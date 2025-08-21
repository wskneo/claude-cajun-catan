import { GameState, TradeOffer, Resources, ResourceType, Player } from './types';
import { ResourceManager } from './resources';

export class TradingManager {
  static validatePlayerTrade(
    gameState: GameState,
    offer: TradeOffer
  ): { valid: boolean; error?: string } {
    const fromPlayer = gameState.players.find(p => p.id === offer.fromPlayerId);
    const toPlayer = offer.toPlayerId ? 
      gameState.players.find(p => p.id === offer.toPlayerId) : null;

    if (!fromPlayer) {
      return { valid: false, error: 'From player not found' };
    }

    if (offer.toPlayerId && !toPlayer) {
      return { valid: false, error: 'To player not found' };
    }

    // Check that offering player has the resources they want to trade
    if (!ResourceManager.hasResources(fromPlayer.resources, offer.offering)) {
      return { valid: false, error: 'Player does not have offered resources' };
    }

    // For player-to-player trades, both players must agree (handled by game engine)
    // For bank trades, validate the trade ratios
    if (!offer.toPlayerId) {
      return this.validateBankTrade(gameState, offer);
    }

    return { valid: true };
  }

  static validateBankTrade(
    gameState: GameState,
    offer: TradeOffer
  ): { valid: boolean; error?: string } {
    const player = gameState.players.find(p => p.id === offer.fromPlayerId);
    if (!player) {
      return { valid: false, error: 'Player not found' };
    }

    // Check player has offered resources
    if (!ResourceManager.hasResources(player.resources, offer.offering)) {
      return { valid: false, error: 'Player does not have offered resources' };
    }

    // Get player's accessible ports
    const accessiblePorts = this.getAccessiblePorts(gameState, offer.fromPlayerId);
    
    // Validate trade ratios for each resource being offered
    const offeringEntries = Object.entries(offer.offering) as [ResourceType, number][];
    const requestingEntries = Object.entries(offer.requesting) as [ResourceType, number][];

    // Must be trading exactly one type of resource for exactly one type
    const offeringTypes = offeringEntries.filter(([_, amount]) => amount > 0);
    const requestingTypes = requestingEntries.filter(([_, amount]) => amount > 0);

    if (offeringTypes.length !== 1 || requestingTypes.length !== 1) {
      return { valid: false, error: 'Bank trades must be one resource type for one resource type' };
    }

    const [offeringResource, offeringAmount] = offeringTypes[0];
    const [requestingResource, requestingAmount] = requestingTypes[0];

    // Get best available ratio for the offering resource
    const bestRatio = this.getBestTradeRatio(accessiblePorts, offeringResource);
    
    // Check if the trade ratio is valid
    if (offeringAmount < bestRatio * requestingAmount) {
      return { 
        valid: false, 
        error: `Invalid trade ratio. Need ${bestRatio}:1 ratio (offering ${offeringAmount}, requesting ${requestingAmount})` 
      };
    }

    return { valid: true };
  }

  static executeTrade(gameState: GameState, offer: TradeOffer): GameState {
    const validation = this.validatePlayerTrade(gameState, offer);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const newState = { ...gameState };
    const fromPlayerIndex = newState.players.findIndex(p => p.id === offer.fromPlayerId);
    
    // Remove offered resources from offering player
    newState.players[fromPlayerIndex].resources = ResourceManager.subtractResources(
      newState.players[fromPlayerIndex].resources,
      offer.offering
    );

    // Add requested resources to offering player
    newState.players[fromPlayerIndex].resources = ResourceManager.addResources(
      newState.players[fromPlayerIndex].resources,
      offer.requesting
    );

    // If it's a player-to-player trade, handle the other player
    if (offer.toPlayerId) {
      const toPlayerIndex = newState.players.findIndex(p => p.id === offer.toPlayerId!);
      
      // Remove requested resources from receiving player (they give these to offering player)
      newState.players[toPlayerIndex].resources = ResourceManager.subtractResources(
        newState.players[toPlayerIndex].resources,
        offer.requesting
      );

      // Add offered resources to receiving player
      newState.players[toPlayerIndex].resources = ResourceManager.addResources(
        newState.players[toPlayerIndex].resources,
        offer.offering
      );
    }

    return newState;
  }

  private static getAccessiblePorts(gameState: GameState, playerId: string): Array<{
    type: 'generic' | ResourceType;
    ratio: number;
  }> {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return [];

    const accessiblePorts: Array<{ type: 'generic' | ResourceType; ratio: number }> = [];

    // Check all player's settlements and cities for port access
    const allBuildings = [...player.buildings.settlements, ...player.buildings.cities];
    
    allBuildings.forEach(intersectionId => {
      const intersection = gameState.board.intersections.get(intersectionId);
      if (intersection?.port) {
        accessiblePorts.push(intersection.port);
      }
    });

    return accessiblePorts;
  }

  private static getBestTradeRatio(
    accessiblePorts: Array<{ type: 'generic' | ResourceType; ratio: number }>,
    resourceType: ResourceType
  ): number {
    let bestRatio = 4; // Default 4:1 ratio

    // Check for specific resource port
    const specificPort = accessiblePorts.find(port => port.type === resourceType);
    if (specificPort) {
      bestRatio = Math.min(bestRatio, specificPort.ratio);
    }

    // Check for generic ports
    const genericPorts = accessiblePorts.filter(port => port.type === 'generic');
    genericPorts.forEach(port => {
      bestRatio = Math.min(bestRatio, port.ratio);
    });

    return bestRatio;
  }

  static getAvailableTradeRatios(gameState: GameState, playerId: string): Record<ResourceType, number> {
    const accessiblePorts = this.getAccessiblePorts(gameState, playerId);
    const ratios: Record<ResourceType, number> = {
      wood: 4,
      brick: 4,
      wool: 4,
      wheat: 4,
      ore: 4
    };

    // Update ratios based on accessible ports
    Object.keys(ratios).forEach(resource => {
      ratios[resource as ResourceType] = this.getBestTradeRatio(
        accessiblePorts, 
        resource as ResourceType
      );
    });

    return ratios;
  }

  static canAffordTrade(
    playerResources: Resources,
    accessiblePorts: Array<{ type: 'generic' | ResourceType; ratio: number }>,
    offeringResource: ResourceType,
    requestingAmount: number
  ): boolean {
    const requiredRatio = this.getBestTradeRatio(accessiblePorts, offeringResource);
    const requiredAmount = requiredRatio * requestingAmount;
    
    return playerResources[offeringResource] >= requiredAmount;
  }

  static createBankTradeOffer(
    fromPlayerId: string,
    offeringResource: ResourceType,
    offeringAmount: number,
    requestingResource: ResourceType,
    requestingAmount: number
  ): TradeOffer {
    const offering: Partial<Resources> = { [offeringResource]: offeringAmount };
    const requesting: Partial<Resources> = { [requestingResource]: requestingAmount };

    return {
      fromPlayerId,
      offering,
      requesting
      // toPlayerId is undefined for bank trades
    };
  }

  static createPlayerTradeOffer(
    fromPlayerId: string,
    toPlayerId: string,
    offering: Partial<Resources>,
    requesting: Partial<Resources>
  ): TradeOffer {
    return {
      fromPlayerId,
      toPlayerId,
      offering,
      requesting
    };
  }

  static getPossibleBankTrades(
    gameState: GameState,
    playerId: string
  ): Array<{
    offeringResource: ResourceType;
    requestingResource: ResourceType;
    ratio: number;
    maxTrades: number;
  }> {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return [];

    const accessiblePorts = this.getAccessiblePorts(gameState, playerId);
    const possibleTrades: Array<{
      offeringResource: ResourceType;
      requestingResource: ResourceType;
      ratio: number;
      maxTrades: number;
    }> = [];

    const resourceTypes: ResourceType[] = ['wood', 'brick', 'wool', 'wheat', 'ore'];

    resourceTypes.forEach(offeringResource => {
      const playerAmount = player.resources[offeringResource];
      if (playerAmount === 0) return;

      const ratio = this.getBestTradeRatio(accessiblePorts, offeringResource);
      const maxTrades = Math.floor(playerAmount / ratio);
      
      if (maxTrades > 0) {
        resourceTypes.forEach(requestingResource => {
          if (requestingResource !== offeringResource) {
            possibleTrades.push({
              offeringResource,
              requestingResource,
              ratio,
              maxTrades
            });
          }
        });
      }
    });

    return possibleTrades;
  }
}