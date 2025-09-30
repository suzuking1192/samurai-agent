/**
 * Unit tests for LLM Cost Calculator
 */

import { calculateLLMCost, formatCost, calculateSessionCost } from '../../../src/common/utils/llmCostCalculator';

describe('LLM Cost Calculator', () => {
    describe('calculateLLMCost', () => {
        it('should calculate cost correctly for OpenAI GPT-4o', () => {
            const result = calculateLLMCost({
                provider: 'openai',
                model: 'gpt-4o',
                promptTokens: 1000000,
                completionTokens: 500000,
            });

            // GPT-4o: $2.50/M input, $10.00/M output
            // Expected: (1000000/1000000 * 2.50) + (500000/1000000 * 10.00) = 2.50 + 5.00 = 7.50
            expect(result.totalCost).toBe(7.50);
            expect(result.promptCost).toBe(2.50);
            expect(result.completionCost).toBe(5.00);
        });

        it('should calculate cost correctly for Anthropic Claude Sonnet 4', () => {
            const result = calculateLLMCost({
                provider: 'anthropic',
                model: 'claude-sonnet-4-20250514',
                promptTokens: 2000000,
                completionTokens: 1000000,
            });

            // Claude Sonnet 4: $3.00/M input, $15.00/M output
            // Expected: (2000000/1000000 * 3.00) + (1000000/1000000 * 15.00) = 6.00 + 15.00 = 21.00
            expect(result.totalCost).toBe(21.00);
            expect(result.promptCost).toBe(6.00);
            expect(result.completionCost).toBe(15.00);
        });

        it('should calculate cost correctly for Google Gemini 2.5 Flash', () => {
            const result = calculateLLMCost({
                provider: 'google',
                model: 'gemini-2.5-flash',
                promptTokens: 1500000,
                completionTokens: 800000,
            });

            // Gemini 2.5 Flash: $0.075/M input, $0.30/M output
            // Expected: (1500000/1000000 * 0.075) + (800000/1000000 * 0.30) = 0.1125 + 0.24 = 0.3525
            expect(result.totalCost).toBe(0.3525);
            expect(result.promptCost).toBe(0.1125);
            expect(result.completionCost).toBe(0.24);
        });

        it('should handle zero tokens correctly', () => {
            const result = calculateLLMCost({
                provider: 'openai',
                model: 'gpt-4o',
                promptTokens: 0,
                completionTokens: 0,
            });

            expect(result.totalCost).toBe(0);
            expect(result.promptCost).toBe(0);
            expect(result.completionCost).toBe(0);
        });

        it('should use fallback pricing for unknown models', () => {
            const result = calculateLLMCost({
                provider: 'openai',
                model: 'unknown-model-xyz',
                promptTokens: 1000000,
                completionTokens: 1000000,
            });

            // Should use fallback: $3.00/M input, $15.00/M output
            // Expected: (1000000/1000000 * 3.00) + (1000000/1000000 * 15.00) = 3.00 + 15.00 = 18.00
            expect(result.totalCost).toBe(18.00);
            expect(result.promptCost).toBe(3.00);
            expect(result.completionCost).toBe(15.00);
        });

        it('should use fallback pricing for unknown providers', () => {
            const result = calculateLLMCost({
                provider: 'unknown-provider',
                model: 'some-model',
                promptTokens: 1000000,
                completionTokens: 1000000,
            });

            // Should use fallback: $3.00/M input, $15.00/M output
            expect(result.totalCost).toBe(18.00);
            expect(result.promptCost).toBe(3.00);
            expect(result.completionCost).toBe(15.00);
        });

        it('should handle small token counts with precision', () => {
            const result = calculateLLMCost({
                provider: 'google',
                model: 'gemini-2.5-flash',
                promptTokens: 1000,
                completionTokens: 500,
            });

            // Gemini 2.5 Flash: $0.075/M input, $0.30/M output
            // Expected: (1000/1000000 * 0.075) + (500/1000000 * 0.30) = 0.000075 + 0.00015 = 0.000225
            expect(result.totalCost).toBeCloseTo(0.000225, 6);
        });

        it('should handle large token counts correctly', () => {
            const result = calculateLLMCost({
                provider: 'anthropic',
                model: 'claude-opus-4-1-20250805',
                promptTokens: 5000000,
                completionTokens: 2500000,
            });

            // Claude Opus 4.1: $15.00/M input, $75.00/M output
            // Expected: (5000000/1000000 * 15.00) + (2500000/1000000 * 75.00) = 75.00 + 187.50 = 262.50
            expect(result.totalCost).toBe(262.50);
            expect(result.promptCost).toBe(75.00);
            expect(result.completionCost).toBe(187.50);
        });
    });

    describe('formatCost', () => {
        it('should format large costs with 2 decimal places', () => {
            expect(formatCost(1.234567)).toBe('$1.23');
            expect(formatCost(10.5)).toBe('$10.50');
            expect(formatCost(0.99)).toBe('$0.99');
        });

        it('should format very small costs with 4 decimal places', () => {
            expect(formatCost(0.0012)).toBe('$0.0012');
            expect(formatCost(0.00001)).toBe('$0.0000');
        });

        it('should format without symbol when requested', () => {
            expect(formatCost(1.23, false)).toBe('1.23');
            expect(formatCost(0.001, false)).toBe('0.0010');
        });

        it('should handle zero cost', () => {
            expect(formatCost(0)).toBe('$0.00');
        });
    });

    describe('calculateSessionCost', () => {
        it('should sum multiple costs correctly', () => {
            const costs = [0.05, 0.03, 0.12, 0.08];
            const total = calculateSessionCost(costs);
            
            expect(total).toBeCloseTo(0.28, 6);
        });

        it('should handle empty array', () => {
            const total = calculateSessionCost([]);
            expect(total).toBe(0);
        });

        it('should handle single cost', () => {
            const total = calculateSessionCost([0.15]);
            expect(total).toBe(0.15);
        });

        it('should handle very small costs with precision', () => {
            const costs = [0.000001, 0.000002, 0.000003];
            const total = calculateSessionCost(costs);
            
            expect(total).toBeCloseTo(0.000006, 6);
        });
    });

    describe('fuzzy model matching', () => {
        it('should find model with fuzzy matching when exact match fails', () => {
            // Test that partial model names still work
            const result = calculateLLMCost({
                provider: 'anthropic',
                model: 'claude-3-5-haiku', // Partial name without date
                promptTokens: 1000000,
                completionTokens: 500000,
            });

            // Should match claude-3-5-haiku-20241022
            // Claude 3.5 Haiku: $0.25/M input, $1.25/M output
            // Expected: (1000000/1000000 * 0.25) + (500000/1000000 * 1.25) = 0.25 + 0.625 = 0.875
            expect(result.totalCost).toBe(0.875);
        });

        it('should handle model variations', () => {
            // Test that model name variations work
            const result = calculateLLMCost({
                provider: 'openai',
                model: 'GPT-4O', // Case variation
                promptTokens: 1000000,
                completionTokens: 1000000,
            });

            // Should still find gpt-4o with fuzzy matching
            expect(result.totalCost).toBe(12.50); // 2.50 + 10.00
        });
    });
});
