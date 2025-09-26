import * as assert from 'assert';
import { LLMProviderService, ChatClient } from '../src/agent/llm/llmProviderService';
import { GlobalDataStore } from '../src/persistence/globalDataStore';
import { DataStore } from '../src/persistence/dataStore';
import { ApiResponse, ResponseType } from '../src/common/models/response-models';
import { LLMRequest, LLMResponse } from '../src/common/models/llm-models';

class MockGlobalDataStore extends GlobalDataStore {
    constructor(private readonly settings: any) {
        super();
    }

    public loadGlobalSettings(): ApiResponse {
        return {
            type: ResponseType.SUCCESS,
            payload: this.settings,
            timestamp: new Date()
        } as ApiResponse;
    }
}

class MockDataStore extends DataStore {
    constructor(private readonly projectSettings: any) {
        super('');
    }

    public readProjectSettings(): ApiResponse {
        return {
            type: ResponseType.SUCCESS,
            payload: this.projectSettings,
            timestamp: new Date()
        } as ApiResponse;
    }
}

class MockChatClient implements ChatClient {
    public lastRequest: LLMRequest | undefined;

    async chat(request: LLMRequest): Promise<ApiResponse<LLMResponse>> {
        this.lastRequest = request;
        const timestamp = new Date();
        return {
            type: ResponseType.SUCCESS,
            payload: {
                id: 'response-id',
                requestId: request.id,
                provider: request.provider,
                model: request.model,
                content: 'mock-response',
                usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
                cost: 0,
                processingTime: 0,
                metadata: {},
                createdAt: timestamp,
                updatedAt: timestamp
            },
            timestamp
        };
    }
}

describe('LLMProviderService', () => {
    const baseGlobalSettings = {
        id: 'global-settings',
        userId: 'test-user',
        openaiApiKey: 'openai-key',
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
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const baseProjectSettings = {
        id: 'project-settings',
        projectId: 'project-id',
        projectName: 'Test Project',
        rawProjectDetailContent: '',
        digestedProjectDetailContent: '',
        defaultModel: 'gpt-4o',
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

    it('should return error when provider client is missing', async () => {
        const service = new LLMProviderService(new MockGlobalDataStore(baseGlobalSettings));
        const response = await service.chat({
            id: 'request-1',
            provider: 'openai',
            model: '',
            messages: [],
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date()
        });

        assert.strictEqual(response.type, ResponseType.ERROR);
        assert.ok(response.error?.includes('No client registered'));
    });

    it('should return error when API key is missing', async () => {
        const service = new LLMProviderService(
            new MockGlobalDataStore({ ...baseGlobalSettings, openaiApiKey: '' })
        );
        service.registerClient('openai', new MockChatClient());

        const response = await service.chat({
            id: 'request-2',
            provider: 'openai',
            model: '',
            messages: [],
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date()
        });

        assert.strictEqual(response.type, ResponseType.ERROR);
        assert.ok(response.error?.includes('No API key configured'));
    });

    it('should select primary model from project settings when available', async () => {
        const client = new MockChatClient();
        const service = new LLMProviderService(
            new MockGlobalDataStore(baseGlobalSettings),
            new MockDataStore({ ...baseProjectSettings, primaryLLMModel: 'gpt-5' })
        );
        service.registerClient('openai', client);

        await service.chat({
            id: 'request-3',
            provider: 'openai',
            model: '',
            messages: [{ role: 'user', content: 'hello' }],
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date()
        });

        assert.strictEqual(client.lastRequest?.model, 'gpt-5');
        assert.ok(client.lastRequest?.metadata?.customApiEndpoints, 'Should provide customApiEndpoints metadata');
        assert.ok(client.lastRequest?.metadata?.llmModels, 'Should provide llmModels metadata');
    });

    it('should fall back to default model when primary is not set', async () => {
        const client = new MockChatClient();
        const service = new LLMProviderService(
            new MockGlobalDataStore(baseGlobalSettings),
            new MockDataStore(baseProjectSettings)
        );
        service.registerClient('openai', client);

        await service.chat({
            id: 'request-4',
            provider: 'openai',
            model: '',
            messages: [{ role: 'user', content: 'hello' }],
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date()
        });

        assert.strictEqual(client.lastRequest?.model, 'gpt-4o');
        assert.ok(client.lastRequest?.metadata?.llmModels?.openai, 'Should expose llmModels for openai');
    });

    it('should use requested model when provided', async () => {
        const client = new MockChatClient();
        const service = new LLMProviderService(
            new MockGlobalDataStore(baseGlobalSettings),
            new MockDataStore(baseProjectSettings)
        );
        service.registerClient('openai', client);

        await service.chat({
            id: 'request-5',
            provider: 'openai',
            model: 'gpt-4-turbo',
            messages: [{ role: 'user', content: 'hi' }],
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date()
        });

        assert.strictEqual(client.lastRequest?.model, 'gpt-4-turbo');
    });
});

