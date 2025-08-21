import { GameState, HexCoordinate, Player } from './types';
import { BoardGenerator } from './board';
import { ResourceManager } from './resources';

export class RobberManager {
  static canMoveRobber(
    gameState: GameState,
    playerId: string,
    newLocation: HexCoordinate
  ): { valid: boolean; error?: string } {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { valid: false, error: 'Player not found' };
    }

    // Check if it's the player's turn
    if (gameState.players[gameState.currentPlayerIndex].id !== playerId) {
      return { valid: false, error: 'Not your turn' };
    }

    // Check if the new location is a valid hex
    const tileKey = BoardGenerator.coordToKey(newLocation);
    const targetTile = gameState.board.tiles.get(tileKey);
    if (!targetTile) {
      return { valid: false, error: 'Invalid hex location' };
    }

    // Check if robber is moving to a different location
    const currentLocation = gameState.board.robberLocation;
    if (currentLocation.q === newLocation.q && currentLocation.r === newLocation.r) {
      return { valid: false, error: 'Robber must move to a different hex' };
    }

    return { valid: true };
  }

  static moveRobber(
    gameState: GameState,
    playerId: string,
    newLocation: HexCoordinate,
    targetPlayerId?: string
  ): GameState {
    const validation = this.canMoveRobber(gameState, playerId, newLocation);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const newState = { ...gameState };

    // Remove robber from current location
    const currentTileKey = BoardGenerator.coordToKey(newState.board.robberLocation);
    const currentTile = newState.board.tiles.get(currentTileKey);
    if (currentTile) {
      currentTile.hasRobber = false;
    }

    // Place robber on new location
    const newTileKey = BoardGenerator.coordToKey(newLocation);
    const newTile = newState.board.tiles.get(newTileKey);
    if (newTile) {
      newTile.hasRobber = true;
    }

    // Update robber location
    newState.board.robberLocation = newLocation;

    // Steal resource if target player specified and valid
    if (targetPlayerId && targetPlayerId !== playerId) {
      const stealValidation = this.canStealFromPlayer(newState, playerId, targetPlayerId, newLocation);
      if (stealValidation.valid) {
        return ResourceManager.stealRandomResource(targetPlayerId, playerId, newState);
      }
    }

    return newState;
  }

  static canStealFromPlayer(
    gameState: GameState,
    theftPlayerId: string,
    targetPlayerId: string,
    robberLocation: HexCoordinate
  ): { valid: boolean; error?: string } {
    if (theftPlayerId === targetPlayerId) {
      return { valid: false, error: 'Cannot steal from yourself' };
    }

    const targetPlayer = gameState.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer) {
      return { valid: false, error: 'Target player not found' };
    }

    // Check if target player has any resources to steal
    const totalResources = ResourceManager.getTotalResources(targetPlayer.resources);
    if (totalResources === 0) {
      return { valid: false, error: 'Target player has no resources to steal' };
    }

    // Check if target player has a building adjacent to the robber
    if (!this.playerHasAdjacentBuilding(gameState, targetPlayerId, robberLocation)) {
      return { valid: false, error: 'Target player has no buildings adjacent to robber' };
    }

    return { valid: true };
  }

  static getPlayersAdjacentToRobber(gameState: GameState): string[] {
    const adjacentPlayers: string[] = [];
    const robberLocation = gameState.board.robberLocation;

    // Find all intersections adjacent to the robber's hex
    gameState.board.intersections.forEach(intersection => {
      const isAdjacent = intersection.hexes.some(hexCoord =>
        hexCoord.q === robberLocation.q && hexCoord.r === robberLocation.r
      );

      if (isAdjacent && intersection.building) {
        const playerId = intersection.building.playerId;
        if (!adjacentPlayers.includes(playerId)) {
          adjacentPlayers.push(playerId);
        }
      }
    });

    return adjacentPlayers;
  }

  static getValidStealTargets(gameState: GameState, theftPlayerId: string): string[] {
    const adjacentPlayers = this.getPlayersAdjacentToRobber(gameState);
    
    return adjacentPlayers.filter(playerId => {
      if (playerId === theftPlayerId) return false;
      
      const player = gameState.players.find(p => p.id === playerId);
      if (!player) return false;
      
      return ResourceManager.getTotalResources(player.resources) > 0;
    });
  }

  private static playerHasAdjacentBuilding(
    gameState: GameState,
    playerId: string,
    hexLocation: HexCoordinate
  ): boolean {
    // Check all intersections adjacent to the hex
    let hasAdjacentBuilding = false;

    gameState.board.intersections.forEach(intersection => {
      const isAdjacent = intersection.hexes.some(hexCoord =>
        hexCoord.q === hexLocation.q && hexCoord.r === hexLocation.r
      );

      if (isAdjacent && intersection.building?.playerId === playerId) {
        hasAdjacentBuilding = true;
      }
    });

    return hasAdjacentBuilding;
  }

  static mustDiscardResources(gameState: GameState): Player[] {
    return gameState.players.filter(player => 
      ResourceManager.getTotalResources(player.resources) > 7
    );
  }

  static getAllPlayersToDiscard(gameState: GameState): Array<{
    playerId: string;
    totalResources: number;
    mustDiscard: number;
  }> {
    return gameState.players
      .filter(player => ResourceManager.getTotalResources(player.resources) > 7)
      .map(player => ({
        playerId: player.id,
        totalResources: ResourceManager.getTotalResources(player.resources),
        mustDiscard: Math.floor(ResourceManager.getTotalResources(player.resources) / 2)
      }));
  }

  static isDiscardPhaseComplete(gameState: GameState): boolean {
    return this.mustDiscardResources(gameState).length === 0;
  }

  static getValidRobberLocations(gameState: GameState): HexCoordinate[] {
    const validLocations: HexCoordinate[] = [];
    const currentLocation = gameState.board.robberLocation;

    gameState.board.tiles.forEach(tile => {
      // Robber can move to any hex except its current location
      if (tile.coordinate.q !== currentLocation.q || tile.coordinate.r !== currentLocation.r) {
        validLocations.push(tile.coordinate);
      }
    });

    return validLocations;
  }

  static getRobberBlockedHexes(gameState: GameState): HexCoordinate[] {
    return [gameState.board.robberLocation];
  }

  static isHexBlockedByRobber(gameState: GameState, hexLocation: HexCoordinate): boolean {
    const robberLocation = gameState.board.robberLocation;
    return robberLocation.q === hexLocation.q && robberLocation.r === hexLocation.r;
  }

  static handleSevenRolled(gameState: GameState): {
    newState: GameState;
    playersToDiscard: Array<{ playerId: string; mustDiscard: number }>;
  } {
    const newState = { ...gameState };
    
    // Get all players who need to discard
    const playersToDiscard = this.getAllPlayersToDiscard(newState);

    return {
      newState,
      playersToDiscard
    };
  }

  static validateRobberPlacement(
    gameState: GameState,
    playerId: string,
    robberLocation: HexCoordinate,
    targetPlayerId?: string
  ): { valid: boolean; error?: string } {
    // Check if robber movement is valid
    const moveValidation = this.canMoveRobber(gameState, playerId, robberLocation);
    if (!moveValidation.valid) {
      return moveValidation;
    }

    // If target player specified, validate stealing
    if (targetPlayerId) {
      return this.canStealFromPlayer(gameState, playerId, targetPlayerId, robberLocation);
    }

    // If no target specified, check if there are valid targets
    const validTargets = this.getValidStealTargets(gameState, playerId);
    if (validTargets.length > 0) {
      return { valid: false, error: 'Must select a player to steal from when valid targets are available' };
    }

    return { valid: true };
  }
}