import { GameState, DevelopmentCardType, Player, Resources, BUILDING_COSTS, HexCoordinate } from './types';
import { ResourceManager } from './resources';
import { BuildingManager } from './building';
import { BoardGenerator } from './board';

export class DevelopmentCardManager {
  static createStandardDeck(): DevelopmentCardType[] {
    const deck: DevelopmentCardType[] = [];
    
    // Standard deck composition
    for (let i = 0; i < 14; i++) deck.push('knight');
    for (let i = 0; i < 5; i++) deck.push('victoryPoint');
    for (let i = 0; i < 2; i++) deck.push('roadBuilding');
    for (let i = 0; i < 2; i++) deck.push('invention');
    for (let i = 0; i < 2; i++) deck.push('monopoly');
    
    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
  }

  static canBuyDevelopmentCard(gameState: GameState, playerId: string): { valid: boolean; error?: string } {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { valid: false, error: 'Player not found' };
    }

    // Check if player has resources
    if (!ResourceManager.hasResources(player.resources, BUILDING_COSTS.developmentCard)) {
      return { valid: false, error: 'Insufficient resources for development card' };
    }

    // Check if deck has cards left
    if (gameState.developmentCardDeck.length === 0) {
      return { valid: false, error: 'No development cards remaining' };
    }

    return { valid: true };
  }

  static buyDevelopmentCard(gameState: GameState, playerId: string): GameState {
    const validation = this.canBuyDevelopmentCard(gameState, playerId);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const newState = { ...gameState };
    const playerIndex = newState.players.findIndex(p => p.id === playerId);
    const player = newState.players[playerIndex];

    // Deduct resources
    newState.players[playerIndex].resources = ResourceManager.subtractResources(
      player.resources,
      BUILDING_COSTS.developmentCard
    );

    // Draw card from deck
    const drawnCard = newState.developmentCardDeck.pop()!;
    newState.players[playerIndex].developmentCards[drawnCard]++;

    // Player cannot play a development card on the same turn they bought it
    newState.players[playerIndex].canPlayDevCard = false;

    return newState;
  }

  static canPlayDevelopmentCard(
    gameState: GameState, 
    playerId: string, 
    cardType: DevelopmentCardType
  ): { valid: boolean; error?: string } {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { valid: false, error: 'Player not found' };
    }

    // Check if player has the card
    if (player.developmentCards[cardType] === 0) {
      return { valid: false, error: `Player does not have ${cardType} card` };
    }

    // Check if it's the player's turn (except for victory point cards)
    if (cardType !== 'victoryPoint' && gameState.players[gameState.currentPlayerIndex].id !== playerId) {
      return { valid: false, error: 'Can only play development cards on your turn' };
    }

    // Check if player can play development card this turn
    if (!player.canPlayDevCard && cardType !== 'victoryPoint') {
      return { valid: false, error: 'Cannot play development card on the same turn it was bought' };
    }

    // Victory point cards can be played anytime
    return { valid: true };
  }

  static playKnightCard(
    gameState: GameState, 
    playerId: string, 
    newRobberLocation: HexCoordinate,
    targetPlayerId?: string
  ): GameState {
    const validation = this.canPlayDevelopmentCard(gameState, playerId, 'knight');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const newState = { ...gameState };
    const playerIndex = newState.players.findIndex(p => p.id === playerId);

    // Remove knight card from player's hand
    newState.players[playerIndex].developmentCards.knight--;
    newState.players[playerIndex].knightsPlayed++;

    // Move robber
    newState.board.robberLocation = newRobberLocation;
    
    // Update all tiles to remove robber
    newState.board.tiles.forEach(tile => {
      tile.hasRobber = false;
    });
    
    // Place robber on new location
    const targetTileKey = BoardGenerator.coordToKey(newRobberLocation);
    const targetTile = newState.board.tiles.get(targetTileKey);
    if (targetTile) {
      targetTile.hasRobber = true;
    }

    // Steal resource if target player specified
    if (targetPlayerId && targetPlayerId !== playerId) {
      return ResourceManager.stealRandomResource(targetPlayerId, playerId, newState);
    }

    // Check for largest army
    return this.updateLargestArmy(newState, playerId);
  }

  static playRoadBuildingCard(
    gameState: GameState, 
    playerId: string, 
    edgeIds: [string, string]
  ): GameState {
    const validation = this.canPlayDevelopmentCard(gameState, playerId, 'roadBuilding');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    let newState = { ...gameState };
    const playerIndex = newState.players.findIndex(p => p.id === playerId);

    // Remove road building card
    newState.players[playerIndex].developmentCards.roadBuilding--;

    // Build first road
    try {
      newState = this.buildFreeRoad(newState, playerId, edgeIds[0]);
    } catch (error) {
      throw new Error(`Cannot build first road: ${error}`);
    }

    // Build second road (if different from first)
    if (edgeIds[1] !== edgeIds[0]) {
      try {
        newState = this.buildFreeRoad(newState, playerId, edgeIds[1]);
      } catch (error) {
        throw new Error(`Cannot build second road: ${error}`);
      }
    }

    return newState;
  }

  static playInventionCard(
    gameState: GameState, 
    playerId: string, 
    resources: [string, string]
  ): GameState {
    const validation = this.canPlayDevelopmentCard(gameState, playerId, 'invention');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const newState = { ...gameState };
    const playerIndex = newState.players.findIndex(p => p.id === playerId);

    // Remove invention card
    newState.players[playerIndex].developmentCards.invention--;

    // Add the two chosen resources
    const resourcesToAdd: Partial<Resources> = {};
    resources.forEach(resourceType => {
      if (!resourcesToAdd[resourceType as keyof Resources]) {
        resourcesToAdd[resourceType as keyof Resources] = 0;
      }
      resourcesToAdd[resourceType as keyof Resources]! += 1;
    });

    newState.players[playerIndex].resources = ResourceManager.addResources(
      newState.players[playerIndex].resources,
      resourcesToAdd
    );

    return newState;
  }

  static playMonopolyCard(
    gameState: GameState, 
    playerId: string, 
    resourceType: string
  ): GameState {
    const validation = this.canPlayDevelopmentCard(gameState, playerId, 'monopoly');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const newState = { ...gameState };
    const playerIndex = newState.players.findIndex(p => p.id === playerId);

    // Remove monopoly card
    newState.players[playerIndex].developmentCards.monopoly--;

    let totalStolen = 0;

    // Take all resources of the specified type from all other players
    newState.players.forEach((player, index) => {
      if (index !== playerIndex) {
        const amountToTake = player.resources[resourceType as keyof Resources];
        totalStolen += amountToTake;
        newState.players[index].resources[resourceType as keyof Resources] = 0;
      }
    });

    // Give all stolen resources to the player
    newState.players[playerIndex].resources[resourceType as keyof Resources] += totalStolen;

    return newState;
  }

  static playVictoryPointCard(gameState: GameState, playerId: string): GameState {
    const validation = this.canPlayDevelopmentCard(gameState, playerId, 'victoryPoint');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const newState = { ...gameState };
    const playerIndex = newState.players.findIndex(p => p.id === playerId);

    // Remove victory point card and add to victory points
    newState.players[playerIndex].developmentCards.victoryPoint--;
    newState.players[playerIndex].victoryPoints += 1;

    return newState;
  }

  private static buildFreeRoad(gameState: GameState, playerId: string, edgeId: string): GameState {
    // Check if edge is valid and empty
    const edge = gameState.board.edges.get(edgeId);
    if (!edge) {
      throw new Error('Invalid edge location');
    }

    if (edge.road) {
      throw new Error('Edge already has a road');
    }

    // Check connectivity
    if (!this.isRoadConnectedForFreeBuilding(gameState, playerId, edgeId)) {
      throw new Error('Road must connect to existing road or building');
    }

    // Check if player has roads remaining
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const remaining = BuildingManager.getRemainingBuildings(player);
    if (remaining.roads === 0) {
      throw new Error('No roads remaining');
    }

    const newState = { ...gameState };
    const playerIndex = newState.players.findIndex(p => p.id === playerId);

    // Place road (no resource cost for free roads)
    const newEdge = newState.board.edges.get(edgeId)!;
    newEdge.road = { playerId };
    
    // Add to player's buildings
    newState.players[playerIndex].buildings.roads.push(edgeId);

    return newState;
  }

  private static isRoadConnectedForFreeBuilding(
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
          if (connectedEdgeId === edgeId) continue;
          
          const connectedEdge = gameState.board.edges.get(connectedEdgeId);
          if (connectedEdge?.road?.playerId === playerId) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private static updateLargestArmy(gameState: GameState, playerId: string): GameState {
    const newState = { ...gameState };
    const player = newState.players.find(p => p.id === playerId);
    
    if (!player || player.knightsPlayed < 3) {
      return newState;
    }

    // Find current largest army holder
    let currentHolder = newState.players.find(p => p.specialCards.largestArmy);
    let currentLargestCount = currentHolder?.knightsPlayed || 2; // Need at least 3 to qualify

    // Check if this player should get largest army
    if (player.knightsPlayed > currentLargestCount) {
      // Remove from current holder
      if (currentHolder) {
        const currentHolderIndex = newState.players.findIndex(p => p.id === currentHolder!.id);
        newState.players[currentHolderIndex].specialCards.largestArmy = false;
        newState.players[currentHolderIndex].victoryPoints -= 2;
      }

      // Give to new holder
      const playerIndex = newState.players.findIndex(p => p.id === playerId);
      newState.players[playerIndex].specialCards.largestArmy = true;
      newState.players[playerIndex].victoryPoints += 2;
    }

    return newState;
  }

  static getPlayableDevelopmentCards(player: Player): DevelopmentCardType[] {
    const playable: DevelopmentCardType[] = [];
    
    if (!player.canPlayDevCard) return playable;

    Object.entries(player.developmentCards).forEach(([cardType, count]) => {
      if (count > 0) {
        playable.push(cardType as DevelopmentCardType);
      }
    });

    return playable;
  }

  static resetPlayDevCardFlag(gameState: GameState): GameState {
    const newState = { ...gameState };
    newState.players.forEach((player, index) => {
      newState.players[index].canPlayDevCard = true;
    });
    return newState;
  }
}