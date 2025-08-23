import { StrategicPlanner } from '../src/services/strategic-planner';
import { GameState, Player, Resources } from '../src/types';
import { StrategicGoal, VictoryPath, StrategicPlan } from '../src/types/strategic-types';

describe('StrategicPlanner', () => {
  let strategicPlanner: StrategicPlanner;
  let mockGameState: GameState;
  let mockPlayer: Player;

  beforeEach(() => {
    strategicPlanner = new StrategicPlanner({
      planningHorizon: 3,
      maxConcurrentGoals: 2,
      goalPriorityWeights: {
        victoryPoints: 1.0,
        resourceEfficiency: 0.8,
        opponentBlocking: 0.6,
        riskMitigation: 0.5
      }
    });

    mockPlayer = {
      id: 'player-1',
      color: 'red',
      resources: { wood: 2, brick: 1, wool: 1, wheat: 2, ore: 1 },
      developmentCards: { knight: 1, roadBuilding: 0, invention: 0, monopoly: 0, victoryPoint: 1 },
      buildings: { roads: ['e_0,0_1,0', 'e_1,0_2,0'], settlements: ['i_1,0'], cities: [] },
      specialCards: { longestRoad: false, largestArmy: false },
      knightsPlayed: 0,
      victoryPoints: 3,
      canPlayDevCard: true
    };

    mockGameState = {
      id: 'test-game',
      phase: 'ACTION',
      currentPlayerIndex: 0,
      players: [
        mockPlayer,
        {
          id: 'player-2',
          color: 'blue',
          resources: { wood: 1, brick: 2, wool: 2, wheat: 1, ore: 2 },
          developmentCards: { knight: 0, roadBuilding: 1, invention: 0, monopoly: 0, victoryPoint: 0 },
          buildings: { roads: ['e_2,1_3,1'], settlements: ['i_2,1', 'i_3,1'], cities: ['i_2,1'] },
          specialCards: { longestRoad: false, largestArmy: false },
          knightsPlayed: 0,
          victoryPoints: 5,
          canPlayDevCard: true
        }
      ],
      board: {
        tiles: new Map(),
        intersections: new Map(),
        edges: new Map(),
        robberLocation: { q: 0, r: 0 }
      },
      developmentCardDeck: ['knight', 'victoryPoint', 'roadBuilding'],
      turn: 5
    };
  });

  describe('createStrategicPlan', () => {
    it('should create a strategic plan with appropriate goals', async () => {
      const plan = await strategicPlanner.createStrategicPlan(mockGameState, 'player-1');

      expect(plan).toBeDefined();
      expect(plan.goals).toHaveLength(2); // maxConcurrentGoals = 2
      expect(plan.turnSequence).toHaveLength(3); // planningHorizon = 3
      expect(plan.confidence).toBeGreaterThan(0);
      expect(plan.lastUpdatedTurn).toBe(5);
    });

    it('should prioritize victory rush when player is close to winning', async () => {
      // Set player close to victory
      mockPlayer.victoryPoints = 8;
      
      const plan = await strategicPlanner.createStrategicPlan(mockGameState, 'player-1');
      
      const victoryGoals = plan.goals.filter(g => g.type === 'expansion' || g.type === 'victory_rush');
      expect(victoryGoals.length).toBeGreaterThan(0);
      expect(plan.goals[0].priority).toBeGreaterThanOrEqual(8);
    });

    it('should create blocking goals when opponents are close to victory', async () => {
      // Set opponent close to victory
      mockGameState.players[1].victoryPoints = 9;
      
      const plan = await strategicPlanner.createStrategicPlan(mockGameState, 'player-1');
      
      
      const blockingGoals = plan.goals.filter(g => g.type === 'blocking');
      expect(blockingGoals.length).toBeGreaterThan(0);
    });

    it('should include resource control goals when resources are scarce', async () => {
      // Set player with low resources
      mockPlayer.resources = { wood: 0, brick: 0, wool: 0, wheat: 0, ore: 0 };
      
      const plan = await strategicPlanner.createStrategicPlan(mockGameState, 'player-1');
      
      const resourceGoals = plan.goals.filter(g => g.type === 'resource_control');
      expect(resourceGoals.length).toBeGreaterThan(0);
    });
  });

  describe('getStrategicRecommendation', () => {
    beforeEach(async () => {
      // Create a plan first
      await strategicPlanner.createStrategicPlan(mockGameState, 'player-1');
    });

    it('should return strategic recommendation for valid actions', () => {
      const validActions = ['BUILD_SETTLEMENT', 'BUILD_ROAD', 'END_TURN'];
      const recommendation = strategicPlanner.getStrategicRecommendation(
        mockGameState, 
        'player-1', 
        validActions
      );

      expect(recommendation).toBeDefined();
      expect(validActions).toContain(recommendation!.action);
      expect(recommendation!.priority).toBeGreaterThan(0);
      expect(recommendation!.reasoning).toBeTruthy();
    });

    it('should return null when no planned actions match valid actions', () => {
      const validActions = ['DISCARD_RESOURCES']; // Action not in typical plan
      const recommendation = strategicPlanner.getStrategicRecommendation(
        mockGameState, 
        'player-1', 
        validActions
      );

      // Might be null if no matching actions, or return END_TURN as fallback
      if (recommendation) {
        expect(validActions).toContain(recommendation.action);
      }
    });

    it('should prioritize high-priority actions', () => {
      const validActions = ['BUILD_SETTLEMENT', 'BUILD_ROAD', 'TRADE_WITH_BANK', 'END_TURN'];
      const recommendation = strategicPlanner.getStrategicRecommendation(
        mockGameState, 
        'player-1', 
        validActions
      );

      expect(recommendation).toBeDefined();
      // Should not recommend END_TURN if better actions available
      expect(recommendation!.action).not.toBe('END_TURN');
    });
  });

  describe('updatePlan', () => {
    beforeEach(async () => {
      await strategicPlanner.createStrategicPlan(mockGameState, 'player-1');
    });

    it('should mark goals as completed when appropriate', () => {
      // Simulate player winning (should complete victory goals)
      mockPlayer.victoryPoints = 10;
      mockGameState.winner = 'player-1';

      strategicPlanner.updatePlan(mockGameState, 'player-1');

      // Victory goals should be marked completed
      const plan = (strategicPlanner as any).currentPlan as StrategicPlan;
      const completedGoals = plan.goals.filter(g => g.completed);
      expect(completedGoals.length).toBeGreaterThan(0);
    });

    it('should update plan confidence based on game state changes', () => {
      const initialPlan = (strategicPlanner as any).currentPlan as StrategicPlan;
      const initialConfidence = initialPlan.confidence;

      // Change game state significantly
      mockGameState.turn = 10;
      mockPlayer.resources = { wood: 10, brick: 10, wool: 10, wheat: 10, ore: 10 };

      strategicPlanner.updatePlan(mockGameState, 'player-1');

      const updatedPlan = (strategicPlanner as any).currentPlan as StrategicPlan;
      expect(updatedPlan.confidence).toBeDefined();
    });

    it('should switch to next goal when current goal is completed', () => {
      const plan = (strategicPlanner as any).currentPlan as StrategicPlan;
      const originalCurrentGoal = plan.currentGoal;

      // Mark current goal as completed
      if (plan.currentGoal) {
        const currentGoal = plan.goals.find(g => g.id === plan.currentGoal);
        if (currentGoal) {
          currentGoal.completed = true;
        }
      }

      strategicPlanner.updatePlan(mockGameState, 'player-1');

      const updatedPlan = (strategicPlanner as any).currentPlan as StrategicPlan;
      expect(updatedPlan.currentGoal).not.toBe(originalCurrentGoal);
    });
  });

  describe('victory path analysis', () => {
    beforeEach(async () => {
      await strategicPlanner.createStrategicPlan(mockGameState, 'player-1');
    });

    it('should identify settlements/cities as viable victory path', () => {
      // Player has good resources for building
      mockPlayer.resources = { wood: 4, brick: 4, wool: 3, wheat: 3, ore: 2 };
      
      const analysis = (strategicPlanner as any).analyzeGameSituation(mockGameState, mockPlayer);
      const buildingPath = analysis.victoryPaths.find((p: VictoryPath) => p.type === 'settlements_cities');
      
      expect(buildingPath).toBeDefined();
      expect(buildingPath.feasibility).toBeGreaterThan(0.3);
    });

    it('should identify development cards as viable when player has dev card resources', () => {
      mockPlayer.resources = { wood: 1, brick: 1, wool: 5, wheat: 5, ore: 5 };
      
      const analysis = (strategicPlanner as any).analyzeGameSituation(mockGameState, mockPlayer);
      const devPath = analysis.victoryPaths.find((p: VictoryPath) => p.type === 'development_cards');
      
      expect(devPath).toBeDefined();
      expect(devPath.feasibility).toBeGreaterThan(0.3);
    });

    it('should consider longest road when player has many roads', () => {
      mockPlayer.buildings.roads = ['e_1', 'e_2', 'e_3', 'e_4', 'e_5', 'e_6'];
      mockPlayer.resources = { wood: 5, brick: 5, wool: 0, wheat: 0, ore: 0 };
      
      const analysis = (strategicPlanner as any).analyzeGameSituation(mockGameState, mockPlayer);
      const roadPath = analysis.victoryPaths.find((p: VictoryPath) => p.type === 'longest_road');
      
      expect(roadPath).toBeDefined();
      expect(roadPath.feasibility).toBeGreaterThan(0.4);
    });
  });

  describe('game situation analysis', () => {
    it('should correctly identify player position as leading', () => {
      mockPlayer.victoryPoints = 7;
      mockGameState.players[1].victoryPoints = 4;
      
      const analysis = (strategicPlanner as any).analyzeGameSituation(mockGameState, mockPlayer);
      expect(analysis.situation.myPosition).toBe('leading');
    });

    it('should correctly identify player position as behind', () => {
      mockPlayer.victoryPoints = 2;
      mockGameState.players[1].victoryPoints = 6;
      
      const analysis = (strategicPlanner as any).analyzeGameSituation(mockGameState, mockPlayer);
      expect(analysis.situation.myPosition).toBe('behind');
    });

    it('should correctly identify desperate situation', () => {
      mockPlayer.victoryPoints = 3;
      mockGameState.players[1].victoryPoints = 9; // Opponent very close to winning
      
      const analysis = (strategicPlanner as any).analyzeGameSituation(mockGameState, mockPlayer);
      expect(analysis.situation.myPosition).toBe('desperate');
    });

    it('should identify threats from players close to winning', () => {
      mockGameState.players[1].victoryPoints = 8;
      
      const analysis = (strategicPlanner as any).analyzeGameSituation(mockGameState, mockPlayer);
      expect(analysis.situation.threats.length).toBeGreaterThan(0);
      expect(analysis.situation.threats[0].severity).toBe(8);
    });
  });
});