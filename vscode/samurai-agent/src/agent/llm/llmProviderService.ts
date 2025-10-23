import { GlobalDataStore } from "../../persistence/globalDataStore";
import { DataStore } from "../../persistence/dataStore";
import {
  LLMRequest,
  LLMResponse,
  LLMError,
  LLMMessage,
} from "../../common/models/llm-models";
import { ApiResponse, ResponseType } from "../../common/models/response-models";
import { LLM_MODELS } from "../../common/constants/llm-models";
import { FREE_TIER_GEMINI_API_KEY, BETA_GEMINI_API_KEY, VALID_BETA_CODE, BETA_MONTHLY_LIMIT } from "../../common/constants/llm-constants";
import { ProjectSettings } from "../../common/models/settings-models";
import { calculateLLMCost } from "../../common/utils/llmCostCalculator";
import { GeminiBetaProxyClient } from "./GeminiBetaProxyClient";

export interface ChatClient {
  chat(request: LLMRequest): Promise<ApiResponse<LLMResponse | LLMError>>;
}

export class LLMProviderService {
  private clients: Map<string, ChatClient>;
  private cachedGlobalSettings: any | undefined;
  private proxyClient: GeminiBetaProxyClient | null = null;

  constructor(
    private readonly globalDataStore: GlobalDataStore,
    private readonly dataStore?: DataStore,
    clients?: Map<string, ChatClient>,
    private readonly llmCostStorage?: any,
  ) {
    this.clients = clients ?? new Map();
  }

  public registerClient(provider: string, client: ChatClient): void {
    this.clients.set(provider.toLowerCase(), client);
  }

  public getCachedGlobalSettings(): any | undefined {
    return this.cachedGlobalSettings;
  }

  /**
   * Get or create the proxy client for beta requests
   */
  private getOrCreateProxyClient(): GeminiBetaProxyClient {
    if (!this.proxyClient) {
      this.proxyClient = new GeminiBetaProxyClient(this.globalDataStore);
    }
    return this.proxyClient;
  }

  /**
   * Fallback logic when beta model fails or monthly limit is exceeded
   * Tries user's own key first, then free tier
   */
  private async fallbackFromBetaModel(
    modelRequest: LLMRequest, 
    globalSettings: any
  ): Promise<ApiResponse<LLMResponse | LLMError>> {
    console.log('[LLMProviderService] Attempting fallback from beta model');
    
    // Try user's own Gemini API key first
    if (globalSettings.geminiApiKey?.trim()) {
      console.log('[LLMProviderService] Falling back to user\'s gemini-2.5-flash key');
      modelRequest.model = 'gemini-2.5-flash';
      modelRequest.metadata = { 
        ...modelRequest.metadata, 
        apiKey: globalSettings.geminiApiKey,
        fallbackReason: 'beta_proxy_failed'
      };
      
      // Execute with user's key
      const client = this.clients.get('google');
      if (client) {
        const response = await client.chat(modelRequest);
        this.trackProxyTelemetry(false, 'PROXY_ERROR', undefined, 'gemini-2.5-flash');
        return response;
      }
    }
    
    // Fall back to free tier
    console.log('[LLMProviderService] Falling back to gemini-2.5-flash-free-tier');
    modelRequest.model = 'gemini-2.5-flash-free-tier';
    modelRequest.metadata = { 
      ...modelRequest.metadata, 
      apiKey: FREE_TIER_GEMINI_API_KEY,
      fallbackReason: 'beta_proxy_failed'
    };
    
    const client = this.clients.get('google');
    if (client) {
      const response = await client.chat(modelRequest);
      this.trackProxyTelemetry(false, 'PROXY_ERROR', undefined, 'gemini-2.5-flash-free-tier');
      return response;
    }
    
    // This should not happen, but handle gracefully
    return this.createErrorResponse(
      'No fallback client available for Gemini requests',
      modelRequest.id
    );
  }

  /**
   * Track proxy telemetry events
   */
  private trackProxyTelemetry(
    success: boolean, 
    errorCode?: string, 
    latencyMs?: number, 
    fallbackModel?: string
  ): void {
    // Get telemetry service from globalDataStore if available
    const telemetryService = (this.globalDataStore as any).telemetryService;
    if (telemetryService && typeof telemetryService.trackGeminiBetaProxyCall === 'function') {
      telemetryService.trackGeminiBetaProxyCall(success, errorCode, latencyMs, fallbackModel)
        .catch((error: any) => {
          console.error('[LLMProviderService] Error tracking proxy telemetry:', error);
        });
    }
  }

  public async chat(
    request: LLMRequest,
  ): Promise<ApiResponse<LLMResponse | LLMError>> {
    const globalSettingsResponse = this.globalDataStore.loadGlobalSettings();
    if (
      globalSettingsResponse.type !== ResponseType.SUCCESS ||
      !globalSettingsResponse.payload
    ) {
      return this.createErrorResponse(
        "Global settings could not be loaded",
        request.id,
      );
    }
    const globalSettings = globalSettingsResponse.payload;
    this.cachedGlobalSettings = globalSettings;

    const projectSettings = this.getProjectSettings();
    const provider = this.resolveProvider(
      request.provider,
      globalSettings,
      projectSettings,
      request.metadata?.targetProvider,
    );
    if (!provider) {
      return this.createErrorResponse(
        "No LLM provider is configured with an API key",
        request.id,
      );
    }

    const client = this.clients.get(provider);
    if (!client) {
      return this.createErrorResponse(
        `No client registered for provider ${provider}`,
        request.id,
      );
    }

    const primaryModel = this.resolvePrimaryModel(
      projectSettings,
      provider,
      request.model,
      globalSettings,
    );

    const apiKey = this.getApiKeyForProvider(provider, globalSettings, primaryModel || request.model);
    if (!apiKey) {
      return this.createErrorResponse(
        `No API key configured for provider ${provider}`,
        request.id,
      );
    }

    const normalizedMessages = this.normalizeMessages(
      request.messages,
      apiKey,
      provider,
    );

    const modelRequest: LLMRequest = {
      ...request,
      provider,
      model: primaryModel || request.model,
      messages: normalizedMessages,
      metadata: {
        ...request.metadata,
        apiKey,
        provider,
        customApiEndpoints: globalSettings.customApiEndpoints,
        llmModels: LLM_MODELS,
      },
    };

    if (provider === "google" && request.maxTokens) {
      modelRequest.maxTokens = request.maxTokens;
    }
    
    // Beta mode enforcement - route through proxy
    if (modelRequest.model === 'gemini-2.5-flash-beta') {
      const isBetaCodeValid = globalSettings.betaCode?.trim() === VALID_BETA_CODE;
      
      if (!isBetaCodeValid) {
        return this.createErrorResponse(
          "Beta Testing requires a valid beta code. Please check your settings.",
          request.id,
        );
      }
      
      // Check monthly limit
      if (this.llmCostStorage) {
        const betaMonthlyCost = this.llmCostStorage.getMonthlyCostForBetaUsers();
        if (betaMonthlyCost >= BETA_MONTHLY_LIMIT) {
          // Fallback: use user's own key if available, otherwise free tier
          return await this.fallbackFromBetaModel(modelRequest, globalSettings);
        }
      }
      
      // Use proxy client for beta requests
      const proxyStartTime = Date.now();
      try {
        const proxyClient = this.getOrCreateProxyClient();
        const response = await proxyClient.chat(modelRequest);
        
        if (response.type === ResponseType.SUCCESS) {
          // Track successful proxy call
          const latency = Date.now() - proxyStartTime;
          this.trackProxyTelemetry(true, undefined, latency);
          return response;
        }
        
        // Proxy returned error - attempt fallback
        console.error('[LLMProviderService] Proxy error, attempting fallback:', response);
        const latency = Date.now() - proxyStartTime;
        const errorCode = response.payload && 'errorCode' in response.payload ? response.payload.errorCode : 'UNKNOWN_ERROR';
        this.trackProxyTelemetry(false, errorCode, latency);
        return await this.fallbackFromBetaModel(modelRequest, globalSettings);
        
      } catch (error) {
        console.error('[LLMProviderService] Proxy call failed, attempting fallback:', error);
        const latency = Date.now() - proxyStartTime;
        this.trackProxyTelemetry(false, 'PROXY_ERROR', latency);
        return await this.fallbackFromBetaModel(modelRequest, globalSettings);
      }
    }
    
    // Execute the LLM request
    const response = await client.chat(modelRequest);
    
    // Check for rate limit errors on free tier model
    if (response.type === ResponseType.ERROR && response.payload) {
      const llmError = response.payload as LLMError;
      if (
        llmError.errorCode === 'RATE_LIMIT_EXCEEDED' &&
        modelRequest.model === 'gemini-2.5-flash-free-tier'
      ) {
        // Customize error message for free tier rate limit
        const customMessage = 'free tier daily limit is reached, please set your own LLM API key and select different model';
        llmError.error = customMessage;
        response.error = customMessage;
      }
    }
    
    // Calculate and add cost if response is successful
    if (response.type === ResponseType.SUCCESS && response.payload) {
      const llmResponse = response.payload as LLMResponse;
      
      console.log('[COST DEBUG] LLMProviderService - before cost calculation:', {
        provider: llmResponse.provider,
        model: llmResponse.model,
        usage: llmResponse.usage,
        hasUsage: !!llmResponse.usage,
        promptTokens: llmResponse.usage?.promptTokens,
        completionTokens: llmResponse.usage?.completionTokens
      });
      
      // Calculate cost based on token usage
      const costCalculation = calculateLLMCost({
        provider: llmResponse.provider,
        model: llmResponse.model,
        promptTokens: llmResponse.usage.promptTokens,
        completionTokens: llmResponse.usage.completionTokens,
      });
      
      console.log('[COST DEBUG] LLMProviderService - cost calculation result:', {
        costCalculation,
        totalCost: costCalculation.totalCost,
        promptCost: costCalculation.promptCost,
        completionCost: costCalculation.completionCost
      });
      
      // Update the response with calculated cost
      llmResponse.cost = costCalculation.totalCost;
      
      console.log('[COST DEBUG] LLMProviderService - updated llmResponse.cost to:', llmResponse.cost);
      
      // Add cost breakdown to metadata for debugging/transparency
      llmResponse.metadata = {
        ...llmResponse.metadata,
        costBreakdown: {
          promptCost: costCalculation.promptCost,
          completionCost: costCalculation.completionCost,
          pricing: costCalculation.pricing,
        },
      };
    } else {
      console.log('[COST DEBUG] LLMProviderService - NOT calculating cost, response type:', response.type);
    }
    
    return response;
  }

  private resolveProvider(
    requestedProvider: string | undefined,
    globalSettings: any,
    projectSettings?: ProjectSettings,
    preferredProvider?: string,
  ): string | undefined {
    const normalizedRequested = this.normalizeProviderId(requestedProvider);
    const providersWithKeys = this.getProvidersWithKeys(globalSettings);

    if (normalizedRequested && normalizedRequested !== "auto") {
      return normalizedRequested;
    }

    const normalizedPreferred = this.normalizeProviderId(preferredProvider);
    if (
      normalizedPreferred &&
      normalizedPreferred !== "auto" &&
      providersWithKeys.includes(normalizedPreferred)
    ) {
      return normalizedPreferred;
    }

    const providerFromProjectModel = this.findProviderForModel(
      projectSettings?.primaryLLMModel,
    );
    if (
      providerFromProjectModel &&
      providersWithKeys.includes(providerFromProjectModel)
    ) {
      return providerFromProjectModel;
    }

    const providerFromDefaultModel = this.findProviderForModel(
      globalSettings?.defaultModel,
    );
    if (
      providerFromDefaultModel &&
      providersWithKeys.includes(providerFromDefaultModel)
    ) {
      return providerFromDefaultModel;
    }

    const defaultProvider = this.normalizeProviderId(
      globalSettings?.defaultProvider,
    );
    if (defaultProvider && providersWithKeys.includes(defaultProvider)) {
      return defaultProvider;
    }

    return providersWithKeys[0];
  }

  private getApiKeyForProvider(
    provider: string,
    globalSettings: any,
    model?: string,
  ): string | undefined {
    // Always use hardcoded API key for free tier model
    if (model === 'gemini-2.5-flash-free-tier') {
      return FREE_TIER_GEMINI_API_KEY;
    }
    
    // Use dedicated beta API key for beta testing model
    if (model === 'gemini-2.5-flash-beta') {
      return BETA_GEMINI_API_KEY;
    }

    switch (provider) {
      case "openai":
        return globalSettings.openaiApiKey;
      case "google":
      case "gemini":
        return globalSettings.geminiApiKey;
      case "anthropic":
      case "claude":
        return globalSettings.claudeApiKey;
      default:
        return undefined;
    }
  }

  private getProjectSettings(): ProjectSettings | undefined {
    if (!this.dataStore) {
      return undefined;
    }
    const response = this.dataStore.readProjectSettings();
    return response.type === ResponseType.SUCCESS
      ? response.payload
      : undefined;
  }

  private resolvePrimaryModel(
    projectSettings: ProjectSettings | undefined,
    provider: string,
    requestedModel: string | undefined,
    globalSettings: any,
  ): string | undefined {
    if (requestedModel) {
      return requestedModel;
    }

    if (!projectSettings) {
      return this.selectFirstAvailableModel(provider);
    }

    if (projectSettings.primaryLLMModel) {
      return projectSettings.primaryLLMModel;
    }

    const providersWithKeys = this.getProvidersWithKeys(globalSettings);
    if (providersWithKeys.length > 1) {
      const sortedProviders = [...providersWithKeys].sort();
      const defaultProvider = sortedProviders[0];
      return this.selectFirstAvailableModel(defaultProvider);
    }

    return this.selectFirstAvailableModel(provider);
  }

  private getProvidersWithKeys(globalSettings?: any): string[] {
    if (!globalSettings) {
      const response = this.globalDataStore.loadGlobalSettings();
      if (response.type !== ResponseType.SUCCESS || !response.payload) {
        return [];
      }
      globalSettings = response.payload;
    }
    const providers: string[] = [];
    if (globalSettings?.openaiApiKey) {
      providers.push("openai");
    }
    // Always include google provider since free tier model is always available
    providers.push("google");
    if (globalSettings?.claudeApiKey) {
      providers.push("anthropic");
    }
    return providers;
  }


  private findProviderForModel(
    modelId: string | null | undefined,
  ): string | undefined {
    if (!modelId) {
      return undefined;
    }
    const normalized = modelId.toLowerCase();
    for (const [provider, models] of Object.entries(LLM_MODELS)) {
      if (models.some((model) => model.id.toLowerCase() === normalized)) {
        return provider;
      }
    }
    return undefined;
  }

  private normalizeProviderId(provider?: string): string | undefined {
    if (!provider) {
      return undefined;
    }
    const lower = provider.toLowerCase();
    switch (lower) {
      case "gemini":
        return "google";
      case "claude":
        return "anthropic";
      default:
        return lower;
    }
  }

  private selectFirstAvailableModel(provider: string): string | undefined {
    const normalizedProvider = provider === "gemini" ? "google" : provider;
    const models = LLM_MODELS[normalizedProvider];
    return models?.[0]?.id;
  }

  private normalizeMessages(
    messages: LLMMessage[],
    apiKey: string,
    provider: string,
  ): LLMMessage[] {
    return messages.map((message, index) => ({
      ...message,
      metadata: {
        ...message.metadata,
        apiKey,
        provider,
        order: index,
      },
    }));
  }

  private createErrorResponse(
    message: string,
    requestId?: string,
  ): ApiResponse<LLMError> {
    return {
      type: ResponseType.ERROR,
      requestId,
      error: message,
      timestamp: new Date(),
    };
  }
}
