/**
 * Context-related data models
 * 
 * Defines the structure for context management, code analysis, and project context
 * in the Samurai Agent extension.
 */

import { BaseModel } from './index';

/**
 * Context types
 */
export enum ContextType {
    PROJECT = 'project',
    FILE = 'file',
    FUNCTION = 'function',
    CLASS = 'class',
    MODULE = 'module',
    SESSION = 'session',
    TASK = 'task'
}

/**
 * Context model
 */
export interface Context extends BaseModel {
    type: ContextType;
    name: string;
    content: string;
    source: string; // File path, URL, etc.
    language?: string;
    metadata: {
        lineStart?: number;
        lineEnd?: number;
        characterStart?: number;
        characterEnd?: number;
        [key: string]: any;
    };
    relatedIds: string[]; // Related context IDs
    tags: string[];
}

/**
 * Code analysis result
 */
export interface CodeAnalysisResult extends BaseModel {
    filePath: string;
    language: string;
    analysis: {
        functions: CodeFunction[];
        classes: CodeClass[];
        imports: string[];
        exports: string[];
        dependencies: string[];
        complexity: number;
        issues: CodeIssue[];
    };
    metadata: Record<string, any>;
}

/**
 * Code function model
 */
export interface CodeFunction {
    name: string;
    parameters: string[];
    returnType?: string;
    lineStart: number;
    lineEnd: number;
    complexity: number;
    documentation?: string;
}

/**
 * Code class model
 */
export interface CodeClass {
    name: string;
    methods: CodeFunction[];
    properties: string[];
    lineStart: number;
    lineEnd: number;
    documentation?: string;
}

export type CodeElementType =
    | 'function'
    | 'class'
    | 'method'
    | 'variable'
    | 'arrow_function'
    | 'interface'
    | 'struct'
    | 'impl'
    | 'trait'
    | 'module'
    | 'enum'
    | 'import'
    | 'export'
    // New language-agnostic types (Phase 1)
    | 'type_definition'  // Type aliases, typedef, protocols (language-agnostic)
    | 'constant'         // const, final, static final, UPPER_CASE conventions
    | 'annotation'       // Decorators (Python/TS), annotations (Java), attributes (C#/PHP8+)
    | 'generic_parameter' // Generics, templates across languages
    | 'namespace';       // namespace, package, module declarations

/**
 * Documentation metadata extracted from code comments
 * Supports multiple documentation formats: JSDoc, docstrings, Javadoc, Rustdoc, etc.
 */
export interface Documentation {
    summary?: string;
    params?: Array<{
        name: string;
        type?: string;
        description: string;
    }>;
    returns?: {
        type?: string;
        description: string;
    };
    throws?: Array<{
        type: string;
        description: string;
    }>;
    examples?: string[];
    inlineComments?: string[];
    deprecated?: boolean;
}

export interface CodeElement {
    name: string;
    type: CodeElementType;
    lineStart: number;
    lineEnd: number;
    filePath: string;
    signature?: string;
    codeSnippet?: string;
    // Phase 2: Documentation support
    documentation?: Documentation;
    // Language-specific metadata
    metadata?: {
        isExported?: boolean;      // Phase 8: Export tracking
        visibility?: string;        // public, private, protected, etc.
        isGeneric?: boolean;        // Has generic/template parameters
        modifiers?: string[];       // static, final, async, etc.
        [key: string]: any;
    };
}

/**
 * Relationship tracking for code flow analysis (Phase 3)
 */
export interface CodeRelationships {
    calls: Array<{
        from: string;        // Caller function/method name
        to: string;          // Callee function/method name
        lineNumber: number;  // Line where call occurs
    }>;
    extends: Array<{
        child: string;       // Child class name
        parent: string;      // Parent class name
    }>;
    implements: Array<{
        class: string;       // Class name
        interface: string;   // Interface name
    }>;
    typeDependencies: Array<{
        type: string;        // Type name
        dependsOn: string[]; // Types it depends on
    }>;
}

/**
 * Pattern detection metadata (Phase 6)
 */
export interface CodePatterns {
    architecturalLayer?: 'controller' | 'service' | 'repository' | 'model' | 'utility';
    frameworkPatterns?: string[]; // e.g., 'react-hook', 'express-route', 'spring-controller'
    isEntryPoint?: boolean;
    dependencyInjection?: boolean;
}

export interface FileInfo {
    path: string;
    name: string;
    extension: string;
    language: string;
    size: number;
    elements: CodeElement[];
    lastModified: Date;
    // Phase 3: Relationship tracking
    relationships?: CodeRelationships;
    // Phase 6: Pattern detection
    patterns?: CodePatterns;
    // Phase 8: Export analysis
    exports?: Array<{
        name: string;
        type: 'named' | 'default' | 're-export';
        from?: string; // For re-exports
    }>;
    moduleBoundary?: {
        isBarrelFile: boolean;
        modulePath: string;
        exportsFromFiles?: string[];
    };
}

/**
 * Code issue model
 */
export interface CodeIssue {
    type: 'error' | 'warning' | 'info';
    message: string;
    line: number;
    column?: number;
    rule?: string;
}
