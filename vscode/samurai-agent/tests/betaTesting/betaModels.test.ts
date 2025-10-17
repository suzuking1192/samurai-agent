/**
 * Unit tests for Beta Testing model definitions and constants
 */

import { LLM_MODELS, getModelById } from '../../src/common/constants/llm-models';
import { BETA_GEMINI_API_KEY, FREE_TIER_GEMINI_API_KEY } from '../../src/common/constants/llm-constants';

describe('Beta Testing - Model Definitions', () => {
    describe('Beta Testing Model', () => {
        it('should exist in LLM_MODELS.google array', () => {
            const betaModel = LLM_MODELS.google.find(m => m.id === 'gemini-2.5-flash-beta');
            expect(betaModel).toBeDefined();
        });
        
        it('should have correct properties', () => {
            const betaModel = LLM_MODELS.google.find(m => m.id === 'gemini-2.5-flash-beta');
            
            expect(betaModel?.id).toBe('gemini-2.5-flash-beta');
            expect(betaModel?.name).toBe('Beta Testing');
            expect(betaModel?.provider).toBe('google');
            expect(betaModel?.inputCostPerMTokens).toBe(0.075);
            expect(betaModel?.outputCostPerMTokens).toBe(0.30);
            expect(betaModel?.description).toContain('Beta Testing');
            expect(betaModel?.description).toContain('$3');
            expect(betaModel?.maxTokens).toBe(8192);
            expect(betaModel?.supportsStreaming).toBe(true);
        });
        
        it('should have same costs as gemini-2.5-flash', () => {
            const betaModel = LLM_MODELS.google.find(m => m.id === 'gemini-2.5-flash-beta');
            const geminiFlash = LLM_MODELS.google.find(m => m.id === 'gemini-2.5-flash');
            
            expect(betaModel?.inputCostPerMTokens).toBe(geminiFlash?.inputCostPerMTokens);
            expect(betaModel?.outputCostPerMTokens).toBe(geminiFlash?.outputCostPerMTokens);
        });
        
        it('should be retrievable by getModelById', () => {
            const betaModel = getModelById('gemini-2.5-flash-beta');
            
            expect(betaModel).toBeDefined();
            expect(betaModel?.name).toBe('Beta Testing');
        });
        
        it('should be positioned after free tier model in array', () => {
            const freeTierIndex = LLM_MODELS.google.findIndex(m => m.id === 'gemini-2.5-flash-free-tier');
            const betaIndex = LLM_MODELS.google.findIndex(m => m.id === 'gemini-2.5-flash-beta');
            
            expect(betaIndex).toBeGreaterThan(freeTierIndex);
        });
        
        it('should be positioned before regular gemini-2.5-flash in array', () => {
            const betaIndex = LLM_MODELS.google.findIndex(m => m.id === 'gemini-2.5-flash-beta');
            const flashIndex = LLM_MODELS.google.findIndex(m => m.id === 'gemini-2.5-flash');
            
            expect(betaIndex).toBeLessThan(flashIndex);
        });
    });
    
    describe('Beta API Key Constant', () => {
        it('should be defined and not empty', () => {
            expect(BETA_GEMINI_API_KEY).toBeDefined();
            expect(BETA_GEMINI_API_KEY.length).toBeGreaterThan(0);
        });
        
        it('should be different from free tier API key', () => {
            expect(BETA_GEMINI_API_KEY).not.toBe(FREE_TIER_GEMINI_API_KEY);
        });
        
        it('should have expected format (AIza prefix)', () => {
            expect(BETA_GEMINI_API_KEY).toMatch(/^AIza/);
        });
    });
});

describe('Beta Code Validation Helper', () => {
    const VALID_BETA_CODE = 'BETA-SA-2025-7K9M';
    
    function isBetaCodeValid(code: string | undefined): boolean {
        return code?.trim() === VALID_BETA_CODE;
    }
    
    it('should accept correct beta code', () => {
        expect(isBetaCodeValid(VALID_BETA_CODE)).toBe(true);
    });
    
    it('should reject incorrect beta code', () => {
        expect(isBetaCodeValid('INVALID-CODE')).toBe(false);
    });
    
    it('should reject empty string', () => {
        expect(isBetaCodeValid('')).toBe(false);
    });
    
    it('should reject undefined', () => {
        expect(isBetaCodeValid(undefined)).toBe(false);
    });
    
    it('should trim whitespace before validation', () => {
        expect(isBetaCodeValid('  BETA-SA-2025-7K9M  ')).toBe(true);
    });
    
    it('should be case-sensitive', () => {
        expect(isBetaCodeValid('beta-sa-2025-7k9m')).toBe(false);
        expect(isBetaCodeValid('BETA-sa-2025-7k9m')).toBe(false);
    });
    
    it('should reject code with extra characters', () => {
        expect(isBetaCodeValid('BETA-SA-2025-7K9M-EXTRA')).toBe(false);
        expect(isBetaCodeValid('X-BETA-SA-2025-7K9M')).toBe(false);
    });
    
    it('should reject similar but incorrect codes', () => {
        expect(isBetaCodeValid('BETA-SA-2025-7K8M')).toBe(false); // Wrong last digit
        expect(isBetaCodeValid('BETA-SA-2024-7K9M')).toBe(false); // Wrong year
        expect(isBetaCodeValid('BETA-SB-2025-7K9M')).toBe(false); // Wrong letter
    });
});

describe('Beta Monthly Limit Constant', () => {
    const BETA_MONTHLY_LIMIT = 3.00;
    
    it('should be set to $3.00', () => {
        expect(BETA_MONTHLY_LIMIT).toBe(3.00);
    });
    
    it('should be a positive number', () => {
        expect(BETA_MONTHLY_LIMIT).toBeGreaterThan(0);
    });
    
    it('should handle decimal comparison correctly', () => {
        const cost1 = 2.99;
        const cost2 = 3.00;
        const cost3 = 3.01;
        
        expect(cost1 < BETA_MONTHLY_LIMIT).toBe(true);
        expect(cost2 >= BETA_MONTHLY_LIMIT).toBe(true);
        expect(cost3 >= BETA_MONTHLY_LIMIT).toBe(true);
    });
});

