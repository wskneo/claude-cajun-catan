/**
 * Types for strategic planning and multi-turn decision making
 */

export interface StrategicGoal {
  id: string;
  type: 'victory_rush' | 'resource_control' | 'expansion' | 'blocking' | 'development';
  priority: number; // 1-10, higher = more important
  description: string;
  targetTurns: number; // Expected turns to complete
  requiredResources?: Partial<import('./index').Resources>;
  requiredActions?: string[]; // Action types needed
  victoryPointValue: number; // VP contribution
  completed: boolean;
}

export interface StrategicPlan {
  goals: StrategicGoal[];
  currentGoal?: string; // Active goal ID
  turnSequence: PlannedTurn[];
  lastUpdatedTurn: number;
  confidence: number; // 0-1, plan reliability
}

export interface PlannedTurn {
  turnNumber: number;
  goalId: string;
  plannedActions: PlannedAction[];
  expectedResources: import('./index').Resources;
  contingencies: PlannedAction[]; // Backup actions
}

export interface PlannedAction {
  type: string;
  priority: number;
  payload?: any;
  resourceCost?: Partial<import('./index').Resources>;
  expectedOutcome: string;
  conditions?: string[]; // Prerequisites for this action
}

export interface VictoryPath {
  type: 'settlements_cities' | 'longest_road' | 'largest_army' | 'development_cards' | 'mixed';
  currentProgress: number; // Current VP from this path
  targetVP: number; // VP needed to win via this path
  estimatedTurns: number;
  feasibility: number; // 0-1, how achievable this path is
  requirements: {
    resources: Partial<import('./index').Resources>;
    actions: string[];
    turns: number;
  };
}

export interface GameSituation {
  myPosition: 'leading' | 'competitive' | 'behind' | 'desperate';
  turnsRemaining: number; // Estimated turns before someone wins
  threats: Array<{
    playerId: string;
    type: 'near_victory' | 'resource_monopoly' | 'positional_advantage';
    severity: number; // 1-10
    countermeasures: string[];
  }>;
  opportunities: Array<{
    type: 'expansion' | 'resource_access' | 'blocking' | 'trading';
    value: number;
    difficulty: number;
    timeframe: 'immediate' | 'short_term' | 'long_term';
  }>;
}

export interface StrategicAnalysis {
  situation: GameSituation;
  victoryPaths: VictoryPath[];
  recommendedStrategy: 'aggressive_expansion' | 'defensive_blocking' | 'resource_accumulation' | 'development_focus';
  keyFactors: Array<{
    factor: string;
    impact: number; // -10 to 10
    description: string;
  }>;
}

export interface StrategicPlannerConfig {
  planningHorizon: number; // How many turns to plan ahead
  replanThreshold: number; // Change threshold to trigger replanning
  goalPriorityWeights: {
    victoryPoints: number;
    resourceEfficiency: number;
    opponentBlocking: number;
    riskMitigation: number;
  };
  enableOpportunisticPlanning: boolean; // Adapt plan for immediate opportunities
  maxConcurrentGoals: number; // How many goals to pursue simultaneously
}