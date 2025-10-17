/**
 * Phase 9: Integration Test - Bug Analysis Scenario
 * 
 * Tests end-to-end bug analysis with complete code flow understanding:
 * - Extracts all necessary code elements
 * - Builds call graphs
 * - Tracks dependencies
 * - Provides architectural context
 */

import * as path from 'path';
import { CodeParserService } from '../../src/agent/code_parser/CodeParserService';
import { promises as fs } from 'fs';

describe('Integration: Bug Analysis Scenario', () => {
    let codeParser: CodeParserService;

    beforeEach(() => {
        codeParser = new CodeParserService();
    });

    it('should extract complete context for debugging authentication bug', async () => {
        // Create a realistic bug scenario with multiple files
        const fixturesDir = path.join(__dirname, '../agent/code_parser/fixtures');
        
        // Scan TypeScript files
        const tsFilePath = path.join(fixturesDir, 'typescript', 'sample_relationships.ts');
        const tsElements = await codeParser.extractElementsFromFile(tsFilePath, 'typescript');
        const tsRelationships = codeParser.buildFileRelationships(tsElements, 'typescript');

        // Verify we have complete context:
        
        // 1. Elements extracted (functions, classes, types, etc.)
        expect(tsElements.length).toBeGreaterThan(0);
        expect(tsElements.some(e => e.type === 'function')).toBe(true);
        expect(tsElements.some(e => e.type === 'class')).toBe(true);
        expect(tsElements.some(e => e.type === 'interface')).toBe(true);
        expect(tsElements.some(e => e.type === 'type_definition')).toBe(true);

        // 2. Call graph available
        expect(tsRelationships.calls).toBeDefined();
        expect(tsRelationships.calls.length).toBeGreaterThan(0);

        // 3. Inheritance relationships tracked
        expect(tsRelationships.extends).toBeDefined();
        expect(tsRelationships.implements).toBeDefined();

        // 4. Type dependencies tracked
        expect(tsRelationships.typeDependencies).toBeDefined();

        console.log('\n=== BUG ANALYSIS CONTEXT ===');
        console.log(`Elements extracted: ${tsElements.length}`);
        console.log(`Call graph edges: ${tsRelationships.calls.length}`);
        console.log(`Inheritance relationships: ${tsRelationships.extends.length}`);
        console.log(`Type dependencies: ${tsRelationships.typeDependencies.length}`);
    });

    it('should provide documentation context for understanding code intent', async () => {
        const fixturesDir = path.join(__dirname, '../agent/code_parser/fixtures');
        const tsFilePath = path.join(fixturesDir, 'typescript', 'sample_with_jsdoc.ts');
        const elements = await codeParser.extractElementsFromFile(tsFilePath, 'typescript');

        // Should extract JSDoc for better understanding
        const elementsWithDocs = elements.filter(e => e.documentation);
        expect(elementsWithDocs.length).toBeGreaterThan(0);

        console.log(`\nElements with documentation: ${elementsWithDocs.length}/${elements.length}`);
    });

    it('should extract constants that might be causing bugs', async () => {
        const fixturesDir = path.join(__dirname, '../agent/code_parser/fixtures');
        const tsFilePath = path.join(fixturesDir, 'typescript', 'sample_constants.ts');
        const elements = await codeParser.extractElementsFromFile(tsFilePath, 'typescript');

        // Should extract constants
        const constants = elements.filter(e => e.type === 'constant');
        expect(constants.length).toBeGreaterThanOrEqual(3);

        console.log(`\nConstants extracted: ${constants.map(c => c.name).join(', ')}`);
    });
});

