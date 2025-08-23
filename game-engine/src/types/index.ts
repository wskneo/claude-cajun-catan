import { WebSocket } from 'ws';
import { GameState, Action } from './game-types';

export interface GameSession {
  id: string;
  gameState: GameState;
  players: Map<string, PlayerConnection>;
  aiPlayers: Set<string>;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

export interface PlayerConnection {
  id: string;
  socket?: WebSocket;
  isConnected: boolean;
  isAI: boolean;
  joinedAt: Date;
}

export interface GameEngineConfig {
  port: number;
  maxGames: number;
  gameTimeoutMs: number;
  aiServiceUrl?: string;
  ruleEngineUrl?: string;
}

export interface WebSocketMessage {
  type: MessageType;
  gameId?: string;
  playerId?: string;
  payload?: any;
}

export type MessageType = 
  | 'CREATE_GAME'
  | 'JOIN_GAME'
  | 'LEAVE_GAME'
  | 'GAME_ACTION'
  | 'GAME_STATE_UPDATE'
  | 'GAME_CREATED'
  | 'GAME_JOINED'
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'ACTION_RESULT'
  | 'ERROR'
  | 'PING'
  | 'PONG';

export interface CreateGameRequest {
  playerIds: string[];
  aiPlayers?: string[];
}

export interface JoinGameRequest {
  gameId: string;
  playerId: string;
  isAI?: boolean;
}

export interface GameActionRequest {
  gameId: string;
  playerId: string;
  action: Action;
}

export interface GameStateUpdate {
  gameId: string;
  gameState: GameState;
  validActions: { [playerId: string]: string[] };
}

export interface ActionResult {
  success: boolean;
  gameState?: GameState;
  error?: string;
}

export interface GameEngineStats {
  activeGames: number;
  totalPlayers: number;
  totalAiPlayers: number;
  uptime: number;
}