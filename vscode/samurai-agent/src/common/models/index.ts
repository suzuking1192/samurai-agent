/**
 * Common Data Models
 * 
 * This module serves as the central location for all shared data structures
 * and type definitions used across the Samurai Agent extension.
 * 
 * These models will be used by:
 * - Agent core logic and orchestration
 * - LLM provider integrations
 * - Memory management systems
 * - Tool integration interfaces
 * - Webview communication protocols
 * - VS Code command handlers
 * 
 * Future model categories:
 * - Agent configuration and settings
 * - Task and workflow definitions
 * - Memory and context structures
 * - LLM request/response formats
 * - Tool call specifications
 * - Error and status reporting
 * - User interface data models
 */

/**
 * Base interface for all agent-related data models
 * Provides common properties that all models should implement
 */
export interface BaseModel {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Agent status enumeration
 * Defines the possible states of the AI agent
 */
export enum AgentStatus {
    UNINITIALIZED = 'uninitialized',
    INITIALIZING = 'initializing',
    READY = 'ready',
    BUSY = 'busy',
    ERROR = 'error',
    SHUTTING_DOWN = 'shutting_down'
}

/**
 * Basic agent configuration interface
 * TODO: Expand this interface as configuration requirements grow
 */
export interface AgentConfig extends BaseModel {
    name: string;
    version: string;
    status: AgentStatus;
    settings: Record<string, any>;
}

/**
 * Placeholder for future model exports
 * TODO: Add specific model interfaces as they are developed:
 * - TaskModel
 * - MemoryModel
 * - LLMRequestModel
 * - ToolCallModel
 * - ContextModel
 * - ResponseModel
 * - ErrorModel
 */

// Export all models from this central location
export * from './agent-config';
export * from './task-models';
export * from './memory-models';
export * from './llm-models';
export * from './tool-models';
export * from './context-models';
export * from './response-models';
export * from './error-models';
