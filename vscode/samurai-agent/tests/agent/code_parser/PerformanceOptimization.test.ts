/**
 * Phase 10: Performance Optimization Tests
 * 
 * Tests caching and performance improvements
 */

import { CodeParserCache } from '../../../src/agent/code_parser/CodeParserCache';
import { CodeElement } from '../../../src/common/models/context-models';

describe('Phase 10: Performance Optimization', () => {
    let cache: CodeParserCache;

    beforeEach(() => {
        cache = new CodeParserCache();
    });

    describe('Caching', () => {
        it('should cache parse results', () => {
            const mockElements: CodeElement[] = [
                {
                    name: 'test',
                    type: 'function',
                    lineStart: 1,
                    lineEnd: 5,
                    filePath: '/test/file.ts',
                    signature: 'function test()',
                },
            ];

            const mockRelationships = {
                calls: [],
                extends: [],
                implements: [],
                typeDependencies: [],
            };

            const mockPatterns = {
                architecturalLayer: 'service' as const,
            };

            cache.set('/test/file.ts', mockElements, mockRelationships, mockPatterns, 12345);

            const retrieved = cache.get('/test/file.ts', 12345);
            expect(retrieved).not.toBeNull();
            expect(retrieved?.elements).toEqual(mockElements);
        });

        it('should invalidate stale cache entries', () => {
            const mockElements: CodeElement[] = [];
            const mockRelationships = {
                calls: [],
                extends: [],
                implements: [],
                typeDependencies: [],
            };
            const mockPatterns = {};

            cache.set('/test/file.ts', mockElements, mockRelationships, mockPatterns, 12345);

            // Try to retrieve with different timestamp (file was modified)
            const retrieved = cache.get('/test/file.ts', 67890);
            expect(retrieved).toBeNull();
        });

        it('should support cache invalidation', () => {
            const mockElements: CodeElement[] = [];
            const mockRelationships = {
                calls: [],
                extends: [],
                implements: [],
                typeDependencies: [],
            };
            const mockPatterns = {};

            cache.set('/test/file.ts', mockElements, mockRelationships, mockPatterns, 12345);
            cache.invalidate('/test/file.ts');

            const retrieved = cache.get('/test/file.ts', 12345);
            expect(retrieved).toBeNull();
        });

        it('should support cache clearing', () => {
            const mockElements: CodeElement[] = [];
            const mockRelationships = {
                calls: [],
                extends: [],
                implements: [],
                typeDependencies: [],
            };
            const mockPatterns = {};

            cache.set('/test/file1.ts', mockElements, mockRelationships, mockPatterns, 12345);
            cache.set('/test/file2.ts', mockElements, mockRelationships, mockPatterns, 12345);

            cache.clear();

            const stats = cache.getStats();
            expect(stats.size).toBe(0);
        });

        it('should provide cache statistics', () => {
            const stats = cache.getStats();
            
            expect(stats).toBeDefined();
            expect(stats.size).toBe(0);
            expect(stats.maxSize).toBeGreaterThan(0);
        });
    });
});

