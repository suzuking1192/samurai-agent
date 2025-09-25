/**
 * Tests for LLM Models Constants
 * Validates the structure and content of the LLM_MODELS constant
 */

import * as assert from 'assert';
import { LLM_MODELS, getAllModels, getModelsByProvider, getModelById, getAvailableProviders } from '../src/common/constants/llm-models';

describe('LLM Models Constants', () => {
    describe('LLM_MODELS structure', () => {
        it('should have all required providers', () => {
            const providers = Object.keys(LLM_MODELS);
            assert(providers.includes('openai'), 'Should include OpenAI provider');
            assert(providers.includes('google'), 'Should include Google provider');
            assert(providers.includes('anthropic'), 'Should include Anthropic provider');
        });

        it('should have correct number of providers', () => {
            const providers = Object.keys(LLM_MODELS);
            assert.strictEqual(providers.length, 3, 'Should have exactly 3 providers');
        });

        it('should have OpenAI models with correct structure', () => {
            const openaiModels = LLM_MODELS.openai;
            assert(Array.isArray(openaiModels), 'OpenAI models should be an array');
            assert(openaiModels.length >= 2, 'Should have at least 2 OpenAI models');
            
            openaiModels.forEach(model => {
                assert(typeof model.id === 'string', 'Model should have string id');
                assert(typeof model.name === 'string', 'Model should have string name');
                assert(typeof model.provider === 'string', 'Model should have string provider');
                assert(typeof model.inputCostPerMTokens === 'number', 'Model should have number inputCostPerMTokens');
                assert(typeof model.outputCostPerMTokens === 'number', 'Model should have number outputCostPerMTokens');
                assert(model.provider === 'openai', 'Provider should be openai');
            });
        });

        it('should have Google models with correct structure', () => {
            const googleModels = LLM_MODELS.google;
            assert(Array.isArray(googleModels), 'Google models should be an array');
            assert(googleModels.length >= 2, 'Should have at least 2 Google models');
            
            googleModels.forEach(model => {
                assert(typeof model.id === 'string', 'Model should have string id');
                assert(typeof model.name === 'string', 'Model should have string name');
                assert(typeof model.provider === 'string', 'Model should have string provider');
                assert(typeof model.inputCostPerMTokens === 'number', 'Model should have number inputCostPerMTokens');
                assert(typeof model.outputCostPerMTokens === 'number', 'Model should have number outputCostPerMTokens');
                assert(model.provider === 'google', 'Provider should be google');
            });
        });

        it('should have Anthropic models with correct structure', () => {
            const anthropicModels = LLM_MODELS.anthropic;
            assert(Array.isArray(anthropicModels), 'Anthropic models should be an array');
            assert(anthropicModels.length >= 3, 'Should have at least 3 Anthropic models');
            
            anthropicModels.forEach(model => {
                assert(typeof model.id === 'string', 'Model should have string id');
                assert(typeof model.name === 'string', 'Model should have string name');
                assert(typeof model.provider === 'string', 'Model should have string provider');
                assert(typeof model.inputCostPerMTokens === 'number', 'Model should have number inputCostPerMTokens');
                assert(typeof model.outputCostPerMTokens === 'number', 'Model should have number outputCostPerMTokens');
                assert(model.provider === 'anthropic', 'Provider should be anthropic');
            });
        });

        it('should include specific required models', () => {
            const allModels = getAllModels();
            const modelIds = allModels.map(m => m.id);
            
            assert(modelIds.includes('gpt-4o'), 'Should include gpt-4o');
            assert(modelIds.includes('gpt-5'), 'Should include gpt-5');
            assert(modelIds.includes('gemini-2.5-flash'), 'Should include gemini-2.5-flash');
            assert(modelIds.includes('gemini-2.5-pro'), 'Should include gemini-2.5-pro');
            assert(modelIds.includes('claude-sonnet-4-20250514'), 'Should include claude-sonnet-4-20250514');
            assert(modelIds.includes('claude-opus-4-1-20250805'), 'Should include claude-opus-4-1-20250805');
            assert(modelIds.includes('claude-3-5-haiku-20241022'), 'Should include claude-3-5-haiku-20241022');
        });

        it('should have reasonable cost values', () => {
            const allModels = getAllModels();
            
            allModels.forEach(model => {
                assert(model.inputCostPerMTokens > 0, 'Input cost should be positive');
                assert(model.outputCostPerMTokens > 0, 'Output cost should be positive');
                assert(model.inputCostPerMTokens < 100, 'Input cost should be reasonable');
                assert(model.outputCostPerMTokens < 100, 'Output cost should be reasonable');
            });
        });
    });

    describe('Utility functions', () => {
        it('getAllModels should return all models as flat array', () => {
            const allModels = getAllModels();
            const expectedTotal = LLM_MODELS.openai.length + LLM_MODELS.google.length + LLM_MODELS.anthropic.length;
            
            assert.strictEqual(allModels.length, expectedTotal, 'Should return all models');
            assert(Array.isArray(allModels), 'Should return an array');
        });

        it('getModelsByProvider should return correct models for each provider', () => {
            const openaiModels = getModelsByProvider('openai');
            const googleModels = getModelsByProvider('google');
            const anthropicModels = getModelsByProvider('anthropic');
            const invalidModels = getModelsByProvider('invalid');
            
            assert.deepStrictEqual(openaiModels, LLM_MODELS.openai, 'Should return OpenAI models');
            assert.deepStrictEqual(googleModels, LLM_MODELS.google, 'Should return Google models');
            assert.deepStrictEqual(anthropicModels, LLM_MODELS.anthropic, 'Should return Anthropic models');
            assert.deepStrictEqual(invalidModels, [], 'Should return empty array for invalid provider');
        });

        it('getModelById should return correct model', () => {
            const gpt4oModel = getModelById('gpt-4o');
            const geminiFlashModel = getModelById('gemini-2.5-flash');
            const claudeSonnetModel = getModelById('claude-sonnet-4-20250514');
            const invalidModel = getModelById('invalid-model');
            
            assert(gpt4oModel, 'Should find gpt-4o model');
            assert.strictEqual(gpt4oModel?.id, 'gpt-4o', 'Should return correct model');
            assert.strictEqual(gpt4oModel?.provider, 'openai', 'Should have correct provider');
            
            assert(geminiFlashModel, 'Should find gemini-2.5-flash model');
            assert.strictEqual(geminiFlashModel?.id, 'gemini-2.5-flash', 'Should return correct model');
            assert.strictEqual(geminiFlashModel?.provider, 'google', 'Should have correct provider');
            
            assert(claudeSonnetModel, 'Should find claude-sonnet-4-20250514 model');
            assert.strictEqual(claudeSonnetModel?.id, 'claude-sonnet-4-20250514', 'Should return correct model');
            assert.strictEqual(claudeSonnetModel?.provider, 'anthropic', 'Should have correct provider');
            
            assert.strictEqual(invalidModel, undefined, 'Should return undefined for invalid model');
        });

        it('getAvailableProviders should return all provider keys', () => {
            const providers = getAvailableProviders();
            const expectedProviders = ['openai', 'google', 'anthropic'];
            
            assert.deepStrictEqual(providers.sort(), expectedProviders.sort(), 'Should return all providers');
        });
    });

    describe('Model properties validation', () => {
        it('should have unique model IDs across all providers', () => {
            const allModels = getAllModels();
            const modelIds = allModels.map(m => m.id);
            const uniqueIds = new Set(modelIds);
            
            assert.strictEqual(modelIds.length, uniqueIds.size, 'All model IDs should be unique');
        });

        it('should have consistent provider values', () => {
            LLM_MODELS.openai.forEach(model => {
                assert.strictEqual(model.provider, 'openai', 'OpenAI models should have openai provider');
            });
            
            LLM_MODELS.google.forEach(model => {
                assert.strictEqual(model.provider, 'google', 'Google models should have google provider');
            });
            
            LLM_MODELS.anthropic.forEach(model => {
                assert.strictEqual(model.provider, 'anthropic', 'Anthropic models should have anthropic provider');
            });
        });

        it('should have non-empty names and descriptions', () => {
            const allModels = getAllModels();
            
            allModels.forEach(model => {
                assert(model.name.length > 0, 'Model name should not be empty');
                if (model.description) {
                    assert(model.description.length > 0, 'Model description should not be empty if provided');
                }
            });
        });

        it('should have reasonable maxTokens values', () => {
            const allModels = getAllModels();
            
            allModels.forEach(model => {
                if (model.maxTokens) {
                    assert(model.maxTokens > 0, 'maxTokens should be positive');
                    assert(model.maxTokens <= 10000000, 'maxTokens should be reasonable');
                }
            });
        });
    });
});

