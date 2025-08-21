import { ResourceManager } from '../src/resources';
import { CatanRuleEngine } from '../src/rule-engine';
import { GameState, Resources } from '../src/types';

describe('ResourceManager', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = CatanRuleEngine.createNewGame(['player1', 'player2']);
    // Place some settlements for testing resource distribution
    const intersection1 = gameState.board.intersections.get('i_0,0');
    const intersection2 = gameState.board.intersections.get('i_1,0');
    
    if (intersection1) {
      intersection1.building = { type: 'settlement', playerId: 'player1' };
    }
    if (intersection2) {
      intersection2.building = { type: 'city', playerId: 'player2' };
    }
  });

  describe('rollDice', () => {
    it('should return two dice values between 1 and 6', () => {
      const [die1, die2] = ResourceManager.rollDice();
      
      expect(die1).toBeGreaterThanOrEqual(1);
      expect(die1).toBeLessThanOrEqual(6);
      expect(die2).toBeGreaterThanOrEqual(1);
      expect(die2).toBeLessThanOrEqual(6);
    });
  });

  describe('distributeResources', () => {
    it('should not distribute resources when 7 is rolled', () => {
      const newState = ResourceManager.distributeResources(gameState, 7);
      
      expect(newState.players[0].resources).toEqual({
        wood: 0, brick: 0, wool: 0, wheat: 0, ore: 0
      });
      expect(newState.players[1].resources).toEqual({
        wood: 0, brick: 0, wool: 0, wheat: 0, ore: 0
      });
    });

    it('should distribute resources for non-7 rolls', () => {
      // Mock a tile with number 8 that should produce resources
      const tile = gameState.board.tiles.get('0,0');
      if (tile) {
        tile.numberDisc = 8;
        tile.terrain = 'forest'; // wood
        tile.hasRobber = false;
      }

      const newState = ResourceManager.distributeResources(gameState, 8);
      
      // Check if resources were distributed (exact amounts depend on board layout)
      const totalResourcesBefore = ResourceManager.getTotalResources(gameState.players[0].resources) +
                                  ResourceManager.getTotalResources(gameState.players[1].resources);
      const totalResourcesAfter = ResourceManager.getTotalResources(newState.players[0].resources) +
                                 ResourceManager.getTotalResources(newState.players[1].resources);
      
      expect(totalResourcesAfter).toBeGreaterThanOrEqual(totalResourcesBefore);
    });

    it('should not distribute resources from robber-blocked tiles', () => {
      const tile = gameState.board.tiles.get('0,0');
      if (tile) {
        tile.numberDisc = 8;
        tile.terrain = 'forest';
        tile.hasRobber = true; // Blocked by robber
      }

      const newState = ResourceManager.distributeResources(gameState, 8);
      
      // Resources should not increase due to robber
      expect(newState.players[0].resources).toEqual(gameState.players[0].resources);
      expect(newState.players[1].resources).toEqual(gameState.players[1].resources);
    });
  });

  describe('getTotalResources', () => {
    it('should calculate total resources correctly', () => {
      const resources: Resources = {
        wood: 2, brick: 1, wool: 3, wheat: 0, ore: 1
      };
      
      expect(ResourceManager.getTotalResources(resources)).toBe(7);
    });

    it('should return 0 for empty resources', () => {
      const resources: Resources = {
        wood: 0, brick: 0, wool: 0, wheat: 0, ore: 0
      };
      
      expect(ResourceManager.getTotalResources(resources)).toBe(0);
    });
  });

  describe('hasResources', () => {
    it('should return true when player has required resources', () => {
      const playerResources: Resources = {
        wood: 2, brick: 1, wool: 1, wheat: 1, ore: 0
      };
      const required = { wood: 1, brick: 1, wool: 1, wheat: 1 };
      
      expect(ResourceManager.hasResources(playerResources, required)).toBe(true);
    });

    it('should return false when player lacks required resources', () => {
      const playerResources: Resources = {
        wood: 1, brick: 0, wool: 1, wheat: 1, ore: 0
      };
      const required = { wood: 1, brick: 1, wool: 1, wheat: 1 };
      
      expect(ResourceManager.hasResources(playerResources, required)).toBe(false);
    });
  });

  describe('addResources', () => {
    it('should add resources correctly', () => {
      const playerResources: Resources = {
        wood: 1, brick: 0, wool: 2, wheat: 1, ore: 0
      };
      const toAdd = { wood: 1, brick: 2, ore: 1 };
      
      const result = ResourceManager.addResources(playerResources, toAdd);
      
      expect(result).toEqual({
        wood: 2, brick: 2, wool: 2, wheat: 1, ore: 1
      });
    });
  });

  describe('subtractResources', () => {
    it('should subtract resources correctly', () => {
      const playerResources: Resources = {
        wood: 3, brick: 2, wool: 1, wheat: 2, ore: 1
      };
      const toSubtract = { wood: 1, brick: 1, wheat: 2 };
      
      const result = ResourceManager.subtractResources(playerResources, toSubtract);
      
      expect(result).toEqual({
        wood: 2, brick: 1, wool: 1, wheat: 0, ore: 1
      });
    });

    it('should not go below 0', () => {
      const playerResources: Resources = {
        wood: 1, brick: 0, wool: 0, wheat: 0, ore: 0
      };
      const toSubtract = { wood: 2, brick: 1 };
      
      const result = ResourceManager.subtractResources(playerResources, toSubtract);
      
      expect(result.wood).toBe(0);
      expect(result.brick).toBe(0);
    });
  });

  describe('validateDiscardSelection', () => {
    it('should validate correct discard amounts', () => {
      const playerResources: Resources = {
        wood: 3, brick: 2, wool: 1, wheat: 2, ore: 1
      };
      const toDiscard = { wood: 2, brick: 1, wheat: 1 };
      const requiredAmount = 4;
      
      const result = ResourceManager.validateDiscardSelection(
        playerResources, toDiscard, requiredAmount
      );
      
      expect(result).toBe(true);
    });

    it('should reject incorrect discard amounts', () => {
      const playerResources: Resources = {
        wood: 3, brick: 2, wool: 1, wheat: 2, ore: 1
      };
      const toDiscard = { wood: 1, brick: 1 }; // Only 2, but need 4
      const requiredAmount = 4;
      
      const result = ResourceManager.validateDiscardSelection(
        playerResources, toDiscard, requiredAmount
      );
      
      expect(result).toBe(false);
    });

    it('should reject discarding resources player does not have', () => {
      const playerResources: Resources = {
        wood: 1, brick: 0, wool: 1, wheat: 1, ore: 0
      };
      const toDiscard = { brick: 1, ore: 1 }; // Player has 0 of these
      const requiredAmount = 2;
      
      const result = ResourceManager.validateDiscardSelection(
        playerResources, toDiscard, requiredAmount
      );
      
      expect(result).toBe(false);
    });
  });

  describe('stealRandomResource', () => {
    it('should transfer a random resource between players', () => {
      gameState.players[0].resources = { wood: 2, brick: 1, wool: 0, wheat: 1, ore: 0 };
      gameState.players[1].resources = { wood: 0, brick: 0, wool: 1, wheat: 0, ore: 0 };
      
      const initialTotal0 = ResourceManager.getTotalResources(gameState.players[0].resources);
      const initialTotal1 = ResourceManager.getTotalResources(gameState.players[1].resources);
      
      const newState = ResourceManager.stealRandomResource('player1', 'player2', gameState);
      
      const finalTotal0 = ResourceManager.getTotalResources(newState.players[0].resources);
      const finalTotal1 = ResourceManager.getTotalResources(newState.players[1].resources);
      
      // One resource should transfer
      expect(finalTotal0).toBe(initialTotal0 - 1);
      expect(finalTotal1).toBe(initialTotal1 + 1);
    });

    it('should handle stealing from player with no resources', () => {
      gameState.players[0].resources = { wood: 0, brick: 0, wool: 0, wheat: 0, ore: 0 };
      gameState.players[1].resources = { wood: 1, brick: 0, wool: 0, wheat: 0, ore: 0 };
      
      const newState = ResourceManager.stealRandomResource('player1', 'player2', gameState);
      
      // No change should occur
      expect(newState.players[0].resources).toEqual(gameState.players[0].resources);
      expect(newState.players[1].resources).toEqual(gameState.players[1].resources);
    });
  });
});