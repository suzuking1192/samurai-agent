/**
 * DataStore Tests
 * 
 * Tests for the centralized persistence module that handles
 * all data storage and retrieval operations.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DataStore } from '../persistence/dataStore';
import { PersistenceCommand, ResponseType, Task, GlobalSettings } from '../common/models';

suite('DataStore', () => {
    test('should create DataStore instance', () => {
        const mockContext = {
            globalStorageUri: {
                fsPath: path.join(__dirname, '..', '..', 'test-data')
            }
        } as vscode.ExtensionContext;

        const dataStore = new DataStore(mockContext);
        assert.ok(dataStore, 'DataStore should be instantiable');
    });

    test('should save a new task', async () => {
        const mockContext = {
            globalStorageUri: {
                fsPath: path.join(__dirname, '..', '..', 'test-data')
            }
        } as vscode.ExtensionContext;

        const dataStore = new DataStore(mockContext);
        
        const task: Task = {
            id: 'test-task-1',
            title: 'Test Task',
            spec: 'Test specification',
            isCompleted: false,
            depth: 1,
            parentTaskId: null,
            hasSubtasks: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const message = {
            command: PersistenceCommand.SAVE_TASK,
            requestId: 'test-request-1',
            payload: task
        };

        const response = await dataStore.handleWebviewMessage(message);

        assert.strictEqual(response.type, ResponseType.SUCCESS);
        assert.strictEqual(response.requestId, 'test-request-1');
        assert.ok(response.payload);
        assert.strictEqual(response.payload.task.id, task.id);
    });

    test('should load tasks', async () => {
        const mockContext = {
            globalStorageUri: {
                fsPath: path.join(__dirname, '..', '..', 'test-data')
            }
        } as vscode.ExtensionContext;

        const dataStore = new DataStore(mockContext);
        
        // First save a task
        const task: Task = {
            id: 'test-task-1',
            title: 'Test Task',
            spec: 'Test specification',
            isCompleted: false,
            depth: 1,
            parentTaskId: null,
            hasSubtasks: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await dataStore.handleWebviewMessage({
            command: PersistenceCommand.SAVE_TASK,
            requestId: 'save-request',
            payload: task
        });

        // Then load tasks
        const loadMessage = {
            command: PersistenceCommand.LOAD_TASKS,
            requestId: 'load-request',
            payload: null
        };

        const response = await dataStore.handleWebviewMessage(loadMessage);

        assert.strictEqual(response.type, ResponseType.SUCCESS);
        assert.strictEqual(response.requestId, 'load-request');
        assert.ok(response.payload);
        assert.ok(Array.isArray(response.payload.tasks));
        assert.strictEqual(response.payload.tasks.length, 1);
        assert.strictEqual(response.payload.tasks[0].id, task.id);
    });

    test('should handle unknown commands', async () => {
        const mockContext = {
            globalStorageUri: {
                fsPath: path.join(__dirname, '..', '..', 'test-data')
            }
        } as vscode.ExtensionContext;

        const dataStore = new DataStore(mockContext);
        
        const message = {
            command: 'unknown-command',
            requestId: 'test-request',
            payload: null
        };

        const response = await dataStore.handleWebviewMessage(message);

        assert.strictEqual(response.type, ResponseType.ERROR);
        assert.strictEqual(response.requestId, 'test-request');
        assert.ok(response.payload.message.includes('Unknown command'));
    });

    test('should save and load global settings', async () => {
        const mockContext = {
            globalStorageUri: {
                fsPath: path.join(__dirname, '..', '..', 'test-data')
            }
        } as vscode.ExtensionContext;

        const dataStore = new DataStore(mockContext);
        
        const globalSettings: GlobalSettings = {
            id: 'global-settings',
            openaiApiKey: 'test-key',
            openaiModels: ['gpt-4'],
            geminiApiKey: '',
            geminiModels: [],
            claudeApiKey: '',
            claudeModels: [],
            defaultProvider: 'openai',
            theme: 'auto',
            autoSave: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Save settings
        const saveMessage = {
            command: PersistenceCommand.SAVE_GLOBAL_SETTINGS,
            requestId: 'save-request',
            payload: globalSettings
        };

        const saveResponse = await dataStore.handleWebviewMessage(saveMessage);
        assert.strictEqual(saveResponse.type, ResponseType.SUCCESS);

        // Load settings
        const loadMessage = {
            command: PersistenceCommand.LOAD_GLOBAL_SETTINGS,
            requestId: 'load-request',
            payload: null
        };

        const loadResponse = await dataStore.handleWebviewMessage(loadMessage);
        assert.strictEqual(loadResponse.type, ResponseType.SUCCESS);
        assert.ok(Array.isArray(loadResponse.payload.globalSettings));
        assert.strictEqual(loadResponse.payload.globalSettings.length, 1);
        assert.strictEqual(loadResponse.payload.globalSettings[0].openaiApiKey, 'test-key');
    });
});