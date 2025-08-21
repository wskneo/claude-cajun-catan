import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { AIDecisionService } from './services/ai-decision-service';
import { createAIRoutes } from './routes/ai-routes';
import { AIPlayerConfig } from './types';
import { createLogger } from './utils/logger';
import fs from 'fs';
import path from 'path';

const logger = createLogger('Server');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configuration
const config: AIPlayerConfig = {
  model: process.env.OLLAMA_MODEL || 'gemma2:270m',
  ollamaHost: process.env.OLLAMA_HOST || 'localhost',
  ollamaPort: parseInt(process.env.OLLAMA_PORT || '11434'),
  timeout: parseInt(process.env.AI_TIMEOUT || '10000'),
  temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
  fallbackToHeuristic: process.env.FALLBACK_TO_HEURISTIC !== 'false',
  enableReasoningLog: process.env.ENABLE_REASONING_LOG === 'true'
};

const PORT = parseInt(process.env.PORT || '3001');

async function startServer() {
  try {
    logger.info('Starting AI Player Service...', { config });

    // Create Express app
    const app = express();

    // Security middleware
    app.use(helmet());
    app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // Body parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    app.use((req, res, next) => {
      const startTime = Date.now();
      const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      req.headers['x-request-id'] = requestId;
      
      logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        requestId
      });

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info('Request completed', {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration,
          requestId
        });
      });

      next();
    });

    // Initialize AI service
    logger.info('Initializing AI Decision Service...');
    const aiService = new AIDecisionService(config);

    // Wait for Ollama to be ready
    logger.info('Checking Ollama connection...');
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds
    
    while (attempts < maxAttempts) {
      const health = await aiService.healthCheck();
      if (health.llmAvailable) {
        logger.info('Ollama connection established');
        break;
      }
      
      attempts++;
      if (attempts >= maxAttempts) {
        if (config.fallbackToHeuristic) {
          logger.warn('Ollama not available, but fallback enabled. Starting with heuristic AI only.');
          break;
        } else {
          throw new Error('Ollama not available and fallback disabled');
        }
      }
      
      logger.info(`Waiting for Ollama... (${attempts}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Routes
    app.use('/ai', createAIRoutes(aiService));

    // Root endpoint
    app.get('/', (req, res) => {
      res.json({
        service: 'Catan AI Player Service',
        version: process.env.npm_package_version || '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
          decision: 'POST /ai/decision',
          health: 'GET /ai/health',
          status: 'GET /ai/status',
          test: 'POST /ai/test',
          metrics: 'GET /ai/metrics'
        }
      });
    });

    // 404 handler
    app.use((req, res) => {
      logger.warn('Route not found', { 
        method: req.method, 
        url: req.url,
        requestId: req.headers['x-request-id']
      });
      
      res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.url} not found`
      });
    });

    // Error handler
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        requestId: req.headers['x-request-id']
      });

      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    });

    // Start server
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info('🚀 AI Player Service started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        model: config.model,
        fallbackEnabled: config.fallbackToHeuristic
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          // Cleanup operations here if needed
          logger.info('Cleanup completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during cleanup', { 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          process.exit(1);
        }
      });

      // Force exit after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { 
        error: error.message, 
        stack: error.stack 
      });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { 
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined
      });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Start the server
startServer();