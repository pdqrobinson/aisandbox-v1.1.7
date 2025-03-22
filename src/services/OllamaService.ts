import ollama from 'ollama/browser';

export interface OllamaModelInfo {
  name: string;
  size: number;
  modified_at: string;
  digest: string;
}

export interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
}

export interface OllamaResponse {
  model: string;
  message: {
    role: 'assistant';
    content: string;
  };
  done: boolean;
}

export interface OllamaStreamResponse {
  model: string;
  message: {
    role: 'assistant';
    content: string;
  };
  done: boolean;
}

export interface OllamaOptions {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  num_predict?: number;
  stop?: string[];
  repeat_penalty?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  tfs_z?: number;
  mirostat?: number;
  mirostat_tau?: number;
  mirostat_eta?: number;
  seed?: number;
}

class OllamaService {
  private static instance: OllamaService;
  private baseUrl: string;
  
  private constructor() {
    // Default to localhost:11434 which is the standard Ollama port
    this.baseUrl = 'http://localhost:11434';
  }
  
  public static getInstance(): OllamaService {
    if (!OllamaService.instance) {
      OllamaService.instance = new OllamaService();
    }
    return OllamaService.instance;
  }
  
  /**
   * Set the base URL for the Ollama API
   * @param url The base URL for the Ollama API
   */
  public setBaseUrl(url: string): void {
    this.baseUrl = url;
  }
  
  /**
   * Get the base URL for the Ollama API
   * @returns The base URL for the Ollama API
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }
  
  /**
   * List all available models
   * @returns A promise that resolves to an array of model information
   */
  public async listModels(): Promise<OllamaModelInfo[]> {
    try {
      const response = await ollama.list();
      return response.models;
    } catch (error) {
      console.error('Error listing models:', error);
      throw error;
    }
  }
  
  /**
   * Generate a chat completion
   * @param model The model to use
   * @param messages The messages to send to the model
   * @param options Optional parameters for the model
   * @returns A promise that resolves to the model's response
   */
  public async chat(
    model: string,
    messages: OllamaMessage[],
    options?: OllamaOptions
  ): Promise<OllamaResponse> {
    try {
      const response = await ollama.chat({
        model,
        messages,
        options
      });
      
      return response;
    } catch (error) {
      console.error('Error generating chat completion:', error);
      throw error;
    }
  }
  
  /**
   * Generate a streaming chat completion
   * @param model The model to use
   * @param messages The messages to send to the model
   * @param options Optional parameters for the model
   * @param onProgress Callback function for each chunk of the response
   * @returns A promise that resolves when the stream is complete
   */
  public async chatStream(
    model: string,
    messages: OllamaMessage[],
    options?: OllamaOptions,
    onProgress?: (chunk: OllamaStreamResponse) => void
  ): Promise<void> {
    try {
      const response = await ollama.chat({
        model,
        messages,
        options,
        stream: true
      });
      
      for await (const chunk of response) {
        if (onProgress) {
          onProgress(chunk);
        }
      }
    } catch (error) {
      console.error('Error generating streaming chat completion:', error);
      throw error;
    }
  }
  
  /**
   * Generate a completion from a prompt
   * @param model The model to use
   * @param prompt The prompt to send to the model
   * @param options Optional parameters for the model
   * @returns A promise that resolves to the model's response
   */
  public async generate(
    model: string,
    prompt: string,
    options?: OllamaOptions
  ): Promise<string> {
    try {
      const response = await ollama.generate({
        model,
        prompt,
        options
      });
      
      return response.response;
    } catch (error) {
      console.error('Error generating completion:', error);
      throw error;
    }
  }
  
  /**
   * Pull a model from the Ollama library
   * @param model The model to pull
   * @param onProgress Callback function for progress updates
   * @returns A promise that resolves when the pull is complete
   */
  public async pullModel(
    model: string,
    onProgress?: (progress: any) => void
  ): Promise<void> {
    try {
      const response = await ollama.pull({
        model,
        stream: true
      });
      
      for await (const progress of response) {
        if (onProgress) {
          onProgress(progress);
        }
      }
    } catch (error) {
      console.error('Error pulling model:', error);
      throw error;
    }
  }
}

export const ollamaService = OllamaService.getInstance();
