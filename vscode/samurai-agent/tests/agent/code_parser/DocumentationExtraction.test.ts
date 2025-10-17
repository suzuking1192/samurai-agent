/**
 * Phase 2: Documentation Extraction Tests
 * 
 * Tests extraction of documentation from code comments:
 * - JSDoc/TSDoc (TypeScript/JavaScript)
 * - Docstrings (Python)
 * - Javadoc (Java)
 * - And other language-specific formats
 */

import * as path from 'path';
import { CodeParserService } from '../../../src/agent/code_parser/CodeParserService';

describe('Phase 2: Documentation Extraction', () => {
    let codeParser: CodeParserService;
    const fixturesDir = path.join(__dirname, 'fixtures');

    beforeEach(() => {
        codeParser = new CodeParserService();
    });

    describe('TypeScript JSDoc Extraction', () => {
        const filePath = path.join(fixturesDir, 'typescript', 'sample_with_jsdoc.ts');

        it('should extract JSDoc for functions', async () => {
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');
            
            const addFunction = elements.find(e => e.name === 'add' && e.type === 'function');
            expect(addFunction).toBeDefined();
            expect(addFunction?.documentation).toBeDefined();
            expect(addFunction?.documentation?.summary).toContain('sum of two numbers');
        });

        it('should extract JSDoc parameters', async () => {
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');
            
            const addFunction = elements.find(e => e.name === 'add' && e.type === 'function');
            expect(addFunction?.documentation?.params).toBeDefined();
            expect(addFunction?.documentation?.params?.length).toBe(2);
            expect(addFunction?.documentation?.params?.[0].name).toBe('a');
            expect(addFunction?.documentation?.params?.[1].name).toBe('b');
        });

        it('should extract JSDoc returns', async () => {
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');
            
            const addFunction = elements.find(e => e.name === 'add' && e.type === 'function');
            expect(addFunction?.documentation?.returns).toBeDefined();
            expect(addFunction?.documentation?.returns?.description).toContain('sum of a and b');
        });

        it('should extract JSDoc examples', async () => {
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');
            
            const addFunction = elements.find(e => e.name === 'add' && e.type === 'function');
            expect(addFunction?.documentation?.examples).toBeDefined();
            expect(addFunction?.documentation?.examples?.length).toBeGreaterThan(0);
        });

        it('should detect @deprecated tag', async () => {
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');
            
            const userClass = elements.find(e => e.name === 'User' && e.type === 'class');
            expect(userClass?.documentation).toBeDefined();
            expect(userClass?.documentation?.deprecated).toBe(true);
        });

        it('should extract @throws information', async () => {
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');
            
            const validateFunction = elements.find(e => e.name === 'validateEmail');
            expect(validateFunction?.documentation?.throws).toBeDefined();
            expect(validateFunction?.documentation?.throws?.length).toBeGreaterThan(0);
        });
    });

    describe('Python Docstring Extraction', () => {
        const filePath = path.join(fixturesDir, 'python', 'sample_with_docstrings.py');

        it('should extract docstrings for functions', async () => {
            const elements = await codeParser.extractElementsFromFile(filePath, 'python');
            
            const addFunction = elements.find(e => e.name === 'add' && e.type === 'function');
            expect(addFunction).toBeDefined();
            expect(addFunction?.documentation).toBeDefined();
            expect(addFunction?.documentation?.summary).toContain('sum of two numbers');
        });

        it('should extract docstring parameters', async () => {
            const elements = await codeParser.extractElementsFromFile(filePath, 'python');
            
            const addFunction = elements.find(e => e.name === 'add' && e.type === 'function');
            expect(addFunction?.documentation?.params).toBeDefined();
            expect(addFunction?.documentation?.params?.length).toBe(2);
            expect(addFunction?.documentation?.params?.[0].name).toBe('a');
            expect(addFunction?.documentation?.params?.[1].name).toBe('b');
        });

        it('should extract docstring returns', async () => {
            const elements = await codeParser.extractElementsFromFile(filePath, 'python');
            
            const addFunction = elements.find(e => e.name === 'add' && e.type === 'function');
            expect(addFunction?.documentation?.returns).toBeDefined();
            expect(addFunction?.documentation?.returns?.description).toContain('sum of a and b');
        });

        it('should extract class docstrings', async () => {
            const elements = await codeParser.extractElementsFromFile(filePath, 'python');
            
            const userClass = elements.find(e => e.name === 'User' && e.type === 'class');
            expect(userClass?.documentation).toBeDefined();
            expect(userClass?.documentation?.summary).toContain('User class');
        });
    });

    describe('Inline Comments Extraction', () => {
        it('should extract inline comments from TypeScript code', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_with_jsdoc.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');
            
            const validateFunction = elements.find(e => e.name === 'validateEmail');
            expect(validateFunction?.documentation?.inlineComments).toBeDefined();
            expect(validateFunction?.documentation?.inlineComments?.length).toBeGreaterThan(0);
        });

        it('should extract inline comments from Python code', async () => {
            const filePath = path.join(fixturesDir, 'python', 'sample_with_docstrings.py');
            const elements = await codeParser.extractElementsFromFile(filePath, 'python');
            
            const validateFunction = elements.find(e => e.name === 'validate_email');
            expect(validateFunction?.documentation?.inlineComments).toBeDefined();
            expect(validateFunction?.documentation?.inlineComments?.length).toBeGreaterThan(0);
        });
    });

    describe('Regression: Elements without documentation', () => {
        it('should still extract elements without documentation', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_types.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');
            
            // Should still extract elements even without docs
            expect(elements.length).toBeGreaterThan(0);
            
            // Some elements may not have documentation
            const userId = elements.find(e => e.name === 'UserId');
            expect(userId).toBeDefined();
            // Documentation is optional
        });
    });
});

