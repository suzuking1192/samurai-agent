/**
 * Chat-related data models
 * 
 * Defines the structure for chat messages, sessions, and conversation management
 * in the Samurai Agent extension.
 */

import { BaseModel } from './index';

/**
 * Message types in chat conversations
 */
export enum MessageType {
    USER = 'user',
    ASSISTANT = 'assistant',
    SYSTEM = 'system',
    ERROR = 'error',
    INFO = 'info'
}

/**
 * Chat session status
 */
export enum SessionStatus {
    ACTIVE = 'active',
    PAUSED = 'paused',
    COMPLETED = 'completed',
    ARCHIVED = 'archived'
}

/**
 * User intent types for conversation analysis
 */
export enum UserIntentEnum {
    PURE_DISCUSSION = 'pure_discussion',
    FEATURE_EXPLORATION = 'feature_exploration',
    SPEC_CLARIFICATION = 'spec_clarification',
    SPEC_GENERATION = 'spec_generation'
}

/**
 * Output structure for SPEC_CLARIFICATION intent
 */
export interface ISpecClarificationOutput {
    clarification_text: string;
    score: number; // 0-100 score indicating specification readiness
    usageTokens?: number;
    cost?: number;
}

/**
 * Schema for interactive UI elements like buttons
 */
export interface QuestionSchema {
    type: string;
    label: string;
    messageToSend: string;
}

/**
 * Confirmation question schema for interactive confirmation UI
 */
export interface ConfirmationQuestion {
    originalQuestionText: string;
}

/**
 * Main ChatMessage model
 * Represents a single message in a chat conversation
 */
export interface ChatMessage extends BaseModel {
    sessionId: string;
    projectId: string;
    type: MessageType;
    content: string;
    role: string; // For compatibility with LLM APIs
    metadata: {
        model?: string; // LLM model used for assistant messages
        tokens?: number; // Token count for the message
        cost?: number; // Cost of the message
        processingTime?: number; // Time taken to process
        error?: string; // Error message if any
        [key: string]: any;
    };
    parentMessageId?: string; // For threaded conversations
    isEdited: boolean;
    editedAt?: Date;
    specClarificationData?: ISpecClarificationOutput; // For SPEC_CLARIFICATION responses
    interactiveQuestions?: QuestionSchema[]; // For interactive UI elements like buttons
    interactiveConfirmationQuestions?: ConfirmationQuestion[]; // For confirmation question buttons
}

/**
 * Chat session model
 * Represents a conversation session
 */
export interface Session extends BaseModel {
    title: string;
    status: SessionStatus;
    messageCount: number;
    totalTokens: number;
    totalCost: number;
    lastMessageAt: Date;
    tags: string[];
    metadata: {
        model?: string; // Default model for the session
        mode?: string; // Chat mode (default, developer, creative, analytical)
        projectId: string; // Associated project
        [key: string]: any;
    };
    codeContextIds: string[]; // References to associated code context payloads
    previous_session_intent: UserIntentEnum; // Intent from the previous session
}

/**
 * Chat message creation request
 */
export interface CreateChatMessageRequest {
    sessionId: string;
    projectId: string;
    type: MessageType;
    content: string;
    role: string;
    metadata?: Record<string, any>;
    parentMessageId?: string;
    specClarificationData?: ISpecClarificationOutput;
    interactiveQuestions?: QuestionSchema[];
    interactiveConfirmationQuestions?: ConfirmationQuestion[];
}

/**
 * Chat message update request
 */
export interface UpdateChatMessageRequest {
    id: string;
    content?: string;
    metadata?: Record<string, any>;
}

/**
 * Session creation request
 */
export interface CreateSessionRequest {
    title: string;
    model?: string;
    mode?: string;
    projectId: string;
    tags?: string[];
    metadata?: Record<string, any>;
}

/**
 * Session update request
 */
export interface UpdateSessionRequest {
    id: string;
    title?: string;
    status?: SessionStatus;
    tags?: string[];
    metadata?: Record<string, any>;
}

/**
 * Chat query options
 */
export interface ChatQueryOptions {
    sessionId?: string;
    messageType?: MessageType[];
    limit?: number;
    offset?: number;
    includeMetadata?: boolean;
}

/**
 * Session query options
 */
export interface SessionQueryOptions {
    status?: SessionStatus[];
    tags?: string[];
    projectId?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'lastMessageAt' | 'title';
    sortOrder?: 'asc' | 'desc';
}
