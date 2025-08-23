import { OllamaClient } from './ollama-client';
import { GameStateSerializer } from './game-state-serializer';
import { ActionParser } from './action-parser';
import { HeuristicAI } from '../heuristics/heuristic-ai';
import { StrategicPlanner } from './strategic-planner';
import { CatanPrompts } from '../prompts/catan-prompts';
import { StrategicPlannerConfig } from '../types/strategic-types';
import { 
  AIDecisionRequest, 
  AIDecisionResponse, 
  AIPlayerConfig,
  GameState,
  ParsedAction
} from '../types';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';

export class AIDecisionService {
  private ollamaClient: OllamaClient;
  private actionParser: ActionParser;
  private heuristicAI: HeuristicAI;
  private strategicPlanner: StrategicPlanner;
  private logger: Logger;
  private config: AIPlayerConfig;

  constructor(config: AIPlayerConfig, strategicConfig?: Partial<StrategicPlannerConfig>) {
    this.config = config;
    this.logger = createLogger('AIDecisionService');
    this.ollamaClient = new OllamaClient(config);
    this.actionParser = new ActionParser();
    this.heuristicAI = new HeuristicAI();
    this.strategicPlanner = new StrategicPlanner(strategicConfig);
  }

  /**
   * Make an AI decision for the given game state
   */
  async makeDecision(request: AIDecisionRequest): Promise<AIDecisionResponse> {
    const startTime = Date.now();
    const timeoutMs = request.timeoutMs || this.config.timeout;

    this.logger.info('Making AI decision', {
      playerId: request.playerId,
      phase: request.gameState.phase,
      validActions: request.validActions,
      timeout: timeoutMs
    });

    try {
      // Update strategic plan
      this.strategicPlanner.updatePlan(request.gameState, request.playerId);
      
      // Get strategic recommendation first
      const strategicRecommendation = this.strategicPlanner.getStrategicRecommendation(
        request.gameState,
        request.playerId,
        request.validActions
      );

      // If we have a high-priority strategic action, consider using it
      if (strategicRecommendation && strategicRecommendation.priority >= 8) {
        this.logger.info('Using strategic recommendation', {
          playerId: request.playerId,
          actionType: strategicRecommendation.action,
          priority: strategicRecommendation.priority,
          reasoning: strategicRecommendation.reasoning
        });

        const strategicAction = {
          type: strategicRecommendation.action,
          playerId: request.playerId,
          payload: {} // Let the action parser handle specific payload
        };

        return {
          action: strategicAction,
          reasoning: `Strategic decision: ${strategicRecommendation.reasoning}`,
          confidence: 0.85, // High confidence for strategic decisions
          processingTimeMs: Date.now() - startTime
        };
      }

      // Try LLM decision first
      const llmResult = await this.tryLLMDecision(request, timeoutMs);
      if (llmResult.success && llmResult.action) {
        const processingTime = Date.now() - startTime;
        this.logger.info('LLM decision successful', {
          playerId: request.playerId,
          actionType: llmResult.action.type,
          processingTime
        });

        return {
          action: llmResult.action,
          reasoning: llmResult.reasoning || 'LLM decision',
          confidence: 0.8, // High confidence for LLM decisions
          processingTimeMs: processingTime
        };
      }

      // Try strategic recommendation as secondary option
      if (strategicRecommendation && strategicRecommendation.priority >= 5) {
        this.logger.info('Using strategic fallback', {
          playerId: request.playerId,
          actionType: strategicRecommendation.action,
          priority: strategicRecommendation.priority
        });

        const strategicAction = {
          type: strategicRecommendation.action,
          playerId: request.playerId,
          payload: {}
        };

        return {
          action: strategicAction,
          reasoning: `Strategic fallback: ${strategicRecommendation.reasoning}`,
          confidence: 0.7,
          processingTimeMs: Date.now() - startTime
        };
      }

      // Fall back to heuristic AI
      this.logger.warn('Falling back to heuristic AI', {
        playerId: request.playerId,
        llmError: llmResult.error,
        strategicRecommendation: strategicRecommendation?.action || 'none'
      });

      const heuristicAction = this.heuristicAI.makeDecision(
        request.gameState,
        request.playerId,
        request.validActions
      );

      const processingTime = Date.now() - startTime;
      this.logger.info('Heuristic decision made', {
        playerId: request.playerId,
        actionType: heuristicAction.type,
        processingTime
      });

      return {
        action: heuristicAction,
        reasoning: strategicRecommendation ? 
          `Heuristic decision (strategic context: ${strategicRecommendation.reasoning.substring(0, 50)}...)` :
          'Heuristic fallback decision due to LLM unavailability',
        confidence: 0.6, // Lower confidence for fallback
        processingTimeMs: processingTime
      };

    } catch (error) {
      this.logger.error('Decision making failed', {
        playerId: request.playerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Last resort: create safe fallback action
      const fallbackAction = this.actionParser.createFallbackAction(
        request.playerId,
        request.validActions
      );

      return {
        action: fallbackAction,
        reasoning: 'Emergency fallback due to system error',
        confidence: 0.3,
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Try to make a decision using the LLM
   */
  private async tryLLMDecision(
    request: AIDecisionRequest, 
    timeoutMs: number
  ): Promise<{ success: boolean; action?: ParsedAction; reasoning?: string; error?: string }> {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('LLM decision timeout')), timeoutMs);
      });

      // Create LLM decision promise
      const llmPromise = this.generateLLMDecision(request);

      // Race between LLM and timeout
      const result = await Promise.race([llmPromise, timeoutPromise]) as {
        action: ParsedAction;
        reasoning?: string;
      };

      return {
        success: true,
        action: result.action,
        reasoning: result.reasoning
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown LLM error';
      this.logger.warn('LLM decision failed', {
        playerId: request.playerId,
        error: errorMessage
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Generate decision using LLM
   */
  private async generateLLMDecision(request: AIDecisionRequest): Promise<{
    action: ParsedAction;
    reasoning?: string;
  }> {
    // Serialize game state for LLM
    const gameStateText = GameStateSerializer.serializeForLLM(
      request.gameState,
      request.playerId
    );

    // Create appropriate prompt based on game phase and actions
    const prompt = this.createPrompt(
      request.gameState,
      gameStateText,
      request.validActions,
      request.playerId
    );

    // Generate response
    const response = await this.ollamaClient.generateResponse(prompt, {
      temperature: this.config.temperature,
      max_tokens: 512
    });

    // Parse action from response
    const parsedAction = this.actionParser.parseAction(response.response, request.playerId);
    if (!parsedAction) {
      throw new Error('Failed to parse action from LLM response');
    }

    // Validate action is in valid actions list
    if (!request.validActions.includes(parsedAction.type)) {
      this.logger.warn('LLM suggested invalid action', {
        suggested: parsedAction.type,
        validActions: request.validActions
      });
      throw new Error(`Invalid action suggested: ${parsedAction.type}`);
    }

    // Extract reasoning
    const reasoning = this.actionParser.extractReasoning(response.response);

    return {
      action: parsedAction,
      reasoning: reasoning || undefined
    };
  }

  /**
   * Create appropriate prompt based on game context
   */
  private createPrompt(
    gameState: GameState,
    gameStateText: string,
    validActions: string[],
    playerId: string
  ): string {
    // Use specific prompts for different scenarios
    const player = gameState.players.find(p => p.id === playerId)!;

    // Special prompts for specific situations
    if (gameState.phase === 'SETUP_ROUND_1' || gameState.phase === 'SETUP_ROUND_2') {
      return CatanPrompts.createSetupPrompt(gameStateText, gameState.phase, validActions);
    }

    if (gameState.phase === 'PRODUCTION') {
      return CatanPrompts.createProductionPhasePrompt(gameStateText);
    }

    // Action phase decisions
    if (validActions.includes('MOVE_ROBBER')) {
      return CatanPrompts.createRobberPrompt(gameStateText, [], []); // Simplified for heuristic
    }

    if (validActions.includes('DISCARD_RESOURCES')) {
      const totalResources = this.getTotalResources(player.resources);
      const mustDiscard = Math.floor(totalResources / 2);
      return CatanPrompts.createDiscardPrompt(gameStateText, mustDiscard);
    }

    if (validActions.length === 1 && validActions.includes('PLAY_DEVELOPMENT_CARD')) {
      const availableCards = this.getPlayableDevelopmentCards(player);
      return CatanPrompts.createDevelopmentCardPrompt(gameStateText, availableCards);
    }

    // General decision prompt
    return CatanPrompts.createDecisionPrompt(gameStateText, validActions);
  }

  private getTotalResources(resources: any): number {
    return resources.wood + resources.brick + resources.wool + resources.wheat + resources.ore;
  }

  private getPlayableDevelopmentCards(player: any): string[] {
    const cards = [];
    if (player.developmentCards.knight > 0) cards.push('knight');
    if (player.developmentCards.roadBuilding > 0) cards.push('roadBuilding');
    if (player.developmentCards.invention > 0) cards.push('invention');
    if (player.developmentCards.monopoly > 0) cards.push('monopoly');
    if (player.developmentCards.victoryPoint > 0) cards.push('victoryPoint');
    return cards;
  }

  /**
   * Create a strategic plan for the given player
   */
  async createStrategicPlan(gameState: GameState, playerId: string): Promise<void> {
    try {
      this.logger.info('Creating strategic plan', { playerId, turn: gameState.turn });
      await this.strategicPlanner.createStrategicPlan(gameState, playerId);
    } catch (error) {
      this.logger.error('Failed to create strategic plan', {
        playerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Check if the AI service is healthy
   */
  async healthCheck(): Promise<{ healthy: boolean; llmAvailable: boolean; error?: string }> {
    try {
      const llmHealthy = await this.ollamaClient.checkHealth();
      const modelAvailable = await this.ollamaClient.ensureModelAvailable();

      return {
        healthy: llmHealthy || this.config.fallbackToHeuristic,
        llmAvailable: llmHealthy && modelAvailable
      };
    } catch (error) {
      return {
        healthy: this.config.fallbackToHeuristic,
        llmAvailable: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test the AI decision making with a sample game state
   */
  async testDecisionMaking(): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      const testResult = await this.ollamaClient.testConnection();
      if (!testResult.success) {
        return testResult;
      }

      // Test with a simple decision scenario
      const sampleGameState: GameState = {
        id: 'test-game',
        phase: 'ACTION',
        currentPlayerIndex: 0,
        players: [
          {
            id: 'test-player',
            color: 'red',
            resources: { wood: 2, brick: 1, wool: 1, wheat: 1, ore: 0 },
            developmentCards: { knight: 0, roadBuilding: 0, invention: 0, monopoly: 0, victoryPoint: 0 },
            buildings: { roads: [], settlements: [], cities: [] },
            specialCards: { longestRoad: false, largestArmy: false },
            knightsPlayed: 0,
            victoryPoints: 0,
            canPlayDevCard: true
          }
        ],
        board: {} as any,
        developmentCardDeck: [],
        turn: 1
      };

      const request: AIDecisionRequest = {
        gameState: sampleGameState,
        playerId: 'test-player',
        validActions: ['BUILD_ROAD', 'END_TURN'],
        timeoutMs: 5000
      };

      const decision = await this.makeDecision(request);
      
      return {
        success: true,
        response: `Decision: ${decision.action.type} (confidence: ${decision.confidence})`
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}