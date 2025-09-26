/**
 * LLM-related data models
 * 
 * Defines the structure for LLM requests, responses, and provider interactions
 * in the Samurai Agent extension.
 */

import { BaseModel } from './index';

/**
 * LLM request model
 */
export interface LLMRequest extends BaseModel {
    provider: string;
    model: string;
    messages: LLMMessage[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stream?: boolean;
    metadata: LLMRequestMetadata;
}

export interface LLMRequestMetadata {
    apiKey?: string;
    provider?: string;
    customApiEndpoints?: Record<string, string>;
    llmModels?: Record<string, Array<{ id: string; maxTokens?: number }>>;
    [key: string]: any;
}

/**
 * LLM message model
 */
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    name?: string;
    metadata?: Record<string, any>;
}

/**
 * LLM response model
 */
export interface LLMResponse extends BaseModel {
    requestId: string;
    provider: string;
    model: string;
    content: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    cost: number;
    processingTime: number;
    metadata: Record<string, any>;
}

/**
 * LLM error model
 */
export interface LLMError extends BaseModel {
    requestId: string;
    provider: string;
    model: string;
    error: string;
    errorCode: string;
    retryable: boolean;
    metadata: Record<string, any>;
}
