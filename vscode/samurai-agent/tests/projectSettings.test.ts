/**
 * Tests for ProjectSettings functionality in DataStore
 * Validates the project-specific settings persistence with theme and autoSave
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataStore } from '../src/persistence/dataStore';

describe('DataStore - ProjectSettings', () => {
    let dataStore: DataStore;
    let testWorkspaceRoot: string;

    beforeEach(() => {
        // Create a temporary test workspace
        testWorkspaceRoot = path.join(os.tmpdir(), 'samurai-agent-test-project', Date.now().toString());
        fs.mkdirSync(testWorkspaceRoot, { recursive: true });
        
        dataStore = new DataStore(testWorkspaceRoot);
    });

    afterEach(() => {
        // Clean up test workspace
        if (fs.existsSync(testWorkspaceRoot)) {
            fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
        }
    });

    describe('loadProjectSettings', () => {
        it('should return default settings with theme and autoSave when file does not exist', async () => {
            const response = dataStore.handleWebviewMessage({
                command: 'loadProjectSettings',
                requestId: 'test-request-1'
            });
            
            assert.strictEqual(response.type, 'success');
            assert.strictEqual(response.requestId, 'test-request-1');
            assert(response.payload);
            
            const settings = response.payload;
            assert.strictEqual(settings.id, 'project-settings');
            assert.strictEqual(settings.projectName, 'Untitled Project');
            assert.strictEqual(settings.theme, 'auto');
            assert.strictEqual(settings.autoSave, true);
        });

        it('should load existing project settings with theme and autoSave', async () => {
            // Create a test project settings file
            const testSettings = {
                id: 'project-settings',
                projectName: 'Test Project',
                projectPath: testWorkspaceRoot,
                projectDetailText: 'This is a test project',
                digestedMemory: 'Test memory content',
                llmProvider: 'claude',
                defaultModel: 'claude-3-opus',
                defaultMode: 'developer',
                theme: 'dark',
                autoSave: false,
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                metadata: { test: 'value' }
            };

            const settingsFile = path.join(testWorkspaceRoot, '.vscode', 'samurai-agent', 'projectSettings.json');
            fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
            fs.writeFileSync(settingsFile, JSON.stringify(testSettings, null, 2));

            const response = dataStore.handleWebviewMessage({
                command: 'loadProjectSettings',
                requestId: 'test-request-2'
            });
            
            assert.strictEqual(response.type, 'success');
            assert(response.payload);
            
            const loadedSettings = response.payload;
            assert.strictEqual(loadedSettings.projectName, 'Test Project');
            assert.strictEqual(loadedSettings.projectDetailText, 'This is a test project');
            assert.strictEqual(loadedSettings.theme, 'dark');
            assert.strictEqual(loadedSettings.autoSave, false);
            assert.strictEqual(loadedSettings.llmProvider, 'claude');
        });

        it('should apply default values for missing theme and autoSave', async () => {
            // Create a test project settings file without theme and autoSave
            const testSettings = {
                id: 'project-settings',
                projectName: 'Test Project',
                projectPath: testWorkspaceRoot,
                projectDetailText: 'This is a test project',
                digestedMemory: 'Test memory content',
                llmProvider: 'openai',
                defaultModel: 'gpt-4',
                defaultMode: 'default',
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                metadata: {}
            };

            const settingsFile = path.join(testWorkspaceRoot, '.vscode', 'samurai-agent', 'projectSettings.json');
            fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
            fs.writeFileSync(settingsFile, JSON.stringify(testSettings, null, 2));

            const response = dataStore.handleWebviewMessage({
                command: 'loadProjectSettings',
                requestId: 'test-request-3'
            });
            
            assert.strictEqual(response.type, 'success');
            assert(response.payload);
            
            const loadedSettings = response.payload;
            assert.strictEqual(loadedSettings.theme, 'auto'); // Default value applied
            assert.strictEqual(loadedSettings.autoSave, true); // Default value applied
            assert.strictEqual(loadedSettings.projectName, 'Test Project');
        });

        it('should handle corrupted JSON files gracefully', async () => {
            const settingsFile = path.join(testWorkspaceRoot, '.vscode', 'samurai-agent', 'projectSettings.json');
            fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
            fs.writeFileSync(settingsFile, 'invalid json content');

            const response = dataStore.handleWebviewMessage({
                command: 'loadProjectSettings',
                requestId: 'test-request-4'
            });
            
            assert.strictEqual(response.type, 'error');
            assert(response.error);
            assert(response.error.includes('Failed to load project settings'));
        });
    });

    describe('saveProjectSettings', () => {
        it('should save project settings with theme and autoSave', async () => {
            const testSettings = {
                id: 'project-settings',
                projectName: 'Save Test Project',
                projectPath: testWorkspaceRoot,
                projectDetailText: 'This is a save test project',
                digestedMemory: 'Save test memory content',
                llmProvider: 'gemini',
                defaultModel: 'gemini-pro',
                defaultMode: 'creative',
                theme: 'light',
                autoSave: true,
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
                metadata: { saveTest: 'value' }
            };

            const response = dataStore.handleWebviewMessage({
                command: 'saveProjectSettings',
                requestId: 'test-request-5',
                payload: testSettings
            });
            
            assert.strictEqual(response.type, 'success');
            assert.strictEqual(response.requestId, 'test-request-5');
            assert(response.payload);
            
            // Verify file was created and contains correct data
            const settingsFile = path.join(testWorkspaceRoot, '.vscode', 'samurai-agent', 'projectSettings.json');
            assert(fs.existsSync(settingsFile), 'Project settings file should exist');
            
            const savedData = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            assert.strictEqual(savedData.projectName, 'Save Test Project');
            assert.strictEqual(savedData.theme, 'light');
            assert.strictEqual(savedData.autoSave, true);
            assert.strictEqual(savedData.llmProvider, 'gemini');
            assert.strictEqual(savedData.metadata.saveTest, 'value');
        });

        it('should apply default values for missing theme and autoSave when saving', async () => {
            const testSettings = {
                id: 'project-settings',
                projectName: 'Default Test Project',
                projectPath: testWorkspaceRoot,
                projectDetailText: 'This project has no theme/autoSave',
                digestedMemory: 'Default test memory',
                llmProvider: 'openai',
                defaultModel: 'gpt-4',
                defaultMode: 'default',
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
                metadata: {}
            };

            const response = dataStore.handleWebviewMessage({
                command: 'saveProjectSettings',
                requestId: 'test-request-6',
                payload: testSettings
            });
            
            assert.strictEqual(response.type, 'success');
            assert(response.payload);
            
            // Verify default values were applied
            const savedSettings = response.payload;
            assert.strictEqual(savedSettings.theme, 'auto'); // Default applied
            assert.strictEqual(savedSettings.autoSave, true); // Default applied
            
            // Verify file contains default values
            const settingsFile = path.join(testWorkspaceRoot, '.vscode', 'samurai-agent', 'projectSettings.json');
            const savedData = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            assert.strictEqual(savedData.theme, 'auto');
            assert.strictEqual(savedData.autoSave, true);
        });

        it('should update timestamps when saving', async () => {
            const testSettings = {
                id: 'project-settings',
                projectName: 'Timestamp Test Project',
                projectPath: testWorkspaceRoot,
                projectDetailText: 'Testing timestamps',
                digestedMemory: 'Timestamp test memory',
                llmProvider: 'openai',
                defaultModel: 'gpt-4',
                defaultMode: 'default',
                theme: 'dark',
                autoSave: false,
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
                metadata: {}
            };

            const beforeSave = new Date();
            const response = dataStore.handleWebviewMessage({
                command: 'saveProjectSettings',
                requestId: 'test-request-7',
                payload: testSettings
            });
            const afterSave = new Date();
            
            assert.strictEqual(response.type, 'success');
            const savedSettings = response.payload;
            
            const savedCreatedAt = new Date(savedSettings.createdAt);
            const savedUpdatedAt = new Date(savedSettings.updatedAt);
            
            assert(savedCreatedAt >= beforeSave && savedCreatedAt <= afterSave);
            assert(savedUpdatedAt >= beforeSave && savedUpdatedAt <= afterSave);
        });

        it('should return error when saving null/undefined settings', async () => {
            const response = dataStore.handleWebviewMessage({
                command: 'saveProjectSettings',
                requestId: 'test-request-8',
                payload: null
            });
            
            assert.strictEqual(response.type, 'error');
            assert.strictEqual(response.requestId, 'test-request-8');
            assert(response.error);
            assert(response.error.includes('Project settings data is required'));
        });
    });

    describe('End-to-End Project Settings Flow', () => {
        it('should save and load project settings with theme and autoSave correctly', async () => {
            // Step 1: Save project settings with theme and autoSave
            const projectSettings = {
                id: 'project-settings',
                projectName: 'E2E Test Project',
                projectPath: testWorkspaceRoot,
                projectDetailText: 'This is an end-to-end test project',
                digestedMemory: 'E2E test memory content',
                llmProvider: 'claude',
                defaultModel: 'claude-3-sonnet',
                defaultMode: 'analytical',
                theme: 'dark',
                autoSave: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                metadata: { e2eTest: 'value' }
            };

            const saveResponse = dataStore.handleWebviewMessage({
                command: 'saveProjectSettings',
                requestId: 'e2e-save',
                payload: projectSettings
            });
            assert.strictEqual(saveResponse.type, 'success');

            // Step 2: Load project settings and verify they match
            const loadResponse = dataStore.handleWebviewMessage({
                command: 'loadProjectSettings',
                requestId: 'e2e-load'
            });
            assert.strictEqual(loadResponse.type, 'success');
            assert(loadResponse.payload);

            const loadedSettings = loadResponse.payload;
            assert.strictEqual(loadedSettings.projectName, 'E2E Test Project');
            assert.strictEqual(loadedSettings.projectDetailText, 'This is an end-to-end test project');
            assert.strictEqual(loadedSettings.theme, 'dark');
            assert.strictEqual(loadedSettings.autoSave, false);
            assert.strictEqual(loadedSettings.llmProvider, 'claude');
            assert.strictEqual(loadedSettings.defaultModel, 'claude-3-sonnet');
            assert.strictEqual(loadedSettings.metadata.e2eTest, 'value');

            // Step 3: Verify file location is workspace-specific
            const settingsFile = path.join(testWorkspaceRoot, '.vscode', 'samurai-agent', 'projectSettings.json');
            assert(fs.existsSync(settingsFile), 'Project settings file should exist in workspace');
        });

        it('should persist theme and autoSave changes across multiple save/load cycles', async () => {
            // Initial settings
            const initialSettings = {
                id: 'project-settings',
                projectName: 'Theme Test Project',
                projectPath: testWorkspaceRoot,
                projectDetailText: 'Testing theme persistence',
                digestedMemory: 'Theme test memory',
                llmProvider: 'openai',
                defaultModel: 'gpt-4',
                defaultMode: 'default',
                theme: 'light',
                autoSave: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                metadata: {}
            };

            // Save initial settings
            dataStore.handleWebviewMessage({
                command: 'saveProjectSettings',
                requestId: 'initial-save',
                payload: initialSettings
            });

            // Load and modify theme and autoSave
            const loadResponse = dataStore.handleWebviewMessage({
                command: 'loadProjectSettings',
                requestId: 'load-modify'
            });
            assert.strictEqual(loadResponse.type, 'success');
            const loadedSettings = loadResponse.payload;
            
            // Update theme and autoSave
            loadedSettings.theme = 'dark';
            loadedSettings.autoSave = false;

            // Save updated settings
            const updateResponse = dataStore.handleWebviewMessage({
                command: 'saveProjectSettings',
                requestId: 'update-save',
                payload: loadedSettings
            });
            assert.strictEqual(updateResponse.type, 'success');

            // Verify persistence
            const finalLoadResponse = dataStore.handleWebviewMessage({
                command: 'loadProjectSettings',
                requestId: 'final-load'
            });
            assert.strictEqual(finalLoadResponse.type, 'success');
            const finalSettings = finalLoadResponse.payload;
            
            assert.strictEqual(finalSettings.theme, 'dark');
            assert.strictEqual(finalSettings.autoSave, false);
            assert.strictEqual(finalSettings.projectName, 'Theme Test Project');
        });
    });
});
