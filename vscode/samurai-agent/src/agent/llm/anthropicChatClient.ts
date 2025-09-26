import Anthropic from '@anthropic-ai/sdk';
import { URL } from 'url';
import { LLMRequest, LLMResponse, LLMError, LLMMessage } from '../../common/models/llm-models';
import { ApiResponse, ResponseType } from '../../common/models/response-models';
import type { ChatClient } from './llmProviderService';

type CustomApiEndpoints = Record<string, string> | undefined;

export class AnthropicChatClient implements ChatClient {
    public async chat(request: LLMRequest): Promise<ApiResponse<LLMResponse | LLMError>> {
        const validationError = this.validate(request);
        if (validationError) {
            return validationError;
        }

        try {
            const client = this.createClient(request);
            const payload = this.buildMessagesPayload(request);
            const response = await client.messages.create(payload);
            return this.buildSuccessResponse(request, response);
        } catch (error) {
            return this.buildErrorResponse(request, error);
        }
    }

    private validate(request: LLMRequest): ApiResponse<LLMError> | undefined {
        if (!Array.isArray(request.messages) || request.messages.length === 0) {
            return this.buildErrorResponse(request, new Error('At least one message is required for Anthropic chat.'));
        }

        const apiKey = this.getApiKey(request);
        if (!apiKey) {
            return this.buildErrorResponse(request, new Error('Anthropic API key is missing.'));
        }

        if (!request.model) {
            return this.buildErrorResponse(request, new Error('Anthropic model is required.'));
        }

        return undefined;
    }

    private createClient(request: LLMRequest): Anthropic {
        const configuration: any = {
            apiKey: this.getApiKey(request)
        };

        const baseUrl = this.getBaseUrl(request.metadata?.customApiEndpoints);
        if (baseUrl) {
            configuration.baseURL = baseUrl;
        }

        return new Anthropic(configuration);
    }

    private buildMessagesPayload(request: LLMRequest): any {
        const maxTokens = this.resolveMaxTokens(request);
        return this.removeUndefined({
            model: request.model,
            temperature: request.temperature,
            max_tokens: maxTokens ?? 1024,
            messages: this.transformMessages(request.messages)
        });
    }

    private transformMessages(messages: LLMMessage[]): Anthropic.Messages.MessageParam[] {
        return messages.map((message) => ({
            role: this.mapRole(message.role),
            content: [
                {
                    type: 'text',
                    text: message.content ?? ''
                }
            ]
        }));
    }

    private mapRole(role: LLMMessage['role']): 'user' | 'assistant' {
        return role === 'assistant' ? 'assistant' : 'user';
    }

    private buildSuccessResponse(
        request: LLMRequest,
        response: any
    ): ApiResponse<LLMResponse> {
        const firstContent = response.content?.[0];
        const text = firstContent?.type === 'text' ? firstContent.text : '';

        const usage = response.usage;

        const payload: LLMResponse = {
            id: response.id ?? `anthropic-${Date.now()}`,
            requestId: request.id,
            provider: request.provider,
            model: response.model ?? request.model,
            content: text,
            usage: {
                promptTokens: usage?.input_tokens ?? 0,
                completionTokens: usage?.output_tokens ?? 0,
                totalTokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0)
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
        const normalizedError = error instanceof Error ? error : new Error('Unknown Anthropic API error');
        const payload: LLMError = {
            id: `anthropic-error-${Date.now()}`,
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

    private resolveMaxTokens(request: LLMRequest): number | undefined {
        if (typeof request.maxTokens === 'number') {
            return request.maxTokens;
        }

        const llmModels = request.metadata?.llmModels;
        const modelsForProvider = llmModels?.anthropic;
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

        const endpoint = endpoints.anthropic ?? endpoints.claude ?? endpoints.default;
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


