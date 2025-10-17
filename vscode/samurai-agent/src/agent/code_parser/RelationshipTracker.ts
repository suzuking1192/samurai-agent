/**
 * Phase 3: Language-Agnostic Relationship Tracking
 * 
 * Tracks relationships between code elements:
 * - Call graphs (who calls whom)
 * - Inheritance hierarchies (extends, implements)
 * - Type dependencies (which types depend on which)
 * - Data flow (variable usage and transformations)
 */

import { CodeRelationships } from '../../common/models/context-models';

export class RelationshipTracker {
    /**
     * Build call graph from code snippet
     * Tracks function/method calls within the code
     */
    public buildCallGraph(
        codeSnippet: string,
        elementName: string,
        language: string
    ): Array<{from: string; to: string; lineNumber: number}> {
        const calls: Array<{from: string; to: string; lineNumber: number}> = [];
        const lines = codeSnippet.split('\n');
        
        const lang = language.toLowerCase();
        
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            
            // Extract function calls based on language
            const callPattern = this.getCallPattern(lang);
            if (!callPattern) {
                return;
            }
            
            const matches = trimmed.matchAll(callPattern);
            for (const match of matches) {
                const calledFunction = match[1];
                if (calledFunction && !this.isKeyword(calledFunction, lang)) {
                    calls.push({
                        from: elementName,
                        to: calledFunction,
                        lineNumber: index + 1,
                    });
                }
            }
        });
        
        return calls;
    }

    /**
     * Get call pattern regex for a language
     */
    private getCallPattern(language: string): RegExp | null {
        switch (language) {
            case 'typescript':
            case 'javascript':
            case 'tsx':
            case 'jsx':
                // Matches: functionName(...), obj.methodName(...), new ClassName(...)
                return /(\w+)\s*\(/g;
            
            case 'python':
                // Matches: function_name(...), obj.method_name(...)
                return /(\w+)\s*\(/g;
            
            case 'java':
            case 'csharp':
                // Matches: methodName(...), new ClassName(...)
                return /(\w+)\s*\(/g;
            
            case 'cpp':
            case 'c':
                // Matches: functionName(...), obj->method(...)
                return /(\w+)\s*\(/g;
            
            case 'go':
                // Matches: functionName(...), obj.Method(...)
                return /(\w+)\s*\(/g;
            
            case 'rust':
                // Matches: function_name(...), obj.method_name(...)
                return /(\w+)\s*\(/g;
            
            case 'php':
                // Matches: functionName(...), $obj->methodName(...)
                return /(\w+)\s*\(/g;
            
            case 'ruby':
                // Matches: method_name(...), obj.method_name
                return /(\w+)\s*(?:\(|$)/g;
            
            default:
                return null;
        }
    }

    /**
     * Check if a name is a language keyword
     */
    private isKeyword(name: string, language: string): boolean {
        const keywords: Record<string, Set<string>> = {
            typescript: new Set(['if', 'for', 'while', 'switch', 'catch', 'try', 'return', 'new', 'typeof', 'instanceof']),
            javascript: new Set(['if', 'for', 'while', 'switch', 'catch', 'try', 'return', 'new', 'typeof', 'instanceof']),
            python: new Set(['if', 'for', 'while', 'try', 'except', 'return', 'print', 'len', 'range', 'str', 'int', 'float', 'bool']),
            java: new Set(['if', 'for', 'while', 'switch', 'catch', 'try', 'return', 'new']),
            go: new Set(['if', 'for', 'switch', 'return', 'new', 'make', 'len', 'cap', 'append']),
            rust: new Set(['if', 'for', 'while', 'match', 'return', 'Some', 'None', 'Ok', 'Err']),
        };
        
        return keywords[language]?.has(name) || false;
    }

    /**
     * Track inheritance relationships
     * Extracts extends/implements/derives relationships
     */
    public trackInheritance(
        signature: string,
        className: string,
        language: string
    ): { extends: string | null; implements: string[] } {
        const result = { extends: null as string | null, implements: [] as string[] };
        const lang = language.toLowerCase();
        
        switch (lang) {
            case 'typescript':
            case 'javascript':
            case 'tsx':
            case 'jsx':
                return this.extractTSInheritance(signature, className);
            
            case 'python':
                return this.extractPythonInheritance(signature, className);
            
            case 'java':
            case 'csharp':
                return this.extractJavaLikeInheritance(signature, className);
            
            case 'cpp':
            case 'c':
                return this.extractCppInheritance(signature, className);
            
            case 'rust':
                return this.extractRustInheritance(signature, className);
            
            case 'go':
                // Go only has interface embedding, no class inheritance
                return result;
            
            default:
                return result;
        }
    }

    private extractTSInheritance(signature: string, className: string): { extends: string | null; implements: string[] } {
        const result = { extends: null as string | null, implements: [] as string[] };
        
        // Extract extends
        const extendsMatch = signature.match(/extends\s+(\w+)/);
        if (extendsMatch) {
            result.extends = extendsMatch[1];
        }
        
        // Extract implements
        const implementsMatch = signature.match(/implements\s+([\w\s,]+)/);
        if (implementsMatch) {
            result.implements = implementsMatch[1].split(',').map(i => i.trim()).filter(i => i);
        }
        
        return result;
    }

    private extractPythonInheritance(signature: string, className: string): { extends: string | null; implements: string[] } {
        const result = { extends: null as string | null, implements: [] as string[] };
        
        // Python: class MyClass(BaseClass, Mixin1, Mixin2):
        const inheritanceMatch = signature.match(/class\s+\w+\s*\(([^)]+)\)/);
        if (inheritanceMatch) {
            const bases = inheritanceMatch[1].split(',').map(b => b.trim()).filter(b => b);
            if (bases.length > 0) {
                result.extends = bases[0]; // First is typically the base class
                result.implements = bases.slice(1); // Rest are mixins/protocols
            }
        }
        
        return result;
    }

    private extractJavaLikeInheritance(signature: string, className: string): { extends: string | null; implements: string[] } {
        const result = { extends: null as string | null, implements: [] as string[] };
        
        // Extract extends
        const extendsMatch = signature.match(/extends\s+(\w+)/);
        if (extendsMatch) {
            result.extends = extendsMatch[1];
        }
        
        // Extract implements
        const implementsMatch = signature.match(/implements\s+([\w\s,]+)/);
        if (implementsMatch) {
            result.implements = implementsMatch[1].split(',').map(i => i.trim()).filter(i => i);
        }
        
        return result;
    }

    private extractCppInheritance(signature: string, className: string): { extends: string | null; implements: string[] } {
        const result = { extends: null as string | null, implements: [] as string[] };
        
        // C++: class Derived : public Base, public Interface
        const inheritanceMatch = signature.match(/:\s*(?:public|private|protected)?\s*([\w\s,]+)/);
        if (inheritanceMatch) {
            const bases = inheritanceMatch[1].split(',').map(b => {
                // Remove access specifiers
                return b.replace(/(?:public|private|protected)\s+/, '').trim();
            }).filter(b => b);
            
            if (bases.length > 0) {
                result.extends = bases[0];
                result.implements = bases.slice(1);
            }
        }
        
        return result;
    }

    private extractRustInheritance(signature: string, className: string): { extends: string | null; implements: string[] } {
        const result = { extends: null as string | null, implements: [] as string[] };
        
        // Rust doesn't have class inheritance, but has trait implementation
        // This would be tracked separately in impl blocks
        return result;
    }

    /**
     * Track type dependencies
     * Identifies which types depend on other types
     */
    public trackTypeDependencies(
        signature: string,
        codeSnippet: string,
        elementName: string,
        language: string
    ): string[] {
        const dependencies: Set<string> = new Set();
        const lang = language.toLowerCase();
        
        // Extract type names from signature and code
        const typePattern = this.getTypePattern(lang);
        if (!typePattern) {
            return [];
        }
        
        // Extract from signature
        const signatureMatches = signature.matchAll(typePattern);
        for (const match of signatureMatches) {
            const typeName = match[1];
            if (typeName && typeName !== elementName && !this.isPrimitiveType(typeName, lang)) {
                dependencies.add(typeName);
            }
        }
        
        // Extract from code snippet (type annotations, casts, etc.)
        const snippetMatches = codeSnippet.matchAll(typePattern);
        for (const match of snippetMatches) {
            const typeName = match[1];
            if (typeName && typeName !== elementName && !this.isPrimitiveType(typeName, lang)) {
                dependencies.add(typeName);
            }
        }
        
        return Array.from(dependencies);
    }

    /**
     * Get type pattern for extracting type names
     */
    private getTypePattern(language: string): RegExp | null {
        switch (language) {
            case 'typescript':
            case 'tsx':
                // Matches type annotations: : TypeName, <TypeName>, as TypeName
                return /:\s*(\w+)|<(\w+)>|as\s+(\w+)/g;
            
            case 'python':
                // Matches type hints: : TypeName, -> TypeName
                return /:\s*(\w+)|->\s*(\w+)/g;
            
            case 'java':
            case 'csharp':
                // Matches type declarations
                return /<(\w+)>|(\w+)\s+\w+\s*[;=]/g;
            
            default:
                return null;
        }
    }

    /**
     * Check if a type is a primitive/built-in type
     */
    private isPrimitiveType(typeName: string, language: string): boolean {
        const primitives: Record<string, Set<string>> = {
            typescript: new Set(['string', 'number', 'boolean', 'any', 'void', 'null', 'undefined', 'never', 'unknown']),
            javascript: new Set(['string', 'number', 'boolean', 'object', 'function']),
            python: new Set(['str', 'int', 'float', 'bool', 'list', 'dict', 'tuple', 'set', 'None']),
            java: new Set(['int', 'long', 'short', 'byte', 'float', 'double', 'boolean', 'char', 'void', 'String']),
            csharp: new Set(['int', 'long', 'short', 'byte', 'float', 'double', 'decimal', 'bool', 'char', 'string', 'void']),
            go: new Set(['int', 'int64', 'int32', 'float64', 'float32', 'bool', 'string', 'byte', 'rune', 'error']),
            rust: new Set(['i32', 'i64', 'u32', 'u64', 'f32', 'f64', 'bool', 'char', 'str', 'String']),
        };
        
        return primitives[language]?.has(typeName) || false;
    }
}

