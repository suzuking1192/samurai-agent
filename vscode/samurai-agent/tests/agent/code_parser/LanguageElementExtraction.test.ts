/**
 * Phase 1: Language-Agnostic Code Element Extraction Tests
 * 
 * Tests extraction of:
 * - Type definitions (type aliases, typedef, protocols, traits)
 * - Enums
 * - Constants
 * - Annotations (decorators, attributes)
 * - Exports
 * - Generic parameters
 * - Namespaces
 */

import * as path from 'path';
import { CodeParserService } from '../../../src/agent/code_parser/CodeParserService';
import { CodeElement, CodeElementType } from '../../../src/common/models/context-models';

describe('Phase 1: Language-Agnostic Element Extraction', () => {
    let codeParser: CodeParserService;
    const fixturesDir = path.join(__dirname, 'fixtures');

    beforeEach(() => {
        codeParser = new CodeParserService();
    });

    describe('TypeScript Element Extraction', () => {
        const typeScriptFixturesDir = path.join(fixturesDir, 'typescript');

        it('should extract type definitions', async () => {
            const filePath = path.join(typeScriptFixturesDir, 'sample_types.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            // Should extract type aliases
            const typeDefinitions = elements.filter(e => e.type === 'type_definition');
            expect(typeDefinitions.length).toBeGreaterThanOrEqual(4);

            // Verify specific type aliases
            const userIdType = typeDefinitions.find(e => e.name === 'UserId');
            expect(userIdType).toBeDefined();
            expect(userIdType?.type).toBe('type_definition');

            const genericResponseType = typeDefinitions.find(e => e.name === 'GenericResponse');
            expect(genericResponseType).toBeDefined();

            const apiResultType = typeDefinitions.find(e => e.name === 'ApiResult');
            expect(apiResultType).toBeDefined();
        });

        it('should extract enums', async () => {
            const filePath = path.join(typeScriptFixturesDir, 'sample_enums.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            const enums = elements.filter(e => e.type === 'enum');
            expect(enums.length).toBeGreaterThanOrEqual(3);

            // Verify specific enums
            const statusEnum = enums.find(e => e.name === 'Status');
            expect(statusEnum).toBeDefined();
            expect(statusEnum?.type).toBe('enum');

            const httpMethodEnum = enums.find(e => e.name === 'HttpMethod');
            expect(httpMethodEnum).toBeDefined();

            const colorEnum = enums.find(e => e.name === 'Color');
            expect(colorEnum).toBeDefined();
        });

        it('should extract constants', async () => {
            const filePath = path.join(typeScriptFixturesDir, 'sample_constants.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            const constants = elements.filter(e => e.type === 'constant');
            expect(constants.length).toBeGreaterThanOrEqual(3);

            // Verify specific constants
            const apiBaseUrl = constants.find(e => e.name === 'API_BASE_URL');
            expect(apiBaseUrl).toBeDefined();
            expect(apiBaseUrl?.type).toBe('constant');

            const maxRetries = constants.find(e => e.name === 'MAX_RETRIES');
            expect(maxRetries).toBeDefined();

            // Should NOT extract regular variables
            const counterVar = elements.find(e => e.name === 'counter');
            expect(counterVar).toBeUndefined();
        });

        it('should extract decorators', async () => {
            const filePath = path.join(typeScriptFixturesDir, 'sample_decorators.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            const annotations = elements.filter(e => e.type === 'annotation');
            // May extract @Component, @Injectable, @LogMethod
            expect(annotations.length).toBeGreaterThanOrEqual(1);

            // Should also extract classes with decorators
            const appComponent = elements.find(e => e.name === 'AppComponent' && e.type === 'class');
            expect(appComponent).toBeDefined();

            const userService = elements.find(e => e.name === 'UserService' && e.type === 'class');
            expect(userService).toBeDefined();
        });

        it('should extract namespaces', async () => {
            const filePath = path.join(typeScriptFixturesDir, 'sample_namespaces.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            const namespaces = elements.filter(e => e.type === 'namespace');
            expect(namespaces.length).toBeGreaterThanOrEqual(2);

            // Verify specific namespaces
            const utilsNamespace = namespaces.find(e => e.name === 'Utils');
            expect(utilsNamespace).toBeDefined();

            const apiNamespace = namespaces.find(e => e.name === 'API');
            expect(apiNamespace).toBeDefined();
        });
    });

    describe('Python Element Extraction', () => {
        const pythonFixturesDir = path.join(fixturesDir, 'python');

        it('should extract type aliases (TypeAlias)', async () => {
            const filePath = path.join(pythonFixturesDir, 'sample_types.py');
            const elements = await codeParser.extractElementsFromFile(filePath, 'python');

            const typeDefinitions = elements.filter(e => e.type === 'type_definition');
            // Should extract UserId, UserRole, Point, Matrix, Result, ApiResponse
            expect(typeDefinitions.length).toBeGreaterThanOrEqual(2);

            const userIdType = typeDefinitions.find(e => e.name === 'UserId');
            expect(userIdType).toBeDefined();
        });

        it('should extract Enum classes', async () => {
            const filePath = path.join(pythonFixturesDir, 'sample_enums.py');
            const elements = await codeParser.extractElementsFromFile(filePath, 'python');

            // Enum classes should be extracted as either 'enum' or 'class'
            const enums = elements.filter(e => 
                (e.type === 'enum' || e.type === 'class') && 
                ['Status', 'HttpMethod', 'Priority', 'Permission', 'Color'].includes(e.name)
            );
            expect(enums.length).toBeGreaterThanOrEqual(4);

            const statusEnum = enums.find(e => e.name === 'Status');
            expect(statusEnum).toBeDefined();
        });

        it('should extract UPPER_CASE constants', async () => {
            const filePath = path.join(pythonFixturesDir, 'sample_constants.py');
            const elements = await codeParser.extractElementsFromFile(filePath, 'python');

            const constants = elements.filter(e => e.type === 'constant');
            expect(constants.length).toBeGreaterThanOrEqual(5);

            // Verify specific constants
            const apiBaseUrl = constants.find(e => e.name === 'API_BASE_URL');
            expect(apiBaseUrl).toBeDefined();

            const maxRetries = constants.find(e => e.name === 'MAX_RETRIES');
            expect(maxRetries).toBeDefined();

            // Should NOT extract lowercase variables
            const counter = elements.find(e => e.name === 'counter' && e.type === 'constant');
            expect(counter).toBeUndefined();
        });

        it('should extract decorators', async () => {
            const filePath = path.join(pythonFixturesDir, 'sample_decorators.py');
            const elements = await codeParser.extractElementsFromFile(filePath, 'python');

            const annotations = elements.filter(e => e.type === 'annotation');
            // Should extract @log_calls, @cache_result, @require_auth, @property
            expect(annotations.length).toBeGreaterThanOrEqual(3);

            // Should extract functions with decorators
            const protectedFunction = elements.find(e => e.name === 'protected_function');
            expect(protectedFunction).toBeDefined();
        });
    });

    describe('Regression Tests - Existing Functionality', () => {
        const typeScriptFixturesDir = path.join(fixturesDir, 'typescript');

        it('should still extract functions correctly', async () => {
            const filePath = path.join(typeScriptFixturesDir, 'sample_decorators.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            const functions = elements.filter(e => e.type === 'function');
            expect(functions.length).toBeGreaterThanOrEqual(2);

            // Decorators should be extracted as functions
            const componentFunc = functions.find(e => e.name === 'Component');
            expect(componentFunc).toBeDefined();
        });

        it('should still extract classes correctly', async () => {
            const filePath = path.join(typeScriptFixturesDir, 'sample_decorators.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            const classes = elements.filter(e => e.type === 'class');
            expect(classes.length).toBeGreaterThanOrEqual(2);

            const appComponent = classes.find(e => e.name === 'AppComponent');
            expect(appComponent).toBeDefined();
        });

        it('should still extract interfaces correctly', async () => {
            const filePath = path.join(typeScriptFixturesDir, 'sample_types.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            const interfaces = elements.filter(e => e.type === 'interface');
            expect(interfaces.length).toBeGreaterThanOrEqual(1);

            const userInterface = interfaces.find(e => e.name === 'User');
            expect(userInterface).toBeDefined();
        });

        it('should still extract Python classes correctly', async () => {
            const pythonFixturesDir = path.join(fixturesDir, 'python');
            const filePath = path.join(pythonFixturesDir, 'sample_types.py');
            const elements = await codeParser.extractElementsFromFile(filePath, 'python');

            const classes = elements.filter(e => e.type === 'class');
            expect(classes.length).toBeGreaterThanOrEqual(2);

            // Protocol classes
            const drawableClass = classes.find(e => e.name === 'Drawable');
            expect(drawableClass).toBeDefined();
        });
    });

    describe('Code Element Metadata', () => {
        const typeScriptFixturesDir = path.join(fixturesDir, 'typescript');

        it('should include line numbers for all elements', async () => {
            const filePath = path.join(typeScriptFixturesDir, 'sample_types.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            elements.forEach(element => {
                expect(element.lineStart).toBeGreaterThan(0);
                expect(element.lineEnd).toBeGreaterThanOrEqual(element.lineStart);
            });
        });

        it('should include file path for all elements', async () => {
            const filePath = path.join(typeScriptFixturesDir, 'sample_types.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            elements.forEach(element => {
                expect(element.filePath).toBe(filePath);
            });
        });

        it('should extract code snippets for elements', async () => {
            const filePath = path.join(typeScriptFixturesDir, 'sample_enums.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            const statusEnum = elements.find(e => e.name === 'Status' && e.type === 'enum');
            expect(statusEnum).toBeDefined();
            expect(statusEnum?.codeSnippet).toBeDefined();
            expect(statusEnum?.codeSnippet).toContain('Active');
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle empty files gracefully', async () => {
            const fs = require('fs/promises');
            const emptyFilePath = path.join(fixturesDir, 'typescript', 'empty.ts');
            // Create empty file for testing
            await fs.writeFile(emptyFilePath, '', 'utf-8');

            const elements = await codeParser.extractElementsFromFile(emptyFilePath, 'typescript');
            expect(elements).toBeDefined();
            expect(Array.isArray(elements)).toBe(true);
        });

        it('should handle files with syntax errors gracefully', async () => {
            const fs = require('fs/promises');
            const invalidFilePath = path.join(fixturesDir, 'typescript', 'invalid.ts');
            // Create file with syntax error
            await fs.writeFile(invalidFilePath, 'const x = {', 'utf-8');

            const elements = await codeParser.extractElementsFromFile(invalidFilePath, 'typescript');
            expect(elements).toBeDefined();
            expect(Array.isArray(elements)).toBe(true);
        });

        it('should handle non-existent language gracefully', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_types.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'unknownlang' as any);
            
            expect(elements).toBeDefined();
            expect(Array.isArray(elements)).toBe(true);
        });
    });
});

