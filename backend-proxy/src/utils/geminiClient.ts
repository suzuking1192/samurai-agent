import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from '@google/generative-ai';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface GeminiResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  processingTime: number;
}

export interface GeminiError {
  error: string;
  errorCode: string;
  details?: any;
}

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 8192,
      }
    });
  }

  /**
   * Generate content using Gemini API
   */
  async generateContent(
    messages: LLMMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      topK?: number;
    }
  ): Promise<GeminiResponse> {
    const startTime = Date.now();

    try {
      // Transform messages to Gemini format
      const geminiMessages = this.transformMessages(messages);
      
      // Configure generation parameters
      const generationConfig: GenerationConfig = {};
      if (options?.temperature !== undefined) {
        generationConfig.temperature = options.temperature;
      }
      if (options?.maxTokens !== undefined) {
        generationConfig.maxOutputTokens = options.maxTokens;
      }
      if (options?.topP !== undefined) {
        generationConfig.topP = options.topP;
      }
      if (options?.topK !== undefined) {
        generationConfig.topK = options.topK;
      }

      // Update model configuration if needed
      if (Object.keys(generationConfig).length > 0) {
        this.model = this.genAI.getGenerativeModel({ 
          model: 'gemini-2.0-flash-exp',
          generationConfig
        });
      }

      // Generate content
      const result = await this.model.generateContent(geminiMessages);
      const response = await result.response;
      const text = response.text();

      // Extract usage information
      const usageMetadata = (response as any).usageMetadata;
      const promptTokens = usageMetadata?.promptTokenCount || 0;
      const completionTokens = usageMetadata?.candidatesTokenCount || 0;
      const totalTokens = usageMetadata?.totalTokenCount || (promptTokens + completionTokens);

      const processingTime = Date.now() - startTime;

      return {
        content: text,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens
        },
        processingTime
      };

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      console.error('Gemini API error:', error);

      // Map Gemini API errors to standardized error codes
      const geminiError = this.mapGeminiError(error);
      throw {
        ...geminiError,
        processingTime
      };
    }
  }

  /**
   * Transform messages from LLM format to Gemini format
   */
  private transformMessages(messages: LLMMessage[]): string {
    let transformedContent = '';

    for (const message of messages) {
      switch (message.role) {
        case 'system':
          transformedContent += `System: ${message.content}\n\n`;
          break;
        case 'user':
          transformedContent += `User: ${message.content}\n\n`;
          break;
        case 'assistant':
          transformedContent += `Assistant: ${message.content}\n\n`;
          break;
      }
    }

    // Remove trailing newlines
    return transformedContent.trim();
  }

  /**
   * Map Gemini API errors to standardized error codes
   */
  private mapGeminiError(error: any): GeminiError {
    const errorMessage = error.message || 'Unknown error';

    // Map common Gemini API errors
    if (errorMessage.includes('API key')) {
      return {
        error: 'Invalid API key',
        errorCode: 'INVALID_API_KEY'
      };
    }

    if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
      return {
        error: 'Rate limit exceeded',
        errorCode: 'RATE_LIMIT'
      };
    }

    if (errorMessage.includes('safety') || errorMessage.includes('blocked')) {
      return {
        error: 'Content blocked by safety filters',
        errorCode: 'SAFETY_FILTER'
      };
    }

    if (errorMessage.includes('timeout')) {
      return {
        error: 'Request timeout',
        errorCode: 'TIMEOUT'
      };
    }

    // Default error mapping
    return {
      error: errorMessage,
      errorCode: 'GEMINI_API_ERROR',
      details: error
    };
  }
}
