import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { WebSocketManager } from './services/websocket-manager';
import { GameSessionManager } from './services/game-session-manager';
import { AICoordinator } from './services/ai-coordinator';
import { GameEngineConfig, WebSocketMessage, GameActionRequest, CreateGameRequest, JoinGameRequest } from './types';
import { RuleEngineClient } from './services/rule-engine-client';
import { WebSocket } from 'ws';

export class GameEngine {
  private app: express.Application;
  private wsManager: WebSocketManager;
  private sessionManager: GameSessionManager;
  private aiCoordinator: AICoordinator;
  private ruleEngineClient: RuleEngineClient;
  private config: GameEngineConfig;
  constructor(config: GameEngineConfig) {
    this.config = config;
    this.app = express();
    this.wsManager = new WebSocketManager();
    this.sessionManager = new GameSessionManager(config.maxGames, config.gameTimeoutMs, config.ruleEngineUrl);
    this.aiCoordinator = new AICoordinator(config.aiServiceUrl);
    this.ruleEngineClient = new RuleEngineClient(config.ruleEngineUrl);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        ...this.sessionManager.getStats()
      });
    });

    // Game stats
    this.app.get('/stats', (req, res) => {
      res.json({
        ...this.sessionManager.getStats(),
        connections: this.wsManager.getConnectionCount(),
        aiServiceConfigured: this.aiCoordinator.isConfigured()
      });
    });

    // Create game endpoint (REST fallback)
    this.app.post('/games', async (req, res) => {
      try {
        const { playerIds, aiPlayers } = req.body as CreateGameRequest;
        const session = await this.sessionManager.createGame(playerIds, aiPlayers || []);
        res.json({
          gameId: session.id,
          gameState: session.gameState,
          players: Array.from(session.players.keys())
        });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });
  }

  private setupWebSocket(): void {
    this.wsManager.initialize(this.config.port + 1); // WebSocket on port+1

    this.wsManager.on('message', (ws?: WebSocket, message?: WebSocketMessage) => {
      if (ws && message) {
        this.handleWebSocketMessage(ws, message);
      }
    });

    this.wsManager.on('disconnect', (ws?: WebSocket, playerId?: string) => {
      if (playerId) {
        this.sessionManager.leaveGame(playerId);
      }
    });
  }

  private async handleWebSocketMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'CREATE_GAME':
          await this.handleCreateGame(ws, message);
          break;

        case 'JOIN_GAME':
          await this.handleJoinGame(ws, message);
          break;

        case 'LEAVE_GAME':
          await this.handleLeaveGame(ws, message);
          break;

        case 'GAME_ACTION':
          await this.handleGameAction(ws, message);
          break;

        default:
          this.wsManager.sendError(ws, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.wsManager.sendError(ws, (error as Error).message, message.gameId);
    }
  }

  private async handleCreateGame(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    const request = message.payload as CreateGameRequest;
    const session = await this.sessionManager.createGame(request.playerIds, request.aiPlayers || []);

    // Register creator's connection
    if (request.playerIds.length > 0) {
      this.wsManager.registerConnection(request.playerIds[0], ws);
    }

    this.wsManager.send(ws, {
      type: 'GAME_CREATED',
      gameId: session.id,
      payload: {
        gameId: session.id,
        gameState: session.gameState,
        players: Array.from(session.players.keys())
      }
    });

    // Start game if all players are ready (AI players are always ready)
    await this.checkAndStartGame(session.id);
  }

  private async handleJoinGame(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    const request = message.payload as JoinGameRequest;
    const session = this.sessionManager.joinGame(request.gameId, request.playerId);

    this.wsManager.registerConnection(request.playerId, ws);

    this.wsManager.send(ws, {
      type: 'GAME_JOINED',
      gameId: session.id,
      payload: {
        gameState: session.gameState,
        playerId: request.playerId
      }
    });

    // Notify other players
    const otherPlayerIds = Array.from(session.players.keys()).filter(id => id !== request.playerId);
    this.wsManager.sendToPlayers(otherPlayerIds, {
      type: 'PLAYER_JOINED',
      gameId: session.id,
      payload: {
        playerId: request.playerId
      }
    });

    await this.checkAndStartGame(session.id);
  }

  private async handleLeaveGame(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    if (!message.playerId) {
      this.wsManager.sendError(ws, 'Player ID required');
      return;
    }

    const session = this.sessionManager.getGameByPlayerId(message.playerId);
    if (session) {
      const otherPlayerIds = Array.from(session.players.keys()).filter(id => id !== message.playerId);
      
      this.sessionManager.leaveGame(message.playerId);
      
      // Notify other players
      this.wsManager.sendToPlayers(otherPlayerIds, {
        type: 'PLAYER_LEFT',
        gameId: session.id,
        payload: {
          playerId: message.playerId
        }
      });
    }
  }

  private async handleGameAction(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    const request = message.payload as GameActionRequest;
    const session = this.sessionManager.getGame(request.gameId);

    if (!session) {
      this.wsManager.sendError(ws, 'Game not found', request.gameId);
      return;
    }

    // Validate it's the player's turn
    const currentPlayer = session.gameState.players[session.gameState.currentPlayerIndex];
    if (currentPlayer.id !== request.playerId) {
      this.wsManager.sendError(ws, 'Not your turn', request.gameId);
      return;
    }

    // Apply action through rule engine
    const result = await this.ruleEngineClient.processAction(session.gameState, request.action);

    if (result.success && result.gameState) {
      // Update session with new game state
      this.sessionManager.updateGameState(request.gameId, result.gameState);

      // Broadcast updated game state to all players
      const allPlayerIds = Array.from(session.players.keys());
      this.wsManager.broadcastToGame(request.gameId, allPlayerIds, {
        type: 'GAME_STATE_UPDATE',
        payload: {
          gameId: request.gameId,
          gameState: result.gameState
        }
      });

      // Check if it's now an AI player's turn
      await this.processAITurnIfNeeded(request.gameId);
    } else {
      // Send error back to the player
      this.wsManager.sendErrorToPlayer(request.playerId, result.error || 'Invalid action', request.gameId);
    }
  }

  private async checkAndStartGame(gameId: string): Promise<void> {
    const session = this.sessionManager.getGame(gameId);
    if (!session) return;

    // Check if all human players are connected
    const humanPlayers = Array.from(session.players.values()).filter(p => !p.isAI);
    const allHumansConnected = humanPlayers.every(p => p.isConnected);

    if (allHumansConnected && session.gameState.phase === 'SETUP_ROUND_1') {
      // Game can start
      const allPlayerIds = Array.from(session.players.keys());
      this.wsManager.broadcastToGame(gameId, allPlayerIds, {
        type: 'GAME_STATE_UPDATE',
        payload: {
          gameId,
          gameState: session.gameState
        }
      });

      // Process AI turn if the first player is AI
      await this.processAITurnIfNeeded(gameId);
    }
  }

  private async processAITurnIfNeeded(gameId: string): Promise<void> {
    const session = this.sessionManager.getGame(gameId);
    if (!session) return;

    const currentPlayer = session.gameState.players[session.gameState.currentPlayerIndex];
    const playerConnection = session.players.get(currentPlayer.id);

    if (playerConnection?.isAI) {
      console.log(`Processing AI turn for player ${currentPlayer.id}`);
      
      // Get valid actions for current game state
      const validActions = await this.ruleEngineClient.getValidActions(session.gameState, currentPlayer.id);
      
      // Get AI decision
      const aiAction = await this.aiCoordinator.getAIDecision(
        session.gameState,
        currentPlayer.id,
        validActions
      );

      if (aiAction) {
        // Apply AI action
        const result = await this.ruleEngineClient.processAction(session.gameState, aiAction);
        
        if (result.success && result.gameState) {
          this.sessionManager.updateGameState(gameId, result.gameState);
          
          // Broadcast update to all players
          const allPlayerIds = Array.from(session.players.keys());
          this.wsManager.broadcastToGame(gameId, allPlayerIds, {
            type: 'GAME_STATE_UPDATE',
            payload: {
              gameId,
              gameState: result.gameState
            }
          });

          // Check if another AI turn is needed
          setTimeout(() => this.processAITurnIfNeeded(gameId), 1000); // Small delay for better UX
        } else {
          console.error(`AI action failed for player ${currentPlayer.id}:`, result.error);
        }
      } else {
        console.warn(`No valid AI action found for player ${currentPlayer.id}`);
      }
    }
  }

  start(): void {
    this.app.listen(this.config.port, () => {
      console.log(`Game Engine HTTP server started on port ${this.config.port}`);
      console.log(`Game Engine WebSocket server started on port ${this.config.port + 1}`);
      console.log(`AI Service URL: ${this.config.aiServiceUrl || 'Not configured'}`);
    });
  }

  stop(): void {
    this.wsManager.close();
    console.log('Game Engine stopped');
  }
}

// Default configuration
const defaultConfig: GameEngineConfig = {
  port: 3000,
  maxGames: 100,
  gameTimeoutMs: 3600000, // 1 hour
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:3001',
  ruleEngineUrl: process.env.RULE_ENGINE_URL || 'http://localhost:3002'
};

// Start the game engine if this file is run directly
if (require.main === module) {
  const gameEngine = new GameEngine(defaultConfig);
  gameEngine.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down Game Engine...');
    gameEngine.stop();
    process.exit(0);
  });
}

export { GameEngineConfig };
export default GameEngine;