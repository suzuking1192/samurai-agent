/**
 * Phase 6: Pattern Detection Tests
 * 
 * Tests detection of:
 * - Framework-specific patterns (React, Spring, Django, etc.)
 * - Architectural layers (controller, service, repository, model)
 * - Entry points
 * - Dependency injection
 */

import * as path from 'path';
import { CodeParserService } from '../../../src/agent/code_parser/CodeParserService';

describe('Phase 6: Pattern Detection', () => {
    let codeParser: CodeParserService;
    let patternDetector: any;
    const fixturesDir = path.join(__dirname, 'fixtures');

    beforeEach(() => {
        codeParser = new CodeParserService();
        // Access pattern detector through private property for testing
        patternDetector = (codeParser as any).patternDetector;
    });

    describe('React Pattern Detection', () => {
        it('should detect React hooks', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_react_patterns.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');
            const patterns = patternDetector.detectPatterns(filePath, elements, 'typescript');

            expect(patterns).toBeDefined();
            expect(patterns.frameworkPatterns).toContain('react-hook');
        });

        it('should detect React components', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_react_patterns.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');
            const patterns = patternDetector.detectPatterns(filePath, elements, 'typescript');

            expect(patterns.frameworkPatterns).toContain('react-component');
        });

        it('should detect Express routes', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_react_patterns.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');
            const patterns = patternDetector.detectPatterns(filePath, elements, 'typescript');

            expect(patterns.frameworkPatterns).toContain('express-route');
        });
    });

    describe('Python Pattern Detection', () => {
        it('should detect Django views', async () => {
            const filePath = path.join(fixturesDir, 'python', 'sample_django_patterns.py');
            const elements = await codeParser.extractElementsFromFile(filePath, 'python');
            const patterns = patternDetector.detectPatterns(filePath, elements, 'python');

            expect(patterns).toBeDefined();
            expect(patterns.frameworkPatterns).toContain('django-view');
        });

        it('should detect dataclasses', async () => {
            const filePath = path.join(fixturesDir, 'python', 'sample_django_patterns.py');
            const elements = await codeParser.extractElementsFromFile(filePath, 'python');
            const patterns = patternDetector.detectPatterns(filePath, elements, 'python');

            expect(patterns.frameworkPatterns).toContain('dataclass');
        });

        it('should detect entry points', async () => {
            const filePath = path.join(fixturesDir, 'python', 'sample_django_patterns.py');
            const elements = await codeParser.extractElementsFromFile(filePath, 'python');
            const patterns = patternDetector.detectPatterns(filePath, elements, 'python');

            expect(patterns.isEntryPoint).toBe(true);
        });
    });

    describe('Java Spring Pattern Detection', () => {
        it('should detect Spring controllers', async () => {
            const filePath = path.join(fixturesDir, 'java', 'SampleSpringPatterns.java');
            const elements = await codeParser.extractElementsFromFile(filePath, 'java');
            const patterns = patternDetector.detectPatterns(filePath, elements, 'java');

            expect(patterns).toBeDefined();
            expect(patterns.frameworkPatterns).toContain('spring-rest-controller');
        });

        it('should detect Spring services', async () => {
            const filePath = path.join(fixturesDir, 'java', 'SampleSpringPatterns.java');
            const elements = await codeParser.extractElementsFromFile(filePath, 'java');
            const patterns = patternDetector.detectPatterns(filePath, elements, 'java');

            expect(patterns.frameworkPatterns).toContain('spring-service');
        });

        it('should detect Spring repositories', async () => {
            const filePath = path.join(fixturesDir, 'java', 'SampleSpringPatterns.java');
            const elements = await codeParser.extractElementsFromFile(filePath, 'java');
            const patterns = patternDetector.detectPatterns(filePath, elements, 'java');

            expect(patterns.frameworkPatterns).toContain('spring-repository');
        });

        it('should detect JPA entities', async () => {
            const filePath = path.join(fixturesDir, 'java', 'SampleSpringPatterns.java');
            const elements = await codeParser.extractElementsFromFile(filePath, 'java');
            const patterns = patternDetector.detectPatterns(filePath, elements, 'java');

            expect(patterns.frameworkPatterns).toContain('jpa-entity');
        });

        it('should detect Java main entry point', async () => {
            const filePath = path.join(fixturesDir, 'java', 'SampleSpringPatterns.java');
            const elements = await codeParser.extractElementsFromFile(filePath, 'java');
            const patterns = patternDetector.detectPatterns(filePath, elements, 'java');

            expect(patterns.isEntryPoint).toBe(true);
        });
    });

    describe('Architectural Layer Detection', () => {
        it('should detect controller layer from file path', async () => {
            const filePath = path.join(fixturesDir, 'java', 'SampleSpringPatterns.java');
            const elements = await codeParser.extractElementsFromFile(filePath, 'java');
            const patterns = patternDetector.detectPatterns(filePath, elements, 'java');

            // Should detect based on class name containing "Controller"
            expect(patterns.architecturalLayer).toBe('controller');
        });
    });

    describe('Regression: Code extraction unaffected', () => {
        it('should still extract elements correctly with pattern detection', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_react_patterns.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            expect(elements.length).toBeGreaterThan(0);
            
            const useCounter = elements.find(e => e.name === 'useCounter');
            expect(useCounter).toBeDefined();
        });
    });
});

