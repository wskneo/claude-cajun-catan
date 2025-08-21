import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { OllamaRequest, OllamaResponse, AIPlayerConfig } from '../types';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';

export class OllamaClient {
  private client: AxiosInstance;
  private logger: Logger;
  private config: AIPlayerConfig;

  constructor(config: AIPlayerConfig) {
    this.config = config;
    this.logger = createLogger('OllamaClient');
    
    const baseURL = `http://${config.ollamaHost}:${config.ollamaPort}`;
    
    this.client = axios.create({
      baseURL,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug('Ollama request', { 
          url: config.url, 
          method: config.method,
          promptLength: typeof config.data === 'object' ? config.data?.prompt?.length : 0
        });
        return config;
      },
      (error) => {
        this.logger.error('Ollama request error', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('Ollama response', { 
          status: response.status,
          responseLength: response.data?.response?.length || 0,
          duration: response.data?.total_duration
        });
        return response;
      },
      (error) => {
        this.logger.error('Ollama response error', {
          status: error.response?.status,
          message: error.message,
          code: error.code
        });
        return Promise.reject(error);
      }
    );
  }

  async generateResponse(prompt: string, options?: Partial<OllamaRequest['options']>): Promise<OllamaResponse> {
    const request: OllamaRequest = {
      model: this.config.model,
      prompt,
      stream: false,
      options: {
        temperature: options?.temperature ?? this.config.temperature,
        top_p: options?.top_p ?? 0.9,
        top_k: options?.top_k ?? 40,
        max_tokens: options?.max_tokens ?? 512,
        stop: options?.stop ?? ['</action>', '\n\n---', 'Human:', 'Assistant:'],
        ...options
      }
    };

    try {
      const startTime = Date.now();
      const response: AxiosResponse<OllamaResponse> = await this.client.post('/api/generate', request);
      const endTime = Date.now();
      
      const result = response.data;
      result.total_duration = endTime - startTime;
      
      this.logger.info('LLM response generated', {
        model: this.config.model,
        promptTokens: result.prompt_eval_count,
        responseTokens: result.eval_count,
        totalDuration: result.total_duration,
        responsePreview: result.response.substring(0, 100)
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to generate LLM response', {
        error: error instanceof Error ? error.message : 'Unknown error',
        model: this.config.model,
        promptPreview: prompt.substring(0, 100)
      });
      throw new Error(`Ollama generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.client.get('/api/version');
      return true;
    } catch (error) {
      this.logger.warn('Ollama health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.get('/api/tags');
      return response.data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      this.logger.error('Failed to list models', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  async pullModel(modelName: string): Promise<boolean> {
    try {
      this.logger.info('Pulling model', { model: modelName });
      
      await this.client.post('/api/pull', {
        name: modelName,
        stream: false
      });
      
      this.logger.info('Model pulled successfully', { model: modelName });
      return true;
    } catch (error) {
      this.logger.error('Failed to pull model', {
        model: modelName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async ensureModelAvailable(): Promise<boolean> {
    try {
      // Check if model is available
      const models = await this.listModels();
      if (models.includes(this.config.model)) {
        this.logger.info('Model is available', { model: this.config.model });
        return true;
      }

      // Try to pull the model
      this.logger.info('Model not found, attempting to pull', { model: this.config.model });
      return await this.pullModel(this.config.model);
    } catch (error) {
      this.logger.error('Failed to ensure model availability', {
        model: this.config.model,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  // Helper method for quick testing
  async testConnection(): Promise<{ success: boolean; model: string; response?: string; error?: string }> {
    try {
      const isHealthy = await this.checkHealth();
      if (!isHealthy) {
        return { success: false, model: this.config.model, error: 'Service unhealthy' };
      }

      const isModelAvailable = await this.ensureModelAvailable();
      if (!isModelAvailable) {
        return { success: false, model: this.config.model, error: 'Model not available' };
      }

      const testResponse = await this.generateResponse(
        'Hello! Can you help me play Catan? Just say "Ready to play!" if you understand.',
        { max_tokens: 50, temperature: 0.3 }
      );

      return {
        success: true,
        model: this.config.model,
        response: testResponse.response.trim()
      };
    } catch (error) {
      return {
        success: false,
        model: this.config.model,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}