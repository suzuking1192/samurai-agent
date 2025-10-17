/**
 * Phase 8: Export Analysis Tests
 * 
 * Tests extraction of:
 * - Named exports
 * - Default exports
 * - Re-exports
 * - Barrel file detection
 * - Public API identification
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import { ExportAnalyzer } from '../../../src/agent/code_parser/ExportAnalyzer';

describe('Phase 8: Export Analysis', () => {
    let exportAnalyzer: ExportAnalyzer;
    const fixturesDir = path.join(__dirname, 'fixtures');

    beforeEach(() => {
        exportAnalyzer = new ExportAnalyzer();
    });

    describe('TypeScript Export Analysis', () => {
        it('should extract named exports', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_imports.ts');
            const content = await fs.readFile(filePath, 'utf-8');
            const exports = exportAnalyzer.analyzeExports(content, filePath, 'typescript');

            expect(exports.length).toBeGreaterThan(0);
            
            const namedExports = exports.filter(e => e.type === 'named');
            expect(namedExports.length).toBeGreaterThan(0);
        });

        it('should extract re-exports', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'barrel_index.ts');
            const content = await fs.readFile(filePath, 'utf-8');
            const exports = exportAnalyzer.analyzeExports(content, filePath, 'typescript');

            const reExports = exports.filter(e => e.type === 're-export');
            expect(reExports.length).toBeGreaterThan(0);
            
            // Should have 'from' field for re-exports
            const userReExport = reExports.find(e => e.name === 'User');
            expect(userReExport).toBeDefined();
            expect(userReExport?.from).toBe('./types');
        });

        it('should detect barrel files', async () => {
            // Rename the file path to index.ts for the barrel detection to work
            const actualFilePath = path.join(fixturesDir, 'typescript', 'barrel_index.ts');
            const content = await fs.readFile(actualFilePath, 'utf-8');
            const simulatedIndexPath = path.join(fixturesDir, 'typescript', 'index.ts');
            const isBarrel = exportAnalyzer.isBarrelFile(content, simulatedIndexPath, 'typescript');

            expect(isBarrel).toBe(true);
        });

        it('should not detect non-barrel files as barrels', async () => {
            const filePath = path.join(fixturesDir, 'typescript', 'sample_types.ts');
            const content = await fs.readFile(filePath, 'utf-8');
            const isBarrel = exportAnalyzer.isBarrelFile(content, filePath, 'typescript');

            expect(isBarrel).toBe(false);
        });
    });

    describe('Python Export Analysis', () => {
        it('should extract exports from __all__', async () => {
            const filePath = path.join(fixturesDir, 'python', '__init__.py');
            const content = await fs.readFile(filePath, 'utf-8');
            const exports = exportAnalyzer.analyzeExports(content, filePath, 'python');

            expect(exports.length).toBeGreaterThanOrEqual(5);
            
            const names = exports.map(e => e.name);
            expect(names).toContain('User');
            expect(names).toContain('UserService');
        });

        it('should detect Python barrel files (__init__.py)', async () => {
            const filePath = path.join(fixturesDir, 'python', '__init__.py');
            const content = await fs.readFile(filePath, 'utf-8');
            const isBarrel = exportAnalyzer.isBarrelFile(content, filePath, 'python');

            expect(isBarrel).toBe(true);
        });

        it('should extract public functions (no leading underscore)', async () => {
            const pythonCode = `
def public_function():
    pass

def _private_function():
    pass

class PublicClass:
    pass

class _PrivateClass:
    pass
`;
            const exports = exportAnalyzer.analyzeExports(pythonCode, 'test.py', 'python');

            const names = exports.map(e => e.name);
            expect(names).toContain('public_function');
            expect(names).toContain('PublicClass');
            expect(names).not.toContain('_private_function');
            expect(names).not.toContain('_PrivateClass');
        });
    });

    describe('Multi-Language Export Analysis', () => {
        it('should extract Java public classes', () => {
            const javaCode = `
public class PublicClass {}
class PackagePrivateClass {}
public interface PublicInterface {}
`;
            const exports = exportAnalyzer.analyzeExports(javaCode, 'Test.java', 'java');

            const names = exports.map(e => e.name);
            expect(names).toContain('PublicClass');
            expect(names).toContain('PublicInterface');
            expect(names).not.toContain('PackagePrivateClass');
        });

        it('should extract Go exported identifiers (capitalized)', () => {
            const goCode = `
func PublicFunction() {}
func privateFunction() {}
type PublicType struct {}
type privateType struct {}
`;
            const exports = exportAnalyzer.analyzeExports(goCode, 'test.go', 'go');

            const names = exports.map(e => e.name);
            expect(names).toContain('PublicFunction');
            expect(names).toContain('PublicType');
            expect(names).not.toContain('privateFunction');
            expect(names).not.toContain('privateType');
        });

        it('should extract Rust pub items', () => {
            const rustCode = `
pub fn public_function() {}
fn private_function() {}
pub struct PublicStruct {}
struct PrivateStruct {}
`;
            const exports = exportAnalyzer.analyzeExports(rustCode, 'lib.rs', 'rust');

            const names = exports.map(e => e.name);
            expect(names).toContain('public_function');
            expect(names).toContain('PublicStruct');
            expect(names).not.toContain('private_function');
            expect(names).not.toContain('PrivateStruct');
        });
    });
});

