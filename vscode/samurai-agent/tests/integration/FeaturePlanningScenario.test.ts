/**
 * Phase 9: Integration Test - Feature Planning Scenario
 * 
 * Tests end-to-end feature planning with architectural understanding:
 * - Identifies architectural layers
 * - Understands data flow
 * - Finds entry points and dependencies
 */

import * as path from 'path';
import { CodeParserService } from '../../src/agent/code_parser/CodeParserService';

describe('Integration: Feature Planning Scenario', () => {
    let codeParser: CodeParserService;

    beforeEach(() => {
        codeParser = new CodeParserService();
    });

    it('should identify architectural patterns for planning new features', async () => {
        const fixturesDir = path.join(__dirname, '../agent/code_parser/fixtures');
        
        // Analyze Java Spring application structure
        const javaFilePath = path.join(fixturesDir, 'java', 'SampleSpringPatterns.java');
        const javaElements = await codeParser.extractElementsFromFile(javaFilePath, 'java');
        const javaRelationships = codeParser.buildFileRelationships(javaElements, 'java');
        const patternDetector = (codeParser as any).patternDetector;
        const javaPatterns = patternDetector.detectPatterns(javaFilePath, javaElements, 'java');

        // Should identify Spring framework patterns
        expect(javaPatterns.frameworkPatterns).toContain('spring-rest-controller');
        expect(javaPatterns.frameworkPatterns).toContain('spring-service');
        expect(javaPatterns.frameworkPatterns).toContain('spring-repository');
        expect(javaPatterns.frameworkPatterns).toContain('jpa-entity');

        // Should identify architectural layer
        expect(javaPatterns.architecturalLayer).toBe('controller');

        // Should identify entry point
        expect(javaPatterns.isEntryPoint).toBe(true);

        console.log('\n=== FEATURE PLANNING CONTEXT ===');
        console.log(`Framework patterns: ${javaPatterns.frameworkPatterns.join(', ')}`);
        console.log(`Architectural layer: ${javaPatterns.architecturalLayer}`);
        console.log(`Is entry point: ${javaPatterns.isEntryPoint}`);
    });

    it('should understand data flow for feature impact analysis', async () => {
        const fixturesDir = path.join(__dirname, '../agent/code_parser/fixtures');
        const tsFilePath = path.join(fixturesDir, 'typescript', 'sample_relationships.ts');
        const elements = await codeParser.extractElementsFromFile(tsFilePath, 'typescript');
        const relationships = codeParser.buildFileRelationships(elements, 'typescript');

        // Should track call graph for understanding impact
        const processUserCalls = relationships.calls.filter(c => c.from === 'processUser');
        expect(processUserCalls.length).toBeGreaterThan(0);

        // Should track type dependencies
        expect(relationships.typeDependencies.length).toBeGreaterThan(0);

        console.log('\n=== DATA FLOW ANALYSIS ===');
        console.log(`processUser calls: ${processUserCalls.map(c => c.to).join(', ')}`);
        console.log(`Type dependencies: ${relationships.typeDependencies.length}`);
    });

    it('should extract types and interfaces for understanding API contracts', async () => {
        const fixturesDir = path.join(__dirname, '../agent/code_parser/fixtures');
        const tsFilePath = path.join(fixturesDir, 'typescript', 'sample_types.ts');
        const elements = await codeParser.extractElementsFromFile(tsFilePath, 'typescript');

        // Should extract type definitions
        const types = elements.filter(e => e.type === 'type_definition');
        const interfaces = elements.filter(e => e.type === 'interface');

        expect(types.length).toBeGreaterThan(0);
        expect(interfaces.length).toBeGreaterThan(0);

        console.log('\n=== API CONTRACT ANALYSIS ===');
        console.log(`Types: ${types.map(t => t.name).join(', ')}`);
        console.log(`Interfaces: ${interfaces.map(i => i.name).join(', ')}`);
    });
});

