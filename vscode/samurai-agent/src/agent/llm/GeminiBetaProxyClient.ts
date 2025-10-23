import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { LLMRequest, LLMResponse, LLMError, LLMMessage } from '../../common/models/llm-models';
import { ApiResponse, ResponseType } from '../../common/models/response-models';
import { GlobalDataStore } from '../../persistence/globalDataStore';
import type { ChatClient } from './llmProviderService';

interface ProxyRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  betaCode: string;
}

interface ProxySuccessResponse {
  type: 'success';
  payload: {
    content: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    processingTime: number;
  };
}

interface ProxyErrorResponse {
  type: 'error';
  error: string;
  errorCode: string;
}

type ProxyResponse = ProxySuccessResponse | ProxyErrorResponse;

export class GeminiBetaProxyClient implements ChatClient {
  private readonly proxyBaseUrl: string;
  private readonly maxRetries = 2;
  private readonly retryDelayMs = 1000;
  private readonly requestTimeoutMs = 30000; // 30 seconds

  constructor(private globalDataStore: GlobalDataStore) {
    // Hardcoded proxy URL (will be updated after Render deployment)
    this.proxyBaseUrl = 'https://samurai-agent-beta-proxy.onrender.com/api/gemini-beta';
  }

  async chat(request: LLMRequest): Promise<ApiResponse<LLMResponse | LLMError>> {
    const startTime = Date.now();
    
    try {
      // Get beta code from global settings
      const globalSettings = this.globalDataStore.getSettings();
      const betaCode = globalSettings.betaCode;
      
      if (!betaCode) {
        return this.createErrorResponse(
          request.id,
          'Beta code is required for gemini-2.5-flash-beta model',
          'MISSING_BETA_CODE'
        );
      }

      // Prepare proxy request
      const proxyRequest: ProxyRequest = {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        betaCode: betaCode
      };

      // Attempt request with retry logic
      let lastError: any = null;
      
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          const response = await this.makeProxyRequest(proxyRequest);
          
          if (response.type === 'success') {
            // Transform successful response to LLMResponse
            const llmResponse = this.transformToLLMResponse(request, response.payload, startTime);
            return this.createSuccessResponse(llmResponse);
          } else {
            // Proxy returned an error response
            const llmError = this.transformToLLMError(request, response, startTime);
            return this.createErrorResponse(llmError);
          }
          
        } catch (error: any) {
          lastError = error;
          
          // Check if this is a retryable error
          if (attempt < this.maxRetries && this.isRetryableError(error)) {
            const delay = this.retryDelayMs * Math.pow(2, attempt); // Exponential backoff
            console.log(`[GeminiBetaProxyClient] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
            await this.sleep(delay);
            continue;
          }
          
          // Not retryable or max retries reached
          break;
        }
      }
      
      // All retries failed
      const llmError = this.handleProxyError(request, lastError, startTime);
      return this.createErrorResponse(llmError);
      
    } catch (error: any) {
      const llmError = this.handleProxyError(request, error, startTime);
      return this.createErrorResponse(llmError);
    }
  }

  private async makeProxyRequest(request: ProxyRequest): Promise<ProxyResponse> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.proxyBaseUrl}/chat`);
      const requestBody = JSON.stringify(request);
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          'User-Agent': 'SamuraiAgent-VSCode/1.0.0',
          'Accept': 'application/json'
        },
        timeout: this.requestTimeoutMs
      };

      const client = url.protocol === 'https:' ? https : http;
      const req = client.request(options, (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        
        res.on('end', () => {
          try {
            const response: ProxyResponse = JSON.parse(responseBody);
            resolve(response);
          } catch (parseError) {
            reject(new Error(`Failed to parse proxy response: ${parseError}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Proxy request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Proxy request timeout'));
      });

      req.write(requestBody);
      req.end();
    });
  }

  private transformToLLMResponse(
    request: LLMRequest, 
    payload: ProxySuccessResponse['payload'], 
    startTime: number
  ): LLMResponse {
    return {
      id: request.id,
      requestId: request.id,
      provider: 'google',
      model: request.model,
      content: payload.content,
      usage: payload.usage,
      cost: 0, // Cost will be calculated by LLMProviderService
      processingTime: payload.processingTime,
      metadata: {
        proxyProcessed: true,
        proxyProcessingTime: payload.processingTime,
        totalProcessingTime: Date.now() - startTime
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private transformToLLMError(
    request: LLMRequest, 
    errorResponse: ProxyErrorResponse, 
    startTime: number
  ): LLMError {
    return {
      id: request.id,
      requestId: request.id,
      provider: 'google',
      model: request.model,
      error: errorResponse.error,
      errorCode: errorResponse.errorCode,
      retryable: this.isRetryableErrorCode(errorResponse.errorCode),
      metadata: {
        proxyError: true,
        proxyErrorCode: errorResponse.errorCode,
        totalProcessingTime: Date.now() - startTime
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private handleProxyError(request: LLMRequest, error: any, startTime: number): LLMError {
    let errorCode = 'PROXY_ERROR';
    let errorMessage = 'Proxy request failed';
    let retryable = false;

    if (error.message) {
      if (error.message.includes('timeout')) {
        errorCode = 'PROXY_TIMEOUT';
        errorMessage = 'Proxy request timeout';
        retryable = true;
      } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        errorCode = 'PROXY_UNAVAILABLE';
        errorMessage = 'Proxy service unavailable';
        retryable = true;
      } else if (error.message.includes('parse')) {
        errorCode = 'PROXY_INVALID_RESPONSE';
        errorMessage = 'Invalid response from proxy';
        retryable = false;
      } else {
        errorMessage = error.message;
        retryable = true;
      }
    }

    return {
      id: request.id,
      requestId: request.id,
      provider: 'google',
      model: request.model,
      error: errorMessage,
      errorCode: errorCode,
      retryable: retryable,
      metadata: {
        proxyError: true,
        originalError: error.message || error,
        totalProcessingTime: Date.now() - startTime
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const message = error.message || '';
    
    // Retry on network errors and timeouts
    if (message.includes('timeout') || 
        message.includes('ECONNREFUSED') || 
        message.includes('ENOTFOUND') ||
        message.includes('ETIMEDOUT')) {
      return true;
    }
    
    // Don't retry on parse errors or client errors
    if (message.includes('parse') || 
        message.includes('400') || 
        message.includes('401') || 
        message.includes('403')) {
      return false;
    }
    
    // Retry on server errors (5xx)
    if (message.includes('500') || 
        message.includes('502') || 
        message.includes('503') || 
        message.includes('504')) {
      return true;
    }
    
    return false;
  }

  private isRetryableErrorCode(errorCode: string): boolean {
    const retryableCodes = [
      'RATE_LIMIT',
      'TIMEOUT',
      'PROXY_TIMEOUT',
      'PROXY_UNAVAILABLE',
      'GEMINI_API_ERROR'
    ];
    
    return retryableCodes.includes(errorCode);
  }

  private createSuccessResponse(response: LLMResponse): ApiResponse<LLMResponse> {
    return {
      type: ResponseType.SUCCESS,
      payload: response,
      timestamp: new Date()
    };
  }

  private createErrorResponse(
    requestId: string, 
    error: string, 
    errorCode: string
  ): ApiResponse<LLMError>;
  private createErrorResponse(error: LLMError): ApiResponse<LLMError>;
  private createErrorResponse(
    requestIdOrError: string | LLMError, 
    error?: string, 
    errorCode?: string
  ): ApiResponse<LLMError> {
    if (typeof requestIdOrError === 'string') {
      // First overload: create error from parameters
      const llmError: LLMError = {
        id: requestIdOrError,
        requestId: requestIdOrError,
        provider: 'google',
        model: 'gemini-2.5-flash-beta',
        error: error || 'Unknown error',
        errorCode: errorCode || 'UNKNOWN_ERROR',
        retryable: false,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      return {
        type: ResponseType.ERROR,
        payload: llmError,
        error: error || 'Unknown error',
        timestamp: new Date()
      };
    } else {
      // Second overload: use provided error object
      return {
        type: ResponseType.ERROR,
        payload: requestIdOrError,
        error: requestIdOrError.error,
        timestamp: new Date()
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
