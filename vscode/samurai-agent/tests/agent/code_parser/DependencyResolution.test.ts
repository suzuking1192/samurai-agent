/**
 * Phase 4: Enhanced Dependency Resolution Tests
 * 
 * Tests extraction of:
 * - Regular imports
 * - Type-only imports (TypeScript)
 * - Re-exports
 * - Multi-language import extraction
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import { CodeParserService } from '../../../src/agent/code_parser/CodeParserService';

describe('Phase 4: Enhanced Dependency Resolution', () => {
    let codeParser: CodeParserService;
    const fixturesDir = path.join(__dirname, 'fixtures');

    beforeEach(() => {
        codeParser = new CodeParserService();
    });

    describe('TypeScript Import Extraction', () => {
        it('should extract regular imports', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_imports.ts');
            const content = await fs.readFile(filePath, 'utf-8');
            const imports = codeParser.extractImportsFromContent(content, 'typescript');

            expect(imports).toContain('./types');
            expect(imports).toContain('./utils');
            expect(imports).toContain('./default');
        });

        it('should extract type-only imports', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_imports.ts');
            const content = await fs.readFile(filePath, 'utf-8');
            const imports = codeParser.extractImportsFromContent(content, 'typescript');

            // Type-only imports should be included
            expect(imports).toContain('./types');
            expect(imports).toContain('./api');
        });

        it('should extract re-exports', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_imports.ts');
            const content = await fs.readFile(filePath, 'utf-8');
            const imports = codeParser.extractImportsFromContent(content, 'typescript');

            // Re-exports should be included
            expect(imports).toContain('./utils');
            expect(imports).toContain('./MyClass');
        });

        it('should extract dynamic imports', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_imports.ts');
            const content = await fs.readFile(filePath, 'utf-8');
            const imports = codeParser.extractImportsFromContent(content, 'typescript');

            expect(imports).toContain('./dynamic-module');
        });
    });

    describe('Python Import Extraction', () => {
        it('should extract regular imports', async () => {
            const filePath = path.join(fixturesDir, 'python', 'sample_imports.py');
            const content = await fs.readFile(filePath, 'utf-8');
            const imports = codeParser.extractImportsFromContent(content, 'python');

            expect(imports).toContain('os');
            expect(imports).toContain('sys');
            expect(imports).toContain('typing');
            expect(imports).toContain('datetime');
        });

        it('should extract relative imports', async () => {
            const filePath = path.join(fixturesDir, 'python', 'sample_imports.py');
            const content = await fs.readFile(filePath, 'utf-8');
            const imports = codeParser.extractImportsFromContent(content, 'python');

            // Relative imports (. prefix)
            expect(imports.some(i => i.includes('models'))).toBe(true);
            expect(imports.some(i => i.includes('utils'))).toBe(true);
        });

        it('should extract re-exports (import *)', async () => {
            const filePath = path.join(fixturesDir, 'python', 'sample_imports.py');
            const content = await fs.readFile(filePath, 'utf-8');
            const imports = codeParser.extractImportsFromContent(content, 'python');

            // from .types import * should be included
            expect(imports.some(i => i.includes('types'))).toBe(true);
            expect(imports.some(i => i.includes('constants'))).toBe(true);
        });
    });

    describe('Multi-Language Import Extraction', () => {
        it('should extract Java imports', () => {
            const javaCode = `
                import java.util.List;
                import java.util.ArrayList;
                import com.example.User;
            `;
            const imports = codeParser.extractImportsFromContent(javaCode, 'java');

            expect(imports).toContain('java.util.List');
            expect(imports).toContain('java.util.ArrayList');
            expect(imports).toContain('com.example.User');
        });

        it('should extract C++ includes', () => {
            const cppCode = `
                #include <iostream>
                #include <vector>
                #include "myheader.h"
                #include "utils/helper.h"
            `;
            const imports = codeParser.extractImportsFromContent(cppCode, 'cpp');

            expect(imports).toContain('iostream');
            expect(imports).toContain('vector');
            expect(imports).toContain('myheader.h');
            expect(imports).toContain('utils/helper.h');
        });

        it('should extract Go imports', () => {
            const goCode = `
                import "fmt"
                import (
                    "context"
                    "github.com/example/package"
                )
            `;
            const imports = codeParser.extractImportsFromContent(goCode, 'go');

            expect(imports).toContain('fmt');
            expect(imports).toContain('context');
        });

        it('should extract Rust uses', () => {
            const rustCode = `
                use std::collections::HashMap;
                use crate::models::User;
                pub use super::utils;
            `;
            const imports = codeParser.extractImportsFromContent(rustCode, 'rust');

            expect(imports).toContain('std::collections::HashMap');
            expect(imports).toContain('crate::models::User');
            expect(imports).toContain('super::utils');
        });
    });

    describe('Regression: Existing import extraction still works', () => {
        it('should not break existing JavaScript import extraction', () => {
            const jsCode = `
                import React from 'react';
                const axios = require('axios');
            `;
            const imports = codeParser.extractImportsFromContent(jsCode, 'javascript');

            expect(imports).toContain('react');
            expect(imports).toContain('axios');
        });

        it('should not break existing Python import extraction', () => {
            const pythonCode = `
                import numpy as np
                from sklearn.model_selection import train_test_split
            `;
            const imports = codeParser.extractImportsFromContent(pythonCode, 'python');

            expect(imports).toContain('numpy');
            expect(imports).toContain('sklearn.model_selection');
        });
    });
});

