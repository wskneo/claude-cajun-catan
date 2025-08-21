import { CatanRuleEngine } from '../src/rule-engine';
import { GameState, Action } from '../src/types';

describe('CatanRuleEngine', () => {
  describe('createNewGame', () => {
    it('should create a new game with valid number of players', () => {
      const playerIds = ['player1', 'player2', 'player3'];
      const gameState = CatanRuleEngine.createNewGame(playerIds);

      expect(gameState.players).toHaveLength(3);
      expect(gameState.phase).toBe('SETUP_ROUND_1');
      expect(gameState.currentPlayerIndex).toBe(0);
      expect(gameState.turn).toBe(1);
      expect(gameState.board.tiles.size).toBe(19); // Standard 3-4 player board
    });

    it('should throw error for invalid number of players', () => {
      expect(() => CatanRuleEngine.createNewGame(['player1'])).toThrow('Game requires 2-4 players');
      expect(() => CatanRuleEngine.createNewGame(['p1', 'p2', 'p3', 'p4', 'p5'])).toThrow('Game requires 2-4 players');
    });
  });

  describe('processAction', () => {
    let gameState: GameState;

    beforeEach(() => {
      gameState = CatanRuleEngine.createNewGame(['player1', 'player2']);
    });

    it('should handle valid actions', () => {
      const action: Action = {
        type: 'BUILD_SETTLEMENT',
        playerId: 'player1',
        payload: { intersectionId: 'i_0,0' }
      };

      const result = CatanRuleEngine.processAction(gameState, action);
      expect(result.success).toBe(true);
      expect(result.newState).toBeDefined();
    });

    it('should reject invalid actions', () => {
      const action: Action = {
        type: 'BUILD_SETTLEMENT',
        playerId: 'player2', // Wrong player's turn
        payload: { intersectionId: 'i_0,0' }
      };

      const result = CatanRuleEngine.processAction(gameState, action);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle unknown action types', () => {
      const action = {
        type: 'INVALID_ACTION' as any,
        playerId: 'player1',
        payload: {}
      };

      const result = CatanRuleEngine.processAction(gameState, action);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action type');
    });
  });

  describe('getValidActions', () => {
    it('should return valid actions for setup phase', () => {
      const gameState = CatanRuleEngine.createNewGame(['player1', 'player2']);
      const validActions = CatanRuleEngine.getValidActions(gameState, 'player1');

      expect(validActions).toContain('BUILD_SETTLEMENT');
      expect(validActions).toContain('BUILD_ROAD');
      expect(validActions).not.toContain('ROLL_DICE');
    });

    it('should return empty actions for non-current player', () => {
      const gameState = CatanRuleEngine.createNewGame(['player1', 'player2']);
      const validActions = CatanRuleEngine.getValidActions(gameState, 'player2');

      expect(validActions).toHaveLength(0);
    });
  });

  describe('getGameSummary', () => {
    it('should return correct game summary', () => {
      const gameState = CatanRuleEngine.createNewGame(['player1', 'player2']);
      const summary = CatanRuleEngine.getGameSummary(gameState);

      expect(summary.phase).toBe('SETUP_ROUND_1');
      expect(summary.currentPlayer).toBe('player1');
      expect(summary.turn).toBe(1);
      expect(summary.playerStats).toHaveLength(2);
      expect(summary.playerStats[0].victoryPoints).toBe(0);
    });
  });
});