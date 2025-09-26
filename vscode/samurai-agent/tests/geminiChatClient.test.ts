jest.mock('@google/generative-ai', () => {
    const generateContentMock = jest.fn();

    const generativeModel = {
        generateContent: generateContentMock
    };

    const GoogleGenerativeAIMock = jest.fn().mockImplementation((_apiKey: string, options?: { baseUrl?: string }) => {
        const modelFactory = jest.fn().mockReturnValue(generativeModel);
        return {
            getGenerativeModel: modelFactory,
            __options: options
        };
    });

    return {
        GoogleGenerativeAI: GoogleGenerativeAIMock,
        __mock: {
            generateContent: generateContentMock
        }
    };
});

import { GeminiChatClient } from '../src/agent/llm/geminiChatClient';
import { ResponseType } from '../src/common/models/response-models';
import { LLMRequest } from '../src/common/models/llm-models';

const genAIModule = jest.requireMock('@google/generative-ai');
const GoogleGenerativeAIConstructor = genAIModule.GoogleGenerativeAI as jest.Mock;
const generateContentMock = genAIModule.__mock.generateContent as jest.Mock;

describe('GeminiChatClient', () => {
    let client: GeminiChatClient;
    let baseRequest: LLMRequest;

    beforeEach(() => {
        jest.clearAllMocks();
        client = new GeminiChatClient();
        baseRequest = {
            id: 'request-1',
            provider: 'google',
            model: 'gemini-2.5-flash',
            messages: [
                { role: 'system', content: 'You are friendly' },
                { role: 'user', content: 'Hello Gemini!' }
            ],
            metadata: {
                apiKey: 'gemini-key',
                customApiEndpoints: { google: 'https://generativelanguage.googleapis.com/v1beta' },
                llmModels: {
                    google: [{ id: 'gemini-2.5-flash', maxTokens: 1024 }]
                }
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };
    });

    it('should call Gemini API with transformed message payload', async () => {
        generateContentMock.mockResolvedValue({
            response: {
                text: () => 'Hallå!',
                usageMetadata: {
                    promptTokenCount: 10,
                    candidatesTokenCount: 5,
                    totalTokenCount: 15
                }
            }
        });

        const result = await client.chat(baseRequest);

        expect(result.type).toBe(ResponseType.SUCCESS);
        expect(GoogleGenerativeAIConstructor).toHaveBeenCalledWith('gemini-key', { baseUrl: 'https://generativelanguage.googleapis.com/v1beta' });

        const modelFactory = GoogleGenerativeAIConstructor.mock.results[0].value.getGenerativeModel;
        expect(modelFactory).toHaveBeenCalledWith({
            model: 'gemini-2.5-flash',
            generationConfig: expect.objectContaining({ maxOutputTokens: 1024 })
        });

        expect(generateContentMock).toHaveBeenCalledWith({
            contents: [
                { role: 'system', parts: [{ text: 'You are friendly' }] },
                { role: 'user', parts: [{ text: 'Hello Gemini!' }] }
            ]
        });

        expect(result.payload?.content).toBe('Hallå!');
        expect(result.payload?.usage.totalTokens).toBe(15);
    });

    it('should fall back to candidate text when .text() throws', async () => {
        generateContentMock.mockResolvedValue({
            response: {
                text: () => { throw new Error('Blocked prompt'); },
                candidates: [
                    {
                        content: {
                            parts: [{ text: 'Partial result' }]
                        }
                    }
                ]
            }
        });

        const result = await client.chat(baseRequest);

        expect(result.type).toBe(ResponseType.SUCCESS);
        expect(result.payload?.content).toBe('Partial result');
    });

    it('should surface API errors as error responses', async () => {
        const apiError = Object.assign(new Error('Rate limit'), { status: 429 });
        generateContentMock.mockRejectedValue(apiError);

        const result = await client.chat(baseRequest);

        expect(result.type).toBe(ResponseType.ERROR);
        expect(result.error).toContain('Rate limit');
        expect(result.payload?.errorCode).toBe('http_429');
        expect(result.payload?.retryable).toBe(false);
    });

    it('should return validation error when API key missing', async () => {
        const result = await client.chat({
            ...baseRequest,
            metadata: { ...baseRequest.metadata, apiKey: '' }
        });

        expect(result.type).toBe(ResponseType.ERROR);
        expect(result.error).toContain('API key');
        expect(GoogleGenerativeAIConstructor).not.toHaveBeenCalled();
    });

    it('should return validation error when messages are empty', async () => {
        const result = await client.chat({
            ...baseRequest,
            messages: []
        });

        expect(result.type).toBe(ResponseType.ERROR);
        expect(result.error).toContain('message');
    });
});


