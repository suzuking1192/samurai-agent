/**
 * LLM Models Constants
 * 
 * Centralized definition of available LLM models and their associated costs
 * for use across the Samurai Agent extension.
 */

/**
 * LLM Model definition interface
 */
export interface LLMModel {
    id: string;
    name: string;
    provider: string;
    inputCostPerMTokens: number;
    outputCostPerMTokens: number;
    description?: string;
    maxTokens?: number;
    supportsStreaming?: boolean;
}

/**
 * Available LLM models with their cost information
 * 
 * This constant contains all supported LLM models organized by provider.
 * Cost values are in USD per million tokens.
 */
export const LLM_MODELS: Record<string, LLMModel[]> = {
    openai: [
        {
            id: 'gpt-4o',
            name: 'GPT-4o',
            provider: 'openai',
            inputCostPerMTokens: 2.50,
            outputCostPerMTokens: 10.00,
            description: 'Most capable GPT-4 model with vision capabilities',
            maxTokens: 128000,
            supportsStreaming: true
        },
        {
            id: 'gpt-5',
            name: 'GPT-5',
            provider: 'openai',
            inputCostPerMTokens: 5.00,
            outputCostPerMTokens: 15.00,
            description: 'Next-generation GPT model (placeholder for future release)',
            maxTokens: 200000,
            supportsStreaming: true
        }
    ],
    google: [
        {
            id: 'gemini-2.5-flash',
            name: 'Gemini 2.5 Flash',
            provider: 'google',
            inputCostPerMTokens: 0.075,
            outputCostPerMTokens: 0.30,
            description: 'Fast and efficient Gemini model for quick responses',
            maxTokens: 1000000,
            supportsStreaming: true
        },
        {
            id: 'gemini-2.5-pro',
            name: 'Gemini 2.5 Pro',
            provider: 'google',
            inputCostPerMTokens: 1.25,
            outputCostPerMTokens: 5.00,
            description: 'Most capable Gemini model for complex tasks',
            maxTokens: 2000000,
            supportsStreaming: true
        }
    ],
    anthropic: [
        {
            id: 'claude-sonnet-4-20250514',
            name: 'Claude Sonnet 4',
            provider: 'anthropic',
            inputCostPerMTokens: 3.00,
            outputCostPerMTokens: 15.00,
            description: 'Balanced Claude model with strong reasoning capabilities',
            maxTokens: 200000,
            supportsStreaming: true
        },
        {
            id: 'claude-opus-4-1-20250805',
            name: 'Claude Opus 4.1',
            provider: 'anthropic',
            inputCostPerMTokens: 15.00,
            outputCostPerMTokens: 75.00,
            description: 'Most capable Claude model for complex reasoning tasks',
            maxTokens: 200000,
            supportsStreaming: true
        },
        {
            id: 'claude-3-5-haiku-20241022',
            name: 'Claude 3.5 Haiku',
            provider: 'anthropic',
            inputCostPerMTokens: 0.25,
            outputCostPerMTokens: 1.25,
            description: 'Fast and cost-effective Claude model',
            maxTokens: 200000,
            supportsStreaming: true
        }
    ]
};

/**
 * Get all models as a flat array
 */
export function getAllModels(): LLMModel[] {
    return Object.values(LLM_MODELS).flat();
}

/**
 * Get models for a specific provider
 */
export function getModelsByProvider(provider: string): LLMModel[] {
    return LLM_MODELS[provider] || [];
}

/**
 * Get a specific model by ID
 */
export function getModelById(modelId: string): LLMModel | undefined {
    return getAllModels().find(model => model.id === modelId);
}

/**
 * Get available providers
 */
export function getAvailableProviders(): string[] {
    return Object.keys(LLM_MODELS);
}

