/**
 * Phase 7: Enhanced LLM Prompts Tests
 * 
 * Tests that prompts:
 * - Are loadable
 * - Contain language-aware instructions
 * - Request architectural context
 * - Request code flow information
 */

import * as path from 'path';
import { promises as fs } from 'fs';

describe('Phase 7: Enhanced LLM Prompts', () => {
    const promptsDir = path.join(__dirname, '../../../src/agent/prompts/codeParser');

    describe('extract_code_context.md', () => {
        let promptContent: string;

        beforeAll(async () => {
            const promptPath = path.join(promptsDir, 'extract_code_context.md');
            promptContent = await fs.readFile(promptPath, 'utf-8');
        });

        it('should be loadable', () => {
            expect(promptContent).toBeDefined();
            expect(promptContent.length).toBeGreaterThan(0);
        });

        it('should mention multiple programming languages', () => {
            expect(promptContent).toContain('programming language');
            expect(promptContent.toLowerCase()).toContain('typescript');
            expect(promptContent.toLowerCase()).toContain('python');
            expect(promptContent.toLowerCase()).toContain('java');
        });

        it('should request language-specific type definitions', () => {
            expect(promptContent).toContain('Phase 7');
            expect(promptContent).toContain('language-specific type definitions');
            expect(promptContent).toContain('TypeAlias');
        });

        it('should request constants and configuration', () => {
            expect(promptContent).toContain('constants');
            expect(promptContent).toContain('configuration');
        });

        it('should request decorators/annotations', () => {
            expect(promptContent).toContain('decorators');
            expect(promptContent).toContain('annotations');
            expect(promptContent).toContain('@decorator');
        });

        it('should request call graphs and code flow', () => {
            expect(promptContent).toContain('Call graphs');
            expect(promptContent).toContain('call chain');
            expect(promptContent).toContain('Execution paths');
            expect(promptContent).toContain('Data flow');
        });

        it('should request architectural layer information', () => {
            expect(promptContent).toContain('Architectural');
            expect(promptContent).toContain('controller');
            expect(promptContent).toContain('service');
            expect(promptContent).toContain('repository');
        });

        it('should request helper functions', () => {
            expect(promptContent).toContain('Helper functions');
            expect(promptContent).toContain('helper/utility functions');
        });

        it('should have expected placeholders', () => {
            expect(promptContent).toContain('{{USER_REQUEST}}');
            expect(promptContent).toContain('{{FOLDER_STRUCTURE}}');
            expect(promptContent).toContain('{{CODE_CONTENT}}');
        });
    });

    describe('step2_identify_relevant_elements.md', () => {
        let promptContent: string;

        beforeAll(async () => {
            const promptPath = path.join(promptsDir, 'step2_identify_relevant_elements.md');
            promptContent = await fs.readFile(promptPath, 'utf-8');
        });

        it('should be loadable', () => {
            expect(promptContent).toBeDefined();
            expect(promptContent.length).toBeGreaterThan(0);
        });

        it('should mention element types', () => {
            expect(promptContent).toContain('type_definition');
            expect(promptContent).toContain('enum');
            expect(promptContent).toContain('constant');
        });

        it('should request language-specific patterns', () => {
            expect(promptContent).toContain('Phase 7');
            expect(promptContent).toContain('Language-specific patterns');
            expect(promptContent).toContain('React hooks');
            expect(promptContent).toContain('@Controller');
        });

        it('should request supporting elements', () => {
            expect(promptContent).toContain('Type definitions');
            expect(promptContent).toContain('Constants');
            expect(promptContent).toContain('Helper/utility functions');
            expect(promptContent).toContain('Decorators/annotations');
        });
    });

    describe('Regression: Prompts still functional', () => {
        it('should maintain existing instructions', async () => {
            const promptPath = path.join(promptsDir, 'extract_code_context.md');
            const promptContent = await fs.readFile(promptPath, 'utf-8');

            // Original critical instructions should still exist
            expect(promptContent).toContain('Track dependencies comprehensively');
            expect(promptContent).toContain('Exclude test files by default');
            expect(promptContent).toContain('STRICT OUTPUT FORMAT');
        });
    });
});

