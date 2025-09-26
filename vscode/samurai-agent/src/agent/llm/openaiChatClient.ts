import OpenAI from 'openai';
import { LLMRequest, LLMResponse, LLMError, LLMMessage } from '../../common/models/llm-models';
import { ApiResponse, ResponseType } from '../../common/models/response-models';
import type { ChatClient } from './llmProviderService';

type CustomApiEndpoints = Record<string, string> | undefined;

export class OpenAIChatClient implements ChatClient {
    public async chat(request: LLMRequest): Promise<ApiResponse<LLMResponse | LLMError>> {
        const validationError = this.validate(request);
        if (validationError) {
            return validationError;
        }

        const client = this.buildClient(request);
        const payload = this.buildChatCompletionPayload(request);

        const startTime = Date.now();
        try {
            const response = await client.chat.completions.create(payload);
            const elapsed = Date.now() - startTime;
            return this.buildSuccessResponse(request, response, elapsed);
        } catch (error) {
            return this.buildErrorResponse(request, error);
        }
    }

    private validate(request: LLMRequest): ApiResponse<LLMError> | undefined {
        const hasMessages = Array.isArray(request.messages) && request.messages.length > 0;
        if (!hasMessages) {
            return this.buildErrorResponse(request, new Error('At least one message is required for OpenAI chat.'));
        }

        const apiKey = this.getApiKey(request);
        if (!apiKey) {
            return this.buildErrorResponse(request, new Error('OpenAI API key is missing.'));
        }

        if (!request.model) {
            return this.buildErrorResponse(request, new Error('OpenAI model is required.'));
        }

        return undefined;
    }

    private buildClient(request: LLMRequest): OpenAI {
        const baseURL = this.getBaseUrl(request.metadata?.customApiEndpoints);
        const configuration: any = {
            apiKey: this.getApiKey(request)
        };

        if (baseURL) {
            configuration.baseURL = baseURL;
        }

        return new OpenAI(configuration);
    }

    private buildChatCompletionPayload(request: LLMRequest): any {
        const messages = this.transformMessages(request.messages);
        const maxTokens = this.resolveMaxTokens(request);
        const payload: any = {
            model: request.model,
            messages,
            temperature: request.temperature,
            top_p: request.topP,
            frequency_penalty: request.frequencyPenalty,
            presence_penalty: request.presencePenalty,
            stream: request.stream
        };

        if (maxTokens !== undefined) {
            payload.max_tokens = maxTokens;
        }

        return this.removeUndefined(payload);
    }

    private buildSuccessResponse(
        request: LLMRequest,
        response: any,
        elapsedMs: number
    ): ApiResponse<LLMResponse> {
        const completion = response.choices?.[0]?.message?.content ?? '';
        const usage = response.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        const payload: LLMResponse = {
            id: response.id ?? `openai-${Date.now()}`,
            requestId: request.id,
            provider: request.provider,
            model: response.model ?? request.model,
            content: completion,
            usage: {
                promptTokens: usage.prompt_tokens ?? 0,
                completionTokens: usage.completion_tokens ?? 0,
                totalTokens: usage.total_tokens ?? 0
            },
            cost: 0,
            processingTime: elapsedMs,
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
        const normalizedError = error instanceof Error ? error : new Error('Unknown OpenAI API error');
        const payload: LLMError = {
            id: `openai-error-${Date.now()}`,
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

    private transformMessages(messages: LLMMessage[]): any[] {
        return messages.map((message) => ({
            role: message.role,
            content: message.content ?? ''
        }));
    }

    private resolveMaxTokens(request: LLMRequest): number | undefined {
        const maxTokens = typeof request.maxTokens === 'number' ? request.maxTokens : undefined;
        if (maxTokens !== undefined) {
            return maxTokens;
        }

        const llmModels = request.metadata?.llmModels;
        const modelsForProvider = llmModels?.openai;
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

        const endpoint = endpoints.openai ?? endpoints.default;
        return typeof endpoint === 'string' && endpoint.trim() ? endpoint.trim() : undefined;
    }

    private removeUndefined<T extends Record<string, unknown>>(payload: T): T {
        const cleanedEntries = Object.entries(payload).filter(([, value]) => value !== undefined);
        return Object.fromEntries(cleanedEntries) as T;
    }

    private extractErrorCode(error: unknown): string {
        if (typeof error === 'object' && error !== null && 'code' in error) {
            const code = (error as { code?: string }).code;
            if (typeof code === 'string') {
                return code;
            }
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


