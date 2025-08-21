import { GameState, Player, Resources, HeuristicWeights, ParsedAction } from '../types';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';

export class HeuristicAI {
  private logger: Logger;
  private weights: HeuristicWeights;

  constructor(weights?: Partial<HeuristicWeights>) {
    this.logger = createLogger('HeuristicAI');
    this.weights = {
      victoryPoints: 1.0,
      resourceDiversity: 0.7,
      buildingPotential: 0.8,
      blockingOpponents: 0.6,
      tradingAdvantage: 0.5,
      ...weights
    };
  }

  /**
   * Make a heuristic decision based on game state
   */
  makeDecision(gameState: GameState, playerId: string, validActions: string[]): ParsedAction {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    this.logger.info('Making heuristic decision', { 
      playerId, 
      phase: gameState.phase, 
      validActions,
      victoryPoints: player.victoryPoints 
    });

    // Phase-specific decision making
    switch (gameState.phase) {
      case 'SETUP_ROUND_1':
      case 'SETUP_ROUND_2':
        return this.makeSetupDecision(gameState, player, validActions);
      
      case 'PRODUCTION':
        return this.makeProductionDecision(gameState, player, validActions);
      
      case 'ACTION':
        return this.makeActionDecision(gameState, player, validActions);
      
      default:
        return this.makeDefaultDecision(player, validActions);
    }
  }

  private makeSetupDecision(gameState: GameState, player: Player, validActions: string[]): ParsedAction {
    if (validActions.includes('BUILD_SETTLEMENT')) {
      // For setup, choose locations with good resource diversity and number probability
      const bestLocation = this.findBestSettlementLocation(gameState, player, true);
      return {
        type: 'BUILD_SETTLEMENT',
        playerId: player.id,
        payload: { intersectionId: bestLocation || 'i_0,0' }
      };
    }

    if (validActions.includes('BUILD_ROAD')) {
      // Build road adjacent to last settlement
      const lastSettlement = player.buildings.settlements[player.buildings.settlements.length - 1];
      const roadLocation = this.findAdjacentRoadLocation(gameState, lastSettlement);
      return {
        type: 'BUILD_ROAD',
        playerId: player.id,
        payload: { edgeId: roadLocation || 'e_0,0_1,-1' }
      };
    }

    return this.makeDefaultDecision(player, validActions);
  }

  private makeProductionDecision(gameState: GameState, player: Player, validActions: string[]): ParsedAction {
    // Check if we should play a development card before rolling
    if (validActions.includes('PLAY_DEVELOPMENT_CARD') && player.developmentCards.knight > 0) {
      const opponents = gameState.players.filter(p => p.id !== player.id);
      const threatPlayer = opponents.find(p => p.victoryPoints >= 8);
      
      if (threatPlayer) {
        // Play knight to disrupt threatening player
        return {
          type: 'PLAY_DEVELOPMENT_CARD',
          playerId: player.id,
          payload: {
            cardType: 'knight',
            robberLocation: { q: 0, r: 1 }, // Simple heuristic location
            targetPlayerId: threatPlayer.id
          }
        };
      }
    }

    // Default to rolling dice
    if (validActions.includes('ROLL_DICE')) {
      return {
        type: 'ROLL_DICE',
        playerId: player.id,
        payload: {}
      };
    }

    return this.makeDefaultDecision(player, validActions);
  }

  private makeActionDecision(gameState: GameState, player: Player, validActions: string[]): ParsedAction {
    const decisions = [
      () => this.considerVictoryPoints(gameState, player, validActions),
      () => this.considerBuilding(gameState, player, validActions),
      () => this.considerTrading(gameState, player, validActions),
      () => this.considerDevelopmentCards(gameState, player, validActions),
      () => this.considerEndTurn(player, validActions)
    ];

    for (const decisionFunction of decisions) {
      const decision = decisionFunction();
      if (decision) {
        this.logger.info('Heuristic decision made', { 
          type: decision.type,
          reasoning: this.getDecisionReasoning(decision.type)
        });
        return decision;
      }
    }

    return this.makeDefaultDecision(player, validActions);
  }

  private considerVictoryPoints(gameState: GameState, player: Player, validActions: string[]): ParsedAction | null {
    // If close to winning, prioritize victory point actions
    if (player.victoryPoints >= 8) {
      
      // Play victory point cards immediately
      if (validActions.includes('PLAY_DEVELOPMENT_CARD') && player.developmentCards.victoryPoint > 0) {
        return {
          type: 'PLAY_DEVELOPMENT_CARD',
          playerId: player.id,
          payload: { cardType: 'victoryPoint' }
        };
      }

      // Build cities for quick VP
      if (validActions.includes('BUILD_CITY') && this.canAffordCity(player)) {
        const cityLocation = this.findBestCityLocation(gameState, player);
        if (cityLocation) {
          return {
            type: 'BUILD_CITY',
            playerId: player.id,
            payload: { intersectionId: cityLocation }
          };
        }
      }

      // Build settlements if cities not available
      if (validActions.includes('BUILD_SETTLEMENT') && this.canAffordSettlement(player)) {
        const settlementLocation = this.findBestSettlementLocation(gameState, player, false);
        if (settlementLocation) {
          return {
            type: 'BUILD_SETTLEMENT',
            playerId: player.id,
            payload: { intersectionId: settlementLocation }
          };
        }
      }
    }

    return null;
  }

  private considerBuilding(gameState: GameState, player: Player, validActions: string[]): ParsedAction | null {
    // Prioritize cities for efficiency
    if (validActions.includes('BUILD_CITY') && this.canAffordCity(player) && player.buildings.settlements.length > 0) {
      const cityLocation = this.findBestCityLocation(gameState, player);
      if (cityLocation) {
        return {
          type: 'BUILD_CITY',
          playerId: player.id,
          payload: { intersectionId: cityLocation }
        };
      }
    }

    // Build settlements for expansion
    if (validActions.includes('BUILD_SETTLEMENT') && this.canAffordSettlement(player)) {
      const settlementLocation = this.findBestSettlementLocation(gameState, player, false);
      if (settlementLocation) {
        return {
          type: 'BUILD_SETTLEMENT',
          playerId: player.id,
          payload: { intersectionId: settlementLocation }
        };
      }
    }

    // Build roads for connectivity or longest road
    if (validActions.includes('BUILD_ROAD') && this.canAffordRoad(player)) {
      const roadLocation = this.findBestRoadLocation(gameState, player);
      if (roadLocation) {
        return {
          type: 'BUILD_ROAD',
          playerId: player.id,
          payload: { edgeId: roadLocation }
        };
      }
    }

    return null;
  }

  private considerTrading(gameState: GameState, player: Player, validActions: string[]): ParsedAction | null {
    if (!validActions.includes('TRADE_WITH_BANK')) {
      return null;
    }

    const resourceNeeds = this.analyzeResourceNeeds(player);
    const excessResources = this.findExcessResources(player);

    if (resourceNeeds.length > 0 && excessResources.length > 0) {
      const tradeRatio = this.getBestTradeRatio(player); // Simplified to 4:1 for heuristic
      
      if (player.resources[excessResources[0] as keyof Resources] >= tradeRatio) {
        return {
          type: 'TRADE_WITH_BANK',
          playerId: player.id,
          payload: {
            tradeOffer: {
              fromPlayerId: player.id,
              offering: { [excessResources[0]]: tradeRatio },
              requesting: { [resourceNeeds[0]]: 1 }
            }
          }
        };
      }
    }

    return null;
  }

  private considerDevelopmentCards(gameState: GameState, player: Player, validActions: string[]): ParsedAction | null {
    // Buy development cards if affordable
    if (validActions.includes('BUY_DEVELOPMENT_CARD') && this.canAffordDevelopmentCard(player)) {
      return {
        type: 'BUY_DEVELOPMENT_CARD',
        playerId: player.id,
        payload: {}
      };
    }

    // Play development cards strategically
    if (validActions.includes('PLAY_DEVELOPMENT_CARD')) {
      // Play knights for largest army
      if (player.developmentCards.knight > 0) {
        return {
          type: 'PLAY_DEVELOPMENT_CARD',
          playerId: player.id,
          payload: {
            cardType: 'knight',
            robberLocation: { q: 0, r: 1 },
            targetPlayerId: this.findBestStealTarget(gameState, player.id)
          }
        };
      }

      // Play invention for needed resources
      if (player.developmentCards.invention > 0) {
        const needs = this.analyzeResourceNeeds(player).slice(0, 2);
        if (needs.length >= 2) {
          return {
            type: 'PLAY_DEVELOPMENT_CARD',
            playerId: player.id,
            payload: {
              cardType: 'invention',
              resources: needs
            }
          };
        }
      }
    }

    return null;
  }

  private considerEndTurn(player: Player, validActions: string[]): ParsedAction | null {
    if (validActions.includes('END_TURN')) {
      return {
        type: 'END_TURN',
        playerId: player.id,
        payload: {}
      };
    }
    return null;
  }

  // Helper methods
  private canAffordRoad(player: Player): boolean {
    return player.resources.wood >= 1 && player.resources.brick >= 1;
  }

  private canAffordSettlement(player: Player): boolean {
    return player.resources.wood >= 1 && player.resources.brick >= 1 && 
           player.resources.wool >= 1 && player.resources.wheat >= 1;
  }

  private canAffordCity(player: Player): boolean {
    return player.resources.wheat >= 2 && player.resources.ore >= 3;
  }

  private canAffordDevelopmentCard(player: Player): boolean {
    return player.resources.wool >= 1 && player.resources.wheat >= 1 && player.resources.ore >= 1;
  }

  private analyzeResourceNeeds(player: Player): string[] {
    const needs = [];
    
    if (!this.canAffordSettlement(player)) {
      if (player.resources.wood < 1) needs.push('wood');
      if (player.resources.brick < 1) needs.push('brick');
      if (player.resources.wool < 1) needs.push('wool');
      if (player.resources.wheat < 1) needs.push('wheat');
    }
    
    if (!this.canAffordCity(player) && player.buildings.settlements.length > 0) {
      if (player.resources.wheat < 2) needs.push('wheat');
      if (player.resources.ore < 3) needs.push('ore');
    }

    return needs;
  }

  private findExcessResources(player: Player): string[] {
    const excess = [];
    const resourceEntries = Object.entries(player.resources) as [keyof Resources, number][];
    
    for (const [resource, amount] of resourceEntries) {
      if (amount >= 6) excess.push(resource); // Consider 6+ as excess for heuristic
    }
    
    return excess;
  }

  private getBestTradeRatio(player: Player): number {
    // Simplified - assume 4:1 ratio. In real implementation, check for ports
    return 4;
  }

  private findBestSettlementLocation(gameState: GameState, player: Player, isSetup: boolean): string | null {
    // Simplified heuristic - return a reasonable location
    // In real implementation, analyze board for resource diversity and numbers
    return 'i_1,0';
  }

  private findBestCityLocation(gameState: GameState, player: Player): string | null {
    // Upgrade the first settlement (simplified heuristic)
    return player.buildings.settlements[0] || null;
  }

  private findBestRoadLocation(gameState: GameState, player: Player): string | null {
    // Simplified - find a location that extends from existing roads
    return 'e_1,0_2,0';
  }

  private findAdjacentRoadLocation(gameState: GameState, settlementId: string): string | null {
    // Simplified - return a reasonable adjacent road location
    return 'e_0,0_1,0';
  }

  private findBestStealTarget(gameState: GameState, playerId: string): string | undefined {
    const opponents = gameState.players.filter(p => p.id !== playerId);
    // Target player with most resources or highest VP
    const target = opponents.reduce((best, current) => {
      const currentScore = current.victoryPoints * 2 + this.getTotalResources(current.resources);
      const bestScore = best ? best.victoryPoints * 2 + this.getTotalResources(best.resources) : 0;
      return currentScore > bestScore ? current : best;
    }, null as Player | null);
    
    return target?.id || undefined;
  }

  private getTotalResources(resources: Resources): number {
    return resources.wood + resources.brick + resources.wool + resources.wheat + resources.ore;
  }

  private makeDefaultDecision(player: Player, validActions: string[]): ParsedAction {
    // Safe fallback actions
    const safeActions = ['END_TURN', 'ROLL_DICE'];
    const availableAction = safeActions.find(action => validActions.includes(action)) || validActions[0];
    
    return {
      type: availableAction || 'END_TURN',
      playerId: player.id,
      payload: {}
    };
  }

  private getDecisionReasoning(actionType: string): string {
    const reasoning = {
      'BUILD_CITY': 'Upgrading settlement for 2 VP efficiency',
      'BUILD_SETTLEMENT': 'Expanding for resource access and VP',
      'BUILD_ROAD': 'Extending connectivity for future expansion',
      'BUY_DEVELOPMENT_CARD': 'Investing in development cards for flexibility',
      'PLAY_DEVELOPMENT_CARD': 'Using development card for strategic advantage',
      'TRADE_WITH_BANK': 'Trading excess resources for needed ones',
      'END_TURN': 'No beneficial actions available this turn'
    };
    
    return reasoning[actionType as keyof typeof reasoning] || 'Heuristic decision based on game state';
  }
}