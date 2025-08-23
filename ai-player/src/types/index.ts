// Import types from rule engine
export interface GameState {
  id: string;
  phase: 'SETUP_ROUND_1' | 'SETUP_ROUND_2' | 'PRODUCTION' | 'ACTION' | 'GAME_OVER';
  currentPlayerIndex: number;
  players: Player[];
  board: GameBoard;
  developmentCardDeck: string[];
  diceRoll?: [number, number];
  turn: number;
  winner?: string;
}

export interface Player {
  id: string;
  color: string;
  resources: Resources;
  developmentCards: DevelopmentCards;
  buildings: Buildings;
  specialCards: SpecialCards;
  knightsPlayed: number;
  victoryPoints: number;
  canPlayDevCard: boolean;
}

export interface Resources {
  wood: number;
  brick: number;
  wool: number;
  wheat: number;
  ore: number;
}

export interface DevelopmentCards {
  knight: number;
  roadBuilding: number;
  invention: number;
  monopoly: number;
  victoryPoint: number;
}

export interface Buildings {
  roads: string[];
  settlements: string[];
  cities: string[];
}

export interface SpecialCards {
  longestRoad: boolean;
  largestArmy: boolean;
}

export interface GameBoard {
  tiles: Map<string, any>;
  intersections: Map<string, any>;
  edges: Map<string, any>;
  robberLocation: { q: number; r: number };
}

export interface AIDecisionRequest {
  gameState: GameState;
  playerId: string;
  validActions: string[];
  timeoutMs?: number;
}

export interface AIDecisionResponse {
  action: {
    type: string;
    playerId: string;
    payload?: any;
  };
  reasoning?: string;
  confidence?: number;
  processingTimeMs: number;
}

export interface OllamaRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    max_tokens?: number;
    stop?: string[];
  };
}

export interface OllamaResponse {
  response: string;
  done: boolean;
  model: string;
  created_at: string;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface AIPlayerConfig {
  model: string;
  ollamaHost: string;
  ollamaPort: number;
  timeout: number;
  temperature: number;
  fallbackToHeuristic: boolean;
  enableReasoningLog: boolean;
}

export interface HeuristicWeights {
  victoryPoints: number;
  resourceDiversity: number;
  buildingPotential: number;
  blockingOpponents: number;
  tradingAdvantage: number;
}

export interface GameAnalysis {
  playerPosition: 'leading' | 'competitive' | 'behind';
  resourceNeeds: string[];
  buildingOpportunities: Array<{
    type: 'road' | 'settlement' | 'city';
    location: string;
    priority: number;
  }>;
  tradeOpportunities: Array<{
    give: string;
    get: string;
    priority: number;
  }>;
  threats: Array<{
    playerId: string;
    threat: string;
    severity: number;
  }>;
}

export interface ParsedAction {
  type: string;
  playerId: string;
  payload?: any;
}

export interface LLMDecision {
  action: ParsedAction;
  reasoning: string;
}

// Re-export strategic planning types
export * from './strategic-types';
