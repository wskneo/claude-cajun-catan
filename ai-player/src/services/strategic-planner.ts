import { 
  StrategicGoal, 
  StrategicPlan, 
  VictoryPath, 
  GameSituation, 
  StrategicAnalysis,
  PlannedTurn,
  PlannedAction,
  StrategicPlannerConfig 
} from '../types/strategic-types';
import { GameState, Player, Resources } from '../types';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';

export class StrategicPlanner {
  private logger: Logger;
  private config: StrategicPlannerConfig;
  private currentPlan?: StrategicPlan;

  constructor(config?: Partial<StrategicPlannerConfig>) {
    this.logger = createLogger('StrategicPlanner');
    this.config = {
      planningHorizon: 5, // Plan 5 turns ahead
      replanThreshold: 0.3, // Replan if situation changes by 30%
      goalPriorityWeights: {
        victoryPoints: 1.0,
        resourceEfficiency: 0.7,
        opponentBlocking: 0.8,
        riskMitigation: 0.6
      },
      enableOpportunisticPlanning: true,
      maxConcurrentGoals: 3,
      ...config
    };
  }

  /**
   * Create or update strategic plan for a player
   */
  async createStrategicPlan(gameState: GameState, playerId: string): Promise<StrategicPlan> {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    this.logger.info('Creating strategic plan', {
      playerId,
      turn: gameState.turn,
      victoryPoints: player.victoryPoints,
      phase: gameState.phase
    });

    // Analyze current game situation
    const analysis = this.analyzeGameSituation(gameState, player);
    
    // Identify possible victory paths
    const victoryPaths = this.analyzeVictoryPaths(gameState, player);
    
    // Generate strategic goals based on analysis
    const goals = this.generateStrategicGoals(analysis, victoryPaths, player);
    
    // Create turn-by-turn plan
    const turnSequence = this.planTurnSequence(gameState, player, goals);

    const plan: StrategicPlan = {
      goals,
      currentGoal: goals.length > 0 ? goals[0].id : undefined,
      turnSequence,
      lastUpdatedTurn: gameState.turn,
      confidence: this.calculatePlanConfidence(analysis, goals)
    };

    this.currentPlan = plan;

    this.logger.info('Strategic plan created', {
      playerId,
      goalCount: goals.length,
      primaryGoal: plan.currentGoal,
      confidence: plan.confidence,
      plannedTurns: turnSequence.length
    });

    return plan;
  }

  /**
   * Get strategic recommendation for current turn
   */
  getStrategicRecommendation(
    gameState: GameState, 
    playerId: string, 
    validActions: string[]
  ): { action: string; reasoning: string; priority: number } | null {
    if (!this.currentPlan || this.shouldReplan(gameState)) {
      this.logger.info('Replanning due to changed circumstances', { playerId, turn: gameState.turn });
      // Note: In practice, this would be async, but for integration we'll make it synchronous
      // This is a simplification for the initial implementation
    }

    const currentTurn = this.findCurrentPlannedTurn(gameState.turn);
    if (!currentTurn) {
      this.logger.warn('No planned turn found', { turn: gameState.turn, playerId });
      return null;
    }

    // Find the best action from planned actions that's also valid
    const validPlannedActions = currentTurn.plannedActions.filter(action => 
      validActions.includes(action.type)
    );

    if (validPlannedActions.length === 0) {
      this.logger.warn('No valid planned actions', { 
        validActions, 
        plannedActions: currentTurn.plannedActions.map(a => a.type)
      });
      return null;
    }

    // Return highest priority valid action
    const bestAction = validPlannedActions.reduce((best, current) => 
      current.priority > best.priority ? current : best
    );

    const goal = this.currentPlan?.goals.find(g => g.id === currentTurn.goalId);

    return {
      action: bestAction.type,
      reasoning: `Strategic action for goal: ${goal?.description || 'Unknown goal'}. ${bestAction.expectedOutcome}`,
      priority: bestAction.priority
    };
  }

  /**
   * Update plan based on new game state
   */
  updatePlan(gameState: GameState, playerId: string): void {
    if (!this.currentPlan) return;

    // Mark completed goals
    this.markCompletedGoals(gameState, playerId);
    
    // Update plan confidence
    const player = gameState.players.find(p => p.id === playerId)!;
    const analysis = this.analyzeGameSituation(gameState, player);
    this.currentPlan.confidence = this.calculatePlanConfidence(analysis, this.currentPlan.goals);
    
    // Update active goal if current one is completed
    if (this.currentPlan.currentGoal) {
      const currentGoal = this.currentPlan.goals.find(g => g.id === this.currentPlan!.currentGoal);
      if (currentGoal?.completed) {
        const nextGoal = this.currentPlan.goals.find(g => !g.completed);
        this.currentPlan.currentGoal = nextGoal?.id;
      }
    }

    this.logger.debug('Plan updated', {
      playerId,
      turn: gameState.turn,
      confidence: this.currentPlan.confidence,
      currentGoal: this.currentPlan.currentGoal
    });
  }

  /**
   * Analyze current game situation
   */
  private analyzeGameSituation(gameState: GameState, player: Player): StrategicAnalysis {
    const opponents = gameState.players.filter(p => p.id !== player.id);
    const maxOpponentVP = Math.max(...opponents.map(p => p.victoryPoints));
    const avgOpponentVP = opponents.reduce((sum, p) => sum + p.victoryPoints, 0) / opponents.length;

    // Determine player position
    let position: GameSituation['myPosition'] = 'competitive';
    if (player.victoryPoints > maxOpponentVP + 1) {
      position = 'leading';
    } else if (maxOpponentVP >= 8) {
      position = 'desperate'; // Urgent situation takes precedence
    } else if (player.victoryPoints < avgOpponentVP - 1) {
      position = 'behind';
    }

    // Estimate turns remaining (simplified)
    const turnsRemaining = Math.max(1, Math.ceil((10 - maxOpponentVP) / 1.5));

    // Identify threats
    const threats = opponents
      .filter(p => p.victoryPoints >= 7)
      .map(p => ({
        playerId: p.id,
        type: 'near_victory' as const,
        severity: p.victoryPoints, 
        countermeasures: ['MOVE_ROBBER', 'BLOCK_EXPANSION']
      }));


    // Identify opportunities (simplified)
    const opportunities = [
      {
        type: 'expansion' as const,
        value: 10 - player.buildings.settlements.length,
        difficulty: 5,
        timeframe: 'short_term' as const
      }
    ];

    const situation: GameSituation = {
      myPosition: position,
      turnsRemaining,
      threats,
      opportunities
    };

    // Analyze victory paths
    const victoryPaths = this.analyzeVictoryPaths(gameState, player);
    
    // Determine recommended strategy
    let recommendedStrategy: StrategicAnalysis['recommendedStrategy'] = 'resource_accumulation';
    if (position === 'leading') {
      recommendedStrategy = 'defensive_blocking';
    } else if (position === 'desperate' || turnsRemaining <= 3) {
      recommendedStrategy = 'aggressive_expansion';
    } else if (player.developmentCards.knight + player.developmentCards.victoryPoint >= 2) {
      recommendedStrategy = 'development_focus';
    }

    return {
      situation,
      victoryPaths,
      recommendedStrategy,
      keyFactors: [
        {
          factor: 'Victory Points Gap',
          impact: maxOpponentVP - player.victoryPoints,
          description: `${player.victoryPoints} VP vs max opponent ${maxOpponentVP} VP`
        },
        {
          factor: 'Resource Position',
          impact: this.calculateResourceStrength(player.resources),
          description: 'Overall resource accumulation strength'
        }
      ]
    };
  }

  /**
   * Analyze possible victory paths
   */
  private analyzeVictoryPaths(gameState: GameState, player: Player): VictoryPath[] {
    const paths: VictoryPath[] = [];

    // Settlement/City path
    const buildingVP = player.buildings.settlements.length + (player.buildings.cities.length * 2);
    paths.push({
      type: 'settlements_cities',
      currentProgress: buildingVP,
      targetVP: 8, // Need 8 VP from buildings to likely win
      estimatedTurns: Math.ceil((8 - buildingVP) / 1.5),
      feasibility: this.calculateBuildingFeasibility(player),
      requirements: {
        resources: { wood: 4, brick: 4, wool: 2, wheat: 4, ore: 6 },
        actions: ['BUILD_SETTLEMENT', 'BUILD_CITY'],
        turns: 4
      }
    });

    // Development card path
    const devCardVP = player.developmentCards.victoryPoint + (player.specialCards.largestArmy ? 2 : 0);
    paths.push({
      type: 'development_cards',
      currentProgress: devCardVP,
      targetVP: 6, // Reasonable target from dev cards
      estimatedTurns: Math.ceil((6 - devCardVP) * 2),
      feasibility: this.calculateDevCardFeasibility(player),
      requirements: {
        resources: { wool: 6, wheat: 6, ore: 6 },
        actions: ['BUY_DEVELOPMENT_CARD', 'PLAY_DEVELOPMENT_CARD'],
        turns: 6
      }
    });

    // Longest road path
    const roadVP = player.specialCards.longestRoad ? 2 : 0;
    paths.push({
      type: 'longest_road',
      currentProgress: roadVP,
      targetVP: 2,
      estimatedTurns: player.buildings.roads.length >= 5 ? 2 : 4,
      feasibility: this.calculateRoadFeasibility(gameState, player),
      requirements: {
        resources: { wood: 6, brick: 6 },
        actions: ['BUILD_ROAD'],
        turns: 3
      }
    });

    return paths.sort((a, b) => b.feasibility - a.feasibility);
  }

  /**
   * Generate strategic goals based on analysis
   */
  private generateStrategicGoals(
    analysis: StrategicAnalysis, 
    victoryPaths: VictoryPath[], 
    player: Player
  ): StrategicGoal[] {
    const goals: StrategicGoal[] = [];
    let goalId = 1;

    // Primary victory goal based on best path
    const bestPath = victoryPaths[0];
    if (bestPath.feasibility > 0.3) {
      goals.push({
        id: `goal_${goalId++}`,
        type: this.mapVictoryPathToGoalType(bestPath.type),
        priority: 9,
        description: `Win via ${bestPath.type}: achieve ${bestPath.targetVP} VP`,
        targetTurns: bestPath.estimatedTurns,
        requiredResources: bestPath.requirements.resources,
        requiredActions: bestPath.requirements.actions,
        victoryPointValue: bestPath.targetVP,
        completed: false
      });
    }

    // Resource control goal if needed
    const resourceNeeds = this.analyzeResourceNeeds(player);
    if (resourceNeeds.length > 0) {
      goals.push({
        id: `goal_${goalId++}`,
        type: 'resource_control',
        priority: 6,
        description: `Secure consistent access to: ${resourceNeeds.join(', ')}`,
        targetTurns: 3,
        requiredActions: ['BUILD_SETTLEMENT', 'TRADE_WITH_BANK'],
        victoryPointValue: 0,
        completed: false
      });
    }

    // Blocking goal if opponents are close to winning
    const urgentThreats = analysis.situation.threats.filter(t => t.severity >= 7);
    if (urgentThreats.length > 0) {
      goals.push({
        id: `goal_${goalId++}`,
        type: 'blocking',
        priority: urgentThreats[0].severity >= 9 ? 10 : 8, // Max priority if opponent very close
        description: `Block ${urgentThreats[0].playerId} from winning`,
        targetTurns: 2,
        requiredActions: ['MOVE_ROBBER', 'BUILD_SETTLEMENT'],
        victoryPointValue: 0,
        completed: false
      });
    }

    return goals
      .sort((a, b) => b.priority - a.priority) // Sort by priority descending
      .slice(0, this.config.maxConcurrentGoals);
  }

  /**
   * Plan sequence of turns to achieve goals
   */
  private planTurnSequence(gameState: GameState, player: Player, goals: StrategicGoal[]): PlannedTurn[] {
    const sequence: PlannedTurn[] = [];
    const currentTurn = gameState.turn;

    for (let i = 0; i < this.config.planningHorizon; i++) {
      const turnNumber = currentTurn + i;
      const activeGoal = goals.find(g => !g.completed) || goals[0];
      
      if (!activeGoal) break;

      const plannedActions = this.planActionsForGoal(activeGoal, player, i);
      
      sequence.push({
        turnNumber,
        goalId: activeGoal.id,
        plannedActions,
        expectedResources: this.projectResources(player.resources, i),
        contingencies: [
          {
            type: 'END_TURN',
            priority: 1,
            expectedOutcome: 'Safe fallback if no better actions available'
          }
        ]
      });
    }

    return sequence;
  }

  // Helper methods
  private shouldReplan(gameState: GameState): boolean {
    if (!this.currentPlan) return true;
    
    const turnsSinceLastPlan = gameState.turn - this.currentPlan.lastUpdatedTurn;
    return turnsSinceLastPlan > 2 || this.currentPlan.confidence < this.config.replanThreshold;
  }

  private findCurrentPlannedTurn(turnNumber: number): PlannedTurn | undefined {
    return this.currentPlan?.turnSequence.find(t => t.turnNumber === turnNumber);
  }

  private markCompletedGoals(gameState: GameState, playerId: string): void {
    if (!this.currentPlan) return;
    
    const player = gameState.players.find(p => p.id === playerId)!;
    
    // Goal completion detection
    this.currentPlan.goals.forEach(goal => {
      if (goal.completed) return; // Already completed
      
      // Victory-related goals
      if (goal.type === 'victory_rush' && player.victoryPoints >= 10) {
        goal.completed = true;
      }
      
      // Expansion goals (simplified completion check)
      if (goal.type === 'expansion') {
        const totalBuildings = player.buildings.settlements.length + player.buildings.cities.length;
        if (totalBuildings >= 4) { // Reasonable expansion threshold
          goal.completed = true;
        }
      }
      
      // Development goals
      if (goal.type === 'development') {
        const totalDevCards = Object.values(player.developmentCards).reduce((sum, count) => sum + count, 0);
        if (totalDevCards >= 3 || player.specialCards.largestArmy) {
          goal.completed = true;
        }
      }
      
      // Resource control goals
      if (goal.type === 'resource_control') {
        const totalResources = Object.values(player.resources).reduce((sum, count) => sum + count, 0);
        if (totalResources >= 8) { // Has reasonable resource base
          goal.completed = true;
        }
      }
      
      // Blocking goals (completed if threat is reduced)
      if (goal.type === 'blocking') {
        const maxOpponentVP = Math.max(...gameState.players.filter(p => p.id !== playerId).map(p => p.victoryPoints));
        if (maxOpponentVP <= 6) { // Threat is no longer urgent
          goal.completed = true;
        }
      }
      
      // Game won - all goals completed
      if (gameState.winner === playerId) {
        goal.completed = true;
      }
    });
  }

  private calculatePlanConfidence(analysis: StrategicAnalysis, goals: StrategicGoal[]): number {
    if (goals.length === 0) return 0;
    
    const avgGoalFeasibility = goals.reduce((sum, goal) => {
      // Simplified feasibility calculation
      return sum + (goal.priority / 10);
    }, 0) / goals.length;
    
    const situationStability = analysis.situation.threats.length === 0 ? 0.8 : 0.4;
    
    return Math.min(1, (avgGoalFeasibility + situationStability) / 2);
  }

  private calculateResourceStrength(resources: Resources): number {
    const total = resources.wood + resources.brick + resources.wool + resources.wheat + resources.ore;
    return Math.min(10, total) - 5; // -5 to +5 scale
  }

  private calculateBuildingFeasibility(player: Player): number {
    const resourcesForBuilding = player.resources.wood + player.resources.brick + 
                               player.resources.wool + player.resources.wheat + player.resources.ore;
    return Math.min(1, resourcesForBuilding / 10);
  }

  private calculateDevCardFeasibility(player: Player): number {
    const devCardResources = player.resources.wool + player.resources.wheat + player.resources.ore;
    return Math.min(1, devCardResources / 6);
  }

  private calculateRoadFeasibility(gameState: GameState, player: Player): number {
    const roadResources = player.resources.wood + player.resources.brick;
    const roadCount = player.buildings.roads.length;
    return Math.min(1, (roadResources / 4) * (roadCount / 8));
  }

  private mapVictoryPathToGoalType(pathType: VictoryPath['type']): StrategicGoal['type'] {
    switch (pathType) {
      case 'settlements_cities': return 'expansion';
      case 'development_cards': return 'development';
      case 'longest_road': return 'expansion';
      default: return 'victory_rush';
    }
  }

  private analyzeResourceNeeds(player: Player): string[] {
    const needs: string[] = [];
    
    if (player.resources.wood < 2) needs.push('wood');
    if (player.resources.brick < 2) needs.push('brick');
    if (player.resources.wool < 2) needs.push('wool');
    if (player.resources.wheat < 2) needs.push('wheat');
    if (player.resources.ore < 1) needs.push('ore');
    
    return needs;
  }

  private planActionsForGoal(goal: StrategicGoal, player: Player, turnOffset: number): PlannedAction[] {
    const actions: PlannedAction[] = [];
    
    // Simplified action planning based on goal type
    switch (goal.type) {
      case 'expansion':
        if (this.canAffordSettlement(player)) {
          actions.push({
            type: 'BUILD_SETTLEMENT',
            priority: 8,
            expectedOutcome: 'Gain 1 VP and resource access',
            resourceCost: { wood: 1, brick: 1, wool: 1, wheat: 1 }
          });
        } else {
          actions.push({
            type: 'TRADE_WITH_BANK',
            priority: 6,
            expectedOutcome: 'Get resources needed for settlement'
          });
        }
        break;
        
      case 'development':
        if (this.canAffordDevelopmentCard(player)) {
          actions.push({
            type: 'BUY_DEVELOPMENT_CARD',
            priority: 7,
            expectedOutcome: 'Progress toward largest army or victory points',
            resourceCost: { wool: 1, wheat: 1, ore: 1 }
          });
        }
        break;
        
      case 'blocking':
        actions.push({
          type: 'BUILD_SETTLEMENT',
          priority: 9,
          expectedOutcome: 'Block opponent expansion'
        });
        break;
    }
    
    // Always consider ending turn as low priority option
    actions.push({
      type: 'END_TURN',
      priority: 2,
      expectedOutcome: 'End turn safely'
    });
    
    return actions.sort((a, b) => b.priority - a.priority);
  }

  private projectResources(currentResources: Resources, turnsAhead: number): Resources {
    // Simplified resource projection (assume some production per turn)
    const productionPerTurn = 2; // Average resources per turn
    const totalProduction = productionPerTurn * turnsAhead;
    
    return {
      wood: currentResources.wood + Math.floor(totalProduction * 0.2),
      brick: currentResources.brick + Math.floor(totalProduction * 0.2),
      wool: currentResources.wool + Math.floor(totalProduction * 0.2),
      wheat: currentResources.wheat + Math.floor(totalProduction * 0.2),
      ore: currentResources.ore + Math.floor(totalProduction * 0.2)
    };
  }

  private canAffordSettlement(player: Player): boolean {
    return player.resources.wood >= 1 && player.resources.brick >= 1 && 
           player.resources.wool >= 1 && player.resources.wheat >= 1;
  }

  private canAffordDevelopmentCard(player: Player): boolean {
    return player.resources.wool >= 1 && player.resources.wheat >= 1 && player.resources.ore >= 1;
  }
}