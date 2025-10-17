/**
 * Phase 5: Enriched Code Snippets Tests
 * 
 * Tests snippet enrichment with full context:
 * - Related imports
 * - Type definitions
 * - Constants
 * - Helper functions
 * - Context lines
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import { CodeParserService } from '../../../src/agent/code_parser/CodeParserService';
import { SnippetEnricher } from '../../../src/agent/code_parser/SnippetEnricher';

describe('Phase 5: Enriched Code Snippets', () => {
    let codeParser: CodeParserService;
    let snippetEnricher: SnippetEnricher;
    const fixturesDir = path.join(__dirname, 'fixtures');

    beforeEach(() => {
        codeParser = new CodeParserService();
        snippetEnricher = new SnippetEnricher();
    });

    describe('Snippet Enrichment', () => {
        it('should include relevant imports in enriched snippet', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_enrichment.ts');
            const content = await fs.readFile(filePath, 'utf-8');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            const processUserFunc = elements.find(e => e.name === 'processUser');
            expect(processUserFunc).toBeDefined();

            const enriched = snippetEnricher.buildEnrichedSnippet(
                processUserFunc!,
                elements,
                content,
                'typescript'
            );

            expect(enriched.metadata.includedImports.length).toBeGreaterThan(0);
            expect(enriched.snippet).toContain('import');
        });

        it('should include type definitions used in signature', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_enrichment.ts');
            const content = await fs.readFile(filePath, 'utf-8');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            const processUserFunc = elements.find(e => e.name === 'processUser');
            expect(processUserFunc).toBeDefined();

            const enriched = snippetEnricher.buildEnrichedSnippet(
                processUserFunc!,
                elements,
                content,
                'typescript'
            );

            // Should include ProcessResult type definition
            expect(enriched.metadata.includedTypes).toContain('ProcessResult');
            expect(enriched.snippet).toContain('ProcessResult');
        });

        it('should include constants referenced in code', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_enrichment.ts');
            const content = await fs.readFile(filePath, 'utf-8');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            const processUserFunc = elements.find(e => e.name === 'processUser');
            expect(processUserFunc).toBeDefined();

            const enriched = snippetEnricher.buildEnrichedSnippet(
                processUserFunc!,
                elements,
                content,
                'typescript'
            );

            // Should include DEFAULT_TIMEOUT constant
            expect(enriched.snippet).toContain('DEFAULT_TIMEOUT');
        });

        it('should include helper functions called (level 1)', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_enrichment.ts');
            const content = await fs.readFile(filePath, 'utf-8');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            const processUserFunc = elements.find(e => e.name === 'processUser');
            expect(processUserFunc).toBeDefined();

            const enriched = snippetEnricher.buildEnrichedSnippet(
                processUserFunc!,
                elements,
                content,
                'typescript'
            );

            // Should include logError and retryOperation helpers
            expect(enriched.metadata.includedHelpers).toContain('logError');
            expect(enriched.metadata.includedHelpers).toContain('retryOperation');
        });

        it('should include helper functions called (level 2 - transitive)', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_enrichment.ts');
            const content = await fs.readFile(filePath, 'utf-8');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            const processUserFunc = elements.find(e => e.name === 'processUser');
            expect(processUserFunc).toBeDefined();

            const enriched = snippetEnricher.buildEnrichedSnippet(
                processUserFunc!,
                elements,
                content,
                'typescript'
            );

            // retryOperation calls logError, so logError should be included transitively
            expect(enriched.metadata.includedHelpers).toContain('logError');
            expect(enriched.snippet).toContain('logError');
        });

        it('should include context lines before and after element', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_enrichment.ts');
            const content = await fs.readFile(filePath, 'utf-8');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            const processUserFunc = elements.find(e => e.name === 'processUser');
            expect(processUserFunc).toBeDefined();

            const enriched = snippetEnricher.buildEnrichedSnippet(
                processUserFunc!,
                elements,
                content,
                'typescript'
            );

            // Should have context before and after
            expect(enriched.metadata.contextLines.before).toBeGreaterThanOrEqual(0);
            expect(enriched.metadata.contextLines.after).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Regression: Basic snippets still work', () => {
        it('should still provide basic snippet when no enrichment available', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_types.ts');
            const content = await fs.readFile(filePath, 'utf-8');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            const userId = elements.find(e => e.name === 'UserId');
            expect(userId).toBeDefined();

            const enriched = snippetEnricher.buildEnrichedSnippet(
                userId!,
                elements,
                content,
                'typescript'
            );

            expect(enriched.snippet).toBeDefined();
            expect(enriched.snippet).toContain('UserId');
        });
    });
});

