jest.mock('@anthropic-ai/sdk', () => {
    const createMock = jest.fn();
    const messages = {
        create: createMock
    };

    const AnthropicConstructor = jest.fn().mockImplementation((_options: { apiKey: string; baseURL?: string }) => ({
        messages
    }));

    return Object.assign(AnthropicConstructor, {
        __mock: {
            create: createMock
        }
    });
});

import { AnthropicChatClient } from '../src/agent/llm/anthropicChatClient';
import { ResponseType } from '../src/common/models/response-models';
import { LLMRequest } from '../src/common/models/llm-models';

const anthropicModule = jest.requireMock('@anthropic-ai/sdk');
const AnthropicConstructor = anthropicModule as jest.Mock;
const createMock = anthropicModule.__mock.create as jest.Mock;

describe('AnthropicChatClient', () => {
    let client: AnthropicChatClient;
    let baseRequest: LLMRequest;

    beforeEach(() => {
        jest.clearAllMocks();
        client = new AnthropicChatClient();
        baseRequest = {
            id: 'request-1',
            provider: 'anthropic',
            model: 'claude-3-5-haiku-20241022',
            messages: [
                { role: 'system', content: 'You are concise.' },
                { role: 'user', content: 'Summarize this conversation.' },
                { role: 'assistant', content: 'Summary: ...' }
            ],
            metadata: {
                apiKey: 'anthropic-key',
                customApiEndpoints: { anthropic: 'https://api.anthropic.com' },
                llmModels: {
                    anthropic: [{ id: 'claude-3-5-haiku-20241022', maxTokens: 4096 }]
                }
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };
    });

    it('should call Anthropic API with transformed payload', async () => {
        createMock.mockResolvedValue({
            id: 'msg-123',
            model: 'claude-3-5-haiku-20241022',
            content: [{ type: 'text', text: 'Here is the summary.' }],
            usage: { input_tokens: 100, output_tokens: 50 }
        });

        const response = await client.chat(baseRequest);

        expect(response.type).toBe(ResponseType.SUCCESS);
        expect(createMock).toHaveBeenCalledWith({
            model: 'claude-3-5-haiku-20241022',
            temperature: undefined,
            max_tokens: 4096,
            messages: [
                { role: 'user', content: [{ type: 'text', text: 'You are concise.' }] },
                { role: 'user', content: [{ type: 'text', text: 'Summarize this conversation.' }] },
                { role: 'assistant', content: [{ type: 'text', text: 'Summary: ...' }] }
            ]
        });

        expect(response.payload?.content).toBe('Here is the summary.');
        expect(response.payload?.usage.totalTokens).toBe(150);
    });

    it('should surface API errors as error responses', async () => {
        const apiError = Object.assign(new Error('Anthropic rate limit'), { status: 429, code: '429' });
        createMock.mockRejectedValue(apiError);

        const response = await client.chat(baseRequest);

        expect(response.type).toBe(ResponseType.ERROR);
        expect(response.error).toContain('Anthropic rate limit');
        expect(response.payload?.errorCode).toBe('http_429');
        expect(response.payload?.retryable).toBe(false);
    });

    it('should return validation error when API key missing', async () => {
        const response = await client.chat({
            ...baseRequest,
            metadata: { ...baseRequest.metadata, apiKey: '' }
        });

        expect(response.type).toBe(ResponseType.ERROR);
        expect(response.error).toContain('API key');
        expect(AnthropicConstructor).not.toHaveBeenCalled();
    });

    it('should return validation error when messages are empty', async () => {
        const response = await client.chat({
            ...baseRequest,
            messages: []
        });

        expect(response.type).toBe(ResponseType.ERROR);
        expect(response.error).toContain('message');
    });
});
