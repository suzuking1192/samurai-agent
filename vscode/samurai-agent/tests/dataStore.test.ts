/**
 * Unit tests for DataStore persistence module
 */

import * as path from 'path';
import * as fs from 'fs';
import { DataStore } from '../src/persistence/dataStore';
import { ExtractCodeToolResultPayload } from '../src/common/models/tool-models';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('DataStore', () => {
    let dataStore: DataStore;
    const mockWorkspaceRoot = '/mock/workspace';

    beforeEach(() => {
        jest.clearAllMocks();

        mockFs.existsSync.mockReturnValue(false);
        mockFs.mkdirSync.mockImplementation(() => undefined);
        mockFs.readFileSync.mockReturnValue('[]');
        mockFs.writeFileSync.mockImplementation(() => undefined);
        
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
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(globalSettings));

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

        it('should handle saveProjectSettings command', () => {
            const projectSettings = {
                id: 'project-settings',
                projectId: 'project-123',
                projectName: 'Sample Project',
                rawProjectDetailContent: 'Initial detail',
                digestedProjectDetailContent: 'Initial digested detail',
                defaultModel: 'gpt-4',
                defaultMode: 'default',
                customPrompts: {},
                projectSpecificConfig: {},
                theme: 'auto',
                autoSave: true,
                primaryLLMModel: null,
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const response = dataStore.handleWebviewMessage({
                command: 'saveProjectSettings',
                requestId: 'save-project-settings',
                payload: projectSettings
            });

            expect(response.type).toBe('success');
            expect(response.requestId).toBe('save-project-settings');
            expect(response.payload).toEqual(expect.objectContaining({
                id: 'project-settings',
                projectId: 'project-123',
                projectName: 'Sample Project',
                rawProjectDetailContent: 'Initial detail',
                digestedProjectDetailContent: 'Initial digested detail'
            }));
            expect(mockFs.writeFileSync).toHaveBeenCalled();
        });

        it('should handle createSession command', () => {
            const message = {
                command: 'createSession',
                requestId: 'test-session-create',
                payload: {
                    title: 'Test Session',
                    projectId: 'project-1'
                }
            };

            mockFs.readFileSync.mockImplementation((filePath: any) => {
                if (typeof filePath === 'string' && filePath.includes('sessions.json')) {
                    return '[]';
                }
                return '[]';
            });

            const response = dataStore.handleWebviewMessage(message);

            expect(response.type).toBe('success');
            expect(response.payload).toEqual(expect.objectContaining({
                title: 'Test Session',
                metadata: expect.objectContaining({ projectId: 'project-1' }),
                messageCount: 0
            }));
            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('sessions.json'),
                expect.stringContaining('Test Session')
            );
        });

        it('should handle loadSession command', () => {
            const sessionId = 'session-123';
            mockFs.readFileSync.mockImplementation((filePath: any) => {
                if (typeof filePath === 'string' && filePath.includes('sessions.json')) {
                    return JSON.stringify([{
                        id: sessionId,
                        title: 'Existing Session',
                        status: 'active',
                        messageCount: 2,
                        totalTokens: 0,
                        totalCost: 0,
                        lastMessageAt: new Date().toISOString(),
                        tags: [],
                        metadata: { projectId: 'project-1' },
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }]);
                }
                return '[]';
            });

            const response = dataStore.handleWebviewMessage({
                command: 'loadSession',
                requestId: 'test-session-load',
                payload: { sessionId }
            });

            expect(response.type).toBe('success');
            expect(response.payload).toEqual(expect.objectContaining({
                id: sessionId,
                title: 'Existing Session'
            }));
        });

        it('should handle updateSession command', () => {
            const sessionId = 'session-456';
            const existingSession = {
                id: sessionId,
                title: 'Original Title',
                status: 'active',
                messageCount: 0,
                totalTokens: 0,
                totalCost: 0,
                lastMessageAt: new Date().toISOString(),
                tags: [],
                metadata: { projectId: 'project-1' },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            mockFs.readFileSync.mockImplementation((filePath: any) => {
                if (typeof filePath === 'string' && filePath.includes('sessions.json')) {
                    return JSON.stringify([existingSession]);
                }
                return '[]';
            });

            const response = dataStore.handleWebviewMessage({
                command: 'updateSession',
                requestId: 'test-session-update',
                payload: { sessionId, updates: { title: 'Updated Title', messageCount: 5 } }
            });

            expect(response.type).toBe('success');
            expect(response.payload).toEqual(expect.objectContaining({
                id: sessionId,
                title: 'Updated Title',
                messageCount: 5
            }));
            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('sessions.json'),
                expect.stringContaining('Updated Title')
            );
        });

        it('should handle saveChatMessage command and update session aggregates', () => {
            const sessionId = 'session-789';
            const existingSession = {
                id: sessionId,
                title: 'Chat Session',
                status: 'active',
                messageCount: 0,
                totalTokens: 0,
                totalCost: 0,
                lastMessageAt: new Date().toISOString(),
                tags: [],
                metadata: { projectId: 'project-1' },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            mockFs.readFileSync.mockImplementation((filePath: any) => {
                if (typeof filePath === 'string' && filePath.includes('sessions.json')) {
                    return JSON.stringify([existingSession]);
                }
                if (typeof filePath === 'string' && filePath.includes('chatMessages.json')) {
                    return '[]';
                }
                return '[]';
            });

            const response = dataStore.handleWebviewMessage({
                command: 'saveChatMessage',
                requestId: 'test-chat-save',
                payload: {
                    sessionId,
                    projectId: 'project-1',
                    type: 'user',
                    content: 'Hello agent',
                    role: 'user',
                    metadata: { tokens: 10, cost: 0.02 }
                }
            });

            expect(response.type).toBe('success');
            expect(response.payload).toEqual(expect.objectContaining({
                sessionId,
                content: 'Hello agent',
                role: 'user'
            }));
            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('chatMessages.json'),
                expect.stringContaining('Hello agent')
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

    describe('code context persistence', () => {
        const mockSessionId = 'test-session-id';
        const mockCodeContextId = 'test-code-context-id';
        const mockPayload: ExtractCodeToolResultPayload = {
            relevantCodeElements: [
                {
                    path: '/test/file.ts',
                    elements: [
                        {
                            name: 'testFunction',
                            type: 'function',
                            lineStart: 10,
                            lineEnd: 20,
                            filePath: '/test/file.ts',
                            signature: 'function testFunction(): void'
                        }
                    ],
                    snippet: 'function testFunction(): void {\n  // test implementation\n}'
                }
            ]
        };

        describe('saveCodeContext', () => {
            it('should save code context payload to file', async () => {
                const expectedDir = path.join(mockWorkspaceRoot, '.vscode', 'samurai-agent', 'sessions', mockSessionId, 'code_contexts');
                const expectedFilePath = path.join(expectedDir, `${mockCodeContextId}.json`);

                await dataStore.saveCodeContext(mockSessionId, mockCodeContextId, mockPayload);

                expect(mockFs.existsSync).toHaveBeenCalledWith(expectedDir);
                expect(mockFs.mkdirSync).toHaveBeenCalledWith(expectedDir, { recursive: true });
                expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                    expectedFilePath,
                    JSON.stringify(mockPayload, null, 2)
                );
            });

            it('should handle directory creation errors', async () => {
                mockFs.mkdirSync.mockImplementation(() => {
                    throw new Error('Directory creation failed');
                });

                await expect(
                    dataStore.saveCodeContext(mockSessionId, mockCodeContextId, mockPayload)
                ).rejects.toThrow('Directory creation failed');
            });
        });

        describe('loadCodeContext', () => {
            it('should load code context payload from file', async () => {
                const expectedFilePath = path.join(
                    mockWorkspaceRoot, 
                    '.vscode', 
                    'samurai-agent', 
                    'sessions', 
                    mockSessionId, 
                    'code_contexts', 
                    `${mockCodeContextId}.json`
                );

                mockFs.existsSync.mockReturnValue(true);
                mockFs.readFileSync.mockReturnValue(JSON.stringify(mockPayload));

                const result = await dataStore.loadCodeContext(mockSessionId, mockCodeContextId);

                expect(mockFs.existsSync).toHaveBeenCalledWith(expectedFilePath);
                expect(mockFs.readFileSync).toHaveBeenCalledWith(expectedFilePath, 'utf8');
                expect(result).toEqual(mockPayload);
            });

            it('should return undefined for non-existent file', async () => {
                mockFs.existsSync.mockReturnValue(false);

                const result = await dataStore.loadCodeContext(mockSessionId, mockCodeContextId);

                expect(result).toBeUndefined();
            });

            it('should return undefined for invalid JSON', async () => {
                mockFs.existsSync.mockReturnValue(true);
                mockFs.readFileSync.mockReturnValue('invalid json');

                const result = await dataStore.loadCodeContext(mockSessionId, mockCodeContextId);

                expect(result).toBeUndefined();
            });
        });

        describe('loadAllCodeContextForSession', () => {
            it('should load all code contexts for a session', async () => {
                const codeContextIds = ['context-1', 'context-2', 'context-3'];
                const payload1 = { ...mockPayload, context: 'Context 1' };
                const payload2 = { ...mockPayload, context: 'Context 2' };
                const payload3 = { ...mockPayload, context: 'Context 3' };

                // Mock successful loads for all contexts
                mockFs.existsSync.mockReturnValue(true);
                mockFs.readFileSync
                    .mockReturnValueOnce(JSON.stringify(payload1))
                    .mockReturnValueOnce(JSON.stringify(payload2))
                    .mockReturnValueOnce(JSON.stringify(payload3));

                const results = await dataStore.loadAllCodeContextForSession(mockSessionId, codeContextIds);

                expect(results).toHaveLength(3);
                expect(results).toContainEqual(payload1);
                expect(results).toContainEqual(payload2);
                expect(results).toContainEqual(payload3);
            });

            it('should handle partial failures gracefully', async () => {
                const codeContextIds = ['context-1', 'context-2', 'context-3'];
                const payload1 = { ...mockPayload, context: 'Context 1' };
                const payload3 = { ...mockPayload, context: 'Context 3' };

                // Mock successful load for context-1, failure for context-2, success for context-3
                mockFs.existsSync
                    .mockReturnValueOnce(true)  // context-1 exists
                    .mockReturnValueOnce(false) // context-2 doesn't exist
                    .mockReturnValueOnce(true); // context-3 exists

                mockFs.readFileSync
                    .mockReturnValueOnce(JSON.stringify(payload1))
                    .mockReturnValueOnce(JSON.stringify(payload3));

                const results = await dataStore.loadAllCodeContextForSession(mockSessionId, codeContextIds);

                expect(results).toHaveLength(2);
                expect(results).toContainEqual(payload1);
                expect(results).toContainEqual(payload3);
            });

            it('should return empty array for empty codeContextIds', async () => {
                const results = await dataStore.loadAllCodeContextForSession(mockSessionId, []);

                expect(results).toEqual([]);
            });
        });
    });
});
