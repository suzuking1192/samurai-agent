/**
 * Error-related data models
 * 
 * Defines the structure for error handling, logging, and error reporting
 * in the Samurai Agent extension.
 */

import { BaseModel } from './index';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

/**
 * Error categories
 */
export enum ErrorCategory {
    VALIDATION = 'validation',
    AUTHENTICATION = 'authentication',
    AUTHORIZATION = 'authorization',
    NETWORK = 'network',
    PERSISTENCE = 'persistence',
    LLM = 'llm',
    TOOL = 'tool',
    SYSTEM = 'system',
    USER = 'user'
}

/**
 * Error model
 */
export interface ErrorModel extends BaseModel {
    code: string;
    message: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    stack?: string;
    context: Record<string, any>;
    userId?: string;
    sessionId?: string;
    requestId?: string;
    resolved: boolean;
    resolvedAt?: Date;
    resolvedBy?: string;
}

/**
 * Error log entry
 */
export interface ErrorLogEntry {
    timestamp: Date;
    level: 'error' | 'warn' | 'info' | 'debug';
    message: string;
    error?: ErrorModel;
    context: Record<string, any>;
    userId?: string;
    sessionId?: string;
    requestId?: string;
}
