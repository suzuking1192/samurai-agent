/**
 * Tool-related data models
 * 
 * Defines the structure for tool calls, tool definitions, and tool integration
 * in the Samurai Agent extension.
 */

import { BaseModel } from './index';
import { CodeElement } from './context-models';

/**
 * Tool call status
 */
export enum ToolCallStatus {
    PENDING = 'pending',
    EXECUTING = 'executing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled'
}

/**
 * Tool definition model
 */
export interface ToolDefinition extends BaseModel {
    name: string;
    description: string;
    parameters: Record<string, any>; // JSON Schema
    required: string[];
    category: string;
    enabled: boolean;
    metadata: Record<string, any>;
}

/**
 * Tool call model
 */
export interface ToolCall extends BaseModel {
    toolName: string;
    parameters: Record<string, any>;
    status: ToolCallStatus;
    result?: any;
    error?: string;
    executionTime?: number;
    metadata: Record<string, any>;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
    success: boolean;
    result?: any;
    error?: string;
    executionTime: number;
    metadata: Record<string, any>;
    relevance_score?: number;
    context?: string;
    file_path?: string;
    elements?: Array<{
        name: string;
        type: string;
        lineStart: number;
        filePath: string;
        signature?: string;
    }>;
}

/**
 * Specific payload interface for code extraction tool results
 */
export interface ExtractCodeToolResultPayload {
    relevance_score: number;
    context: string;
    file_path: string;
    relevantCodeElements: Array<{
        path: string;
        elements: CodeElement[];
        snippet: string;
    }>;
}
