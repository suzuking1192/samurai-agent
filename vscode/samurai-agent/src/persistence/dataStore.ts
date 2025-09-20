/**
 * Centralized persistence module for Samurai Agent
 * Handles all data storage and retrieval operations
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Task } from '../common/models/task-models';
import { Memory } from '../common/models/memory-models';
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

interface ProjectSettings {
    id: string;
    projectName: string;
    projectPath: string;
    projectDetailText: string;
    digestedMemory: string;
    llmProvider: 'openai' | 'gemini' | 'claude';
    defaultModel: string;
    defaultMode: string;
    createdAt: Date;
    updatedAt: Date;
    metadata: Record<string, any>;
}

interface GlobalSettings {
    id: string;
    openaiApiKey: string;
    openaiModels: string[];
    geminiApiKey: string;
    geminiModels: string[];
    claudeApiKey: string;
    claudeModels: string[];
    theme: string;
    autoSave: boolean;
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
     * Reads JSON data from file
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
     * Writes JSON data to file
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
    
    // Task operation handlers
    private handleLoadTasks(requestId?: string): ApiResponse<Task[]> {
        const tasks = this.readJsonFile<Task>(this.getDataFilePath('tasks'));
        return this.createResponse(ResponseType.SUCCESS, requestId, tasks);
    }
    
    private handleSaveTask(requestId?: string, task?: Task): ApiResponse<any> {
        if (!task) {
            return this.createResponse(ResponseType.ERROR, requestId, undefined, 'Task data is required');
        }
        
        const tasks = this.readJsonFile<Task>(this.getDataFilePath('tasks'));
        const existingIndex = tasks.findIndex(t => t.id === task.id);
        
        const now = new Date();
        if (existingIndex >= 0) {
            task.updatedAt = now;
            tasks[existingIndex] = task;
        } else {
            task.createdAt = now;
            task.updatedAt = now;
            tasks.push(task);
        }
        
        this.writeJsonFile(this.getDataFilePath('tasks'), tasks);
        return this.createResponse(ResponseType.SUCCESS, requestId, task);
    }
    
    private handleDeleteTask(requestId?: string, payload?: any): ApiResponse<any> {
        if (!payload?.taskId) {
            return this.createResponse(ResponseType.ERROR, requestId, undefined, 'Task ID is required');
        }
        
        const tasks = this.readJsonFile<Task>(this.getDataFilePath('tasks'));
        const filteredTasks = tasks.filter(task => task.id !== payload.taskId);
        
        this.writeJsonFile(this.getDataFilePath('tasks'), filteredTasks);
        return this.createResponse(ResponseType.SUCCESS, requestId, true);
    }
    
    // Memory operation handlers
    private handleLoadMemories(requestId?: string): ApiResponse<Memory[]> {
        const memories = this.readJsonFile<Memory>(this.getDataFilePath('memories'));
        return this.createResponse(ResponseType.SUCCESS, requestId, memories);
    }
    
    private handleSaveMemory(requestId?: string, memory?: Memory): ApiResponse<any> {
        if (!memory) {
            return this.createResponse(ResponseType.ERROR, requestId, undefined, 'Memory data is required');
        }
        
        const memories = this.readJsonFile<Memory>(this.getDataFilePath('memories'));
        const existingIndex = memories.findIndex(m => m.id === memory.id);
        
        const now = new Date();
        if (existingIndex >= 0) {
            memory.updatedAt = now;
            memories[existingIndex] = memory;
        } else {
            memory.createdAt = now;
            memory.updatedAt = now;
            memories.push(memory);
        }
        
        this.writeJsonFile(this.getDataFilePath('memories'), memories);
        return this.createResponse(ResponseType.SUCCESS, requestId, memory);
    }
    
    private handleDeleteMemory(requestId?: string, payload?: any): ApiResponse<any> {
        if (!payload?.memoryId) {
            return this.createResponse(ResponseType.ERROR, requestId, undefined, 'Memory ID is required');
        }
        
        const memories = this.readJsonFile<Memory>(this.getDataFilePath('memories'));
        const filteredMemories = memories.filter(memory => memory.id !== payload.memoryId);
        
        this.writeJsonFile(this.getDataFilePath('memories'), filteredMemories);
        return this.createResponse(ResponseType.SUCCESS, requestId, true);
    }
    
    // Session operation handlers
    private handleLoadSessions(requestId?: string): ApiResponse<Session[]> {
        const sessions = this.readJsonFile<Session>(this.getDataFilePath('sessions'));
        return this.createResponse(ResponseType.SUCCESS, requestId, sessions);
    }
    
    private handleSaveSession(requestId?: string, session?: Session): ApiResponse<any> {
        if (!session) {
            return this.createResponse(ResponseType.ERROR, requestId, undefined, 'Session data is required');
        }
        
        const sessions = this.readJsonFile<Session>(this.getDataFilePath('sessions'));
        const existingIndex = sessions.findIndex(s => s.id === session.id);
        
        const now = new Date();
        if (existingIndex >= 0) {
            session.updatedAt = now;
            sessions[existingIndex] = session;
        } else {
            session.createdAt = now;
            session.updatedAt = now;
            sessions.push(session);
        }
        
        this.writeJsonFile(this.getDataFilePath('sessions'), sessions);
        return this.createResponse(ResponseType.SUCCESS, requestId, session);
    }
    
    private handleDeleteSession(requestId?: string, payload?: any): ApiResponse<any> {
        if (!payload?.sessionId) {
            return this.createResponse(ResponseType.ERROR, requestId, undefined, 'Session ID is required');
        }
        
        const sessions = this.readJsonFile<Session>(this.getDataFilePath('sessions'));
        const filteredSessions = sessions.filter(session => session.id !== payload.sessionId);
        
        this.writeJsonFile(this.getDataFilePath('sessions'), filteredSessions);
        return this.createResponse(ResponseType.SUCCESS, requestId, true);
    }
    
    // Chat message operation handlers
    private handleLoadChatMessagesForSession(requestId?: string, payload?: any): ApiResponse<any> {
        if (!payload?.sessionId) {
            return this.createResponse(ResponseType.ERROR, requestId, undefined, 'Session ID is required');
        }
        
        const messages = this.readJsonFile<ChatMessage>(this.getDataFilePath('chatMessages'));
        const sessionMessages = messages.filter(msg => msg.sessionId === payload.sessionId);
        
        return this.createResponse(ResponseType.SUCCESS, requestId, sessionMessages);
    }
    
    private handleSaveChatMessage(requestId?: string, message?: ChatMessage): ApiResponse<any> {
        if (!message) {
            return this.createResponse(ResponseType.ERROR, requestId, undefined, 'Message data is required');
        }
        
        const messages = this.readJsonFile<ChatMessage>(this.getDataFilePath('chatMessages'));
        const existingIndex = messages.findIndex(m => m.id === message.id);
        
        const now = new Date();
        if (existingIndex >= 0) {
            message.updatedAt = now;
            messages[existingIndex] = message;
        } else {
            message.createdAt = now;
            message.updatedAt = now;
            messages.push(message);
        }
        
        this.writeJsonFile(this.getDataFilePath('chatMessages'), messages);
        return this.createResponse(ResponseType.SUCCESS, requestId, message);
    }
    
    // Settings operation handlers
    private handleLoadProjectSettings(requestId?: string): ApiResponse<any> {
        const settings = this.readJsonFile<ProjectSettings>(this.getDataFilePath('projectSettings'));
        return this.createResponse(ResponseType.SUCCESS, requestId, settings[0] || null);
    }
    
    private handleSaveProjectSettings(requestId?: string, settings?: ProjectSettings): ApiResponse<any> {
        if (!settings) {
            return this.createResponse(ResponseType.ERROR, requestId, undefined, 'Project settings data is required');
        }
        
        const now = new Date();
        settings.updatedAt = now;
        if (!settings.createdAt) {
            settings.createdAt = now;
        }
        
        this.writeJsonFile(this.getDataFilePath('projectSettings'), [settings]);
        return this.createResponse(ResponseType.SUCCESS, requestId, settings);
    }
    
    private handleLoadGlobalSettings(requestId?: string): ApiResponse<any> {
        const settings = this.readJsonFile<GlobalSettings>(this.getDataFilePath('globalSettings'));
        return this.createResponse(ResponseType.SUCCESS, requestId, settings[0] || null);
    }
    
    private handleSaveGlobalSettings(requestId?: string, settings?: GlobalSettings): ApiResponse<any> {
        if (!settings) {
            return this.createResponse(ResponseType.ERROR, requestId, undefined, 'Global settings data is required');
        }
        
        const now = new Date();
        settings.updatedAt = now;
        if (!settings.createdAt) {
            settings.createdAt = now;
        }
        
        this.writeJsonFile(this.getDataFilePath('globalSettings'), [settings]);
        return this.createResponse(ResponseType.SUCCESS, requestId, settings);
    }
}