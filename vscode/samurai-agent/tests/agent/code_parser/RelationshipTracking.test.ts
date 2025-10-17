/**
 * Phase 3: Relationship Tracking Tests
 * 
 * Tests extraction of:
 * - Call graphs (function/method calls)
 * - Inheritance relationships (extends, implements)
 * - Type dependencies
 */

import * as path from 'path';
import { CodeParserService } from '../../../src/agent/code_parser/CodeParserService';

describe('Phase 3: Relationship Tracking', () => {
    let codeParser: CodeParserService;
    const fixturesDir = path.join(__dirname, 'fixtures');

    beforeEach(() => {
        codeParser = new CodeParserService();
    });

    describe('TypeScript Call Graph', () => {
        it('should build call graph for TypeScript functions', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_relationships.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');
            const relationships = codeParser.buildFileRelationships(elements, 'typescript');

            expect(relationships.calls).toBeDefined();
            expect(relationships.calls.length).toBeGreaterThan(0);

            // processUser should call getUserById, validateUser, sendNotification
            const processUserCalls = relationships.calls.filter(c => c.from === 'processUser');
            expect(processUserCalls.length).toBeGreaterThanOrEqual(2);
            
            const callNames = processUserCalls.map(c => c.to);
            expect(callNames).toContain('getUserById');
        });
    });

    describe('TypeScript Inheritance', () => {
        it('should track class extends relationships', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_relationships.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');
            const relationships = codeParser.buildFileRelationships(elements, 'typescript');

            expect(relationships.extends).toBeDefined();
            expect(relationships.extends.length).toBeGreaterThan(0);

            // Dog extends Animal
            const dogExtends = relationships.extends.find(e => e.child === 'Dog');
            expect(dogExtends).toBeDefined();
            expect(dogExtends?.parent).toBe('Animal');
        });

        it('should track interface implementations', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_relationships.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');
            const relationships = codeParser.buildFileRelationships(elements, 'typescript');

            expect(relationships.implements).toBeDefined();
            expect(relationships.implements.length).toBeGreaterThan(0);

            // Shape implements Drawable, Colorable
            const shapeImplements = relationships.implements.filter(i => i.class === 'Shape');
            expect(shapeImplements.length).toBeGreaterThanOrEqual(2);
            
            const interfaces = shapeImplements.map(i => i.interface);
            expect(interfaces).toContain('Drawable');
            expect(interfaces).toContain('Colorable');
        });
    });

    describe('TypeScript Type Dependencies', () => {
        it('should track type dependencies', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_relationships.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');
            const relationships = codeParser.buildFileRelationships(elements, 'typescript');

            expect(relationships.typeDependencies).toBeDefined();
            expect(relationships.typeDependencies.length).toBeGreaterThan(0);

            // ResponseData depends on Metadata
            const responseDataDeps = relationships.typeDependencies.find(t => t.type === 'ResponseData');
            expect(responseDataDeps).toBeDefined();
            expect(responseDataDeps?.dependsOn).toContain('Metadata');
        });
    });

    describe('Python Call Graph', () => {
        it('should build call graph for Python functions', async () => {
            const filePath = path.join(fixturesDir, 'python', 'sample_relationships.py');
            const elements = await codeParser.extractElementsFromFile(filePath, 'python');
            const relationships = codeParser.buildFileRelationships(elements, 'python');

            expect(relationships.calls).toBeDefined();
            expect(relationships.calls.length).toBeGreaterThan(0);

            // process_user should call get_user_by_id, validate_user, send_notification
            const processUserCalls = relationships.calls.filter(c => c.from === 'process_user');
            expect(processUserCalls.length).toBeGreaterThanOrEqual(2);
            
            const callNames = processUserCalls.map(c => c.to);
            expect(callNames).toContain('get_user_by_id');
        });
    });

    describe('Python Inheritance', () => {
        it('should track Python class inheritance', async () => {
            const filePath = path.join(fixturesDir, 'python', 'sample_relationships.py');
            const elements = await codeParser.extractElementsFromFile(filePath, 'python');
            const relationships = codeParser.buildFileRelationships(elements, 'python');

            expect(relationships.extends).toBeDefined();
            expect(relationships.extends.length).toBeGreaterThan(0);

            // Dog extends Animal
            const dogExtends = relationships.extends.find(e => e.child === 'Dog');
            expect(dogExtends).toBeDefined();
            expect(dogExtends?.parent).toBe('Animal');

            // User extends Serializable (first parent)
            const userExtends = relationships.extends.find(e => e.child === 'User');
            expect(userExtends).toBeDefined();
            expect(userExtends?.parent).toBe('Serializable');
        });

        it('should track Python multiple inheritance as implements', async () => {
            const filePath = path.join(fixturesDir, 'python', 'sample_relationships.py');
            const elements = await codeParser.extractElementsFromFile(filePath, 'python');
            const relationships = codeParser.buildFileRelationships(elements, 'python');

            // User implements Timestamped (second parent)
            const userImplements = relationships.implements.filter(i => i.class === 'User');
            expect(userImplements.length).toBeGreaterThanOrEqual(1);
            
            const interfaces = userImplements.map(i => i.interface);
            expect(interfaces).toContain('Timestamped');
        });
    });

    describe('Regression: Element extraction still works', () => {
        it('should still extract all elements correctly', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_relationships.ts');
            const elements = await codeParser.extractElementsFromFile(filePath, 'typescript');

            // Should have functions, classes, interfaces, types
            const functions = elements.filter(e => e.type === 'function');
            const classes = elements.filter(e => e.type === 'class');
            const interfaces = elements.filter(e => e.type === 'interface');
            const types = elements.filter(e => e.type === 'type_definition');

            expect(functions.length).toBeGreaterThan(0);
            expect(classes.length).toBeGreaterThan(0);
            expect(interfaces.length).toBeGreaterThan(0);
            expect(types.length).toBeGreaterThan(0);
        });
    });
});

