import { HeuristicAI } from '../src/heuristics/heuristic-ai';
import { GameState, Player } from '../src/types';

describe('HeuristicAI', () => {
  let heuristicAI: HeuristicAI;
  let mockGameState: GameState;
  let mockPlayer: Player;

  beforeEach(() => {
    heuristicAI = new HeuristicAI();
    
    mockPlayer = {
      id: 'player1',
      color: 'red',
      resources: { wood: 2, brick: 1, wool: 1, wheat: 1, ore: 0 },
      developmentCards: { knight: 0, roadBuilding: 0, invention: 0, monopoly: 0, victoryPoint: 0 },
      buildings: { roads: [], settlements: [], cities: [] },
      specialCards: { longestRoad: false, largestArmy: false },
      knightsPlayed: 0,
      victoryPoints: 0,
      canPlayDevCard: true
    };

    mockGameState = {
      id: 'test-game',
      phase: 'ACTION',
      currentPlayerIndex: 0,
      players: [mockPlayer],
      board: {} as any,
      developmentCardDeck: [],
      turn: 1
    };
  });

  describe('makeDecision', () => {
    it('should make setup decisions during setup phases', () => {
      mockGameState.phase = 'SETUP_ROUND_1';
      const validActions = ['BUILD_SETTLEMENT', 'BUILD_ROAD'];

      const decision = heuristicAI.makeDecision(mockGameState, 'player1', validActions);

      expect(decision.type).toBe('BUILD_SETTLEMENT');
      expect(decision.playerId).toBe('player1');
    });

    it('should roll dice during production phase', () => {
      mockGameState.phase = 'PRODUCTION';
      const validActions = ['ROLL_DICE', 'PLAY_DEVELOPMENT_CARD'];

      const decision = heuristicAI.makeDecision(mockGameState, 'player1', validActions);

      expect(decision.type).toBe('ROLL_DICE');
    });

    it('should prioritize victory points when close to winning', () => {
      mockPlayer.victoryPoints = 9;
      mockPlayer.developmentCards.victoryPoint = 1;
      const validActions = ['PLAY_DEVELOPMENT_CARD', 'BUILD_ROAD', 'END_TURN'];

      const decision = heuristicAI.makeDecision(mockGameState, 'player1', validActions);

      expect(decision.type).toBe('PLAY_DEVELOPMENT_CARD');
      expect(decision.payload?.cardType).toBe('victoryPoint');
    });

    it('should consider building when resources are available', () => {
      // Player has resources for settlement
      mockPlayer.resources = { wood: 1, brick: 1, wool: 1, wheat: 1, ore: 0 };
      const validActions = ['BUILD_SETTLEMENT', 'BUILD_ROAD', 'END_TURN'];

      const decision = heuristicAI.makeDecision(mockGameState, 'player1', validActions);

      expect(decision.type).toBe('BUILD_SETTLEMENT');
    });

    it('should prioritize cities over settlements for efficiency', () => {
      mockPlayer.resources = { wood: 0, brick: 0, wool: 0, wheat: 3, ore: 4 };
      mockPlayer.buildings.settlements = ['i_0,0'];
      const validActions = ['BUILD_CITY', 'BUILD_SETTLEMENT', 'END_TURN'];

      const decision = heuristicAI.makeDecision(mockGameState, 'player1', validActions);

      expect(decision.type).toBe('BUILD_CITY');
    });

    it('should consider trading when having excess resources', () => {
      mockPlayer.resources = { wood: 8, brick: 0, wool: 0, wheat: 0, ore: 0 };
      const validActions = ['TRADE_WITH_BANK', 'END_TURN'];

      const decision = heuristicAI.makeDecision(mockGameState, 'player1', validActions);

      expect(decision.type).toBe('TRADE_WITH_BANK');
    });

    it('should buy development cards when affordable', () => {
      mockPlayer.resources = { wood: 0, brick: 0, wool: 2, wheat: 2, ore: 2 };
      const validActions = ['BUY_DEVELOPMENT_CARD', 'END_TURN'];

      const decision = heuristicAI.makeDecision(mockGameState, 'player1', validActions);

      expect(decision.type).toBe('BUY_DEVELOPMENT_CARD');
    });

    it('should end turn when no beneficial actions available', () => {
      mockPlayer.resources = { wood: 0, brick: 0, wool: 0, wheat: 0, ore: 0 };
      const validActions = ['END_TURN'];

      const decision = heuristicAI.makeDecision(mockGameState, 'player1', validActions);

      expect(decision.type).toBe('END_TURN');
    });

    it('should handle knight card strategically during production', () => {
      mockGameState.phase = 'PRODUCTION';
      mockPlayer.developmentCards.knight = 1;
      
      // Add a threatening opponent
      const threateningPlayer: Player = {
        ...mockPlayer,
        id: 'player2',
        victoryPoints: 8
      };
      mockGameState.players.push(threateningPlayer);

      const validActions = ['PLAY_DEVELOPMENT_CARD', 'ROLL_DICE'];

      const decision = heuristicAI.makeDecision(mockGameState, 'player1', validActions);

      expect(decision.type).toBe('PLAY_DEVELOPMENT_CARD');
      expect(decision.payload?.cardType).toBe('knight');
      expect(decision.payload?.targetPlayerId).toBe('player2');
    });

    it('should handle unknown player gracefully', () => {
      expect(() => {
        heuristicAI.makeDecision(mockGameState, 'unknown-player', ['END_TURN']);
      }).toThrow('Player unknown-player not found');
    });
  });

  describe('resource analysis', () => {
    it('should identify resource needs correctly', () => {
      // Test internal logic by checking decisions made
      mockPlayer.resources = { wood: 0, brick: 0, wool: 1, wheat: 1, ore: 1 };
      const validActions = ['TRADE_WITH_BANK', 'END_TURN'];

      const decision = heuristicAI.makeDecision(mockGameState, 'player1', validActions);

      // Should not trade since don't have enough excess resources
      expect(decision.type).toBe('END_TURN');
    });

    it('should recognize when player can afford buildings', () => {
      mockPlayer.resources = { wood: 1, brick: 1, wool: 1, wheat: 1, ore: 0 };
      const validActions = ['BUILD_SETTLEMENT', 'END_TURN'];

      const decision = heuristicAI.makeDecision(mockGameState, 'player1', validActions);

      expect(decision.type).toBe('BUILD_SETTLEMENT');
    });
  });

  describe('strategic priorities', () => {
    it('should handle multiple valid building options', () => {
      mockPlayer.resources = { wood: 2, brick: 2, wool: 2, wheat: 4, ore: 4 };
      mockPlayer.buildings.settlements = ['i_0,0'];
      const validActions = ['BUILD_CITY', 'BUILD_SETTLEMENT', 'BUILD_ROAD', 'END_TURN'];

      const decision = heuristicAI.makeDecision(mockGameState, 'player1', validActions);

      // Should prioritize city for VP efficiency
      expect(decision.type).toBe('BUILD_CITY');
    });

    it('should fallback to safe actions when parsing fails', () => {
      const validActions = ['BUILD_ROAD', 'COMPLEX_ACTION', 'END_TURN'];

      const decision = heuristicAI.makeDecision(mockGameState, 'player1', validActions);

      expect(decision.type).toBe('END_TURN'); // Safe fallback
    });
  });
});