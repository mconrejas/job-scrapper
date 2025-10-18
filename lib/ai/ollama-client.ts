import axios from 'axios';

/**
 * Ollama API Client
 * Connects to local Ollama instance for embeddings and LLM generation
 *
 * Install Ollama: https://ollama.com
 * Pull models:
 *   ollama pull nomic-embed-text
 *   ollama pull llama3.1:8b-instruct-q4_0
 */

export interface OllamaConfig {
  baseUrl?: string;
  timeout?: number;
}

export interface EmbeddingResponse {
  embedding: number[];
}

export interface GenerateResponse {
  response: string;
  done: boolean;
}

export class OllamaClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config?: OllamaConfig) {
    this.baseUrl = config?.baseUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    this.timeout = config?.timeout || 300000; // 5 minutes (for large generations)
  }

  /**
   * Generate embeddings for text
   * Uses nomic-embed-text model (768 dimensions)
   */
  async embed(text: string, model: string = 'nomic-embed-text'): Promise<number[]> {
    try {
      const response = await axios.post<EmbeddingResponse>(
        `${this.baseUrl}/api/embeddings`,
        {
          model,
          prompt: text,
        },
        { timeout: this.timeout }
      );

      return response.data.embedding;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error(
            'Cannot connect to Ollama. Make sure Ollama is running (ollama serve) and the model is pulled.'
          );
        }
        throw new Error(`Ollama embedding error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Generate text using LLM
   * Uses llama3.1:8b-instruct by default
   */
  async generate(
    prompt: string,
    model: string = 'llama3.1:8b-instruct-q4_0',
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model,
          prompt,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.7,
            num_predict: options?.maxTokens ?? 2000, // Default 2000 tokens
          },
        },
        { timeout: this.timeout }
      );

      return response.data.response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error(
            'Cannot connect to Ollama. Make sure Ollama is running and the model is pulled.'
          );
        }
        if (error.response?.status === 404) {
          throw new Error(
            `Model "${model}" not found. Pull it with: ollama pull ${model}`
          );
        }
        throw new Error(`Ollama generation error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Chat completion with conversation history
   */
  async chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    model: string = 'llama3.1:8b-instruct-q4_0'
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/chat`,
        {
          model,
          messages,
          stream: false,
        },
        { timeout: this.timeout }
      );

      return response.data.message.content;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Cannot connect to Ollama. Make sure Ollama is running.');
        }
        throw new Error(`Ollama chat error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Check if Ollama is running and model is available
   */
  async checkHealth(model?: string): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
      });

      if (model) {
        const models = response.data.models || [];
        return models.some((m: any) => m.name === model || m.name.startsWith(model));
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
      });

      return (response.data.models || []).map((m: any) => m.name);
    } catch (error) {
      throw new Error('Failed to list Ollama models');
    }
  }
}

// Singleton instance
let ollamaClient: OllamaClient | null = null;

export function getOllamaClient(): OllamaClient {
  if (!ollamaClient) {
    ollamaClient = new OllamaClient();
  }
  return ollamaClient;
}
