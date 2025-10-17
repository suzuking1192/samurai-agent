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
            model: this.mapModelName(request.model),
            generationConfig: this.buildGenerationConfig(request)
        });
    }

    private mapModelName(modelId: string): string {
        // Map free tier model ID to actual Gemini API model name
        if (modelId === 'gemini-2.5-flash-free-tier') {
            return 'gemini-2.5-flash';
        }
        // Map beta testing model ID to actual Gemini API model name
        if (modelId === 'gemini-2.5-flash-beta') {
            return 'gemini-2.5-flash';
        }
        return modelId;
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
        console.log('[GEMINI BUILD GENERATION CONFIG DEBUG] GeminiChatClient - maxOutputTokens:', maxOutputTokens);
        return this.removeUndefined({
            temperature: request.temperature,
            topP: request.topP,
            topK: undefined,
            maxOutputTokens
        });
    }

    private buildSuccessResponse(request: LLMRequest, response: Awaited<ReturnType<ReturnType<GoogleGenerativeAI['getGenerativeModel']>['generateContent']>>): ApiResponse<LLMResponse> {
        console.log("=== GEMINI BUILD SUCCESS RESPONSE DEBUG START ===");
        console.log("Request details:", {
            requestId: request.id,
            provider: request.provider,
            model: request.model
        });

        const generatedText = this.extractText(response) ?? '';
        const usage = response.response?.usageMetadata;

        console.log("Response processing:", {
            generatedTextType: typeof generatedText,
            generatedTextLength: generatedText?.length || 0,
            generatedTextPreview: generatedText?.substring(0, 100) + (generatedText && generatedText.length > 100 ? '...' : ''),
            hasUsage: !!usage,
            usage: usage
        });

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

        console.log("Final payload:", {
            payloadId: payload.id,
            payloadContentType: typeof payload.content,
            payloadContentLength: payload.content?.length || 0,
            payloadContentPreview: payload.content?.substring(0, 100) + (payload.content && payload.content.length > 100 ? '...' : ''),
            payloadKeys: Object.keys(payload)
        });

        const result = {
            type: ResponseType.SUCCESS,
            requestId: request.id,
            payload,
            timestamp: new Date()
        };

        console.log("=== GEMINI BUILD SUCCESS RESPONSE DEBUG END ===");
        return result;
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
        console.log("=== GEMINI EXTRACT TEXT DEBUG START ===");
        console.log("Response structure:", {
            hasResponse: !!response.response,
            responseKeys: response.response ? Object.keys(response.response) : 'no response',
            hasText: !!response.response?.text,
            hasCandidates: !!response.response?.candidates,
            candidatesLength: response.response?.candidates?.length || 0
        });

        try {
            const text = response.response?.text?.();
            console.log("Text extraction result:", {
                textType: typeof text,
                textLength: text?.length || 0,
                textPreview: text?.substring(0, 100) + (text && text.length > 100 ? '...' : ''),
                fullText: text
            });
            console.log("=== GEMINI EXTRACT TEXT DEBUG END (SUCCESS) ===");
            return text;
        } catch (error) {
            console.warn("Text extraction failed, trying fallback:", error);
            
            // Try alternative extraction methods
            const candidates = response.response?.candidates;
            if (candidates && candidates.length > 0) {
                console.log("Trying candidates extraction:", {
                    candidatesCount: candidates.length,
                    firstCandidate: candidates[0]
                });
                
                for (let i = 0; i < candidates.length; i++) {
                    const candidate = candidates[i];
                    const content = candidate?.content;
                    const parts = content?.parts;
                    
                    console.log(`Candidate ${i}:`, {
                        hasContent: !!content,
                        hasParts: !!parts,
                        partsLength: parts?.length || 0,
                        hasFinishReason: !!candidate.finishReason,
                        finishReason: candidate.finishReason,
                        hasSafetyRatings: !!candidate.safetyRatings,
                        safetyRatings: candidate.safetyRatings
                    });

                    // Check for safety-related blocks
                    if (candidate.finishReason === 'SAFETY') {
                        console.warn(`⚠️ GEMINI SAFETY BLOCK: Candidate ${i} was blocked due to safety concerns`);
                    }

                    if (candidate.finishReason === 'RECITATION') {
                        console.warn(`⚠️ GEMINI RECITATION BLOCK: Candidate ${i} was blocked due to recitation concerns`);
                    }

                    if (candidate.finishReason === 'OTHER') {
                        console.warn(`⚠️ GEMINI OTHER BLOCK: Candidate ${i} was blocked for other reasons`);
                    }

                    if (candidate.safetyRatings) {
                        console.log(`Candidate ${i} safety ratings:`, candidate.safetyRatings.map((rating: any) => ({
                            category: rating.category,
                            probability: rating.probability,
                            blocked: rating.blocked
                        })));
                    }
                    
                    if (parts && parts.length > 0) {
                        for (let j = 0; j < parts.length; j++) {
                            const part = parts[j];
                            console.log(`Part ${j}:`, {
                                hasText: !!part?.text,
                                textType: typeof part?.text,
                                textLength: part?.text?.length || 0,
                                textPreview: part?.text?.substring(0, 100) + (part?.text && part.text.length > 100 ? '...' : '')
                            });
                            
                            if (part?.text) {
                                console.log("=== GEMINI EXTRACT TEXT DEBUG END (FALLBACK SUCCESS) ===");
                                return part.text;
                            }
                        }
                    }
                }
            }
            
            console.warn("All text extraction methods failed");
            console.log("=== GEMINI EXTRACT TEXT DEBUG END (FAILED) ===");
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
        // Check for rate limit/quota errors
        if (this.isRateLimitError(error)) {
            return 'RATE_LIMIT_EXCEEDED';
        }

        if (typeof error === 'object' && error !== null && 'status' in error) {
            const status = (error as { status?: number }).status;
            return typeof status === 'number' ? `http_${status}` : 'unknown_error';
        }
        return 'unknown_error';
    }

    private isRateLimitError(error: unknown): boolean {
        if (typeof error !== 'object' || error === null) {
            return false;
        }

        // Check HTTP status code 429 (Too Many Requests)
        if ('status' in error) {
            const status = (error as { status?: number }).status;
            if (status === 429) {
                return true;
            }
        }

        // Check error message for rate limit/quota patterns
        const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
        const rateLimitPatterns = [
            'quota exceeded',
            'rate limit',
            'resource exhausted',
            'too many requests',
            'resource_exhausted'
        ];

        return rateLimitPatterns.some(pattern => errorMessage.includes(pattern));
    }

    private isRetryable(error: unknown): boolean {
        if (typeof error === 'object' && error !== null && 'status' in error) {
            const status = (error as { status?: number }).status;
            return typeof status === 'number' && status >= 500;
        }
        return false;
    }
}


