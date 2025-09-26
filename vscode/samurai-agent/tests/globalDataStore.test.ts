/**
 * Tests for GlobalDataStore
 * Validates the global settings persistence functionality
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GlobalDataStore } from '../src/persistence/globalDataStore';
import { GlobalSettings } from '../src/common/models/settings-models';

describe('GlobalDataStore', () => {
    let globalDataStore: GlobalDataStore;
    let testConfigDir: string;
    let originalConfigDir: string;

    beforeEach(() => {
        // Create a temporary test directory
        testConfigDir = path.join(os.tmpdir(), 'samurai-agent-test-global', Date.now().toString());
        fs.mkdirSync(testConfigDir, { recursive: true });
        
        // Mock the constructor to use our test directory
        originalConfigDir = process.env.HOME || os.homedir();
        process.env.HOME = testConfigDir;
        
        globalDataStore = new GlobalDataStore();
    });

    afterEach(() => {
        // Clean up test directory
        if (fs.existsSync(testConfigDir)) {
            fs.rmSync(testConfigDir, { recursive: true, force: true });
        }
        
        // Restore original HOME
        process.env.HOME = originalConfigDir;
    });

    describe('Constructor and Configuration', () => {
        it('should create config directory on instantiation', () => {
            const configDir = globalDataStore.getGlobalConfigDir();
            assert(fs.existsSync(configDir), 'Config directory should exist');
        });

        it('should use correct config directory path for different platforms', () => {
            const configDir = globalDataStore.getGlobalConfigDir();
            const expectedDir = path.join(testConfigDir, '.config', 'samurai-agent');
            assert.strictEqual(configDir, expectedDir);
        });
    });

    describe('loadGlobalSettings', () => {
        it('should return default settings when file does not exist', async () => {
            const response = globalDataStore.loadGlobalSettings('test-request-1');
            
            assert.strictEqual(response.type, 'success');
            assert.strictEqual(response.requestId, 'test-request-1');
            assert(response.payload);
            
            const settings = response.payload as GlobalSettings;
            assert.strictEqual(settings.id, 'global-settings');
            assert.strictEqual(settings.userId, 'default-user');
            assert.strictEqual(settings.openaiApiKey, '');
            assert(!('theme' in settings));
            assert(!('autoSave' in settings));
        });

        it('should load existing settings from file', async () => {
            // Create a test settings file
            const testSettings: GlobalSettings = {
                id: 'global-settings',
                userId: 'test-user',
                openaiApiKey: 'sk-test-key',
                geminiApiKey: '',
                claudeApiKey: '',
                defaultProvider: 'openai' as any,
                defaultModel: 'gpt-4',
                defaultMode: 'default' as any,
                fontSize: 16,
                showTokenCounts: false,
                showCostEstimates: true,
                autoSaveInterval: 60,
                maxHistoryItems: 200,
                enableNotifications: false,
                customApiEndpoints: {},
                metadata: { test: 'value' },
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02')
            };

            const settingsFile = globalDataStore.getGlobalSettingsPath();
            fs.writeFileSync(settingsFile, JSON.stringify(testSettings, null, 2));

            const response = globalDataStore.loadGlobalSettings('test-request-2');
            
            assert.strictEqual(response.type, 'success');
            assert(response.payload);
            
            const loadedSettings = response.payload as GlobalSettings;
            assert.strictEqual(loadedSettings.openaiApiKey, 'sk-test-key');
            assert.strictEqual(loadedSettings.fontSize, 16);
            assert.strictEqual(loadedSettings.maxHistoryItems, 200);
            assert.strictEqual(loadedSettings.metadata.test, 'value');
            assert(!('theme' in loadedSettings));
            assert(!('autoSave' in loadedSettings));
        });

        it('should ignore theme and autoSave fields from old format files', async () => {
            // Create a test settings file with old format (including theme and autoSave)
            const oldFormatSettings = {
                id: 'global-settings',
                userId: 'test-user',
                openaiApiKey: 'sk-test-key',
                geminiApiKey: '',
                claudeApiKey: '',
                theme: 'dark',
                autoSave: false,
                fontSize: 14,
                showTokenCounts: true,
                showCostEstimates: false,
                autoSaveInterval: 30,
                maxHistoryItems: 100,
                enableNotifications: true,
                customApiEndpoints: {},
                metadata: {},
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02')
            };

            const settingsFile = globalDataStore.getGlobalSettingsPath();
            fs.writeFileSync(settingsFile, JSON.stringify(oldFormatSettings, null, 2));

            const response = globalDataStore.loadGlobalSettings('test-request-3');
            
            assert.strictEqual(response.type, 'success');
            assert(response.payload);
            
            const loadedSettings = response.payload as GlobalSettings;
            // Verify old fields are not present
            assert(!('theme' in loadedSettings));
            assert(!('autoSave' in loadedSettings));
            // Verify other fields are preserved
            assert.strictEqual(loadedSettings.openaiApiKey, 'sk-test-key');
            assert.strictEqual(loadedSettings.fontSize, 14);
        });

        it('should handle corrupted JSON files gracefully', async () => {
            const settingsFile = globalDataStore.getGlobalSettingsPath();
            fs.writeFileSync(settingsFile, 'invalid json content');

            const response = globalDataStore.loadGlobalSettings('test-request-4');
            
            assert.strictEqual(response.type, 'error');
            assert(response.error);
            assert(response.error.includes('Failed to load global settings'));
        });
    });

    describe('saveGlobalSettings', () => {
        it('should save settings to file successfully', async () => {
            const testSettings: GlobalSettings = {
                id: 'global-settings',
                userId: 'test-user',
                openaiApiKey: 'sk-test-save-key',
                geminiApiKey: 'gemini-test-key',
                claudeApiKey: 'claude-test-key',
                defaultProvider: 'anthropic' as any,
                defaultModel: 'claude-3-opus',
                defaultMode: 'developer' as any,
                fontSize: 18,
                showTokenCounts: false,
                showCostEstimates: true,
                autoSaveInterval: 45,
                maxHistoryItems: 150,
                enableNotifications: true,
                customApiEndpoints: {},
                metadata: { env: 'test' },
                createdAt: new Date('2024-02-01'),
                updatedAt: new Date('2024-02-01')
            };

            const response = globalDataStore.saveGlobalSettings(testSettings, 'test-request-5');
            
            assert.strictEqual(response.type, 'success');
            assert.strictEqual(response.requestId, 'test-request-5');
            assert(response.payload);
            
            // Verify file was created and contains correct data
            const settingsFile = globalDataStore.getGlobalSettingsPath();
            assert(fs.existsSync(settingsFile), 'Settings file should exist');
            
            const savedData = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            assert.strictEqual(savedData.openaiApiKey, 'sk-test-save-key');
            assert.strictEqual(savedData.geminiApiKey, 'gemini-test-key');
            assert.strictEqual(savedData.defaultProvider, 'anthropic');
            assert.strictEqual(savedData.metadata.saveTest, 'value');
        });

        it('should update timestamps when saving', async () => {
            const testSettings: GlobalSettings = {
                id: 'global-settings',
                userId: 'test-user',
                openaiApiKey: 'sk-test-timestamp',
                geminiApiKey: '',
                claudeApiKey: '',
                defaultProvider: 'openai' as any,
                defaultModel: 'gpt-4',
                defaultMode: 'default' as any,
                fontSize: 14,
                showTokenCounts: true,
                showCostEstimates: false,
                autoSaveInterval: 30,
                maxHistoryItems: 100,
                enableNotifications: true,
                customApiEndpoints: {},
                metadata: {},
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01')
            };

            const beforeSave = new Date();
            globalDataStore.saveGlobalSettings(testSettings, 'test-request-6');
            const afterSave = new Date();

            const settingsFile = globalDataStore.getGlobalSettingsPath();
            const savedData = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            
            const savedCreatedAt = new Date(savedData.createdAt);
            const savedUpdatedAt = new Date(savedData.updatedAt);
            
            assert(savedCreatedAt >= beforeSave && savedCreatedAt <= afterSave);
            assert(savedUpdatedAt >= beforeSave && savedUpdatedAt <= afterSave);
        });

        it('should return error when saving null/undefined settings', async () => {
            const response = globalDataStore.saveGlobalSettings(null as any, 'test-request-7');
            
            assert.strictEqual(response.type, 'error');
            assert.strictEqual(response.requestId, 'test-request-7');
            assert(response.error);
            assert(response.error.includes('Global settings data is required'));
        });
    });

    describe('End-to-End LLM API Key Flow', () => {
        it('should save and load LLM API keys correctly', async () => {
            // Step 1: Save API keys
            const settingsWithApiKeys: GlobalSettings = {
                id: 'global-settings',
                userId: 'test-user',
                openaiApiKey: 'sk-openai-test-key-12345',
                geminiApiKey: 'gemini-test-key-67890',
                claudeApiKey: 'claude-test-key-abcdef',
                defaultProvider: 'openai' as any,
                defaultModel: 'gpt-4',
                defaultMode: 'default' as any,
                fontSize: 14,
                showTokenCounts: true,
                showCostEstimates: true,
                autoSaveInterval: 30,
                maxHistoryItems: 100,
                enableNotifications: true,
                customApiEndpoints: {},
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const saveResponse = globalDataStore.saveGlobalSettings(settingsWithApiKeys, 'save-keys');
            assert.strictEqual(saveResponse.type, 'success');

            // Step 2: Load API keys and verify they match
            const loadResponse = globalDataStore.loadGlobalSettings('load-keys');
            assert.strictEqual(loadResponse.type, 'success');
            assert(loadResponse.payload);

            const loadedSettings = loadResponse.payload as GlobalSettings;
            assert.strictEqual(loadedSettings.openaiApiKey, 'sk-openai-test-key-12345');
            assert.strictEqual(loadedSettings.geminiApiKey, 'gemini-test-key-67890');
            assert.strictEqual(loadedSettings.claudeApiKey, 'claude-test-key-abcdef');
            assert.strictEqual(loadedSettings.defaultProvider, 'openai');
            assert.strictEqual(loadedSettings.defaultModel, 'gpt-4');

            // Step 3: Verify file location is user-specific
            const settingsFile = globalDataStore.getGlobalSettingsPath();
            assert(settingsFile.includes('samurai-agent'));
            assert(settingsFile.endsWith('global_user_settings.json'));
        });

        it('should persist API keys across multiple save/load cycles', async () => {
            const initialSettings: GlobalSettings = {
                id: 'global-settings',
                userId: 'test-user',
                openaiApiKey: 'sk-initial-key',
                geminiApiKey: '',
                claudeApiKey: '',
                defaultProvider: 'openai' as any,
                defaultModel: 'gpt-4',
                defaultMode: 'default' as any,
                fontSize: 14,
                showTokenCounts: true,
                showCostEstimates: true,
                autoSaveInterval: 30,
                maxHistoryItems: 100,
                enableNotifications: true,
                customApiEndpoints: {},
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Save initial settings
            globalDataStore.saveGlobalSettings(initialSettings, 'initial');

            // Load and modify
            const loadResponse = globalDataStore.loadGlobalSettings('load-modify');
            assert.strictEqual(loadResponse.type, 'success');
            const loadedSettings = loadResponse.payload as GlobalSettings;
            
            // Update API keys
            loadedSettings.openaiApiKey = 'sk-updated-key';
            loadedSettings.geminiApiKey = 'gemini-updated-key';

            // Save updated settings
            const updateResponse = globalDataStore.saveGlobalSettings(loadedSettings, 'update');
            assert.strictEqual(updateResponse.type, 'success');

            // Verify persistence
            const finalLoadResponse = globalDataStore.loadGlobalSettings('final-load');
            assert.strictEqual(finalLoadResponse.type, 'success');
            const finalSettings = finalLoadResponse.payload as GlobalSettings;
            
            assert.strictEqual(finalSettings.openaiApiKey, 'sk-updated-key');
            assert.strictEqual(finalSettings.geminiApiKey, 'gemini-updated-key');
        });
    });
});
