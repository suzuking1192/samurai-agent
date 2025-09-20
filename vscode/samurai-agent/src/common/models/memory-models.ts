/**
 * Memory-related data models
 * 
 * Defines the structure for memory storage, retrieval, and management
 * in the Samurai Agent extension.
 */

import { BaseModel } from './index';

/**
 * Memory types for categorization
 */
export enum MemoryType {
    EPISODIC = 'episodic',     // Specific events and experiences
    SEMANTIC = 'semantic',     // Facts and knowledge
    PROCEDURAL = 'procedural', // How-to knowledge and skills
    WORKING = 'working',       // Temporary working memory
    CONTEXTUAL = 'contextual'  // Project and session context
}

/**
 * Memory importance levels
 */
export enum MemoryImportance {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

/**
 * Main Memory model
 * Represents a piece of memory with its content and metadata
 */
export interface Memory extends BaseModel {
    content: string;
    type: MemoryType;
    importance: MemoryImportance;
    tags: string[];
    source: string; // Where this memory came from (e.g., 'user_input', 'agent_analysis', 'code_analysis')
    context: string; // Additional context about when/where this memory was created
    relatedTaskIds: string[]; // Tasks this memory is related to
    relatedSessionIds: string[]; // Sessions this memory is related to
    embedding?: number[]; // Vector embedding for semantic search
    metadata: Record<string, any>;
}

/**
 * Memory creation request model
 */
export interface CreateMemoryRequest {
    content: string;
    type: MemoryType;
    importance?: MemoryImportance;
    tags?: string[];
    source: string;
    context?: string;
    relatedTaskIds?: string[];
    relatedSessionIds?: string[];
    metadata?: Record<string, any>;
}

/**
 * Memory update request model
 */
export interface UpdateMemoryRequest {
    id: string;
    content?: string;
    type?: MemoryType;
    importance?: MemoryImportance;
    tags?: string[];
    source?: string;
    context?: string;
    relatedTaskIds?: string[];
    relatedSessionIds?: string[];
    metadata?: Record<string, any>;
}

/**
 * Memory search query model
 */
export interface MemorySearchQuery {
    query: string;
    type?: MemoryType[];
    importance?: MemoryImportance[];
    tags?: string[];
    relatedTaskIds?: string[];
    relatedSessionIds?: string[];
    limit?: number;
    includeEmbeddings?: boolean;
}

/**
 * Memory search result
 */
export interface MemorySearchResult {
    memories: Memory[];
    total: number;
    query: string;
    searchTime: number;
}
