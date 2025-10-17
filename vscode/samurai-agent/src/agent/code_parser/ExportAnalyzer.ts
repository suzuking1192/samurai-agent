/**
 * Phase 8: Language-Agnostic Export Analysis
 * 
 * Analyzes exports and visibility across languages:
 * - Public vs private/internal APIs
 * - Module boundaries (barrel files, packages)
 * - Re-exports
 */

export interface ExportInfo {
    name: string;
    type: 'named' | 'default' | 're-export';
    from?: string; // For re-exports
}

export interface ModuleBoundary {
    isBarrelFile: boolean;
    modulePath: string;
    exportsFromFiles?: string[];
}

export class ExportAnalyzer {
    /**
     * Analyze exports in a file
     */
    public analyzeExports(
        fileContent: string,
        filePath: string,
        language: string
    ): ExportInfo[] {
        const exports: ExportInfo[] = [];
        const lang = language.toLowerCase();

        switch (lang) {
            case 'typescript':
            case 'tsx':
            case 'javascript':
            case 'jsx':
                return this.analyzeJSExports(fileContent);
            
            case 'python':
                return this.analyzePythonExports(fileContent);
            
            case 'java':
                return this.analyzeJavaExports(fileContent);
            
            case 'go':
                return this.analyzeGoExports(fileContent);
            
            case 'rust':
                return this.analyzeRustExports(fileContent);
            
            case 'csharp':
                return this.analyzeCSharpExports(fileContent);
            
            case 'php':
                return this.analyzePHPExports(fileContent);
            
            default:
                return [];
        }
    }

    /**
     * Detect if a file is a barrel file (aggregates and re-exports from other files)
     */
    public isBarrelFile(fileContent: string, filePath: string, language: string): boolean {
        const fileName = filePath.split('/').pop()?.toLowerCase() || '';
        const lang = language.toLowerCase();

        // Check filename patterns
        if (lang === 'typescript' || lang === 'javascript') {
            if (fileName === 'index.ts' || fileName === 'index.js' || 
                fileName === 'index.tsx' || fileName === 'index.jsx') {
                // Check if it has multiple re-exports
                const reExportCount = (fileContent.match(/export\s+(?:\*|{[^}]+})\s+from/g) || []).length;
                return reExportCount >= 2;
            }
        }

        if (lang === 'python') {
            if (fileName === '__init__.py') {
                // Check if it has re-exports
                const reExportCount = (fileContent.match(/from\s+\.\w+\s+import/g) || []).length;
                return reExportCount >= 2;
            }
        }

        if (lang === 'rust') {
            if (fileName === 'mod.rs') {
                const pubUseCount = (fileContent.match(/pub\s+use/g) || []).length;
                return pubUseCount >= 2;
            }
        }

        return false;
    }

    private analyzeJSExports(fileContent: string): ExportInfo[] {
        const exports: ExportInfo[] = [];

        // Named exports: export const/function/class X
        const namedExports = fileContent.matchAll(/export\s+(?:const|function|class|interface|type|enum)\s+(\w+)/g);
        for (const match of namedExports) {
            exports.push({
                name: match[1],
                type: 'named',
            });
        }

        // Default exports: export default X
        const defaultExports = fileContent.matchAll(/export\s+default\s+(?:class\s+)?(\w+)/g);
        for (const match of defaultExports) {
            exports.push({
                name: match[1],
                type: 'default',
            });
        }

        // Re-exports: export { X } from 'path'
        const reExports = fileContent.matchAll(/export\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g);
        for (const match of reExports) {
            const names = match[1].split(',').map(n => n.trim().replace(/\s+as\s+\w+/, ''));
            for (const name of names) {
                if (name) {
                    exports.push({
                        name,
                        type: 're-export',
                        from: match[2],
                    });
                }
            }
        }

        // Re-export all: export * from 'path'
        const reExportAll = fileContent.matchAll(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g);
        for (const match of reExportAll) {
            exports.push({
                name: '*',
                type: 're-export',
                from: match[1],
            });
        }

        return exports;
    }

    private analyzePythonExports(fileContent: string): ExportInfo[] {
        const exports: ExportInfo[] = [];

        // Check for __all__ definition
        const allMatch = fileContent.match(/__all__\s*=\s*\[([\s\S]*?)\]/);
        if (allMatch) {
            const items = allMatch[1].matchAll(/['"](\w+)['"]/g);
            for (const match of items) {
                exports.push({
                    name: match[1],
                    type: 'named',
                });
            }
        } else {
            // No __all__ - all public names (not starting with _) are exported
            // Extract top-level function and class names
            const functions = fileContent.matchAll(/^def\s+([a-zA-Z]\w*)/gm);
            for (const match of functions) {
                if (!match[1].startsWith('_')) {
                    exports.push({
                        name: match[1],
                        type: 'named',
                    });
                }
            }

            const classes = fileContent.matchAll(/^class\s+([a-zA-Z]\w*)/gm);
            for (const match of classes) {
                if (!match[1].startsWith('_')) {
                    exports.push({
                        name: match[1],
                        type: 'named',
                    });
                }
            }
        }

        return exports;
    }

    private analyzeJavaExports(fileContent: string): ExportInfo[] {
        const exports: ExportInfo[] = [];

        // Public classes, methods, fields
        const publicClasses = fileContent.matchAll(/public\s+class\s+(\w+)/g);
        for (const match of publicClasses) {
            exports.push({
                name: match[1],
                type: 'named',
            });
        }

        const publicInterfaces = fileContent.matchAll(/public\s+interface\s+(\w+)/g);
        for (const match of publicInterfaces) {
            exports.push({
                name: match[1],
                type: 'named',
            });
        }

        return exports;
    }

    private analyzeGoExports(fileContent: string): ExportInfo[] {
        const exports: ExportInfo[] = [];

        // Go: Capitalized identifiers are exported
        const funcs = fileContent.matchAll(/func\s+([A-Z]\w*)/g);
        for (const match of funcs) {
            exports.push({
                name: match[1],
                type: 'named',
            });
        }

        const types = fileContent.matchAll(/type\s+([A-Z]\w*)/g);
        for (const match of types) {
            exports.push({
                name: match[1],
                type: 'named',
            });
        }

        return exports;
    }

    private analyzeRustExports(fileContent: string): ExportInfo[] {
        const exports: ExportInfo[] = [];

        // pub fn, pub struct, pub enum, pub type
        const pubFuncs = fileContent.matchAll(/pub\s+fn\s+(\w+)/g);
        for (const match of pubFuncs) {
            exports.push({
                name: match[1],
                type: 'named',
            });
        }

        const pubTypes = fileContent.matchAll(/pub\s+(?:struct|enum|type|trait)\s+(\w+)/g);
        for (const match of pubTypes) {
            exports.push({
                name: match[1],
                type: 'named',
            });
        }

        // pub use re-exports
        const pubUse = fileContent.matchAll(/pub\s+use\s+[^;]+::(\w+)/g);
        for (const match of pubUse) {
            exports.push({
                name: match[1],
                type: 're-export',
            });
        }

        return exports;
    }

    private analyzeCSharpExports(fileContent: string): ExportInfo[] {
        const exports: ExportInfo[] = [];

        // public classes, interfaces
        const publicClasses = fileContent.matchAll(/public\s+class\s+(\w+)/g);
        for (const match of publicClasses) {
            exports.push({
                name: match[1],
                type: 'named',
            });
        }

        return exports;
    }

    private analyzePHPExports(fileContent: string): ExportInfo[] {
        const exports: ExportInfo[] = [];

        // public functions, classes
        const publicFuncs = fileContent.matchAll(/public\s+function\s+(\w+)/g);
        for (const match of publicFuncs) {
            exports.push({
                name: match[1],
                type: 'named',
            });
        }

        return exports;
    }
}

