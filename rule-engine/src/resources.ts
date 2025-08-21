import { GameState, Resources, ResourceType, HexCoordinate, TerrainType } from './types';
import { BoardGenerator } from './board';

export class ResourceManager {
  static rollDice(): [number, number] {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    return [die1, die2];
  }

  static distributeResources(gameState: GameState, diceSum: number): GameState {
    if (diceSum === 7) {
      return this.handleSevenRolled(gameState);
    }

    const newState = { ...gameState };
    
    // Find all tiles with the rolled number
    const producingTiles: HexCoordinate[] = [];
    
    gameState.board.tiles.forEach((tile) => {
      if (tile.numberDisc === diceSum && !tile.hasRobber) {
        producingTiles.push(tile.coordinate);
      }
    });

    // Distribute resources to players with buildings on producing tiles
    producingTiles.forEach(tileCoord => {
      const tile = gameState.board.tiles.get(BoardGenerator.coordToKey(tileCoord));
      if (!tile || tile.terrain === 'desert') return;

      const resourceType = this.terrainToResource(tile.terrain);
      
      // Find intersections adjacent to this tile
      gameState.board.intersections.forEach(intersection => {
        const isAdjacent = intersection.hexes.some(hexCoord =>
          hexCoord.q === tileCoord.q && hexCoord.r === tileCoord.r
        );

        if (isAdjacent && intersection.building) {
          const playerId = intersection.building.playerId;
          const playerIndex = newState.players.findIndex(p => p.id === playerId);
          
          if (playerIndex !== -1) {
            const resourceAmount = intersection.building.type === 'city' ? 2 : 1;
            newState.players[playerIndex].resources[resourceType] += resourceAmount;
          }
        }
      });
    });

    return newState;
  }

  private static handleSevenRolled(gameState: GameState): GameState {
    const newState = { ...gameState };
    
    // Phase 1: Players with >7 resources must discard half
    newState.players = newState.players.map(player => {
      const totalResources = this.getTotalResources(player.resources);
      
      if (totalResources > 7) {
        const discardCount = Math.floor(totalResources / 2);
        // Note: In real implementation, this would require player input
        // For now, we'll create a placeholder that needs to be resolved
        return {
          ...player,
          // This would be handled by the action phase where player selects cards to discard
        };
      }
      
      return player;
    });

    return newState;
  }

  static getTotalResources(resources: Resources): number {
    return resources.wood + resources.brick + resources.wool + 
           resources.wheat + resources.ore;
  }

  static hasResources(playerResources: Resources, required: Partial<Resources>): boolean {
    return Object.entries(required).every(([resource, amount]) => {
      return playerResources[resource as ResourceType] >= (amount || 0);
    });
  }

  static subtractResources(
    playerResources: Resources, 
    toSubtract: Partial<Resources>
  ): Resources {
    const result = { ...playerResources };
    
    Object.entries(toSubtract).forEach(([resource, amount]) => {
      if (amount && amount > 0) {
        result[resource as ResourceType] = Math.max(0, 
          result[resource as ResourceType] - amount
        );
      }
    });

    return result;
  }

  static addResources(
    playerResources: Resources, 
    toAdd: Partial<Resources>
  ): Resources {
    const result = { ...playerResources };
    
    Object.entries(toAdd).forEach(([resource, amount]) => {
      if (amount && amount > 0) {
        result[resource as ResourceType] += amount;
      }
    });

    return result;
  }

  static createEmptyResources(): Resources {
    return {
      wood: 0,
      brick: 0,
      wool: 0,
      wheat: 0,
      ore: 0
    };
  }

  static validateDiscardSelection(
    currentResources: Resources, 
    toDiscard: Partial<Resources>,
    requiredAmount: number
  ): boolean {
    // Check that player has the resources they want to discard
    if (!this.hasResources(currentResources, toDiscard)) {
      return false;
    }

    // Check that the discard amount matches required
    const discardAmount = Object.values(toDiscard).reduce((sum, amount) => sum + (amount || 0), 0);
    return discardAmount === requiredAmount;
  }

  static discardResources(
    gameState: GameState,
    playerId: string,
    toDiscard: Partial<Resources>
  ): GameState {
    const newState = { ...gameState };
    const playerIndex = newState.players.findIndex(p => p.id === playerId);
    
    if (playerIndex === -1) {
      throw new Error(`Player ${playerId} not found`);
    }

    const player = newState.players[playerIndex];
    const totalResources = this.getTotalResources(player.resources);
    
    if (totalResources <= 7) {
      throw new Error(`Player ${playerId} doesn't need to discard resources`);
    }

    const requiredDiscard = Math.floor(totalResources / 2);
    
    if (!this.validateDiscardSelection(player.resources, toDiscard, requiredDiscard)) {
      throw new Error('Invalid discard selection');
    }

    newState.players[playerIndex].resources = this.subtractResources(
      player.resources, 
      toDiscard
    );

    return newState;
  }

  private static terrainToResource(terrain: TerrainType): ResourceType {
    const mapping: Record<TerrainType, ResourceType | null> = {
      forest: 'wood',
      hill: 'brick',
      pasture: 'wool',
      field: 'wheat',
      mountain: 'ore',
      desert: null
    };

    const resource = mapping[terrain];
    if (!resource) {
      throw new Error(`No resource type for terrain: ${terrain}`);
    }
    
    return resource;
  }

  static stealRandomResource(fromPlayerId: string, toPlayerId: string, gameState: GameState): GameState {
    const newState = { ...gameState };
    
    const fromPlayerIndex = newState.players.findIndex(p => p.id === fromPlayerId);
    const toPlayerIndex = newState.players.findIndex(p => p.id === toPlayerId);
    
    if (fromPlayerIndex === -1 || toPlayerIndex === -1) {
      throw new Error('Invalid player IDs for stealing');
    }

    const fromPlayer = newState.players[fromPlayerIndex];
    const availableResources: ResourceType[] = [];
    
    // Collect all available resource cards
    (Object.entries(fromPlayer.resources) as [ResourceType, number][]).forEach(([resource, count]) => {
      for (let i = 0; i < count; i++) {
        availableResources.push(resource);
      }
    });

    if (availableResources.length === 0) {
      return newState; // Nothing to steal
    }

    // Randomly select a resource to steal
    const randomIndex = Math.floor(Math.random() * availableResources.length);
    const stolenResource = availableResources[randomIndex];

    // Transfer the resource
    newState.players[fromPlayerIndex].resources[stolenResource]--;
    newState.players[toPlayerIndex].resources[stolenResource]++;

    return newState;
  }
}