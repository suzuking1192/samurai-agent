/**
 * Unit tests for DataStore persistence module
 */

import * as path from 'path';
import * as fs from 'fs';
import { DataStore } from '../dataStore';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('DataStore', () => {
    let dataStore: DataStore;
    const mockWorkspaceRoot = '/mock/workspace';

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Mock fs.existsSync to return false initially
        mockFs.existsSync.mockReturnValue(false);
        
        // Mock fs.mkdirSync
        mockFs.mkdirSync.mockImplementation(() => '');
        
        // Mock fs.readFileSync
        mockFs.readFileSync.mockReturnValue('[]');
        
        // Mock fs.writeFileSync
        mockFs.writeFileSync.mockImplementation(() => {});
        
        dataStore = new DataStore(mockWorkspaceRoot);
    });

    describe('constructor', () => {
        it('should create data directory if it does not exist', () => {
            const expectedDataDir = path.join(mockWorkspaceRoot, '.vscode', 'samurai-agent');
            
            expect(mockFs.existsSync).toHaveBeenCalledWith(expectedDataDir);
            expect(mockFs.mkdirSync).toHaveBeenCalledWith(expectedDataDir, { recursive: true });
        });

        it('should not create data directory if it already exists', () => {
            mockFs.existsSync.mockReturnValue(true);
            
            new DataStore(mockWorkspaceRoot);
            
            expect(mockFs.mkdirSync).not.toHaveBeenCalled();
        });
    });

    describe('handleWebviewMessage', () => {
        it('should handle loadTasks command', () => {
            const message = {
                command: 'loadTasks',
                requestId: 'test-request-1',
                payload: null
            };

            const response = dataStore.handleWebviewMessage(message);

            expect(response.type).toBe('success');
            expect(response.requestId).toBe('test-request-1');
            expect(response.payload).toEqual([]);
        });

        it('should handle saveTask command', () => {
            const task = {
                id: 'task-1',
                title: 'Test Task',
                spec: 'Test specification',
                status: 'pending',
                priority: 'medium',
                isCompleted: false,
                depth: 1,
                parentTaskId: null,
                hasSubtasks: false,
                tags: [],
                dependencies: [],
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const message = {
                command: 'saveTask',
                requestId: 'test-request-2',
                payload: task
            };

            const response = dataStore.handleWebviewMessage(message);

            expect(response.type).toBe('success');
            expect(response.requestId).toBe('test-request-2');
            expect(response.payload).toEqual(expect.objectContaining({
                id: 'task-1',
                title: 'Test Task',
                spec: 'Test specification'
            }));
            expect(mockFs.writeFileSync).toHaveBeenCalled();
        });

        it('should handle unknown command', () => {
            const message = {
                command: 'unknownCommand',
                requestId: 'test-request-3',
                payload: null
            };

            const response = dataStore.handleWebviewMessage(message);

            expect(response.type).toBe('error');
            expect(response.requestId).toBe('test-request-3');
            expect(response.error).toContain('Unknown command');
        });

        it('should handle saveTask command with missing payload', () => {
            const message = {
                command: 'saveTask',
                requestId: 'test-request-4',
                payload: null
            };

            const response = dataStore.handleWebviewMessage(message);

            expect(response.type).toBe('error');
            expect(response.requestId).toBe('test-request-4');
            expect(response.error).toContain('Task data is required');
        });

        it('should handle loadGlobalSettings command', () => {
            const message = {
                command: 'loadGlobalSettings',
                requestId: 'test-request-5',
                payload: null
            };

            const response = dataStore.handleWebviewMessage(message);

            expect(response.type).toBe('success');
            expect(response.requestId).toBe('test-request-5');
            expect(response.payload).toBeNull();
        });

        it('should handle saveGlobalSettings command', () => {
            const settings = {
                id: 'global-settings-1',
                openaiApiKey: 'test-key',
                openaiModels: ['gpt-4'],
                geminiApiKey: '',
                geminiModels: [],
                claudeApiKey: '',
                claudeModels: [],
                theme: 'default',
                autoSave: true,
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const message = {
                command: 'saveGlobalSettings',
                requestId: 'test-request-6',
                payload: settings
            };

            const response = dataStore.handleWebviewMessage(message);

            expect(response.type).toBe('success');
            expect(response.requestId).toBe('test-request-6');
            expect(response.payload).toEqual(expect.objectContaining({
                id: 'global-settings-1',
                openaiApiKey: 'test-key',
                openaiModels: ['gpt-4']
            }));
            expect(mockFs.writeFileSync).toHaveBeenCalled();
        });

        it('should handle upsert operations correctly', () => {
            // Mock existing task data
            mockFs.readFileSync.mockReturnValue(JSON.stringify([
                {
                    id: 'task-1',
                    title: 'Original Task',
                    spec: 'Original spec',
                    status: 'pending',
                    priority: 'medium',
                    isCompleted: false,
                    depth: 1,
                    parentTaskId: null,
                    hasSubtasks: false,
                    tags: [],
                    dependencies: [],
                    metadata: {},
                    createdAt: new Date('2023-01-01'),
                    updatedAt: new Date('2023-01-01')
                }
            ]));

            const updatedTask = {
                id: 'task-1',
                title: 'Updated Task',
                spec: 'Updated spec',
                status: 'in_progress',
                priority: 'high',
                isCompleted: false,
                depth: 1,
                parentTaskId: null,
                hasSubtasks: false,
                tags: [],
                dependencies: [],
                metadata: {},
                createdAt: new Date('2023-01-01'),
                updatedAt: new Date()
            };

            const message = {
                command: 'saveTask',
                requestId: 'test-upsert-1',
                payload: updatedTask
            };

            const response = dataStore.handleWebviewMessage(message);

            expect(response.type).toBe('success');
            expect(response.payload).toEqual(expect.objectContaining({
                id: 'task-1',
                title: 'Updated Task',
                spec: 'Updated spec',
                status: 'in_progress',
                priority: 'high'
            }));
            
            // Verify that writeFileSync was called with updated data
            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('tasks.json'),
                expect.stringContaining('Updated Task')
            );
        });

        it('should handle delete operations correctly', () => {
            // Mock existing task data
            mockFs.readFileSync.mockReturnValue(JSON.stringify([
                {
                    id: 'task-1',
                    title: 'Task 1',
                    spec: 'Spec 1',
                    status: 'pending',
                    priority: 'medium',
                    isCompleted: false,
                    depth: 1,
                    parentTaskId: null,
                    hasSubtasks: false,
                    tags: [],
                    dependencies: [],
                    metadata: {},
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    id: 'task-2',
                    title: 'Task 2',
                    spec: 'Spec 2',
                    status: 'pending',
                    priority: 'medium',
                    isCompleted: false,
                    depth: 1,
                    parentTaskId: null,
                    hasSubtasks: false,
                    tags: [],
                    dependencies: [],
                    metadata: {},
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ]));

            const message = {
                command: 'deleteTask',
                requestId: 'test-delete-1',
                payload: { taskId: 'task-1' }
            };

            const response = dataStore.handleWebviewMessage(message);

            expect(response.type).toBe('success');
            expect(response.payload).toBe(true);
            
            // Verify that writeFileSync was called with filtered data
            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('tasks.json'),
                expect.not.stringContaining('task-1')
            );
        });

        it('should handle loadChatMessagesForSession correctly', () => {
            // Mock existing chat messages
            mockFs.readFileSync.mockReturnValue(JSON.stringify([
                {
                    id: 'msg-1',
                    sessionId: 'session-1',
                    role: 'user',
                    content: 'Hello',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    metadata: {}
                },
                {
                    id: 'msg-2',
                    sessionId: 'session-1',
                    role: 'assistant',
                    content: 'Hi there!',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    metadata: {}
                },
                {
                    id: 'msg-3',
                    sessionId: 'session-2',
                    role: 'user',
                    content: 'Different session',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    metadata: {}
                }
            ]));

            const message = {
                command: 'loadChatMessagesForSession',
                requestId: 'test-load-chat-1',
                payload: { sessionId: 'session-1' }
            };

            const response = dataStore.handleWebviewMessage(message);

            expect(response.type).toBe('success');
            expect(response.payload).toHaveLength(2);
            expect(response.payload).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ id: 'msg-1', sessionId: 'session-1' }),
                    expect.objectContaining({ id: 'msg-2', sessionId: 'session-1' })
                ])
            );
        });

        it('should handle GlobalSettings as single object', () => {
            const globalSettings = {
                id: 'global-settings-1',
                openaiApiKey: 'test-key',
                openaiModels: ['gpt-4'],
                geminiApiKey: '',
                geminiModels: [],
                claudeApiKey: '',
                claudeModels: [],
                theme: 'default',
                autoSave: true,
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Mock readFileSync to return single object (not array)
            mockFs.readFileSync.mockReturnValue(JSON.stringify(globalSettings));

            const message = {
                command: 'loadGlobalSettings',
                requestId: 'test-load-global-1',
                payload: null
            };

            const response = dataStore.handleWebviewMessage(message);

            expect(response.type).toBe('success');
            expect(response.payload).toEqual(globalSettings);
            
            // Verify that readFileSync was called with correct file path
            expect(mockFs.readFileSync).toHaveBeenCalledWith(
                expect.stringContaining('globalSettings.json')
            );
        });
    });

    describe('error handling', () => {
        it('should handle file read errors gracefully', () => {
            mockFs.readFileSync.mockImplementation(() => {
                throw new Error('File read error');
            });

            const message = {
                command: 'loadTasks',
                requestId: 'test-request-7',
                payload: null
            };

            const response = dataStore.handleWebviewMessage(message);

            expect(response.type).toBe('success');
            expect(response.payload).toEqual([]);
        });

        it('should handle file write errors', () => {
            mockFs.writeFileSync.mockImplementation(() => {
                throw new Error('File write error');
            });

            const task = {
                id: 'task-1',
                title: 'Test Task',
                spec: 'Test specification',
                status: 'pending',
                priority: 'medium',
                isCompleted: false,
                depth: 1,
                parentTaskId: null,
                hasSubtasks: false,
                tags: [],
                dependencies: [],
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const message = {
                command: 'saveTask',
                requestId: 'test-request-8',
                payload: task
            };

            const response = dataStore.handleWebviewMessage(message);

            expect(response.type).toBe('error');
            expect(response.error).toContain('File write error');
        });
    });
});
