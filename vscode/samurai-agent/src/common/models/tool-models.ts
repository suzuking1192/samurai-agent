/**
 * Tool-related data models
 * 
 * Defines the structure for tool calls, tool definitions, and tool integration
 * in the Samurai Agent extension.
 */

import { BaseModel } from './index';

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
}
