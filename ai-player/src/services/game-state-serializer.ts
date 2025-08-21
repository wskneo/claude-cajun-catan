import { GameState, Player, Resources, GameAnalysis } from '../types';

export class GameStateSerializer {
  
  /**
   * Converts game state to a human-readable format for LLM consumption
   */
  static serializeForLLM(gameState: GameState, playerId: string): string {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found in game state`);
    }

    const sections = [
      this.createGameOverview(gameState),
      this.createPlayerStatus(player, gameState.players),
      this.createBoardSituation(gameState),
      this.createResourceSituation(player),
      this.createBuildingSituation(player),
      this.createOpponentAnalysis(gameState.players, playerId),
      this.createCurrentSituation(gameState, playerId)
    ];

    return sections.filter(section => section.trim()).join('\n\n');
  }

  private static createGameOverview(gameState: GameState): string {
    const totalPlayers = gameState.players.length;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    return `## GAME STATUS
Turn: ${gameState.turn}
Phase: ${gameState.phase}
Current Player: ${currentPlayer.id}
Total Players: ${totalPlayers}
${gameState.diceRoll ? `Last Dice Roll: ${gameState.diceRoll[0]} + ${gameState.diceRoll[1]} = ${gameState.diceRoll[0] + gameState.diceRoll[1]}` : ''}`;
  }

  private static createPlayerStatus(player: Player, allPlayers: Player[]): string {
    const vpBreakdown = this.getVictoryPointBreakdown(player);
    const position = this.getPlayerPosition(player, allPlayers);
    
    return `## YOUR STATUS (${player.id})
Victory Points: ${player.victoryPoints}/10 ${vpBreakdown}
Position: ${position}
Resources: ${this.getTotalResources(player.resources)} total
- Wood: ${player.resources.wood}
- Brick: ${player.resources.brick}  
- Wool: ${player.resources.wool}
- Wheat: ${player.resources.wheat}
- Ore: ${player.resources.ore}
Development Cards: ${this.getTotalDevelopmentCards(player)}
${this.getDevelopmentCardBreakdown(player)}
Knights Played: ${player.knightsPlayed}
${player.specialCards.longestRoad ? '🏆 LONGEST ROAD' : ''}
${player.specialCards.largestArmy ? '🗡️ LARGEST ARMY' : ''}`;
  }

  private static createBoardSituation(gameState: GameState): string {
    const robberInfo = `Robber at: (${gameState.board.robberLocation.q}, ${gameState.board.robberLocation.r})`;
    const devCardsLeft = gameState.developmentCardDeck.length;
    
    return `## BOARD SITUATION
${robberInfo}
Development Cards Remaining: ${devCardsLeft}
Phase: ${gameState.phase}`;
  }

  private static createResourceSituation(player: Player): string {
    const totalResources = this.getTotalResources(player.resources);
    const resourceNeeds = this.analyzeResourceNeeds(player);
    
    return `## RESOURCE ANALYSIS
Total Resources: ${totalResources}
${totalResources > 7 ? '⚠️ MUST DISCARD ON 7!' : ''}
Resource Needs: ${resourceNeeds.join(', ') || 'None identified'}
Can Trade: ${totalResources >= 4 ? 'Yes (4:1)' : 'No - need more resources'}`;
  }

  private static createBuildingSituation(player: Player): string {
    const roadsLeft = 15 - player.buildings.roads.length;
    const settlementsLeft = 5 - player.buildings.settlements.length;
    const citiesLeft = 4 - player.buildings.cities.length;
    
    return `## BUILDING SITUATION
Roads: ${player.buildings.roads.length}/15 (${roadsLeft} remaining)
Settlements: ${player.buildings.settlements.length}/5 (${settlementsLeft} remaining)
Cities: ${player.buildings.cities.length}/4 (${citiesLeft} remaining)

Current Buildings:
${player.buildings.roads.length > 0 ? `Roads at: ${player.buildings.roads.slice(0, 3).join(', ')}${player.buildings.roads.length > 3 ? '...' : ''}` : 'No roads'}
${player.buildings.settlements.length > 0 ? `Settlements at: ${player.buildings.settlements.join(', ')}` : 'No settlements'}
${player.buildings.cities.length > 0 ? `Cities at: ${player.buildings.cities.join(', ')}` : 'No cities'}`;
  }

  private static createOpponentAnalysis(allPlayers: Player[], playerId: string): string {
    const opponents = allPlayers.filter(p => p.id !== playerId);
    const analysis = opponents.map(opponent => {
      const threat = this.assessThreatLevel(opponent);
      const resourceCount = this.getTotalResources(opponent.resources);
      return `${opponent.id}: ${opponent.victoryPoints} VP, ${resourceCount} resources, ${threat}`;
    });
    
    return `## OPPONENT ANALYSIS
${analysis.join('\n')}`;
  }

  private static createCurrentSituation(gameState: GameState, playerId: string): string {
    const isMyTurn = gameState.players[gameState.currentPlayerIndex].id === playerId;
    const player = gameState.players.find(p => p.id === playerId)!;
    
    let situation = `## CURRENT SITUATION\n`;
    situation += isMyTurn ? '🔥 YOUR TURN' : `Waiting for ${gameState.players[gameState.currentPlayerIndex].id}`;
    
    if (isMyTurn) {
      situation += `\nPhase: ${gameState.phase}`;
      
      if (gameState.phase === 'PRODUCTION') {
        situation += '\n- Must roll dice';
      } else if (gameState.phase === 'ACTION') {
        situation += '\n- Can build, trade, play cards, or end turn';
      } else if (gameState.phase.includes('SETUP')) {
        situation += '\n- Must place settlement and road';
      }
      
      // Add urgent warnings
      const resourceCount = this.getTotalResources(player.resources);
      if (resourceCount > 7) {
        situation += '\n⚠️ URGENT: You have >7 resources - will lose half on next 7 roll!';
      }
    }
    
    return situation;
  }

  // Helper methods
  private static getTotalResources(resources: Resources): number {
    return resources.wood + resources.brick + resources.wool + resources.wheat + resources.ore;
  }

  private static getTotalDevelopmentCards(player: Player): number {
    return player.developmentCards.knight + player.developmentCards.roadBuilding + 
           player.developmentCards.invention + player.developmentCards.monopoly + 
           player.developmentCards.victoryPoint;
  }

  private static getDevelopmentCardBreakdown(player: Player): string {
    const cards = [];
    if (player.developmentCards.knight > 0) cards.push(`Knights: ${player.developmentCards.knight}`);
    if (player.developmentCards.roadBuilding > 0) cards.push(`Road Building: ${player.developmentCards.roadBuilding}`);
    if (player.developmentCards.invention > 0) cards.push(`Invention: ${player.developmentCards.invention}`);
    if (player.developmentCards.monopoly > 0) cards.push(`Monopoly: ${player.developmentCards.monopoly}`);
    if (player.developmentCards.victoryPoint > 0) cards.push(`Victory Points: ${player.developmentCards.victoryPoint}`);
    
    return cards.length > 0 ? `- ${cards.join('\n- ')}` : '- None';
  }

  private static getVictoryPointBreakdown(player: Player): string {
    const parts = [];
    if (player.buildings.settlements.length > 0) parts.push(`${player.buildings.settlements.length} settlements`);
    if (player.buildings.cities.length > 0) parts.push(`${player.buildings.cities.length} cities`);
    if (player.specialCards.longestRoad) parts.push('longest road');
    if (player.specialCards.largestArmy) parts.push('largest army');
    
    const buildingVP = player.buildings.settlements.length + (player.buildings.cities.length * 2);
    const specialVP = (player.specialCards.longestRoad ? 2 : 0) + (player.specialCards.largestArmy ? 2 : 0);
    const devCardVP = player.victoryPoints - buildingVP - specialVP;
    
    if (devCardVP > 0) parts.push(`${devCardVP} from dev cards`);
    
    return parts.length > 0 ? `(${parts.join(', ')})` : '';
  }

  private static getPlayerPosition(player: Player, allPlayers: Player[]): string {
    const sorted = [...allPlayers].sort((a, b) => b.victoryPoints - a.victoryPoints);
    const rank = sorted.findIndex(p => p.id === player.id) + 1;
    const total = allPlayers.length;
    
    if (rank === 1) return `Leading (1st of ${total})`;
    if (rank <= total / 2) return `Competitive (${rank}${this.getOrdinalSuffix(rank)} of ${total})`;
    return `Behind (${rank}${this.getOrdinalSuffix(rank)} of ${total})`;
  }

  private static getOrdinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }

  private static analyzeResourceNeeds(player: Player): string[] {
    const needs = [];
    const resources = player.resources;
    
    // Check for specific building needs
    if (resources.wood < 1 || resources.brick < 1) {
      if (player.buildings.settlements.length < 5) needs.push('Wood/Brick for roads/settlements');
    }
    
    if (resources.wheat < 2 || resources.ore < 3) {
      if (player.buildings.settlements.length > 0) needs.push('Wheat/Ore for cities');
    }
    
    if (resources.wool < 1 || resources.wheat < 1 || resources.ore < 1) {
      needs.push('Wool/Wheat/Ore for development cards');
    }
    
    // Check for overall resource scarcity
    const total = this.getTotalResources(resources);
    if (total < 3) needs.push('Any resources for trading');
    
    return needs;
  }

  private static assessThreatLevel(opponent: Player): string {
    if (opponent.victoryPoints >= 8) return '🚨 HIGH THREAT (near victory)';
    if (opponent.victoryPoints >= 6) return '⚠️ MEDIUM THREAT';
    if (opponent.victoryPoints >= 4) return '⚡ GROWING THREAT';
    return '😴 LOW THREAT';
  }

  /**
   * Create a compact summary for quick decision making
   */
  static createQuickSummary(gameState: GameState, playerId: string): string {
    const player = gameState.players.find(p => p.id === playerId)!;
    const resourceCount = this.getTotalResources(player.resources);
    const isMyTurn = gameState.players[gameState.currentPlayerIndex].id === playerId;
    
    return `Quick Status: ${player.victoryPoints}/10 VP, ${resourceCount} resources, ${gameState.phase}${isMyTurn ? ' (YOUR TURN)' : ''}`;
  }
}