// Local type definitions for the Game Engine
// These mirror the types from rule-engine to avoid cross-compilation issues

export interface GameState {
  id: string;
  players: Player[];
  board: any; // Simplified for now
  currentPlayerIndex: number;
  phase: GamePhase;
  diceRoll?: [number, number];
  turnCounter: number;
  winner?: string;
  lastAction?: Action;
}

export interface Player {
  id: string;
  name?: string;
  color: string;
  resources: {
    [key in ResourceType]: number;
  };
  developmentCards: DevelopmentCardType[];
  buildings: {
    settlements: number;
    cities: number;
    roads: number;
  };
  victoryPoints: number;
  longestRoad: number;
  largestArmy: number;
  isBot?: boolean;
}

export interface Action {
  type: ActionType;
  playerId: string;
  payload?: any;
}

export interface GameResult {
  success: boolean;
  gameState?: GameState;
  error?: string;
  validActions?: string[];
}

export type GamePhase = 
  | 'SETUP_ROUND_1'
  | 'SETUP_ROUND_2'
  | 'PLAY'
  | 'GAME_OVER';

export type ResourceType = 
  | 'BRICK'
  | 'LUMBER'
  | 'WOOL'
  | 'GRAIN'
  | 'ORE';

export type DevelopmentCardType =
  | 'KNIGHT'
  | 'VICTORY_POINT'
  | 'ROAD_BUILDING'
  | 'YEAR_OF_PLENTY'
  | 'MONOPOLY';

export type ActionType =
  | 'ROLL_DICE'
  | 'BUILD_ROAD'
  | 'BUILD_SETTLEMENT'
  | 'BUILD_CITY'
  | 'BUY_DEVELOPMENT_CARD'
  | 'PLAY_DEVELOPMENT_CARD'
  | 'TRADE_WITH_PLAYER'
  | 'TRADE_WITH_BANK'
  | 'END_TURN'
  | 'MOVE_ROBBER'
  | 'DISCARD_CARDS';