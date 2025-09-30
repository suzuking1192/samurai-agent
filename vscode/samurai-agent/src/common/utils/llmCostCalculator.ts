/**
 * LLM Cost Calculator Utility
 * 
 * Calculates the monetary cost of LLM API interactions based on token usage
 * and configured pricing rates from the LLM models constants.
 */

import { getModelById, getAllModels, LLMModel } from '../constants/llm-models';

export interface CostCalculationInput {
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
}

export interface ModelPricing {
    inputCostPerMTokens: number;
    outputCostPerMTokens: number;
}

export interface CostCalculationResult {
    totalCost: number;
    promptCost: number;
    completionCost: number;
    pricing: ModelPricing;
}

/**
 * Default fallback pricing when model is not found (per million tokens)
 */
const DEFAULT_FALLBACK_PRICING: ModelPricing = {
    inputCostPerMTokens: 3.00,
    outputCostPerMTokens: 15.00,
};

/**
 * Get pricing for a specific model
 * @param modelId - Model ID
 * @returns Model pricing or fallback pricing if not found
 */
function getModelPricing(modelId: string): ModelPricing {
    const model = getModelById(modelId);
    
    if (!model) {
        // Try fuzzy matching: find model that contains the modelId or vice versa
        const allModels = getAllModels();
        const fuzzyMatch = allModels.find(m => 
            m.id.toLowerCase().includes(modelId.toLowerCase()) ||
            modelId.toLowerCase().includes(m.id.toLowerCase())
        );
        
        if (fuzzyMatch) {
            return {
                inputCostPerMTokens: fuzzyMatch.inputCostPerMTokens,
                outputCostPerMTokens: fuzzyMatch.outputCostPerMTokens,
            };
        }
        
        console.warn(`[LLM Cost] Unknown model: ${modelId}. Using fallback pricing.`);
        return DEFAULT_FALLBACK_PRICING;
    }
    
    return {
        inputCostPerMTokens: model.inputCostPerMTokens,
        outputCostPerMTokens: model.outputCostPerMTokens,
    };
}

/**
 * Calculate the cost of an LLM interaction
 * 
 * @param input - Cost calculation parameters
 * @returns Detailed cost breakdown
 */
export function calculateLLMCost(input: CostCalculationInput): CostCalculationResult {
    const { model, promptTokens, completionTokens } = input;
    
    // Get pricing for the model
    const pricing = getModelPricing(model);
    
    // Calculate costs
    // Formula: (tokens / 1,000,000) * cost_per_million_tokens
    const promptCost = (promptTokens / 1000000) * pricing.inputCostPerMTokens;
    const completionCost = (completionTokens / 1000000) * pricing.outputCostPerMTokens;
    const totalCost = promptCost + completionCost;
    
    return {
        totalCost: Number(totalCost.toFixed(6)), // Round to 6 decimal places for precision
        promptCost: Number(promptCost.toFixed(6)),
        completionCost: Number(completionCost.toFixed(6)),
        pricing,
    };
}

/**
 * Format cost for display
 * 
 * @param cost - Cost in USD
 * @param includeSymbol - Whether to include $ symbol
 * @returns Formatted cost string
 */
export function formatCost(cost: number, includeSymbol: boolean = true): string {
    const symbol = includeSymbol ? '$' : '';
    
    if (cost === 0) {
        // Handle zero explicitly
        return `${symbol}0.00`;
    } else if (cost < 0.01) {
        // For very small costs, show more decimal places
        return `${symbol}${cost.toFixed(4)}`;
    } else {
        // For larger costs, show 2 decimal places
        return `${symbol}${cost.toFixed(2)}`;
    }
}

/**
 * Calculate session cost from an array of individual costs
 * 
 * @param costs - Array of individual LLM call costs
 * @returns Total session cost
 */
export function calculateSessionCost(costs: number[]): number {
    const total = costs.reduce((sum, cost) => sum + cost, 0);
    return Number(total.toFixed(6));
}
