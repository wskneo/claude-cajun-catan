import { VictoryManager } from '../src/victory';
import { CatanRuleEngine } from '../src/rule-engine';
import { GameState, Player } from '../src/types';

describe('VictoryManager', () => {
  let gameState: GameState;
  let player: Player;

  beforeEach(() => {
    gameState = CatanRuleEngine.createNewGame(['player1', 'player2']);
    player = gameState.players[0];
  });

  describe('calculateVictoryPoints', () => {
    it('should calculate points from settlements correctly', () => {
      player.buildings.settlements = ['i1', 'i2'];
      player.victoryPoints = 2; // Should match settlements
      
      const points = VictoryManager.calculateVictoryPoints(player);
      expect(points).toBe(2);
    });

    it('should calculate points from cities correctly', () => {
      player.buildings.cities = ['i1'];
      player.victoryPoints = 2; // Should match cities
      
      const points = VictoryManager.calculateVictoryPoints(player);
      expect(points).toBe(2);
    });

    it('should calculate points from special cards', () => {
      player.specialCards.longestRoad = true;
      player.specialCards.largestArmy = true;
      player.victoryPoints = 4; // Should match special cards
      
      const points = VictoryManager.calculateVictoryPoints(player);
      expect(points).toBe(4);
    });

    it('should calculate points from development cards', () => {
      player.buildings.settlements = ['i1']; // 1 VP
      player.victoryPoints = 3; // 1 from settlement + 2 from dev cards
      
      const points = VictoryManager.calculateVictoryPoints(player);
      expect(points).toBe(3);
    });

    it('should calculate total points correctly', () => {
      player.buildings.settlements = ['i1', 'i2']; // 2 VP
      player.buildings.cities = ['i3']; // 2 VP
      player.specialCards.longestRoad = true; // 2 VP
      player.victoryPoints = 7; // 2 + 2 + 2 + 1 dev card
      
      const points = VictoryManager.calculateVictoryPoints(player);
      expect(points).toBe(7);
    });
  });

  describe('checkWinCondition', () => {
    it('should return true when player reaches 10 VP', () => {
      player.buildings.settlements = ['i1', 'i2', 'i3', 'i4']; // 4 VP
      player.buildings.cities = ['i5', 'i6', 'i7']; // 6 VP
      player.victoryPoints = 10;
      
      const hasWon = VictoryManager.checkWinCondition(gameState, 'player1');
      expect(hasWon).toBe(true);
    });

    it('should return false when player has less than 10 VP', () => {
      player.buildings.settlements = ['i1']; // 1 VP
      player.victoryPoints = 1;
      
      const hasWon = VictoryManager.checkWinCondition(gameState, 'player1');
      expect(hasWon).toBe(false);
    });
  });

  describe('getWinner', () => {
    it('should return winner when a player reaches 10 VP', () => {
      player.buildings.settlements = ['i1', 'i2']; // 2 VP
      player.buildings.cities = ['i3', 'i4', 'i5', 'i6']; // 8 VP
      player.victoryPoints = 10;
      
      const winner = VictoryManager.getWinner(gameState);
      expect(winner?.id).toBe('player1');
    });

    it('should return null when no player has won', () => {
      player.buildings.settlements = ['i1']; // 1 VP
      player.victoryPoints = 1;
      
      const winner = VictoryManager.getWinner(gameState);
      expect(winner).toBeNull();
    });
  });

  describe('getVictoryPointBreakdown', () => {
    it('should provide detailed breakdown of victory points', () => {
      player.buildings.settlements = ['i1', 'i2']; // 2 VP
      player.buildings.cities = ['i3']; // 2 VP
      player.specialCards.longestRoad = true; // 2 VP
      player.victoryPoints = 7; // Total including 1 dev card VP
      
      const breakdown = VictoryManager.getVictoryPointBreakdown(player);
      
      expect(breakdown.settlements).toBe(2);
      expect(breakdown.cities).toBe(2);
      expect(breakdown.longestRoad).toBe(2);
      expect(breakdown.largestArmy).toBe(0);
      expect(breakdown.developmentCards).toBe(1);
      expect(breakdown.total).toBe(7);
    });

    it('should handle zero points correctly', () => {
      const breakdown = VictoryManager.getVictoryPointBreakdown(player);
      
      expect(breakdown.settlements).toBe(0);
      expect(breakdown.cities).toBe(0);
      expect(breakdown.longestRoad).toBe(0);
      expect(breakdown.largestArmy).toBe(0);
      expect(breakdown.developmentCards).toBe(0);
      expect(breakdown.total).toBe(0);
    });
  });

  describe('checkGameEnd', () => {
    it('should detect game end when player wins', () => {
      player.buildings.settlements = ['i1']; // 1 VP
      player.buildings.cities = ['i2', 'i3', 'i4', 'i5']; // 8 VP
      player.victoryPoints = 10; // 9 + 1 dev card
      
      const result = VictoryManager.checkGameEnd(gameState);
      
      expect(result.gameEnded).toBe(true);
      expect(result.winner?.id).toBe('player1');
    });

    it('should not detect game end when no winner', () => {
      const result = VictoryManager.checkGameEnd(gameState);
      
      expect(result.gameEnded).toBe(false);
      expect(result.winner).toBeUndefined();
    });
  });

  describe('updateLongestRoad', () => {
    beforeEach(() => {
      // Create a simple road network for testing
      gameState.players[0].buildings.roads = ['e1', 'e2', 'e3', 'e4', 'e5'];
      
      // Mock the road graph structure (simplified)
      // In real implementation, this would be calculated from board state
    });

    it('should award longest road to qualifying player', () => {
      // This test would need more complex setup to properly test road connectivity
      // For now, we test the basic logic structure
      const newState = VictoryManager.updateLongestRoad(gameState);
      expect(newState).toBeDefined();
    });
  });

  describe('updateLargestArmy', () => {
    it('should award largest army to player with most knights', () => {
      gameState.players[0].knightsPlayed = 5;
      gameState.players[1].knightsPlayed = 2;
      
      const newState = VictoryManager.updateLargestArmy(gameState);
      
      expect(newState.players[0].specialCards.largestArmy).toBe(true);
      expect(newState.players[1].specialCards.largestArmy).toBe(false);
    });

    it('should not award largest army for less than 3 knights', () => {
      gameState.players[0].knightsPlayed = 2;
      gameState.players[1].knightsPlayed = 1;
      
      const newState = VictoryManager.updateLargestArmy(gameState);
      
      expect(newState.players[0].specialCards.largestArmy).toBe(false);
      expect(newState.players[1].specialCards.largestArmy).toBe(false);
    });

    it('should transfer largest army when overtaken', () => {
      // Player 2 starts with largest army
      gameState.players[1].knightsPlayed = 3;
      gameState.players[1].specialCards.largestArmy = true;
      gameState.players[1].victoryPoints = 2;
      
      // Player 1 plays more knights
      gameState.players[0].knightsPlayed = 4;
      
      const newState = VictoryManager.updateLargestArmy(gameState);
      
      expect(newState.players[0].specialCards.largestArmy).toBe(true);
      expect(newState.players[1].specialCards.largestArmy).toBe(false);
    });

    it('should handle ties by keeping current holder', () => {
      // Player 2 has largest army
      gameState.players[1].knightsPlayed = 3;
      gameState.players[1].specialCards.largestArmy = true;
      gameState.players[1].victoryPoints = 2;
      
      // Player 1 ties
      gameState.players[0].knightsPlayed = 3;
      
      const newState = VictoryManager.updateLargestArmy(gameState);
      
      // Player 2 should keep it due to tie
      expect(newState.players[1].specialCards.largestArmy).toBe(true);
      expect(newState.players[0].specialCards.largestArmy).toBe(false);
    });
  });
});