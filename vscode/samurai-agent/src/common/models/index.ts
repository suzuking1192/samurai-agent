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
 * Session-related data models
 * Defines the structure for chat sessions and conversation management
 */
export interface Session extends BaseModel {
    title: string;
    description?: string;
    isActive: boolean;
    messageCount: number;
    lastMessageAt?: Date;
    metadata: Record<string, any>;
}

/**
 * Chat message data model
 * Represents individual messages within a chat session
 */
export interface ChatMessage extends BaseModel {
    sessionId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    model?: string;
    mode?: string;
    tokens?: number;
    cost?: number;
    metadata: Record<string, any>;
}

/**
 * Project settings data model
 * Represents project-specific configuration
 */
export interface ProjectSettings extends BaseModel {
    projectName: string;
    projectPath: string;
    projectDetailText: string;
    digestedMemory: string;
    llmProvider: 'openai' | 'gemini' | 'claude';
    defaultModel: string;
    defaultMode: string;
    metadata: Record<string, any>;
}

/**
 * Global settings data model
 * Represents extension-wide configuration
 */
export interface GlobalSettings extends BaseModel {
    openaiApiKey: string;
    openaiModels: string[];
    geminiApiKey: string;
    geminiModels: string[];
    claudeApiKey: string;
    claudeModels: string[];
    theme: string;
    autoSave: boolean;
    metadata: Record<string, any>;
}

// Export all models from this central location
export * from './agent-config';
export * from './task-models';
export * from './memory-models';
export * from './llm-models';
export * from './tool-models';
export * from './context-models';
export * from './response-models';
export * from './error-models';
export * from './chat-models';
export * from './settings-models';
