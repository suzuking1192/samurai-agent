import * as assert from 'assert';
import { LLMProviderService, ChatClient } from '../src/agent/llm/llmProviderService';
import { GlobalDataStore } from '../src/persistence/globalDataStore';
import { DataStore } from '../src/persistence/dataStore';
import { ApiResponse, ResponseType } from '../src/common/models/response-models';
import { LLMRequest, LLMResponse, LLMError } from '../src/common/models/llm-models';
import { FREE_TIER_GEMINI_API_KEY } from '../src/common/constants/llm-constants';

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

    describe('Free Tier Model', () => {
        it('should use hardcoded API key for free tier model even when user has no Gemini API key', async () => {
            const client = new MockChatClient();
            const service = new LLMProviderService(
                new MockGlobalDataStore({ ...baseGlobalSettings, geminiApiKey: '' }),
                new MockDataStore(baseProjectSettings)
            );
            service.registerClient('google', client);

            const response = await service.chat({
                id: 'request-free-tier-0',
                provider: 'google',
                model: 'gemini-2.5-flash-free-tier',
                messages: [{ role: 'user', content: 'hello' }],
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Verify the request succeeds with hardcoded API key
            assert.strictEqual(response.type, ResponseType.SUCCESS);
            assert.strictEqual(client.lastRequest?.metadata?.apiKey, FREE_TIER_GEMINI_API_KEY);
        });

        it('should use hardcoded API key for free tier model when user has Gemini API key', async () => {
            const client = new MockChatClient();
            const service = new LLMProviderService(
                new MockGlobalDataStore({ ...baseGlobalSettings, geminiApiKey: 'user-gemini-key' }),
                new MockDataStore(baseProjectSettings)
            );
            service.registerClient('google', client);

            await service.chat({
                id: 'request-free-tier-1',
                provider: 'google',
                model: 'gemini-2.5-flash-free-tier',
                messages: [{ role: 'user', content: 'hello' }],
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Verify the hardcoded API key is used instead of user's key
            assert.strictEqual(client.lastRequest?.metadata?.apiKey, FREE_TIER_GEMINI_API_KEY);
            assert.notStrictEqual(client.lastRequest?.metadata?.apiKey, 'user-gemini-key');
        });

        it('should use user API key for non-free-tier Gemini models', async () => {
            const client = new MockChatClient();
            const service = new LLMProviderService(
                new MockGlobalDataStore({ ...baseGlobalSettings, geminiApiKey: 'user-gemini-key' }),
                new MockDataStore(baseProjectSettings)
            );
            service.registerClient('google', client);

            await service.chat({
                id: 'request-paid-tier-1',
                provider: 'google',
                model: 'gemini-2.5-flash',
                messages: [{ role: 'user', content: 'hello' }],
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Verify the user's API key is used for non-free-tier models
            assert.strictEqual(client.lastRequest?.metadata?.apiKey, 'user-gemini-key');
            assert.notStrictEqual(client.lastRequest?.metadata?.apiKey, FREE_TIER_GEMINI_API_KEY);
        });

        it('should customize error message for free tier rate limit', async () => {
            class MockChatClientWithRateLimit implements ChatClient {
                async chat(request: LLMRequest): Promise<ApiResponse<LLMResponse | LLMError>> {
                    const timestamp = new Date();
                    return {
                        type: ResponseType.ERROR,
                        error: 'Rate limit exceeded',
                        payload: {
                            id: 'error-id',
                            requestId: request.id,
                            provider: request.provider,
                            model: request.model,
                            error: 'Rate limit exceeded',
                            errorCode: 'RATE_LIMIT_EXCEEDED',
                            retryable: false,
                            metadata: {},
                            createdAt: timestamp,
                            updatedAt: timestamp
                        },
                        timestamp
                    };
                }
            }

            const client = new MockChatClientWithRateLimit();
            const service = new LLMProviderService(
                new MockGlobalDataStore({ ...baseGlobalSettings, geminiApiKey: '' }),
                new MockDataStore(baseProjectSettings)
            );
            service.registerClient('google', client);

            const response = await service.chat({
                id: 'request-rate-limit-1',
                provider: 'google',
                model: 'gemini-2.5-flash-free-tier',
                messages: [{ role: 'user', content: 'hello' }],
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Verify the custom error message for free tier rate limit
            assert.strictEqual(response.type, ResponseType.ERROR);
            const expectedMessage = 'free tier daily limit is reached, please set your own LLM API key and select different model';
            assert.strictEqual(response.error, expectedMessage);
            assert.strictEqual((response.payload as LLMError).error, expectedMessage);
        });

        it('should not customize error message for rate limit on non-free-tier models', async () => {
            class MockChatClientWithRateLimit implements ChatClient {
                async chat(request: LLMRequest): Promise<ApiResponse<LLMResponse | LLMError>> {
                    const timestamp = new Date();
                    return {
                        type: ResponseType.ERROR,
                        error: 'Rate limit exceeded',
                        payload: {
                            id: 'error-id',
                            requestId: request.id,
                            provider: request.provider,
                            model: request.model,
                            error: 'Rate limit exceeded',
                            errorCode: 'RATE_LIMIT_EXCEEDED',
                            retryable: false,
                            metadata: {},
                            createdAt: timestamp,
                            updatedAt: timestamp
                        },
                        timestamp
                    };
                }
            }

            const client = new MockChatClientWithRateLimit();
            const service = new LLMProviderService(
                new MockGlobalDataStore({ ...baseGlobalSettings, geminiApiKey: 'user-gemini-key' }),
                new MockDataStore(baseProjectSettings)
            );
            service.registerClient('google', client);

            const response = await service.chat({
                id: 'request-rate-limit-2',
                provider: 'google',
                model: 'gemini-2.5-flash',
                messages: [{ role: 'user', content: 'hello' }],
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Verify the original error message is preserved for non-free-tier models
            assert.strictEqual(response.type, ResponseType.ERROR);
            assert.strictEqual(response.error, 'Rate limit exceeded');
            assert.strictEqual((response.payload as LLMError).error, 'Rate limit exceeded');
        });
    });
});

