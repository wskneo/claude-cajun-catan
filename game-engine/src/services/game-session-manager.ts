import { v4 as uuidv4 } from 'uuid';
import { GameSession, PlayerConnection } from '../types';
import { GameState, Player } from '../types/game-types';
import { RuleEngineClient } from './rule-engine-client';

export class GameSessionManager {
  private sessions: Map<string, GameSession> = new Map();
  private playerToGame: Map<string, string> = new Map();
  private readonly maxGames: number;
  private readonly gameTimeoutMs: number;
  private ruleEngineClient: RuleEngineClient;

  constructor(maxGames: number = 100, gameTimeoutMs: number = 3600000, ruleEngineUrl?: string) { // 1 hour default
    this.maxGames = maxGames;
    this.gameTimeoutMs = gameTimeoutMs;
    this.ruleEngineClient = new RuleEngineClient(ruleEngineUrl);
    
    // Clean up inactive games every 5 minutes
    setInterval(() => this.cleanupInactiveGames(), 300000);
  }

  async createGame(playerIds: string[], aiPlayers: string[] = []): Promise<GameSession> {
    if (this.sessions.size >= this.maxGames) {
      throw new Error('Maximum number of games reached');
    }

    const allPlayerIds = [...playerIds, ...aiPlayers];
    if (allPlayerIds.length < 2 || allPlayerIds.length > 4) {
      throw new Error('Game requires 2-4 players');
    }

    // Check if any players are already in a game
    for (const playerId of allPlayerIds) {
      if (this.playerToGame.has(playerId)) {
        throw new Error(`Player ${playerId} is already in a game`);
      }
    }

    const gameId = uuidv4();
    const gameState = await this.ruleEngineClient.createNewGame(allPlayerIds);
    
    const players = new Map<string, PlayerConnection>();
    const aiPlayerSet = new Set(aiPlayers);

    for (const playerId of allPlayerIds) {
      players.set(playerId, {
        id: playerId,
        isConnected: !aiPlayerSet.has(playerId), // AI players start as "connected"
        isAI: aiPlayerSet.has(playerId),
        joinedAt: new Date()
      });
      this.playerToGame.set(playerId, gameId);
    }

    const session: GameSession = {
      id: gameId,
      gameState,
      players,
      aiPlayers: aiPlayerSet,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true
    };

    this.sessions.set(gameId, session);
    return session;
  }

  getGame(gameId: string): GameSession | undefined {
    return this.sessions.get(gameId);
  }

  getGameByPlayerId(playerId: string): GameSession | undefined {
    const gameId = this.playerToGame.get(playerId);
    return gameId ? this.sessions.get(gameId) : undefined;
  }

  joinGame(gameId: string, playerId: string): GameSession {
    const session = this.sessions.get(gameId);
    if (!session) {
      throw new Error('Game not found');
    }

    if (!session.isActive) {
      throw new Error('Game is no longer active');
    }

    const playerConnection = session.players.get(playerId);
    if (!playerConnection) {
      throw new Error('Player not part of this game');
    }

    if (this.playerToGame.has(playerId) && this.playerToGame.get(playerId) !== gameId) {
      throw new Error('Player is already in another game');
    }

    playerConnection.isConnected = true;
    this.playerToGame.set(playerId, gameId);
    this.updateLastActivity(gameId);
    
    return session;
  }

  leaveGame(playerId: string): void {
    const gameId = this.playerToGame.get(playerId);
    if (!gameId) {
      return;
    }

    const session = this.sessions.get(gameId);
    if (!session) {
      return;
    }

    const playerConnection = session.players.get(playerId);
    if (playerConnection) {
      playerConnection.isConnected = false;
      playerConnection.socket = undefined;
    }

    this.playerToGame.delete(playerId);
    this.updateLastActivity(gameId);

    // Check if all human players have disconnected
    const humanPlayersConnected = Array.from(session.players.values())
      .filter(p => !p.isAI)
      .some(p => p.isConnected);

    if (!humanPlayersConnected) {
      this.deactivateGame(gameId);
    }
  }

  updateGameState(gameId: string, newGameState: GameState): void {
    const session = this.sessions.get(gameId);
    if (session) {
      session.gameState = newGameState;
      this.updateLastActivity(gameId);
    }
  }

  getAllActiveSessions(): GameSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  getStats(): {
    activeGames: number;
    totalPlayers: number;
    totalAiPlayers: number;
  } {
    const activeSessions = this.getAllActiveSessions();
    
    return {
      activeGames: activeSessions.length,
      totalPlayers: activeSessions.reduce((sum, session) => 
        sum + Array.from(session.players.values()).filter(p => p.isConnected).length, 0),
      totalAiPlayers: activeSessions.reduce((sum, session) => 
        sum + session.aiPlayers.size, 0)
    };
  }

  private updateLastActivity(gameId: string): void {
    const session = this.sessions.get(gameId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  private deactivateGame(gameId: string): void {
    const session = this.sessions.get(gameId);
    if (session) {
      session.isActive = false;
      
      // Remove all players from the game mapping
      for (const playerId of session.players.keys()) {
        this.playerToGame.delete(playerId);
      }
    }
  }

  private cleanupInactiveGames(): void {
    const now = new Date();
    const gamesToRemove: string[] = [];

    for (const [gameId, session] of this.sessions) {
      const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
      
      if (!session.isActive || timeSinceLastActivity > this.gameTimeoutMs) {
        gamesToRemove.push(gameId);
      }
    }

    for (const gameId of gamesToRemove) {
      this.sessions.delete(gameId);
      console.log(`Cleaned up inactive game: ${gameId}`);
    }
  }
}