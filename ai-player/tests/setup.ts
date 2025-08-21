// Test setup file
import { createLogger } from '../src/utils/logger';

// Suppress logs during testing
const logger = createLogger('Test');
logger.silent = true;

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.OLLAMA_HOST = 'localhost';
process.env.OLLAMA_PORT = '11434';
process.env.OLLAMA_MODEL = 'gemma2:270m';
process.env.FALLBACK_TO_HEURISTIC = 'true';