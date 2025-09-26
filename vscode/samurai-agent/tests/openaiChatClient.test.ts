jest.mock('openai', () => {
    const createMock = jest.fn();
    const OpenAIConstructor = jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: createMock
            }
        }
    }));

    return Object.assign(OpenAIConstructor, {
        Chat: {
            Completions: {}
        },
        __mock: {
            create: createMock
        }
    });
});

import { OpenAIChatClient } from '../src/agent/llm/openaiChatClient';
import { ResponseType } from '../src/common/models/response-models';
import { LLMRequest } from '../src/common/models/llm-models';

const openAIModule = jest.requireMock('openai') as any;
const mockOpenAIConstructor = openAIModule as jest.Mock;
const mockCreate = openAIModule.__mock.create as jest.Mock;

describe('OpenAIChatClient', () => {
    let client: OpenAIChatClient;
    let baseRequest: LLMRequest;

    beforeEach(() => {
        jest.clearAllMocks();
        client = new OpenAIChatClient();
        baseRequest = {
            id: 'request-1',
            provider: 'openai',
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'Hello there' }],
            metadata: {
                apiKey: 'openai-key',
                customApiEndpoints: { openai: 'https://example.com/v1' },
                llmModels: {
                    openai: [{ id: 'gpt-4o', maxTokens: 2048 }]
                }
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };
    });

    it('should create chat completion with transformed payload', async () => {
        mockCreate.mockResolvedValue({
            id: 'chatcmpl-123',
            model: 'gpt-4o',
            choices: [{ message: { content: 'Hi!' } }],
            usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 }
        });

        const response = await client.chat(baseRequest);

        expect(response.type).toBe(ResponseType.SUCCESS);
        expect(mockOpenAIConstructor).toHaveBeenCalledWith({
            apiKey: 'openai-key',
            baseURL: 'https://example.com/v1'
        });

        expect(mockCreate).toHaveBeenCalledWith({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'Hello there' }],
            max_tokens: 2048
        });

        expect(response.payload?.content).toBe('Hi!');
        expect(response.payload?.usage.totalTokens).toBe(12);
    });

    it('should surface API errors as error responses', async () => {
        const apiError = Object.assign(new Error('Rate limit exceeded'), { status: 429, code: 'rate_limit' });
        mockCreate.mockRejectedValue(apiError);

        const response = await client.chat(baseRequest);

        expect(response.type).toBe(ResponseType.ERROR);
        expect(response.error).toContain('Rate limit exceeded');
        expect(response.payload?.errorCode).toBe('rate_limit');
        expect(response.payload?.retryable).toBe(false);
    });

    it('should fall back to llm model defaults when maxTokens omitted on request', async () => {
        mockCreate.mockResolvedValue({
            id: 'chatcmpl-456',
            model: 'gpt-4o',
            choices: [{ message: { content: 'Hello' } }]
        });

        const request = {
            ...baseRequest,
            maxTokens: undefined
        };

        await client.chat(request);

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                max_tokens: 2048
            })
        );
    });

    it('should return validation error when API key missing', async () => {
        const request = {
            ...baseRequest,
            metadata: { ...baseRequest.metadata, apiKey: '' }
        };

        const response = await client.chat(request);

        expect(response.type).toBe(ResponseType.ERROR);
        expect(response.error).toContain('API key');
        expect(mockOpenAIConstructor).not.toHaveBeenCalled();
    });

    it('should return validation error when messages are empty', async () => {
        const request = {
            ...baseRequest,
            messages: []
        };

        const response = await client.chat(request);

        expect(response.type).toBe(ResponseType.ERROR);
        expect(response.error).toContain('message');
        expect(mockOpenAIConstructor).not.toHaveBeenCalled();
    });
});


