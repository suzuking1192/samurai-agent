/**
 * Unit tests for tool models
 */

import { ExtractCodeToolResultPayload } from '../../../src/common/models/tool-models';

describe('ExtractCodeToolResultPayload', () => {
    it('should have correct structure', () => {
        const payload: ExtractCodeToolResultPayload = {
            relevance_score: 8.5,
            context: 'Test code context analysis',
            file_path: '/test/file.ts',
            relevantCodeElements: [
                {
                    path: '/test/file.ts',
                    elements: [
                        {
                            name: 'testFunction',
                            type: 'function',
                            lineStart: 10,
                            lineEnd: 20,
                            filePath: '/test/file.ts',
                            signature: 'function testFunction(): void'
                        }
                    ],
                    snippet: 'function testFunction(): void {\n  // test implementation\n}'
                }
            ]
        };

        expect(typeof payload.relevance_score).toBe('number');
        expect(typeof payload.context).toBe('string');
        expect(typeof payload.file_path).toBe('string');
        expect(Array.isArray(payload.relevantCodeElements)).toBe(true);
    });

    it('should allow multiple code elements', () => {
        const payload: ExtractCodeToolResultPayload = {
            relevance_score: 7.0,
            context: 'Multiple elements analysis',
            file_path: '/test/file.ts',
            relevantCodeElements: [
                {
                    path: '/test/file.ts',
                    elements: [
                        {
                            name: 'function1',
                            type: 'function',
                            lineStart: 1,
                            lineEnd: 10,
                            filePath: '/test/file.ts',
                            signature: 'function function1(): void'
                        },
                        {
                            name: 'class1',
                            type: 'class',
                            lineStart: 15,
                            lineEnd: 30,
                            filePath: '/test/file.ts',
                            signature: 'class Class1'
                        }
                    ],
                    snippet: 'function function1(): void {\n  // implementation\n}\n\nclass Class1 {\n  // class body\n}'
                }
            ]
        };

        expect(payload.relevantCodeElements).toHaveLength(1);
        expect(payload.relevantCodeElements[0].elements).toHaveLength(2);
    });

    it('should allow empty code elements array', () => {
        const payload: ExtractCodeToolResultPayload = {
            relevance_score: 0,
            context: 'No relevant elements found',
            file_path: '/test/file.ts',
            relevantCodeElements: []
        };

        expect(payload.relevantCodeElements).toHaveLength(0);
        expect(payload.relevance_score).toBe(0);
    });
});
