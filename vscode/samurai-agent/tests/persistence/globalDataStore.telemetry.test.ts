/**
 * Integration tests for GlobalDataStore LLM API key telemetry tracking
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GlobalDataStore } from '../../src/persistence/globalDataStore';
import { TelemetryService } from '../../src/services/TelemetryService';
import { GlobalSettings } from '../../src/common/models/settings-models';

// Mock TelemetryService
const mockTelemetryService = {
    trackLLMKeyStatusChange: jest.fn(),
    trackChatMessage: jest.fn(),
    trackExtensionActivation: jest.fn(),
    trackTelemetrySettingChange: jest.fn(),
    captureError: jest.fn(),
    dispose: jest.fn()
} as unknown as TelemetryService;

describe('GlobalDataStore LLM API Key Telemetry Integration', () => {
    let globalDataStore: GlobalDataStore;
    let testConfigDir: string;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        // Clear mock
        jest.clearAllMocks();

        // Save original environment
        originalEnv = { ...process.env };

        // Create temporary test directory
        testConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'samurai-agent-telemetry-test-'));
        
        // Override HOME environment variable to use test directory
        process.env.HOME = testConfigDir;
        process.env.XDG_CONFIG_HOME = path.join(testConfigDir, '.config');

        // Create GlobalDataStore and set telemetry service
        globalDataStore = new GlobalDataStore();
        globalDataStore.setTelemetryService(mockTelemetryService);
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;

        // Clean up test directory
        if (fs.existsSync(testConfigDir)) {
            fs.rmSync(testConfigDir, { recursive: true, force: true });
        }
    });

    describe('saveGlobalSettings with telemetry', () => {
        it('should track when OpenAI API key is added', () => {
            const settings: GlobalSettings = {
                id: 'global-settings',
                userId: 'test-user',
                openaiApiKey: 'sk-new-openai-key',
                geminiApiKey: '',
                claudeApiKey: '',
                defaultProvider: 'openai' as any,
                defaultModel: 'gpt-4o',
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

            const response = globalDataStore.saveGlobalSettings(settings, 'test-request');

            expect(response.type).toBe('success');
            expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
                'openai',
                'added',
                false,
                true
            );
        });

        it('should track when Gemini API key is updated', () => {
            // First save with an initial key
            const initialSettings: GlobalSettings = {
                id: 'global-settings',
                userId: 'test-user',
                openaiApiKey: '',
                geminiApiKey: 'old-gemini-key',
                claudeApiKey: '',
                defaultProvider: 'google' as any,
                defaultModel: 'gemini-pro',
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

            globalDataStore.saveGlobalSettings(initialSettings);
            jest.clearAllMocks();

            // Now update the key
            const updatedSettings = {
                ...initialSettings,
                geminiApiKey: 'new-gemini-key'
            };

            globalDataStore.saveGlobalSettings(updatedSettings);

            expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
                'gemini',
                'updated',
                true,
                true
            );
        });

        it('should track when Claude API key is removed', () => {
            // First save with a key
            const initialSettings: GlobalSettings = {
                id: 'global-settings',
                userId: 'test-user',
                openaiApiKey: '',
                geminiApiKey: '',
                claudeApiKey: 'claude-key',
                defaultProvider: 'anthropic' as any,
                defaultModel: 'claude-3-sonnet',
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

            globalDataStore.saveGlobalSettings(initialSettings);
            jest.clearAllMocks();

            // Now remove the key
            const updatedSettings = {
                ...initialSettings,
                claudeApiKey: ''
            };

            globalDataStore.saveGlobalSettings(updatedSettings);

            expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
                'claude',
                'removed',
                true,
                false
            );
        });

        it('should track multiple key changes in a single save', () => {
            // First save with initial keys
            const initialSettings: GlobalSettings = {
                id: 'global-settings',
                userId: 'test-user',
                openaiApiKey: '',
                geminiApiKey: 'old-gemini',
                claudeApiKey: 'old-claude',
                defaultProvider: 'openai' as any,
                defaultModel: 'gpt-4o',
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

            globalDataStore.saveGlobalSettings(initialSettings);
            jest.clearAllMocks();

            // Update multiple keys at once
            const updatedSettings = {
                ...initialSettings,
                openaiApiKey: 'new-openai',
                geminiApiKey: 'new-gemini',
                claudeApiKey: ''
            };

            globalDataStore.saveGlobalSettings(updatedSettings);

            expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledTimes(3);
            expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
                'openai',
                'added',
                false,
                true
            );
            expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
                'gemini',
                'updated',
                true,
                true
            );
            expect(mockTelemetryService.trackLLMKeyStatusChange).toHaveBeenCalledWith(
                'claude',
                'removed',
                true,
                false
            );
        });

        it('should not track when no API keys have changed', () => {
            const settings: GlobalSettings = {
                id: 'global-settings',
                userId: 'test-user',
                openaiApiKey: 'existing-key',
                geminiApiKey: '',
                claudeApiKey: '',
                defaultProvider: 'openai' as any,
                defaultModel: 'gpt-4o',
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

            globalDataStore.saveGlobalSettings(settings);
            jest.clearAllMocks();

            // Save again without changing API keys
            const sameSettings = {
                ...settings,
                fontSize: 16 // Only change non-API-key setting
            };

            globalDataStore.saveGlobalSettings(sameSettings);

            expect(mockTelemetryService.trackLLMKeyStatusChange).not.toHaveBeenCalled();
        });

        it('should not track when telemetry service is not set', () => {
            // Create new store without telemetry service
            const storeWithoutTelemetry = new GlobalDataStore();

            const settings: GlobalSettings = {
                id: 'global-settings',
                userId: 'test-user',
                openaiApiKey: 'new-key',
                geminiApiKey: '',
                claudeApiKey: '',
                defaultProvider: 'openai' as any,
                defaultModel: 'gpt-4o',
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

            const response = storeWithoutTelemetry.saveGlobalSettings(settings);

            expect(response.type).toBe('success');
            expect(mockTelemetryService.trackLLMKeyStatusChange).not.toHaveBeenCalled();
        });
    });
});

