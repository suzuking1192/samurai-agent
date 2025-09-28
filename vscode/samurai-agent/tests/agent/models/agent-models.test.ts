/**
 * Unit tests for agent models
 */

import { AgentExecutionResult } from '../../../src/agent/models/agent-models';

describe('AgentExecutionResult', () => {
    it('should have correct structure', () => {
        const result: AgentExecutionResult = {
            success: true,
            message: 'Test message',
            payload: { test: 'data' },
            metadata: { key: 'value' }
        };

        expect(typeof result.success).toBe('boolean');
        expect(typeof result.message).toBe('string');
        expect(result.payload).toBeDefined();
        expect(result.metadata).toBeDefined();
    });

    it('should allow optional payload', () => {
        const result: AgentExecutionResult = {
            success: false,
            message: 'Error message',
            metadata: {}
        };

        expect(result.payload).toBeUndefined();
        expect(result.success).toBe(false);
        expect(result.message).toBe('Error message');
    });

    it('should require all mandatory fields', () => {
        // This test ensures TypeScript compilation works correctly
        const result: AgentExecutionResult = {
            success: true,
            message: 'Success',
            metadata: {}
        };

        expect(result).toBeDefined();
    });
});
