import { GameState, Player, Resources, BUILDING_COSTS } from './types';
import { ResourceManager } from './resources';

export class BuildingManager {
  static canBuildRoad(
    gameState: GameState, 
    playerId: string, 
    edgeId: string
  ): { valid: boolean; error?: string } {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { valid: false, error: 'Player not found' };
    }

    // Check if player has resources (skip during setup)
    if (gameState.phase !== 'SETUP_ROUND_1' && gameState.phase !== 'SETUP_ROUND_2') {
      if (!ResourceManager.hasResources(player.resources, BUILDING_COSTS.road)) {
        return { valid: false, error: 'Insufficient resources for road' };
      }
    }

    // Check if edge exists and is empty
    const edge = gameState.board.edges.get(edgeId);
    if (!edge) {
      return { valid: false, error: 'Invalid edge location' };
    }

    if (edge.road) {
      return { valid: false, error: 'Edge already has a road' };
    }

    // Check connectivity - road must connect to existing road or building
    if (!this.isRoadConnected(gameState, playerId, edgeId)) {
      return { valid: false, error: 'Road must connect to existing road or building' };
    }

    return { valid: true };
  }

  static canBuildSettlement(
    gameState: GameState, 
    playerId: string, 
    intersectionId: string
  ): { valid: boolean; error?: string } {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { valid: false, error: 'Player not found' };
    }

    // Check if player has resources (skip during setup)
    if (gameState.phase !== 'SETUP_ROUND_1' && gameState.phase !== 'SETUP_ROUND_2') {
      if (!ResourceManager.hasResources(player.resources, BUILDING_COSTS.settlement)) {
        return { valid: false, error: 'Insufficient resources for settlement' };
      }
    }

    // Check if intersection exists and is empty
    const intersection = gameState.board.intersections.get(intersectionId);
    if (!intersection) {
      return { valid: false, error: 'Invalid intersection location' };
    }

    if (intersection.building) {
      return { valid: false, error: 'Intersection already has a building' };
    }

    // Check distance rule - no settlements within 2 edges
    const distanceValid = this.checkDistanceRule(gameState, intersectionId);
    if (!distanceValid.valid) {
      return distanceValid;
    }

    // During setup phase, no connectivity check needed
    if (gameState.phase === 'SETUP_ROUND_1' || gameState.phase === 'SETUP_ROUND_2') {
      return { valid: true };
    }

    // Check connectivity - settlement must connect to player's road
    if (!this.isSettlementConnected(gameState, playerId, intersectionId)) {
      return { valid: false, error: 'Settlement must connect to your road' };
    }

    return { valid: true };
  }

  static canBuildCity(
    gameState: GameState, 
    playerId: string, 
    intersectionId: string
  ): { valid: boolean; error?: string } {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { valid: false, error: 'Player not found' };
    }

    // Check if player has resources
    if (!ResourceManager.hasResources(player.resources, BUILDING_COSTS.city)) {
      return { valid: false, error: 'Insufficient resources for city' };
    }

    // Check if intersection has player's settlement
    const intersection = gameState.board.intersections.get(intersectionId);
    if (!intersection) {
      return { valid: false, error: 'Invalid intersection location' };
    }

    if (!intersection.building || 
        intersection.building.type !== 'settlement' || 
        intersection.building.playerId !== playerId) {
      return { valid: false, error: 'Can only upgrade your own settlements to cities' };
    }

    return { valid: true };
  }

  static buildRoad(gameState: GameState, playerId: string, edgeId: string): GameState {
    const validation = this.canBuildRoad(gameState, playerId, edgeId);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const newState = { ...gameState };
    const playerIndex = newState.players.findIndex(p => p.id === playerId);
    const player = newState.players[playerIndex];

    // Deduct resources
    newState.players[playerIndex].resources = ResourceManager.subtractResources(
      player.resources,
      BUILDING_COSTS.road
    );

    // Place road
    const edge = newState.board.edges.get(edgeId)!;
    edge.road = { playerId };
    
    // Add to player's buildings
    newState.players[playerIndex].buildings.roads.push(edgeId);

    return newState;
  }

  static buildSettlement(gameState: GameState, playerId: string, intersectionId: string): GameState {
    const validation = this.canBuildSettlement(gameState, playerId, intersectionId);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const newState = { ...gameState };
    const playerIndex = newState.players.findIndex(p => p.id === playerId);
    const player = newState.players[playerIndex];

    // Deduct resources (except during setup)
    if (gameState.phase !== 'SETUP_ROUND_1' && gameState.phase !== 'SETUP_ROUND_2') {
      newState.players[playerIndex].resources = ResourceManager.subtractResources(
        player.resources,
        BUILDING_COSTS.settlement
      );
    }

    // Place settlement
    const intersection = newState.board.intersections.get(intersectionId)!;
    intersection.building = { type: 'settlement', playerId };
    
    // Add to player's buildings
    newState.players[playerIndex].buildings.settlements.push(intersectionId);

    // Update victory points
    newState.players[playerIndex].victoryPoints += 1;

    return newState;
  }

  static buildCity(gameState: GameState, playerId: string, intersectionId: string): GameState {
    const validation = this.canBuildCity(gameState, playerId, intersectionId);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const newState = { ...gameState };
    const playerIndex = newState.players.findIndex(p => p.id === playerId);
    const player = newState.players[playerIndex];

    // Deduct resources
    newState.players[playerIndex].resources = ResourceManager.subtractResources(
      player.resources,
      BUILDING_COSTS.city
    );

    // Upgrade settlement to city
    const intersection = newState.board.intersections.get(intersectionId)!;
    intersection.building = { type: 'city', playerId };
    
    // Remove from settlements, add to cities
    const settlementIndex = newState.players[playerIndex].buildings.settlements.indexOf(intersectionId);
    newState.players[playerIndex].buildings.settlements.splice(settlementIndex, 1);
    newState.players[playerIndex].buildings.cities.push(intersectionId);

    // Update victory points (city worth 2, settlement worth 1, so +1 net)
    newState.players[playerIndex].victoryPoints += 1;

    return newState;
  }

  private static checkDistanceRule(
    gameState: GameState, 
    intersectionId: string
  ): { valid: boolean; error?: string } {
    const intersection = gameState.board.intersections.get(intersectionId);
    if (!intersection) {
      return { valid: false, error: 'Invalid intersection' };
    }

    // Check all adjacent intersections (connected by edges)
    for (const edgeId of intersection.edges) {
      const edge = gameState.board.edges.get(edgeId);
      if (!edge) continue;

      // Get the other intersection connected by this edge
      const otherIntersectionId = edge.intersections.find(id => id !== intersectionId);
      if (!otherIntersectionId) continue;

      const otherIntersection = gameState.board.intersections.get(otherIntersectionId);
      if (otherIntersection?.building) {
        return { 
          valid: false, 
          error: 'Cannot place settlement adjacent to another building (distance rule)' 
        };
      }
    }

    return { valid: true };
  }

  private static isRoadConnected(
    gameState: GameState, 
    playerId: string, 
    edgeId: string
  ): boolean {
    const edge = gameState.board.edges.get(edgeId);
    if (!edge) return false;

    // Check if either intersection has player's building
    for (const intersectionId of edge.intersections) {
      const intersection = gameState.board.intersections.get(intersectionId);
      if (intersection?.building?.playerId === playerId) {
        return true;
      }

      // Check if intersection has connected roads belonging to player
      if (intersection) {
        for (const connectedEdgeId of intersection.edges) {
          if (connectedEdgeId === edgeId) continue; // Skip the edge we're trying to place
          
          const connectedEdge = gameState.board.edges.get(connectedEdgeId);
          if (connectedEdge?.road?.playerId === playerId) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private static isSettlementConnected(
    gameState: GameState, 
    playerId: string, 
    intersectionId: string
  ): boolean {
    const intersection = gameState.board.intersections.get(intersectionId);
    if (!intersection) return false;

    // Check if any connected edge has player's road
    for (const edgeId of intersection.edges) {
      const edge = gameState.board.edges.get(edgeId);
      if (edge?.road?.playerId === playerId) {
        return true;
      }
    }

    return false;
  }

  static getRemainingBuildings(player: Player): { roads: number; settlements: number; cities: number } {
    return {
      roads: 15 - player.buildings.roads.length,
      settlements: 5 - player.buildings.settlements.length,
      cities: 4 - player.buildings.cities.length
    };
  }

  static canPlayerBuild(player: Player, buildingType: 'road' | 'settlement' | 'city'): boolean {
    const remaining = this.getRemainingBuildings(player);
    
    switch (buildingType) {
      case 'road':
        return remaining.roads > 0 && ResourceManager.hasResources(player.resources, BUILDING_COSTS.road);
      case 'settlement':
        return remaining.settlements > 0 && ResourceManager.hasResources(player.resources, BUILDING_COSTS.settlement);
      case 'city':
        return remaining.cities > 0 && ResourceManager.hasResources(player.resources, BUILDING_COSTS.city);
      default:
        return false;
    }
  }
}