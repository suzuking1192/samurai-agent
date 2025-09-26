/**
 * Tests for Updated Webview Provider
 * Validates the webview provider's handling of initial settings and model filtering
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SamuraiAgentPanelWebviewViewProvider } from '../src/webview/SamuraiAgentPanelWebviewViewProvider';
import { LLM_MODELS } from '../src/common/constants/llm-models';
import { GlobalDataStore } from '../src/persistence/globalDataStore';
import { DataStore } from '../src/persistence/dataStore';
import { LLMProviderService } from '../src/agent/llm/llmProviderService';
import { ProjectDetailService } from '../src/memory/projectDetailService';

// Use real fs and path modules for these tests
jest.unmock('fs');
jest.unmock('path');

// Mock VS Code API
const mockWebview = {
    postMessage: jest.fn(),
    options: {},
    asWebviewUri: jest.fn((uri: any) => uri)
};

const mockWebviewView = {
    webview: mockWebview,
    onDidReceiveMessage: jest.fn()
};

const mockExtensionUri = {
    fsPath: '/test/extension'
};

let provider: SamuraiAgentPanelWebviewViewProvider;
let testWorkspaceRoot: string;
let testConfigDir: string;
let originalConfigDir: string;

function createProvider(workspaceRoot: string) {
    const globalDataStore = new GlobalDataStore();
    const dataStore = new DataStore(workspaceRoot);
    const llmProviderService = new LLMProviderService(globalDataStore);
    const projectDetailService = new ProjectDetailService(llmProviderService, dataStore);

    return new SamuraiAgentPanelWebviewViewProvider(mockExtensionUri as any, {
        llmProviderService,
        projectDetailService,
        dataStore,
        globalDataStore
    });
}

beforeEach(() => {
    // Create temporary test directories
    testWorkspaceRoot = path.join(os.tmpdir(), 'samurai-agent-test-workspace-webview', Date.now().toString());
    testConfigDir = path.join(os.tmpdir(), 'samurai-agent-test-global-webview', Date.now().toString());

    fs.mkdirSync(testWorkspaceRoot, { recursive: true });
    fs.mkdirSync(testConfigDir, { recursive: true });

    // Mock environment
    originalConfigDir = process.env.HOME || os.homedir();
    process.env.HOME = testConfigDir;

    const mockWorkspaceFolder = {
        uri: { fsPath: testWorkspaceRoot },
        name: 'test-workspace',
        index: 0
    };
    (require('vscode').workspace as any).workspaceFolders = [mockWorkspaceFolder];

    provider = createProvider(testWorkspaceRoot);

    // Clear mocks
    jest.clearAllMocks();

    // Initialize the provider's data stores by calling resolveWebviewView
    provider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);
});

    afterEach(() => {
        // Clean up test directories
        if (fs.existsSync(testWorkspaceRoot)) {
            fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
        }
        if (fs.existsSync(testConfigDir)) {
            fs.rmSync(testConfigDir, { recursive: true, force: true });
        }
        
        // Restore original HOME
        process.env.HOME = originalConfigDir;
    });

    describe('getAvailableModels method', () => {
        it('should return all models when all API keys are present', () => {
            const globalSettings = {
                openaiApiKey: 'test-openai-key',
                geminiApiKey: 'test-gemini-key',
                claudeApiKey: 'test-claude-key'
            };

            // Access private method through any cast
            const availableModels = (provider as any).getAvailableModels(globalSettings);
            
            const expectedTotal = LLM_MODELS.openai.length + LLM_MODELS.google.length + LLM_MODELS.anthropic.length;
            assert.strictEqual(availableModels.length, expectedTotal, 'Should return all models');
            
            // Check that all providers are represented
            const providers = [...new Set(availableModels.map((m: any) => m.provider))];
            assert(providers.includes('openai'), 'Should include OpenAI models');
            assert(providers.includes('google'), 'Should include Google models');
            assert(providers.includes('anthropic'), 'Should include Anthropic models');
        });

        it('should return only OpenAI models when only OpenAI API key is present', () => {
            const globalSettings = {
                openaiApiKey: 'test-openai-key',
                geminiApiKey: '',
                claudeApiKey: ''
            };

            const availableModels = (provider as any).getAvailableModels(globalSettings);
            
            assert.strictEqual(availableModels.length, LLM_MODELS.openai.length, 'Should return only OpenAI models');
            availableModels.forEach((model: any) => {
                assert.strictEqual(model.provider, 'openai', 'All models should be from OpenAI');
            });
        });

        it('should return only Google models when only Google API key is present', () => {
            const globalSettings = {
                openaiApiKey: '',
                geminiApiKey: 'test-gemini-key',
                claudeApiKey: ''
            };

            const availableModels = (provider as any).getAvailableModels(globalSettings);
            
            assert.strictEqual(availableModels.length, LLM_MODELS.google.length, 'Should return only Google models');
            availableModels.forEach((model: any) => {
                assert.strictEqual(model.provider, 'google', 'All models should be from Google');
            });
        });

        it('should return only Anthropic models when only Anthropic API key is present', () => {
            const globalSettings = {
                openaiApiKey: '',
                geminiApiKey: '',
                claudeApiKey: 'test-claude-key'
            };

            const availableModels = (provider as any).getAvailableModels(globalSettings);
            
            assert.strictEqual(availableModels.length, LLM_MODELS.anthropic.length, 'Should return only Anthropic models');
            availableModels.forEach((model: any) => {
                assert.strictEqual(model.provider, 'anthropic', 'All models should be from Anthropic');
            });
        });

        it('should return empty array when no API keys are present', () => {
            const globalSettings = {
                openaiApiKey: '',
                geminiApiKey: '',
                claudeApiKey: ''
            };

            const availableModels = (provider as any).getAvailableModels(globalSettings);
            
            assert.strictEqual(availableModels.length, 0, 'Should return empty array');
        });

        it('should ignore whitespace-only API keys', () => {
            const globalSettings = {
                openaiApiKey: '   ',
                geminiApiKey: '\t\n',
                claudeApiKey: ' '
            };

            const availableModels = (provider as any).getAvailableModels(globalSettings);
            
            assert.strictEqual(availableModels.length, 0, 'Should return empty array for whitespace-only keys');
        });

        it('should sort models alphabetically by provider then by name', () => {
            const globalSettings = {
                openaiApiKey: 'test-openai-key',
                geminiApiKey: 'test-gemini-key',
                claudeApiKey: 'test-claude-key'
            };

            const availableModels = (provider as any).getAvailableModels(globalSettings);
            
            // Check that models are sorted correctly
            for (let i = 1; i < availableModels.length; i++) {
                const prev = availableModels[i - 1];
                const curr = availableModels[i];
                
                if (prev.provider === curr.provider) {
                    assert(prev.name <= curr.name, 'Models within same provider should be sorted by name');
                } else {
                    assert(prev.provider < curr.provider, 'Providers should be sorted alphabetically');
                }
            }
        });
    });

    describe('sendInitialSettingsToWebview method', () => {
        it('should send initial settings with available models', async () => {
            // Create test global settings file
            const globalSettings = {
                id: 'test-global-settings',
                userId: 'test-user',
                openaiApiKey: 'test-openai-key',
                geminiApiKey: 'test-gemini-key',
                claudeApiKey: 'test-claude-key',
                defaultProvider: 'openai',
                defaultModel: 'gpt-4o',
                defaultMode: 'default',
                fontSize: 14,
                showTokenCounts: true,
                showCostEstimates: true,
                autoSaveInterval: 30,
                maxHistoryItems: 100,
                enableNotifications: true,
                customApiEndpoints: {},
                metadata: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const globalSettingsFile = path.join(testConfigDir, '.config', 'samurai-agent', 'global_user_settings.json');
            fs.mkdirSync(path.dirname(globalSettingsFile), { recursive: true });
            fs.writeFileSync(globalSettingsFile, JSON.stringify(globalSettings, null, 2));

            // Create test project settings file
            const projectSettings = {
                id: 'test-project-settings',
                projectId: 'test-project',
                projectName: 'Test Project',
                projectDetailText: 'Test project details',
                digestedMemory: 'Test digested memory',
                defaultModel: 'gpt-4o',
                defaultMode: 'default',
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
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const projectSettingsFile = path.join(testWorkspaceRoot, '.vscode', 'samurai-agent', 'project_settings.json');
            fs.mkdirSync(path.dirname(projectSettingsFile), { recursive: true });
            fs.writeFileSync(projectSettingsFile, JSON.stringify(projectSettings, null, 2));

            // Call the method
            await (provider as any).sendInitialSettingsToWebview(mockWebview);

            // Verify that postMessage was called
            assert(mockWebview.postMessage.mock.calls.length > 0, 'Should call postMessage');
            
            const message = mockWebview.postMessage.mock.calls[0][0];
            assert.strictEqual(message.type, 'initialSettings', 'Should send initialSettings message');
            assert(message.payload, 'Should have payload');
            
            const payload = message.payload;
            assert(payload.globalSettings, 'Should include globalSettings');
            assert(payload.projectSettings, 'Should include projectSettings');
            assert(payload.availableModels, 'Should include availableModels');
            assert(payload.llmModels, 'Should include llmModels');
            
            // Verify available models are filtered correctly
            const expectedTotal = LLM_MODELS.openai.length + LLM_MODELS.google.length + LLM_MODELS.anthropic.length;
            assert.strictEqual(payload.availableModels.length, expectedTotal, 'Should include all available models');
            
            // Verify primaryLLMModel is set to first available model
            assert(payload.projectSettings.primaryLLMModel, 'Should set primaryLLMModel');
            assert.strictEqual(payload.projectSettings.primaryLLMModel, payload.availableModels[0].id, 'Should set to first available model');
        });

        it('should preserve existing primaryLLMModel if already set', async () => {
            // Create test settings with existing primaryLLMModel
            const globalSettings = {
                id: 'test-global-settings',
                userId: 'test-user',
                openaiApiKey: 'test-openai-key',
                geminiApiKey: 'test-gemini-key',
                claudeApiKey: 'test-claude-key',
                defaultProvider: 'openai',
                defaultModel: 'gpt-4o',
                defaultMode: 'default',
                fontSize: 14,
                showTokenCounts: true,
                showCostEstimates: true,
                autoSaveInterval: 30,
                maxHistoryItems: 100,
                enableNotifications: true,
                customApiEndpoints: {},
                metadata: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const projectSettings = {
                id: 'test-project-settings',
                projectId: 'test-project',
                projectName: 'Test Project',
                projectDetailText: 'Test project details',
                digestedMemory: 'Test digested memory',
                defaultModel: 'gpt-4o',
                defaultMode: 'default',
                customPrompts: {},
                projectSpecificConfig: {
                    codeAnalysisEnabled: true,
                    autoTaskGeneration: true,
                    memoryRetentionDays: 30,
                    maxTokensPerRequest: 4000
                },
                theme: 'auto',
                autoSave: true,
                primaryLLMModel: 'claude-sonnet-4-20250514', // Already set
                metadata: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Create files
            const globalSettingsFile = path.join(testConfigDir, '.config', 'samurai-agent', 'global_user_settings.json');
            fs.mkdirSync(path.dirname(globalSettingsFile), { recursive: true });
            fs.writeFileSync(globalSettingsFile, JSON.stringify(globalSettings, null, 2));

            const projectSettingsFile = path.join(testWorkspaceRoot, '.vscode', 'samurai-agent', 'project_settings.json');
            fs.mkdirSync(path.dirname(projectSettingsFile), { recursive: true });
            fs.writeFileSync(projectSettingsFile, JSON.stringify(projectSettings, null, 2));

            // Call the method
            await (provider as any).sendInitialSettingsToWebview(mockWebview);

            // Verify that existing primaryLLMModel is preserved
            const message = mockWebview.postMessage.mock.calls[0][0];
            const payload = message.payload;
            assert.strictEqual(payload.projectSettings.primaryLLMModel, 'claude-sonnet-4-20250514', 'Should preserve existing primaryLLMModel');
        });

        it('should handle case when no API keys are configured', async () => {
            // Create test settings with no API keys
            const globalSettings = {
                id: 'test-global-settings',
                userId: 'test-user',
                openaiApiKey: '',
                geminiApiKey: '',
                claudeApiKey: '',
                defaultProvider: 'openai',
                defaultModel: 'gpt-4o',
                defaultMode: 'default',
                fontSize: 14,
                showTokenCounts: true,
                showCostEstimates: true,
                autoSaveInterval: 30,
                maxHistoryItems: 100,
                enableNotifications: true,
                customApiEndpoints: {},
                metadata: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const projectSettings = {
                id: 'test-project-settings',
                projectId: 'test-project',
                projectName: 'Test Project',
                projectDetailText: 'Test project details',
                digestedMemory: 'Test digested memory',
                defaultModel: 'gpt-4o',
                defaultMode: 'default',
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
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Create files
            const globalSettingsFile = path.join(testConfigDir, '.config', 'samurai-agent', 'global_user_settings.json');
            fs.mkdirSync(path.dirname(globalSettingsFile), { recursive: true });
            fs.writeFileSync(globalSettingsFile, JSON.stringify(globalSettings, null, 2));

            const projectSettingsFile = path.join(testWorkspaceRoot, '.vscode', 'samurai-agent', 'project_settings.json');
            fs.mkdirSync(path.dirname(projectSettingsFile), { recursive: true });
            fs.writeFileSync(projectSettingsFile, JSON.stringify(projectSettings, null, 2));

            // Call the method
            await (provider as any).sendInitialSettingsToWebview(mockWebview);

            // Verify that no models are available and primaryLLMModel remains null
            const message = mockWebview.postMessage.mock.calls[0][0];
            const payload = message.payload;
            assert.strictEqual(payload.availableModels.length, 0, 'Should have no available models');
            assert.strictEqual(payload.projectSettings.primaryLLMModel, null, 'Should keep primaryLLMModel as null');
        });
    });
});
