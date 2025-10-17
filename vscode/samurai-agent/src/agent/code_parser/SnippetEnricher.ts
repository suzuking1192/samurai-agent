/**
 * Phase 5: Enriched Code Snippets
 * 
 * Enhances code snippets with full context:
 * - Related imports at the top
 * - Type definitions used
 * - Constants referenced
 * - Helper functions called
 * - Context lines before/after
 */

import { CodeElement } from '../../common/models/context-models';

export interface EnrichedSnippet {
    snippet: string;
    metadata: {
        includedImports: string[];
        includedTypes: string[];
        includedHelpers: string[];
        contextLines: { before: number; after: number };
    };
}

export class SnippetEnricher {
    /**
     * Build enriched snippet with full context
     */
    public buildEnrichedSnippet(
        element: CodeElement,
        allElements: CodeElement[],
        fileContent: string,
        language: string
    ): EnrichedSnippet {
        const snippetParts: string[] = [];
        const metadata = {
            includedImports: [] as string[],
            includedTypes: [] as string[],
            includedHelpers: [] as string[],
            contextLines: { before: 0, after: 0 },
        };

        const lines = fileContent.split('\n');

        // 1. Extract and include relevant imports
        const imports = this.extractRelevantImports(element, fileContent, language);
        if (imports.length > 0) {
            snippetParts.push('// Relevant Imports:');
            snippetParts.push(imports.join('\n'));
            snippetParts.push('');
            metadata.includedImports = imports;
        }

        // 2. Extract and include type definitions used in this element
        const types = this.extractUsedTypes(element, allElements);
        if (types.length > 0) {
            snippetParts.push('// Type Definitions:');
            types.forEach(type => {
                if (type.codeSnippet) {
                    snippetParts.push(type.codeSnippet);
                }
            });
            snippetParts.push('');
            metadata.includedTypes = types.map(t => t.name);
        }

        // 3. Extract and include constants referenced
        const constants = this.extractReferencedConstants(element, allElements);
        if (constants.length > 0) {
            snippetParts.push('// Constants:');
            constants.forEach(constant => {
                if (constant.codeSnippet) {
                    snippetParts.push(constant.codeSnippet);
                }
            });
            snippetParts.push('');
        }

        // 4. Add context lines before element
        const contextBefore = this.getContextLines(lines, element.lineStart - 1, -3, 0);
        if (contextBefore.length > 0) {
            snippetParts.push('// Context before:');
            snippetParts.push(contextBefore.join('\n'));
            snippetParts.push('');
            metadata.contextLines.before = contextBefore.length;
        }

        // 5. Add the main element snippet
        snippetParts.push('// Main Element:');
        if (element.codeSnippet) {
            snippetParts.push(element.codeSnippet);
        }

        // 6. Add context lines after element
        const contextAfter = this.getContextLines(lines, element.lineEnd, 1, 3);
        if (contextAfter.length > 0) {
            snippetParts.push('');
            snippetParts.push('// Context after:');
            snippetParts.push(contextAfter.join('\n'));
            metadata.contextLines.after = contextAfter.length;
        }

        // 7. Include helper functions called (up to 2 levels)
        const helpers = this.extractCalledHelpers(element, allElements, 2);
        if (helpers.length > 0) {
            snippetParts.push('');
            snippetParts.push('// Helper Functions Called:');
            helpers.forEach(helper => {
                if (helper.codeSnippet) {
                    snippetParts.push('');
                    snippetParts.push(`// ${helper.name}:`);
                    snippetParts.push(helper.codeSnippet);
                }
            });
            metadata.includedHelpers = helpers.map(h => h.name);
        }

        return {
            snippet: snippetParts.join('\n'),
            metadata,
        };
    }

    /**
     * Extract relevant imports for an element
     */
    private extractRelevantImports(
        element: CodeElement,
        fileContent: string,
        language: string
    ): string[] {
        const imports: string[] = [];
        const lines = fileContent.split('\n');

        // Extract import lines from beginning of file
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Stop at first non-import line
            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
                continue;
            }

            const isImport = this.isImportLine(trimmed, language);
            if (!isImport) {
                // Stop when we hit non-import code
                if (trimmed && !this.isCommentOrEmpty(trimmed)) {
                    break;
                }
                continue;
            }

            imports.push(line);
        }

        return imports;
    }

    private isImportLine(line: string, language: string): boolean {
        switch (language.toLowerCase()) {
            case 'typescript':
            case 'tsx':
            case 'javascript':
            case 'jsx':
                return line.startsWith('import ') || line.startsWith('export ') || 
                       line.includes('require(');
            
            case 'python':
                return line.startsWith('import ') || line.startsWith('from ');
            
            case 'java':
                return line.startsWith('import ');
            
            case 'cpp':
            case 'c':
                return line.startsWith('#include');
            
            case 'go':
                return line.startsWith('import');
            
            case 'rust':
                return line.startsWith('use ') || line.startsWith('pub use');
            
            case 'csharp':
                return line.startsWith('using ');
            
            case 'php':
                return line.startsWith('use ') || line.includes('require');
            
            default:
                return false;
        }
    }

    private isCommentOrEmpty(line: string): boolean {
        return !line || line.startsWith('//') || line.startsWith('/*') || 
               line.startsWith('*') || line.startsWith('#') || line.startsWith('/**');
    }

    /**
     * Extract types used in this element's signature
     */
    private extractUsedTypes(
        element: CodeElement,
        allElements: CodeElement[]
    ): CodeElement[] {
        if (!element.signature) {
            return [];
        }

        const usedTypes: CodeElement[] = [];
        const typeNames = this.extractTypeNamesFromSignature(element.signature);

        for (const typeName of typeNames) {
            const typeElement = allElements.find(e => 
                e.name === typeName && 
                (e.type === 'type_definition' || e.type === 'interface' || e.type === 'class')
            );
            if (typeElement) {
                usedTypes.push(typeElement);
            }
        }

        return usedTypes;
    }

    private extractTypeNamesFromSignature(signature: string): string[] {
        const typeNames: string[] = [];
        
        // Extract type names from various patterns:
        // : TypeName, <TypeName>, TypeName[], (TypeName)
        const patterns = [
            /:\s*(\w+)/g,           // : TypeName
            /<(\w+)>/g,             // <TypeName>
            /\(\s*(\w+)\s*\)/g,     // (TypeName)
        ];

        for (const pattern of patterns) {
            const matches = signature.matchAll(pattern);
            for (const match of matches) {
                if (match[1] && !this.isPrimitive(match[1])) {
                    typeNames.push(match[1]);
                }
            }
        }

        return typeNames;
    }

    private isPrimitive(typeName: string): boolean {
        const primitives = new Set([
            'string', 'number', 'boolean', 'any', 'void', 'null', 'undefined',
            'int', 'float', 'str', 'bool', 'dict', 'list', 'tuple',
        ]);
        return primitives.has(typeName.toLowerCase());
    }

    /**
     * Extract constants referenced in code snippet
     */
    private extractReferencedConstants(
        element: CodeElement,
        allElements: CodeElement[]
    ): CodeElement[] {
        if (!element.codeSnippet) {
            return [];
        }

        const referencedConstants: CodeElement[] = [];
        const constantElements = allElements.filter(e => e.type === 'constant');

        for (const constant of constantElements) {
            // Check if constant name appears in code snippet
            const regex = new RegExp(`\\b${constant.name}\\b`);
            if (regex.test(element.codeSnippet)) {
                referencedConstants.push(constant);
            }
        }

        return referencedConstants;
    }

    /**
     * Get context lines before or after an element
     */
    private getContextLines(
        lines: string[],
        startLine: number,
        relativeStart: number,
        relativeEnd: number
    ): string[] {
        const contextLines: string[] = [];
        
        const start = Math.max(0, startLine + relativeStart);
        const end = Math.min(lines.length - 1, startLine + relativeEnd);

        for (let i = start; i < end; i++) {
            const line = lines[i];
            if (line.trim()) {
                contextLines.push(line);
            }
        }

        return contextLines;
    }

    /**
     * Extract helper functions called by this element (up to N levels deep)
     */
    private extractCalledHelpers(
        element: CodeElement,
        allElements: CodeElement[],
        maxDepth: number
    ): CodeElement[] {
        if (!element.codeSnippet || maxDepth <= 0) {
            return [];
        }

        const helpers: CodeElement[] = [];
        const visited = new Set<string>([element.name]);

        this.findHelpersRecursive(element, allElements, helpers, visited, maxDepth, 0);

        return helpers;
    }

    private findHelpersRecursive(
        element: CodeElement,
        allElements: CodeElement[],
        helpers: CodeElement[],
        visited: Set<string>,
        maxDepth: number,
        currentDepth: number
    ): void {
        if (currentDepth >= maxDepth || !element.codeSnippet) {
            return;
        }

        // Find function calls in this element
        const functionCalls = this.extractFunctionCalls(element.codeSnippet);

        for (const calledFunction of functionCalls) {
            if (visited.has(calledFunction)) {
                continue; // Avoid circular references
            }

            const helperElement = allElements.find(e => 
                e.name === calledFunction && 
                (e.type === 'function' || e.type === 'method' || e.type === 'arrow_function')
            );

            if (helperElement) {
                helpers.push(helperElement);
                visited.add(calledFunction);

                // Recursively find helpers called by this helper
                this.findHelpersRecursive(
                    helperElement,
                    allElements,
                    helpers,
                    visited,
                    maxDepth,
                    currentDepth + 1
                );
            }
        }
    }

    private extractFunctionCalls(codeSnippet: string): string[] {
        const calls: string[] = [];
        
        // Simple pattern: functionName(
        const pattern = /(\w+)\s*\(/g;
        const matches = codeSnippet.matchAll(pattern);
        
        for (const match of matches) {
            const functionName = match[1];
            if (functionName && !this.isKeyword(functionName)) {
                calls.push(functionName);
            }
        }

        return calls;
    }

    private isKeyword(name: string): boolean {
        const keywords = new Set([
            'if', 'for', 'while', 'switch', 'try', 'catch', 'return',
            'console', 'print', 'len', 'range', 'new', 'typeof', 'instanceof',
        ]);
        return keywords.has(name);
    }
}

