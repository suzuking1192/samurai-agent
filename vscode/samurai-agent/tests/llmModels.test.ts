/**
 * Tests for LLM Models Constants
 * Validates the structure and content of the LLM_MODELS constant
 */

import { LLM_MODELS, getAllModels, getModelsByProvider, getModelById, getAvailableProviders } from '../src/common/constants/llm-models';

describe('LLM Models Constants', () => {
    describe('LLM_MODELS structure', () => {
        it('should have all required providers', () => {
            const providers = Object.keys(LLM_MODELS);
            expect(providers).toContain('openai');
            expect(providers).toContain('google');
            expect(providers).toContain('anthropic');
        });

        it('should have correct number of providers', () => {
            const providers = Object.keys(LLM_MODELS);
            expect(providers).toHaveLength(3);
        });

        it('should have OpenAI models with correct structure', () => {
            const openaiModels = LLM_MODELS.openai;
            expect(Array.isArray(openaiModels)).toBe(true);
            expect(openaiModels.length).toBeGreaterThanOrEqual(2);
            
            openaiModels.forEach(model => {
                expect(typeof model.id).toBe('string');
                expect(typeof model.name).toBe('string');
                expect(typeof model.provider).toBe('string');
                expect(typeof model.inputCostPerMTokens).toBe('number');
                expect(typeof model.outputCostPerMTokens).toBe('number');
                expect(model.provider).toBe('openai');
            });
        });

        it('should have Google models with correct structure', () => {
            const googleModels = LLM_MODELS.google;
            expect(Array.isArray(googleModels)).toBe(true);
            expect(googleModels.length).toBeGreaterThanOrEqual(3);
            
            googleModels.forEach(model => {
                expect(typeof model.id).toBe('string');
                expect(typeof model.name).toBe('string');
                expect(typeof model.provider).toBe('string');
                expect(typeof model.inputCostPerMTokens).toBe('number');
                expect(typeof model.outputCostPerMTokens).toBe('number');
                expect(model.provider).toBe('google');
            });
        });

        it('should have Anthropic models with correct structure', () => {
            const anthropicModels = LLM_MODELS.anthropic;
            expect(Array.isArray(anthropicModels)).toBe(true);
            expect(anthropicModels.length).toBeGreaterThanOrEqual(3);
            
            anthropicModels.forEach(model => {
                expect(typeof model.id).toBe('string');
                expect(typeof model.name).toBe('string');
                expect(typeof model.provider).toBe('string');
                expect(typeof model.inputCostPerMTokens).toBe('number');
                expect(typeof model.outputCostPerMTokens).toBe('number');
                expect(model.provider).toBe('anthropic');
            });
        });

        it('should include specific required models', () => {
            const allModels = getAllModels();
            const modelIds = allModels.map(m => m.id);
            
            expect(modelIds).toEqual(expect.arrayContaining([
                'gpt-4o',
                'gpt-5',
                'gemini-2.5-flash-free-tier',
                'gemini-2.5-flash',
                'gemini-2.5-pro',
                'claude-sonnet-4-20250514',
                'claude-opus-4-1-20250805',
                'claude-3-5-haiku-20241022'
            ]));
        });

        it('should have reasonable cost values', () => {
            const allModels = getAllModels();
            
            allModels.forEach(model => {
                // Allow zero cost for free tier models
                expect(model.inputCostPerMTokens).toBeGreaterThanOrEqual(0);
                expect(model.outputCostPerMTokens).toBeGreaterThanOrEqual(0);
                expect(model.inputCostPerMTokens).toBeLessThan(100);
                expect(model.outputCostPerMTokens).toBeLessThan(100);
            });
        });

        it('should have free tier model with zero costs', () => {
            const freeTierModel = getModelById('gemini-2.5-flash-free-tier');
            
            expect(freeTierModel).toBeTruthy();
            expect(freeTierModel?.id).toBe('gemini-2.5-flash-free-tier');
            expect(freeTierModel?.name).toBe('Free Tier');
            expect(freeTierModel?.provider).toBe('google');
            expect(freeTierModel?.inputCostPerMTokens).toBe(0);
            expect(freeTierModel?.outputCostPerMTokens).toBe(0);
        });
    });

    describe('Utility functions', () => {
        it('getAllModels should return all models as flat array', () => {
            const allModels = getAllModels();
            const expectedTotal = LLM_MODELS.openai.length + LLM_MODELS.google.length + LLM_MODELS.anthropic.length;
            
            expect(allModels).toHaveLength(expectedTotal);
            expect(Array.isArray(allModels)).toBe(true);
        });

        it('getModelsByProvider should return correct models for each provider', () => {
            const openaiModels = getModelsByProvider('openai');
            const googleModels = getModelsByProvider('google');
            const anthropicModels = getModelsByProvider('anthropic');
            const invalidModels = getModelsByProvider('invalid');
            
            expect(openaiModels).toEqual(LLM_MODELS.openai);
            expect(googleModels).toEqual(LLM_MODELS.google);
            expect(anthropicModels).toEqual(LLM_MODELS.anthropic);
            expect(invalidModels).toEqual([]);
        });

        it('getModelById should return correct model', () => {
            const gpt4oModel = getModelById('gpt-4o');
            const geminiFlashModel = getModelById('gemini-2.5-flash');
            const claudeSonnetModel = getModelById('claude-sonnet-4-20250514');
            const invalidModel = getModelById('invalid-model');
            
            expect(gpt4oModel).toBeTruthy();
            expect(gpt4oModel?.id).toBe('gpt-4o');
            expect(gpt4oModel?.provider).toBe('openai');

            expect(geminiFlashModel).toBeTruthy();
            expect(geminiFlashModel?.provider).toBe('google');

            expect(claudeSonnetModel).toBeTruthy();
            expect(claudeSonnetModel?.provider).toBe('anthropic');

            expect(invalidModel).toBeUndefined();
        });

        it('getAvailableProviders should return all provider keys', () => {
            const providers = getAvailableProviders();
            const expectedProviders = ['openai', 'google', 'anthropic'];
            
            expect(providers.sort()).toEqual(expectedProviders.sort());
        });
    });

    describe('Model properties validation', () => {
        it('should have unique model IDs across all providers', () => {
            const allModels = getAllModels();
            const modelIds = allModels.map(m => m.id);
            const uniqueIds = new Set(modelIds);
            
            expect(modelIds.length).toBe(uniqueIds.size);
        });

        it('should have consistent provider values', () => {
            LLM_MODELS.openai.forEach(model => {
                expect(model.provider).toBe('openai');
            });
            
            LLM_MODELS.google.forEach(model => {
                expect(model.provider).toBe('google');
            });
            
            LLM_MODELS.anthropic.forEach(model => {
                expect(model.provider).toBe('anthropic');
            });
        });

        it('should have non-empty names and descriptions', () => {
            const allModels = getAllModels();
            
            allModels.forEach(model => {
                expect(model.name.length).toBeGreaterThan(0);
                if (model.description) {
                    expect(model.description.length).toBeGreaterThan(0);
                }
            });
        });

        it('should have reasonable maxTokens values', () => {
            const allModels = getAllModels();
            
            allModels.forEach(model => {
                if (model.maxTokens) {
                    expect(model.maxTokens).toBeGreaterThan(0);
                    expect(model.maxTokens).toBeLessThanOrEqual(10000000);
                }
            });
        });
    });
});

