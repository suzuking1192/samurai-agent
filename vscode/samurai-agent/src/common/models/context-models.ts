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
    | 'export';

export interface CodeElement {
    name: string;
    type: CodeElementType;
    lineStart: number;
    lineEnd: number;
    filePath: string;
    signature?: string;
    codeSnippet?: string;
}

export interface FileInfo {
    path: string;
    name: string;
    extension: string;
    language: string;
    size: number;
    elements: CodeElement[];
    lastModified: Date;
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
