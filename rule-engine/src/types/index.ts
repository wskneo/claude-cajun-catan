export type ResourceType = 'wood' | 'brick' | 'wool' | 'wheat' | 'ore';

export type TerrainType = 'forest' | 'pasture' | 'field' | 'hill' | 'mountain' | 'desert';

export type DevelopmentCardType = 'knight' | 'roadBuilding' | 'invention' | 'monopoly' | 'victoryPoint';

export type GamePhase = 'SETUP_ROUND_1' | 'SETUP_ROUND_2' | 'PRODUCTION' | 'ACTION' | 'GAME_OVER';

export type ActionType = 
  | 'ROLL_DICE'
  | 'PLAY_DEVELOPMENT_CARD'
  | 'BUILD_ROAD'
  | 'BUILD_SETTLEMENT'
  | 'BUILD_CITY'
  | 'BUY_DEVELOPMENT_CARD'
  | 'TRADE_WITH_PLAYER'
  | 'TRADE_WITH_BANK'
  | 'MOVE_ROBBER'
  | 'DISCARD_RESOURCES'
  | 'END_TURN';

export interface HexCoordinate {
  q: number; // axial coordinate q
  r: number; // axial coordinate r
}

export interface Intersection {
  id: string;
  hexes: HexCoordinate[]; // up to 3 adjacent hexes
  edges: string[]; // 3 connected edge IDs
  building?: {
    type: 'settlement' | 'city';
    playerId: string;
  };
  port?: {
    type: 'generic' | ResourceType;
    ratio: number;
  };
}

export interface Edge {
  id: string;
  intersections: [string, string]; // 2 connected intersection IDs
  road?: {
    playerId: string;
  };
}

export interface Tile {
  coordinate: HexCoordinate;
  terrain: TerrainType;
  numberDisc?: number; // 2-12, undefined for desert
  hasRobber: boolean;
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

export interface Player {
  id: string;
  color: string;
  resources: Resources;
  developmentCards: DevelopmentCards;
  buildings: {
    roads: string[]; // edge IDs
    settlements: string[]; // intersection IDs
    cities: string[]; // intersection IDs
  };
  specialCards: {
    longestRoad: boolean;
    largestArmy: boolean;
  };
  knightsPlayed: number;
  victoryPoints: number;
  canPlayDevCard: boolean;
}

export interface GameBoard {
  tiles: Map<string, Tile>; // key: "q,r"
  intersections: Map<string, Intersection>;
  edges: Map<string, Edge>;
  robberLocation: HexCoordinate;
}

export interface GameState {
  id: string;
  phase: GamePhase;
  currentPlayerIndex: number;
  players: Player[];
  board: GameBoard;
  developmentCardDeck: DevelopmentCardType[];
  diceRoll?: [number, number];
  turn: number;
  winner?: string;
}

export interface Action {
  type: ActionType;
  playerId: string;
  payload?: any;
}

export interface GameResult {
  success: boolean;
  newState?: GameState;
  error?: string;
}

export interface TradeOffer {
  offering: Partial<Resources>;
  requesting: Partial<Resources>;
  fromPlayerId: string;
  toPlayerId?: string; // undefined for bank trades
}

export interface BuildingCosts {
  road: Resources;
  settlement: Resources;
  city: Resources;
  developmentCard: Resources;
}

export const BUILDING_COSTS: BuildingCosts = {
  road: { wood: 1, brick: 1, wool: 0, wheat: 0, ore: 0 },
  settlement: { wood: 1, brick: 1, wool: 1, wheat: 1, ore: 0 },
  city: { wood: 0, brick: 0, wool: 0, wheat: 2, ore: 3 },
  developmentCard: { wood: 0, brick: 0, wool: 1, wheat: 1, ore: 1 }
};