// Main rule engine
export { CatanRuleEngine } from './rule-engine';

// Core types
export * from './types';

// Individual managers (for advanced use cases)
export { BoardGenerator } from './board';
export { ResourceManager } from './resources';
export { BuildingManager } from './building';
export { TradingManager } from './trading';
export { DevelopmentCardManager } from './development-cards';
export { RobberManager } from './robber';
export { VictoryManager } from './victory';

// Utility functions for common operations
export const CatanUtils = {
  // Create a new game
  createGame: (playerIds: string[]) => CatanRuleEngine.createNewGame(playerIds),
  
  // Process an action
  processAction: (gameState: any, action: any) => CatanRuleEngine.processAction(gameState, action),
  
  // Get valid actions for a player
  getValidActions: (gameState: any, playerId: string) => CatanRuleEngine.getValidActions(gameState, playerId),
  
  // Get game summary
  getGameSummary: (gameState: any) => CatanRuleEngine.getGameSummary(gameState),
  
  // Victory point calculations
  calculateVictoryPoints: (player: any) => VictoryManager.calculateVictoryPoints(player),
  getVictoryPointBreakdown: (player: any) => VictoryManager.getVictoryPointBreakdown(player),
  
  // Resource utilities
  getTotalResources: (resources: any) => ResourceManager.getTotalResources(resources),
  hasResources: (playerResources: any, required: any) => ResourceManager.hasResources(playerResources, required),
  
  // Building utilities
  canBuildRoad: (gameState: any, playerId: string, edgeId: string) => 
    BuildingManager.canBuildRoad(gameState, playerId, edgeId),
  canBuildSettlement: (gameState: any, playerId: string, intersectionId: string) =>
    BuildingManager.canBuildSettlement(gameState, playerId, intersectionId),
  canBuildCity: (gameState: any, playerId: string, intersectionId: string) =>
    BuildingManager.canBuildCity(gameState, playerId, intersectionId),
  
  // Trading utilities
  getAvailableTradeRatios: (gameState: any, playerId: string) =>
    TradingManager.getAvailableTradeRatios(gameState, playerId),
  getPossibleBankTrades: (gameState: any, playerId: string) =>
    TradingManager.getPossibleBankTrades(gameState, playerId),
  
  // Development card utilities
  getPlayableDevelopmentCards: (player: any) => 
    DevelopmentCardManager.getPlayableDevelopmentCards(player),
  canBuyDevelopmentCard: (gameState: any, playerId: string) =>
    DevelopmentCardManager.canBuyDevelopmentCard(gameState, playerId),
  
  // Robber utilities
  getValidRobberLocations: (gameState: any) => RobberManager.getValidRobberLocations(gameState),
  getValidStealTargets: (gameState: any, playerId: string) =>
    RobberManager.getValidStealTargets(gameState, playerId),
  getPlayersAdjacentToRobber: (gameState: any) =>
    RobberManager.getPlayersAdjacentToRobber(gameState)
};