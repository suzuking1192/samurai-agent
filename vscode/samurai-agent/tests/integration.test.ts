/**
 * Integration tests for the persistence system
 */

import * as vscode from 'vscode';
import { SamuraiAgentPanelWebviewViewProvider } from '../webview/SamuraiAgentPanelWebviewViewProvider';
import { DataStore } from '../persistence/dataStore';

describe('Persistence Integration Tests', () => {
    let mockExtensionUri: vscode.Uri;
    let mockWebviewView: vscode.WebviewView;
    let mockWebview: vscode.Webview;
    let provider: SamuraiAgentPanelWebviewViewProvider;
    let dataStore: DataStore;

    beforeEach(() => {
        // Mock VS Code objects
        mockExtensionUri = vscode.Uri.file('/mock/extension');
        mockWebview = {
            options: {} as vscode.WebviewOptions,
            html: '',
            onDidReceiveMessage: jest.fn(),
            postMessage: jest.fn()
        } as any;
        
        mockWebviewView = {
            webview: mockWebview
        } as any;

        provider = new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri);
        
        // Mock workspace
        const mockWorkspaceFolders = [{
            uri: vscode.Uri.file('/mock/workspace')
        }];
        
        jest.spyOn(vscode.workspace, 'workspaceFolders', 'get').mockReturnValue(mockWorkspaceFolders);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Webview Provider Integration', () => {
        it('should initialize with proper webview configuration', () => {
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            expect(mockWebview.options).toEqual({
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(mockExtensionUri, 'src', 'webview')
                ]
            });
        });

        it('should set up message listener', () => {
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
        });

        it('should generate HTML with all required scripts', () => {
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

            const html = mockWebview.html;
            expect(html).toContain('webviewApi.js');
            expect(html).toContain('agentPanel.js');
            expect(html).toContain('chat.js');
            expect(html).toContain('task.js');
            expect(html).toContain('settings.js');
        });
    });

    describe('Message Flow Integration', () => {
        beforeEach(() => {
            // Set up the provider
            provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
        });

        it('should handle task save message flow', async () => {
            const taskMessage = {
                command: 'saveTask',
                requestId: 'test-save-task',
                payload: {
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
                }
            };

            // Mock the message handler
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            
            // Mock file system operations
            const fs = require('fs');
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);
            jest.spyOn(fs, 'mkdirSync').mockImplementation(() => '');
            jest.spyOn(fs, 'readFileSync').mockReturnValue('[]');
            jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

            // Trigger the message handler
            messageHandler(taskMessage);

            // Verify response was sent back to webview
            expect(mockWebview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'success',
                    requestId: 'test-save-task'
                })
            );
        });

        it('should handle settings load message flow', async () => {
            const settingsMessage = {
                command: 'loadGlobalSettings',
                requestId: 'test-load-settings',
                payload: null
            };

            // Mock the message handler
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            
            // Mock file system operations
            const fs = require('fs');
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);
            jest.spyOn(fs, 'mkdirSync').mockImplementation(() => '');
            jest.spyOn(fs, 'readFileSync').mockReturnValue('[]');

            // Trigger the message handler
            messageHandler(settingsMessage);

            // Verify response was sent back to webview
            expect(mockWebview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'success',
                    requestId: 'test-load-settings'
                })
            );
        });

        it('should handle unknown command gracefully', async () => {
            const unknownMessage = {
                command: 'unknownCommand',
                requestId: 'test-unknown',
                payload: null
            };

            // Mock the message handler
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            
            // Mock file system operations
            const fs = require('fs');
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);
            jest.spyOn(fs, 'mkdirSync').mockImplementation(() => '');

            // Trigger the message handler
            messageHandler(unknownMessage);

            // Verify error response was sent back to webview
            expect(mockWebview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                    requestId: 'test-unknown',
                    error: expect.stringContaining('Unknown command')
                })
            );
        });
    });

    describe('DataStore Integration', () => {
        beforeEach(() => {
            // Mock file system operations
            const fs = require('fs');
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);
            jest.spyOn(fs, 'mkdirSync').mockImplementation(() => '');
            jest.spyOn(fs, 'readFileSync').mockReturnValue('[]');
            jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

            dataStore = new DataStore('/mock/workspace');
        });

        it('should handle complete task lifecycle', () => {
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

            // Save task
            const saveResponse = dataStore.handleWebviewMessage({
                command: 'saveTask',
                requestId: 'save-1',
                payload: task
            });

            expect(saveResponse.type).toBe('success');
            expect(saveResponse.payload).toEqual(expect.objectContaining({
                id: 'task-1',
                title: 'Test Task'
            }));

            // Load tasks
            const loadResponse = dataStore.handleWebviewMessage({
                command: 'loadTasks',
                requestId: 'load-1',
                payload: null
            });

            expect(loadResponse.type).toBe('success');
            expect(loadResponse.payload).toEqual(expect.arrayContaining([
                expect.objectContaining({ id: 'task-1' })
            ]));

            // Delete task
            const deleteResponse = dataStore.handleWebviewMessage({
                command: 'deleteTask',
                requestId: 'delete-1',
                payload: { taskId: 'task-1' }
            });

            expect(deleteResponse.type).toBe('success');
            expect(deleteResponse.payload).toBe(true);
        });

        it('should handle settings lifecycle', () => {
            const globalSettings = {
                id: 'global-1',
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

            // Save settings
            const saveResponse = dataStore.handleWebviewMessage({
                command: 'saveGlobalSettings',
                requestId: 'save-settings-1',
                payload: globalSettings
            });

            expect(saveResponse.type).toBe('success');
            expect(saveResponse.payload).toEqual(expect.objectContaining({
                openaiApiKey: 'test-key'
            }));

            // Load settings
            const loadResponse = dataStore.handleWebviewMessage({
                command: 'loadGlobalSettings',
                requestId: 'load-settings-1',
                payload: null
            });

            expect(loadResponse.type).toBe('success');
            expect(loadResponse.payload).toEqual(expect.objectContaining({
                openaiApiKey: 'test-key'
            }));
        });
    });
});
