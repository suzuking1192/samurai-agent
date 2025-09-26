/**
 * Centralized persistence module for Samurai Agent
 * Handles all data storage and retrieval operations
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Task } from '../common/models/task-models';
import { Memory } from '../common/models/memory-models';
import { ProjectSettings, GlobalSettings, IProjectSettings } from '../common/models/settings-models';
import { ApiResponse, ResponseType } from '../common/models/response-models';

// Temporary interfaces until they're moved to proper model files
interface ChatMessage {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    model?: string;
    mode?: string;
    tokens?: number;
    cost?: number;
    createdAt: Date;
    updatedAt: Date;
    metadata: Record<string, any>;
}

interface Session {
    id: string;
    title: string;
    description?: string;
    isActive: boolean;
    messageCount: number;
    lastMessageAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    metadata: Record<string, any>;
}

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
                // Task operations
                case 'loadTasks':
                    return this.handleLoadTasks(requestId);
                case 'saveTask':
                    return this.handleSaveTask(requestId, payload);
                case 'deleteTask':
                    return this.handleDeleteTask(requestId, payload);
                
                // Memory operations
                case 'loadMemories':
                    return this.handleLoadMemories(requestId);
                case 'saveMemory':
                    return this.handleSaveMemory(requestId, payload);
                case 'deleteMemory':
                    return this.handleDeleteMemory(requestId, payload);
                
                // Session operations
                case 'loadSessions':
                    return this.handleLoadSessions(requestId);
                case 'saveSession':
                    return this.handleSaveSession(requestId, payload);
                case 'deleteSession':
                    return this.handleDeleteSession(requestId, payload);
                
                // Chat message operations
                case 'loadChatMessagesForSession':
                    return this.handleLoadChatMessagesForSession(requestId, payload);
                case 'saveChatMessage':
                    return this.handleSaveChatMessage(requestId, payload);
                
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
                        autoTaskGeneration: true,
                        memoryRetentionDays: 30,
                        maxTokensPerRequest: 4000
                    },
                    theme: 'auto',
                    autoSave: true,
                    primaryLLMModel: null,
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
    
    // Task operation handlers
    private handleLoadTasks(requestId?: string): ApiResponse<any> {
        try {
            const tasks = this.readJsonFile<Task>(this.getDataFilePath('tasks'));
            return this.createSuccessResponse(requestId, tasks);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to load tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private handleSaveTask(requestId?: string, task?: Task): ApiResponse<any> {
        try {
            if (!task) {
                return this.createErrorResponse(requestId, 'Task data is required');
            }
            
            const savedTask = this.upsertCollectionItem<Task>(this.getDataFilePath('tasks'), task);
            return this.createSuccessResponse(requestId, savedTask);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to save task: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    private handleDeleteTask(requestId?: string, payload?: any): ApiResponse<any> {
        try {
            if (!payload?.taskId) {
                return this.createErrorResponse(requestId, 'Task ID is required');
            }
            
            const deleted = this.deleteCollectionItem<Task>(this.getDataFilePath('tasks'), payload.taskId);
            return this.createSuccessResponse(requestId, deleted);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    private handleLoadSessions(requestId?: string): ApiResponse<any> {
        try {
            const sessions = this.readJsonFile<Session>(this.getDataFilePath('sessions'));
            return this.createSuccessResponse(requestId, sessions);
            } catch (error) {
            return this.createErrorResponse(requestId, `Failed to load sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    private handleSaveSession(requestId?: string, session?: Session): ApiResponse<any> {
        try {
            if (!session) {
                return this.createErrorResponse(requestId, 'Session data is required');
            }
            
            const savedSession = this.upsertCollectionItem<Session>(this.getDataFilePath('sessions'), session);
            return this.createSuccessResponse(requestId, savedSession);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to save session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    private handleDeleteSession(requestId?: string, payload?: any): ApiResponse<any> {
        try {
            if (!payload?.sessionId) {
                return this.createErrorResponse(requestId, 'Session ID is required');
            }
            
            const deleted = this.deleteCollectionItem<Session>(this.getDataFilePath('sessions'), payload.sessionId);
            return this.createSuccessResponse(requestId, deleted);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to delete session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    // Chat message operation handlers
    private handleLoadChatMessagesForSession(requestId?: string, payload?: any): ApiResponse<any> {
        try {
            if (!payload?.sessionId) {
                return this.createErrorResponse(requestId, 'Session ID is required');
            }
            
            const messages = this.readJsonFile<ChatMessage>(this.getDataFilePath('chatMessages'));
            const sessionMessages = messages.filter(msg => msg.sessionId === payload.sessionId);
            
            return this.createSuccessResponse(requestId, sessionMessages);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to load chat messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    private handleSaveChatMessage(requestId?: string, message?: ChatMessage): ApiResponse<any> {
        try {
            if (!message) {
                return this.createErrorResponse(requestId, 'Message data is required');
            }
            
            const savedMessage = this.upsertCollectionItem<ChatMessage>(this.getDataFilePath('chatMessages'), message);
            return this.createSuccessResponse(requestId, savedMessage);
        } catch (error) {
            return this.createErrorResponse(requestId, `Failed to save chat message: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
}