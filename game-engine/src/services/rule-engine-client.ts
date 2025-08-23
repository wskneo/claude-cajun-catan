import axios from 'axios';
import { GameState, Action, GameResult } from '../types/game-types';

export class RuleEngineClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3002') {
    this.baseUrl = baseUrl;
  }

  async createNewGame(playerIds: string[]): Promise<GameState> {
    try {
      const response = await axios.post<GameState>(`${this.baseUrl}/game/create`, {
        playerIds
      });
      return response.data;
    } catch (error) {
      console.error('Failed to create game via rule engine:', error);
      // Fallback: create a basic game state
      return this.createFallbackGameState(playerIds);
    }
  }

  async processAction(gameState: GameState, action: Action): Promise<GameResult> {
    try {
      const response = await axios.post<GameResult>(`${this.baseUrl}/game/action`, {
        gameState,
        action
      });
      return response.data;
    } catch (error) {
      console.error('Failed to process action via rule engine:', error);
      return {
        success: false,
        error: 'Rule engine communication failed'
      };
    }
  }

  async getValidActions(gameState: GameState, playerId: string): Promise<string[]> {
    try {
      const response = await axios.post<{actions: string[]}>(`${this.baseUrl}/game/valid-actions`, {
        gameState,
        playerId
      });
      return response.data.actions || [];
    } catch (error) {
      console.error('Failed to get valid actions via rule engine:', error);
      // Fallback: return basic actions based on game phase
      return this.getFallbackActions(gameState, playerId);
    }
  }

  private createFallbackGameState(playerIds: string[]): GameState {
    const players = playerIds.map((id, index) => ({
      id,
      name: `Player ${index + 1}`,
      color: ['red', 'blue', 'green', 'yellow'][index] || 'gray',
      resources: {
        BRICK: 0,
        LUMBER: 0,
        WOOL: 0,
        GRAIN: 0,
        ORE: 0
      },
      developmentCards: [],
      buildings: {
        settlements: 5,
        cities: 4,
        roads: 15
      },
      victoryPoints: 0,
      longestRoad: 0,
      largestArmy: 0,
      isBot: false
    }));

    return {
      id: `game-${Date.now()}`,
      players,
      board: {}, // Simplified board
      currentPlayerIndex: 0,
      phase: 'SETUP_ROUND_1',
      turnCounter: 1
    };
  }

  private getFallbackActions(gameState: GameState, playerId: string): string[] {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.id !== playerId) {
      return [];
    }

    switch (gameState.phase) {
      case 'SETUP_ROUND_1':
      case 'SETUP_ROUND_2':
        return ['BUILD_SETTLEMENT', 'BUILD_ROAD'];
      case 'PLAY':
        if (!gameState.diceRoll) {
          return ['ROLL_DICE'];
        }
        return ['BUILD_ROAD', 'BUILD_SETTLEMENT', 'BUILD_CITY', 'BUY_DEVELOPMENT_CARD', 'END_TURN'];
      case 'GAME_OVER':
        return [];
      default:
        return ['END_TURN'];
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/health`);
      return response.status === 200;
    } catch {
      return false;
    }
  }
}