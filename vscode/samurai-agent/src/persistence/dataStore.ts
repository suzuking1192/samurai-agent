/**
 * Centralized persistence module for Samurai Agent
 * Handles all data storage and retrieval operations
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Spec } from '../common/models/spec-models';
import { Memory } from '../common/models/memory-models';
import { ProjectSettings, GlobalSettings, IProjectSettings } from '../common/models/settings-models';
import { ApiResponse, ResponseType } from '../common/models/response-models';
import {
    ChatMessage,
    CreateChatMessageRequest,
    CreateSessionRequest,
    MessageType,
    Session,
    SessionStatus,
    UserIntentEnum
} from '../common/models/chat-models';
import { ExtractCodeToolResultPayload } from '../common/models/tool-models';
import { randomUUID } from 'crypto';

type StoredSession = Omit<Session, 'createdAt' | 'updatedAt' | 'lastMessageAt'> & {
    createdAt: string;
    updatedAt: string;
    lastMessageAt: string | null;
};

type StoredChatMessage = Omit<ChatMessage, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
};

export class DataStore {
    private workspaceRoot: string;
    private dataDir: string;
    
    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.dataDir = path.join(workspaceRoot, '.vscode', 'samurai-agent');
        this.ensureDataDirectory();
    }
    
    /**
     * Ensures the data directory exists
     */
    private ensureDataDirectory() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    /**
     * Gets the file path for a specific data type
     */
    private getDataFilePath(dataType: string): string {
        return path.join(this.dataDir, `${dataType}.json`);
    }
    
    /**
     * Reads JSON data from file (for arrays)
     */
    private readJsonFile<T>(filePath: string): T[] {
        try {
            if (!fs.existsSync(filePath)) {
                return [];
            }
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error reading ${filePath}:`, error);
            return [];
        }
    }

    /**
     * Writes JSON data to file (for arrays)
     */
    private writeJsonFile<T>(filePath: string, data: T[]): void {
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`Error writing ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Reads single JSON object from file
     */
    private readSingleJsonFile<T>(filePath: string): T | null {
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error reading single JSON file ${filePath}:`, error);
            return null;
        }
    }
    
    /**
     * Writes single JSON object to file
     */
    private writeSingleJsonFile<T>(filePath: string, data: T): void {
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`Error writing single JSON file ${filePath}:`, error);
            throw error;
        }
    }

    private getSessionsFilePath(): string {
        return this.getDataFilePath('sessions');
    }

    private getChatMessagesFilePath(): string {
        return this.getDataFilePath('chatMessages');
    }

    private readStoredSessions(): StoredSession[] {
        return this.readJsonFile<StoredSession>(this.getSessionsFilePath());
    }

    private writeStoredSessions(sessions: StoredSession[]): void {
        this.writeJsonFile(this.getSessionsFilePath(), sessions);
    }

    private readStoredChatMessages(): StoredChatMessage[] {
        return this.readJsonFile<StoredChatMessage>(this.getChatMessagesFilePath());
    }

    private writeStoredChatMessages(messages: StoredChatMessage[]): void {
        this.writeJsonFile(this.getChatMessagesFilePath(), messages);
    }

    private toStoredSession(session: Session): StoredSession {
        return {
            ...session,
            createdAt: session.createdAt.toISOString(),
            updatedAt: session.updatedAt.toISOString(),
            lastMessageAt: session.lastMessageAt ? session.lastMessageAt.toISOString() : null
        };
    }

    private fromStoredSession(stored: StoredSession): Session {
        return {
            ...stored,
            createdAt: new Date(stored.createdAt),
            updatedAt: new Date(stored.updatedAt),
            lastMessageAt: stored.lastMessageAt ? new Date(stored.lastMessageAt) : new Date(stored.createdAt),
            metadata: stored.metadata ?? {
                projectId: ''
            }
        };
    }

    private toStoredChatMessage(message: ChatMessage): StoredChatMessage {
        return {
            ...message,
            createdAt: message.createdAt.toISOString(),
            updatedAt: message.updatedAt.toISOString()
        };
    }

    private fromStoredChatMessage(stored: StoredChatMessage): ChatMessage {
        return {
            ...stored,
            createdAt: new Date(stored.createdAt),
            updatedAt: new Date(stored.updatedAt),
            metadata: stored.metadata ?? {}
        };
    }

    private loadSessionInternal(sessionId: string): Session | undefined {
        if (!sessionId) {
            return undefined;
        }
        const storedSessions = this.readStoredSessions();
        const stored = storedSessions.find((session) => session.id === sessionId);
        return stored ? this.fromStoredSession(stored) : undefined;
    }

    private loadSessionsInternal(): Session[] {
        const storedSessions = this.readStoredSessions();
        return storedSessions.map((session) => this.fromStoredSession(session));
    }

    private createSessionInternal(request: CreateSessionRequest): Session {
        if (!request?.projectId) {
            throw new Error('Project ID is required to create a session');
        }

        const now = new Date();
        const session: Session = {
            id: randomUUID(),
            title: request.title?.trim() || 'New Conversation',
            status: SessionStatus.ACTIVE,
            messageCount: 0,
            totalTokens: 0,
            totalCost: 0,
            lastMessageAt: now,
            tags: request.tags ?? [],
            metadata: {
                projectId: request.projectId,
                ...(request.model ? { model: request.model } : {}),
                ...(request.mode ? { mode: request.mode } : {}),
                ...(request.metadata ?? {})
            },
            codeContextIds: [],
            previous_session_intent: UserIntentEnum.PURE_DISCUSSION,
            createdAt: now,
            updatedAt: now
        };

        const storedSessions = this.readStoredSessions();
        storedSessions.push(this.toStoredSession(session));
        this.writeStoredSessions(storedSessions);

        return session;
    }

    private updateSessionInternal(sessionId: string, updates: Partial<Session>): Session {
        if (!sessionId) {
            throw new Error('Session ID is required to update a session');
        }

        const storedSessions = this.readStoredSessions();
        const sessionIndex = storedSessions.findIndex((session) => session.id === sessionId);

        if (sessionIndex < 0) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const currentSession = this.fromStoredSession(storedSessions[sessionIndex]);
        const now = new Date();

        const mergedMetadata = updates.metadata
            ? { ...currentSession.metadata, ...updates.metadata }
            : currentSession.metadata;

        const updatedSession: Session = {
            ...currentSession,
            ...updates,
            metadata: mergedMetadata,
            lastMessageAt: updates.lastMessageAt ?? currentSession.lastMessageAt,
            tags: updates.tags ?? currentSession.tags,
            status: updates.status ?? currentSession.status,
            updatedAt: now
        };

        storedSessions[sessionIndex] = this.toStoredSession(updatedSession);
        this.writeStoredSessions(storedSessions);

        return updatedSession;
    }

    private saveChatMessageInternal(request: CreateChatMessageRequest): ChatMessage {
        if (!request?.sessionId) {
            throw new Error('Session ID is required to save a chat message');
        }
        if (!request?.projectId) {
            throw new Error('Project ID is required to save a chat message');
        }

        const session = this.loadSessionInternal(request.sessionId);
        if (!session) {
            throw new Error(`Session not found: ${request.sessionId}`);
        }

        const now = new Date();
        const chatMessage: ChatMessage = {
            id: randomUUID(),
            sessionId: request.sessionId,
            projectId: request.projectId,
            type: request.type ?? MessageType.USER,
            content: request.content,
            role: request.role,
            metadata: { ...(request.metadata ?? {}) },
            parentMessageId: request.parentMessageId,
            isEdited: false,
            createdAt: now,
            updatedAt: now
        };

        const messages = this.readStoredChatMessages();
        messages.push(this.toStoredChatMessage(chatMessage));
        this.writeStoredChatMessages(messages);

        const tokensDelta = typeof chatMessage.metadata?.tokens === 'number' ? chatMessage.metadata.tokens : 0;
        const costDelta = typeof chatMessage.metadata?.cost === 'number' ? chatMessage.metadata.cost : 0;

        this.updateSessionInternal(session.id, {
            messageCount: session.messageCount + 1,
            totalTokens: session.totalTokens + tokensDelta,
            totalCost: session.totalCost + costDelta,
            lastMessageAt: chatMessage.createdAt
        });

        return chatMessage;
    }

    private loadChatMessagesForSessionInternal(sessionId: string): ChatMessage[] {
        if (!sessionId) {
            return [];
        }

        const messages = this.readStoredChatMessages()
            .filter((message) => message.sessionId === sessionId)
            .map((message) => this.fromStoredChatMessage(message))
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        return messages;
    }

    /**
     * Public method to load chat messages for a session
     */
    public loadChatMessagesForSession(sessionId: string): ChatMessage[] {
        return this.loadChatMessagesForSessionInternal(sessionId);
    }

    /**
     * Public method to update a session
     */
    public updateSession(sessionId: string, updates: Partial<Session>): Session {
        return this.updateSessionInternal(sessionId, updates);
    }
    
    /**
     * Upserts a collection item (update if exists, insert if not)
     */
    private upsertCollectionItem<T extends { id: string; createdAt?: Date; updatedAt?: Date }>(
        filePath: string, 
        item: T
    ): T {
        const items = this.readJsonFile<T>(filePath);
        const existingIndex = items.findIndex(existing => existing.id === item.id);
        
        const now = new Date();
        if (existingIndex >= 0) {
            // Update existing item
            item.updatedAt = now;
            items[existingIndex] = item;
        } else {
            // Add new item
            item.createdAt = now;
            item.updatedAt = now;
            items.push(item);
        }
        
        this.writeJsonFile(filePath, items);
        return item;
    }

    /**
     * Deletes a collection item by ID
     */
    private deleteCollectionItem<T extends { id: string }>(filePath: string, id: string): boolean {
        const items = this.readJsonFile<T>(filePath);
        const initialLength = items.length;
        const filteredItems = items.filter(item => item.id !== id);
        
        if (filteredItems.length < initialLength) {
            this.writeJsonFile(filePath, filteredItems);
            return true;
        }
        
        return false;
    }

    /**
     * Creates a standardized API response
     */
    private createResponse<T>(
        type: ResponseType, 
        requestId?: string, 
        payload?: T, 
        error?: string
    ): ApiResponse<T> {
        return {
            type,
            requestId,
            payload,
            error,
            timestamp: new Date()
        };
    }

    /**
     * Creates a success response
     */
    private createSuccessResponse<T>(requestId?: string, payload?: T): ApiResponse<T> {
        return this.createResponse(ResponseType.SUCCESS, requestId, payload);
    }

    /**
     * Creates an error response
     */
    private createErrorResponse<T>(requestId?: string, error?: string): ApiResponse<T> {
        return this.createResponse(ResponseType.ERROR, requestId, undefined as T, error);
    }

    /**
     * Main message handler that dispatches commands
     */
    public handleWebviewMessage(message: any): ApiResponse {
        const { command, requestId, payload } = message;
        
        console.log(`DataStore: Handling command '${command}' with requestId '${requestId}'`);
        
        try {
            switch (command) {
                // Spec operations
                case 'loadSpecs':
                    return this.handleLoadSpecs(requestId);
                case 'saveSpec':
                    return this.handleSaveSpec(requestId, payload);
                case 'deleteSpec':
                    return this.handleDeleteSpec(requestId, payload);
                
                // Memory operations
                case 'loadMemories':
                    return this.handleLoadMemories(requestId);
                case 'saveMemory':
                    return this.handleSaveMemory(requestId, payload);
                case 'deleteMemory':
                    return this.handleDeleteMemory(requestId, payload);
                
                // Session operations
                case 'createSession':
                    return this.handleCreateSessionCommand(requestId, payload);
                case 'loadSession':
                    return this.handleLoadSessionCommand(requestId, payload);
                case 'updateSession':
                    return this.handleUpdateSessionCommand(requestId, payload);
        
                // Chat message operations
                case 'loadChatMessagesForSession':
                    return this.handleLoadChatMessagesForSessionCommand(requestId, payload);
                case 'saveChatMessage':
                    return this.handleSaveChatMessageCommand(requestId, payload);
                
                // Settings operations
                case 'loadProjectSettings':
                    return this.handleLoadProjectSettings(requestId);
                case 'saveProjectSettings':
                    return this.handleSaveProjectSettings(requestId, payload);
                case 'loadGlobalSettings':
                    return this.handleLoadGlobalSettings(requestId);
                case 'saveGlobalSettings':
                    return this.handleSaveGlobalSettings(requestId, payload);
                
                default:
                    console.warn(`Unknown command: ${command}`);
                    return this.createResponse(
                        ResponseType.ERROR, 
                        requestId, 
                        undefined, 
                        `Unknown command: ${command}`
                    );
            }
        } catch (error) {
            console.error(`Error handling command '${command}':`, error);
            return this.createResponse(
                ResponseType.ERROR, 
            requestId,
                undefined, 
                error instanceof Error ? error.message : 'Unknown error occurred'
            );
        }
    }

    // GlobalSettings operations
    private handleLoadGlobalSettings(requestId?: string): ApiResponse<any> {
        try {
            const settings = this.readSingleJsonFile<GlobalSettings>(this.getDataFilePath('globalSettings'));
            return this.createSuccessResponse(requestId, settings);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to load global settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private handleSaveGlobalSettings(requestId?: string, settings?: GlobalSettings): ApiResponse<any> {
        try {
            if (!settings) {
                return this.createErrorResponse(requestId, 'Global settings data is required');
            }

            const now = new Date();
            settings.updatedAt = now;
            if (!settings.createdAt) {
                settings.createdAt = now;
            }

            this.writeSingleJsonFile(this.getDataFilePath('globalSettings'), settings);
            return this.createSuccessResponse(requestId, settings);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to save global settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Public ProjectSettings methods
    public readProjectSettings(requestId?: string): ApiResponse<ProjectSettings> {
        return this.handleLoadProjectSettings(requestId);
    }

    public saveProjectSettings(settings: ProjectSettings, requestId?: string): ApiResponse<ProjectSettings> {
        return this.handleSaveProjectSettings(requestId, settings);
    }

    // ProjectSettings operations
    private handleLoadProjectSettings(requestId?: string): ApiResponse<any> {
        try {
            const rawSettings = this.readSingleJsonFile<IProjectSettings>(this.getDataFilePath('projectSettings'));
            
            if (!rawSettings) {
                // Return default project settings if file doesn't exist
                const defaultSettings: ProjectSettings = {
                    id: 'project-settings',
                    projectId: 'default-project',
                    projectName: 'Untitled Project',
                    rawProjectDetailContent: '',
                    digestedProjectDetailContent: '',
                    defaultModel: 'gpt-4o',
                    defaultMode: 'default' as any,
                    customPrompts: {},
                    projectSpecificConfig: {
                        codeAnalysisEnabled: true,
                        autoSpecGeneration: true,
                        memoryRetentionDays: 30,
                        maxTokensPerRequest: 4000
                    },
                    theme: 'auto',
                    autoSave: true,
                    primaryLLMModel: null,
                    currentSessionId: null,
                    metadata: {},
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                return this.createSuccessResponse(requestId, defaultSettings);
            }
            
            // Apply default values for theme, autoSave, and primaryLLMModel if they are missing
            const settings: ProjectSettings = {
                ...rawSettings,
                theme: rawSettings.theme || 'auto',
                autoSave: rawSettings.autoSave !== undefined ? rawSettings.autoSave : true,
                primaryLLMModel: rawSettings.primaryLLMModel !== undefined ? rawSettings.primaryLLMModel : null,
                currentSessionId: rawSettings.currentSessionId ?? null,
                rawProjectDetailContent: rawSettings.rawProjectDetailContent ?? rawSettings.projectDetailText ?? '',
                digestedProjectDetailContent: rawSettings.digestedProjectDetailContent ?? rawSettings.digestedMemory ?? '',
                createdAt: rawSettings.createdAt ? new Date(rawSettings.createdAt) : new Date(),
                updatedAt: rawSettings.updatedAt ? new Date(rawSettings.updatedAt) : new Date()
            };
            
            return this.createSuccessResponse(requestId, settings);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to load project settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private handleSaveProjectSettings(requestId?: string, settings?: ProjectSettings): ApiResponse<any> {
        try {
            if (!settings) {
                return this.createErrorResponse(requestId, 'Project settings data is required');
            }

            // Ensure theme, autoSave, and primaryLLMModel have default values if not provided
            const settingsWithDefaults: ProjectSettings = {
                ...settings,
                theme: settings.theme || 'auto',
                autoSave: settings.autoSave !== undefined ? settings.autoSave : true,
                primaryLLMModel: settings.primaryLLMModel !== undefined ? settings.primaryLLMModel : null,
                currentSessionId: settings.currentSessionId ?? null,
                rawProjectDetailContent: settings.rawProjectDetailContent ?? settings.projectDetailText ?? '',
                digestedProjectDetailContent: settings.digestedProjectDetailContent ?? settings.digestedMemory ?? ''
            };

            // Use writeSingleJsonFile since project settings is a single object, not a collection
            const now = new Date();
            const savedSettings: ProjectSettings = {
                ...settingsWithDefaults,
                updatedAt: now,
                createdAt: settings.createdAt || now
            };

            this.writeSingleJsonFile(this.getDataFilePath('projectSettings'), savedSettings);
            return this.createSuccessResponse(requestId, savedSettings);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to save project settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    // Spec operation handlers
    private handleLoadSpecs(requestId?: string): ApiResponse<any> {
        try {
            const specs = this.readJsonFile<Spec>(this.getDataFilePath('specs'));
            return this.createSuccessResponse(requestId, specs);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to load specs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private handleSaveSpec(requestId?: string, spec?: Spec): ApiResponse<any> {
        try {
            if (!spec) {
                return this.createErrorResponse(requestId, 'Spec data is required');
            }
            
            const savedSpec = this.upsertCollectionItem<Spec>(this.getDataFilePath('specs'), spec);
            return this.createSuccessResponse(requestId, savedSpec);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to save spec: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    private handleDeleteSpec(requestId?: string, payload?: any): ApiResponse<any> {
        try {
            if (!payload?.specId) {
                return this.createErrorResponse(requestId, 'Spec ID is required');
            }
            
            const deleted = this.deleteCollectionItem<Spec>(this.getDataFilePath('specs'), payload.specId);
            return this.createSuccessResponse(requestId, deleted);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to delete spec: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Memory operation handlers
    private handleLoadMemories(requestId?: string): ApiResponse<any> {
        try {
            const memories = this.readJsonFile<Memory>(this.getDataFilePath('memories'));
            return this.createSuccessResponse(requestId, memories);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to load memories: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    private handleSaveMemory(requestId?: string, memory?: Memory): ApiResponse<any> {
        try {
            if (!memory) {
                return this.createErrorResponse(requestId, 'Memory data is required');
            }
            
            const savedMemory = this.upsertCollectionItem<Memory>(this.getDataFilePath('memories'), memory);
            return this.createSuccessResponse(requestId, savedMemory);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to save memory: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    private handleDeleteMemory(requestId?: string, payload?: any): ApiResponse<any> {
        try {
            if (!payload?.memoryId) {
                return this.createErrorResponse(requestId, 'Memory ID is required');
            }
            
            const deleted = this.deleteCollectionItem<Memory>(this.getDataFilePath('memories'), payload.memoryId);
            return this.createSuccessResponse(requestId, deleted);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to delete memory: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    // Session operation handlers
    private handleCreateSessionCommand(requestId?: string, payload?: CreateSessionRequest): ApiResponse<any> {
        try {
            if (!payload) {
                return this.createErrorResponse(requestId, 'Session request is required');
            }

            const session = this.createSessionInternal(payload);
            return this.createSuccessResponse(requestId, session);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private handleLoadSessionCommand(requestId?: string, payload?: { sessionId: string }): ApiResponse<any> {
        try {
            if (!payload?.sessionId) {
                return this.createErrorResponse(requestId, 'Session ID is required');
            }

            const session = this.loadSessionInternal(payload.sessionId);
            return this.createSuccessResponse(requestId, session);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to load session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private handleUpdateSessionCommand(requestId?: string, payload?: { sessionId: string; updates: Partial<Session> }): ApiResponse<any> {
        try {
            if (!payload?.sessionId || !payload?.updates) {
                return this.createErrorResponse(requestId, 'Session ID and updates are required');
            }

            const updatedSession = this.updateSessionInternal(payload.sessionId, payload.updates);
            return this.createSuccessResponse(requestId, updatedSession);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to update session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private handleLoadChatMessagesForSessionCommand(requestId?: string, payload?: any): ApiResponse<any> {
        try {
            if (!payload?.sessionId) {
                return this.createErrorResponse(requestId, 'Session ID is required');
            }

            const messages = this.loadChatMessagesForSessionInternal(payload.sessionId);

            return this.createSuccessResponse(requestId, messages);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to load chat messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private handleSaveChatMessageCommand(requestId?: string, payload?: CreateChatMessageRequest): ApiResponse<any> {
        try {
            if (!payload) {
                return this.createErrorResponse(requestId, 'Message data is required');
            }

            const savedMessage = this.saveChatMessageInternal(payload);
            return this.createSuccessResponse(requestId, savedMessage);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to save chat message: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Gets the file path for a specific code context JSON file
     */
    private getCodeContextFilePath(projectId: string, codeContextId: string): string {
        const codeContextDir = path.join(this.dataDir, 'code_contexts');
        return path.join(codeContextDir, `${codeContextId}.json`);
    }

    /**
     * Saves a code context payload to a unique JSON file
     * @param payload The code context payload to save
     * @param projectId The project ID
     * @param sessionId The session ID
     * @returns The unique ID of the saved context
     */
    public async saveCodeContext(payload: ExtractCodeToolResultPayload, projectId: string, sessionId: string): Promise<string> {
        try {
            const uniqueId = randomUUID();
            const filePath = this.getCodeContextFilePath(projectId, uniqueId);
            const codeContextDir = path.dirname(filePath);
            
            // Ensure the directory structure exists
            if (!fs.existsSync(codeContextDir)) {
                fs.mkdirSync(codeContextDir, { recursive: true });
            }
            
            // Write the payload to the file
            this.writeSingleJsonFile(filePath, payload);
            return uniqueId;
        } catch (error) {
            console.error(`Error saving code context for project ${projectId}, session ${sessionId}:`, error);
            throw error;
        }
    }

    /**
     * Loads a specific code context payload from a JSON file
     * @param id The code context ID
     * @param projectId The project ID
     * @returns The code context payload or undefined if not found
     */
    public async loadCodeContext(id: string, projectId: string): Promise<ExtractCodeToolResultPayload | undefined> {
        try {
            const filePath = this.getCodeContextFilePath(projectId, id);
            return this.readSingleJsonFile<ExtractCodeToolResultPayload>(filePath) || undefined;
        } catch (error) {
            console.error(`Error loading code context ${id} for project ${projectId}:`, error);
            return undefined;
        }
    }

    /**
     * Loads all code context payloads for a session
     * @param sessionId The session ID
     * @param projectId The project ID
     * @returns Array of code context payloads
     */
    public async loadAllCodeContextForSession(sessionId: string, projectId: string): Promise<ExtractCodeToolResultPayload[]> {
        try {
            // First, get the session to access codeContextIds
            const session = this.loadSessionInternal(sessionId);
            if (!session) {
                console.warn(`Session ${sessionId} not found`);
                return [];
            }

            const results: ExtractCodeToolResultPayload[] = [];
            
            for (const codeContextId of session.codeContextIds || []) {
                try {
                    const payload = await this.loadCodeContext(codeContextId, projectId);
                    if (payload) {
                        results.push(payload);
                    }
                } catch (error) {
                    console.error(`Error loading code context ${codeContextId} for session ${sessionId}:`, error);
                    // Continue loading other contexts even if one fails
                }
            }
            
            return results;
        } catch (error) {
            console.error(`Error loading code contexts for session ${sessionId}:`, error);
            return [];
        }
    }
    
}