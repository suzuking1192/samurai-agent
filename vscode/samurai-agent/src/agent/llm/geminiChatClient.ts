import { GoogleGenerativeAI, type Content } from '@google/generative-ai';
import { URL } from 'url';
import { LLMRequest, LLMResponse, LLMError, LLMMessage } from '../../common/models/llm-models';
import { ApiResponse, ResponseType } from '../../common/models/response-models';
import type { ChatClient } from './llmProviderService';

type CustomApiEndpoints = Record<string, string> | undefined;

export class GeminiChatClient implements ChatClient {
    public async chat(request: LLMRequest): Promise<ApiResponse<LLMResponse | LLMError>> {
        const validationError = this.validate(request);
        if (validationError) {
            return validationError;
        }

        try {
            const model = this.createModel(request);
            const response = await model.generateContent(this.buildPayload(request));
            return this.buildSuccessResponse(request, response);
        } catch (error) {
            return this.buildErrorResponse(request, error);
        }
    }

    private validate(request: LLMRequest): ApiResponse<LLMError> | undefined {
        const messagesValid = Array.isArray(request.messages) && request.messages.length > 0;
        if (!messagesValid) {
            return this.buildErrorResponse(request, new Error('At least one message is required for Gemini chat.'));
        }

        const apiKey = this.getApiKey(request);
        if (!apiKey) {
            return this.buildErrorResponse(request, new Error('Gemini API key is missing.'));
        }

        if (!request.model) {
            return this.buildErrorResponse(request, new Error('Gemini model is required.'));
        }

        return undefined;
    }

    private createModel(request: LLMRequest) {
        const apiKey = this.getApiKey(request) as string;
        const clientOptions = this.buildClientOptions(request);
        const genAI = new GoogleGenerativeAI(apiKey);
        return genAI.getGenerativeModel({
            model: request.model,
            generationConfig: this.buildGenerationConfig(request)
        });
    }

    private buildClientOptions(request: LLMRequest) {
        const baseUrl = this.getBaseUrl(request.metadata?.customApiEndpoints);
        return baseUrl ? { baseUrl } : undefined;
    }

    private buildPayload(request: LLMRequest) {
        return {
            contents: this.transformMessages(request.messages)
        };
    }

    private transformMessages(messages: LLMMessage[]): Content[] {
        return messages.map((message) => ({
            role: this.mapRole(message.role),
            parts: [{ text: message.content ?? '' }]
        }));
    }

    private mapRole(role: LLMMessage['role']): string {
        switch (role) {
            case 'assistant':
                return 'model';
            case 'system':
                return 'user';
            default:
                return 'user';
        }
    }

    private buildGenerationConfig(request: LLMRequest) {
        const maxOutputTokens = this.resolveMaxTokens(request);
        return this.removeUndefined({
            temperature: request.temperature,
            topP: request.topP,
            topK: undefined,
            maxOutputTokens
        });
    }

    private buildSuccessResponse(request: LLMRequest, response: Awaited<ReturnType<ReturnType<GoogleGenerativeAI['getGenerativeModel']>['generateContent']>>): ApiResponse<LLMResponse> {
        const generatedText = this.extractText(response) ?? '';
        const usage = response.response?.usageMetadata;

        const payload: LLMResponse = {
            id: `gemini-${Date.now()}`,
            requestId: request.id,
            provider: request.provider,
            model: request.model,
            content: generatedText,
            usage: {
                promptTokens: usage?.promptTokenCount ?? 0,
                completionTokens: usage?.candidatesTokenCount ?? 0,
                totalTokens: usage?.totalTokenCount ?? 0
            },
            cost: 0,
            processingTime: 0,
            metadata: {
                rawResponse: response
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };

        return {
            type: ResponseType.SUCCESS,
            requestId: request.id,
            payload,
            timestamp: new Date()
        };
    }

    private buildErrorResponse(request: LLMRequest, error: unknown): ApiResponse<LLMError> {
        const normalizedError = error instanceof Error ? error : new Error('Unknown Gemini API error');
        const payload: LLMError = {
            id: `gemini-error-${Date.now()}`,
            requestId: request.id,
            provider: request.provider,
            model: request.model,
            error: normalizedError.message,
            errorCode: this.extractErrorCode(error),
            retryable: this.isRetryable(error),
            metadata: {
                rawError: error
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };

        return {
            type: ResponseType.ERROR,
            requestId: request.id,
            error: normalizedError.message,
            payload,
            timestamp: new Date()
        };
    }

    private extractText(response: Awaited<ReturnType<ReturnType<GoogleGenerativeAI['getGenerativeModel']>['generateContent']>>): string | undefined {
        try {
            return response.response?.text?.();
        } catch (error) {
            if (response.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
                return response.response.candidates[0].content.parts[0].text;
            }
            return undefined;
        }
    }

    private resolveMaxTokens(request: LLMRequest): number | undefined {
        if (typeof request.maxTokens === 'number') {
            return request.maxTokens;
        }

        const llmModels = request.metadata?.llmModels;
        const modelsForProvider = llmModels?.google;
        const matchedModel = Array.isArray(modelsForProvider)
            ? modelsForProvider.find((model: any) => model?.id === request.model)
            : undefined;

        return matchedModel?.maxTokens;
    }

    private getApiKey(request: LLMRequest): string | undefined {
        const apiKey = request.metadata?.apiKey;
        return typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : undefined;
    }

    private getBaseUrl(endpoints: CustomApiEndpoints): string | undefined {
        if (!endpoints) {
            return undefined;
        }

        const endpoint = endpoints.google ?? endpoints.gemini ?? endpoints.default;
        if (typeof endpoint !== 'string' || !endpoint.trim()) {
            return undefined;
        }

        try {
            const url = new URL(endpoint.trim());
            return url.toString();
        } catch (error) {
            return undefined;
        }
    }

    private removeUndefined<T extends Record<string, unknown>>(payload: T): T {
        return Object.fromEntries(
            Object.entries(payload).filter(([, value]) => value !== undefined)
        ) as T;
    }

    private extractErrorCode(error: unknown): string {
        if (typeof error === 'object' && error !== null && 'status' in error) {
            const status = (error as { status?: number }).status;
            return typeof status === 'number' ? `http_${status}` : 'unknown_error';
        }
        return 'unknown_error';
    }

    private isRetryable(error: unknown): boolean {
        if (typeof error === 'object' && error !== null && 'status' in error) {
            const status = (error as { status?: number }).status;
            return typeof status === 'number' && status >= 500;
        }
        return false;
    }
}


