import { Router, Request, Response } from 'express';
import { AIDecisionService } from '../services/ai-decision-service';
import { AIDecisionRequest, AIPlayerConfig } from '../types';
import { createLogger } from '../utils/logger';
import Joi from 'joi';

const logger = createLogger('AIRoutes');

// Validation schemas
const decisionRequestSchema = Joi.object({
  gameState: Joi.object({
    id: Joi.string().required(),
    phase: Joi.string().valid('SETUP_ROUND_1', 'SETUP_ROUND_2', 'PRODUCTION', 'ACTION', 'GAME_OVER').required(),
    currentPlayerIndex: Joi.number().min(0).required(),
    players: Joi.array().items(Joi.object({
      id: Joi.string().required(),
      color: Joi.string().required(),
      resources: Joi.object({
        wood: Joi.number().min(0).required(),
        brick: Joi.number().min(0).required(),
        wool: Joi.number().min(0).required(),
        wheat: Joi.number().min(0).required(),
        ore: Joi.number().min(0).required()
      }).required(),
      developmentCards: Joi.object({
        knight: Joi.number().min(0).required(),
        roadBuilding: Joi.number().min(0).required(),
        invention: Joi.number().min(0).required(),
        monopoly: Joi.number().min(0).required(),
        victoryPoint: Joi.number().min(0).required()
      }).required(),
      buildings: Joi.object({
        roads: Joi.array().items(Joi.string()).required(),
        settlements: Joi.array().items(Joi.string()).required(),
        cities: Joi.array().items(Joi.string()).required()
      }).required(),
      specialCards: Joi.object({
        longestRoad: Joi.boolean().required(),
        largestArmy: Joi.boolean().required()
      }).required(),
      knightsPlayed: Joi.number().min(0).required(),
      victoryPoints: Joi.number().min(0).required(),
      canPlayDevCard: Joi.boolean().required()
    })).min(2).max(4).required(),
    board: Joi.object().required(),
    developmentCardDeck: Joi.array().items(Joi.string()).required(),
    turn: Joi.number().min(1).required(),
    diceRoll: Joi.array().items(Joi.number().min(1).max(6)).length(2).optional(),
    winner: Joi.string().optional()
  }).required(),
  playerId: Joi.string().required(),
  validActions: Joi.array().items(Joi.string()).min(1).required(),
  timeoutMs: Joi.number().min(1000).max(30000).optional()
});

export function createAIRoutes(aiService: AIDecisionService): Router {
  const router = Router();

  /**
   * POST /decision - Make an AI decision
   */
  router.post('/decision', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Validate request
      const { error, value } = decisionRequestSchema.validate(req.body);
      if (error) {
        logger.warn('Invalid decision request', { 
          error: error.details[0].message,
          body: req.body 
        });
        return res.status(400).json({
          error: 'Invalid request',
          details: error.details[0].message
        });
      }

      const request: AIDecisionRequest = value;
      
      logger.info('Processing AI decision request', {
        playerId: request.playerId,
        phase: request.gameState.phase,
        validActions: request.validActions,
        requestId: req.headers['x-request-id'] || 'unknown'
      });

      // Make decision
      const decision = await aiService.makeDecision(request);
      
      const totalTime = Date.now() - startTime;
      logger.info('AI decision completed', {
        playerId: request.playerId,
        actionType: decision.action.type,
        confidence: decision.confidence,
        totalTime
      });

      res.json({
        success: true,
        decision: decision,
        meta: {
          requestTime: new Date().toISOString(),
          processingTimeMs: totalTime
        }
      });

    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error('AI decision request failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime: totalTime,
        requestId: req.headers['x-request-id'] || 'unknown'
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process AI decision request',
        meta: {
          requestTime: new Date().toISOString(),
          processingTimeMs: totalTime
        }
      });
    }
  });

  /**
   * GET /health - Health check endpoint
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await aiService.healthCheck();
      
      const status = health.healthy ? 200 : 503;
      
      res.status(status).json({
        healthy: health.healthy,
        llmAvailable: health.llmAvailable,
        timestamp: new Date().toISOString(),
        service: 'ai-player',
        version: process.env.npm_package_version || '1.0.0',
        error: health.error
      });

    } catch (error) {
      logger.error('Health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(503).json({
        healthy: false,
        llmAvailable: false,
        timestamp: new Date().toISOString(),
        service: 'ai-player',
        error: 'Health check failed'
      });
    }
  });

  /**
   * GET /status - Detailed status information
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const health = await aiService.healthCheck();
      
      res.json({
        service: 'ai-player',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        health: health,
        config: {
          model: process.env.OLLAMA_MODEL || 'gemma2:270m',
          ollamaHost: process.env.OLLAMA_HOST || 'localhost',
          ollamaPort: process.env.OLLAMA_PORT || '11434',
          timeout: process.env.AI_TIMEOUT || '10000',
          fallbackToHeuristic: process.env.FALLBACK_TO_HEURISTIC !== 'false'
        }
      });

    } catch (error) {
      logger.error('Status check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        service: 'ai-player',
        timestamp: new Date().toISOString(),
        error: 'Status check failed'
      });
    }
  });

  /**
   * POST /test - Test AI decision making
   */
  router.post('/test', async (req: Request, res: Response) => {
    try {
      const testResult = await aiService.testDecisionMaking();
      
      const status = testResult.success ? 200 : 500;
      
      res.status(status).json({
        success: testResult.success,
        response: testResult.response,
        error: testResult.error,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('AI test failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Test execution failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * POST /plan - Create strategic plan for a player
   */
  router.post('/plan', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Simple validation for planning request
      const { gameState, playerId } = req.body;
      
      if (!gameState || !playerId) {
        return res.status(400).json({
          error: 'Invalid request',
          details: 'gameState and playerId are required'
        });
      }

      logger.info('Creating strategic plan', {
        playerId,
        phase: gameState.phase,
        turn: gameState.turn,
        requestId: req.headers['x-request-id'] || 'unknown'
      });

      // Create strategic plan
      await aiService.createStrategicPlan(gameState, playerId);
      
      const totalTime = Date.now() - startTime;
      logger.info('Strategic plan created', {
        playerId,
        processingTime: totalTime
      });

      res.json({
        success: true,
        message: 'Strategic plan created successfully',
        meta: {
          requestTime: new Date().toISOString(),
          processingTimeMs: totalTime
        }
      });

    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error('Strategic plan creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: totalTime,
        requestId: req.headers['x-request-id'] || 'unknown'
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create strategic plan',
        meta: {
          requestTime: new Date().toISOString(),
          processingTimeMs: totalTime
        }
      });
    }
  });

  /**
   * GET /metrics - Basic metrics endpoint
   */
  router.get('/metrics', (req: Request, res: Response) => {
    const metrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      timestamp: new Date().toISOString(),
      nodejs_version: process.version,
      platform: process.platform,
      architecture: process.arch
    };

    res.json(metrics);
  });

  return router;
}