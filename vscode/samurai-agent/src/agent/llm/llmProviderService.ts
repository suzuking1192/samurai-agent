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
import { ProjectSettings } from "../../common/models/settings-models";
import { calculateLLMCost } from "../../common/utils/llmCostCalculator";

export interface ChatClient {
  chat(request: LLMRequest): Promise<ApiResponse<LLMResponse | LLMError>>;
}

export class LLMProviderService {
  private clients: Map<string, ChatClient>;
  private cachedGlobalSettings: any | undefined;

  constructor(
    private readonly globalDataStore: GlobalDataStore,
    private readonly dataStore?: DataStore,
    clients?: Map<string, ChatClient>,
  ) {
    this.clients = clients ?? new Map();
  }

  public registerClient(provider: string, client: ChatClient): void {
    this.clients.set(provider.toLowerCase(), client);
  }

  public getCachedGlobalSettings(): any | undefined {
    return this.cachedGlobalSettings;
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

    const apiKey = this.getApiKeyForProvider(provider, globalSettings);
    if (!apiKey) {
      return this.createErrorResponse(
        `No API key configured for provider ${provider}`,
        request.id,
      );
    }

    const primaryModel = this.resolvePrimaryModel(
      projectSettings,
      provider,
      request.model,
      globalSettings,
    );

    const normalizedMessages = this.normalizeMessages(
      request.messages,
      apiKey,
      provider,
    );

    const projectMaxTokens = this.getProjectMaxTokens(projectSettings);

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

    if (projectMaxTokens && projectMaxTokens > 0) {
      modelRequest.maxTokens = projectMaxTokens;
    }

    // Execute the LLM request
    const response = await client.chat(modelRequest);
    
    // Calculate and add cost if response is successful
    if (response.type === ResponseType.SUCCESS && response.payload) {
      const llmResponse = response.payload as LLMResponse;
      
      // Calculate cost based on token usage
      const costCalculation = calculateLLMCost({
        provider: llmResponse.provider,
        model: llmResponse.model,
        promptTokens: llmResponse.usage.promptTokens,
        completionTokens: llmResponse.usage.completionTokens,
      });
      
      // Update the response with calculated cost
      llmResponse.cost = costCalculation.totalCost;
      
      // Add cost breakdown to metadata for debugging/transparency
      llmResponse.metadata = {
        ...llmResponse.metadata,
        costBreakdown: {
          promptCost: costCalculation.promptCost,
          completionCost: costCalculation.completionCost,
          pricing: costCalculation.pricing,
        },
      };
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
  ): string | undefined {
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
    if (globalSettings?.geminiApiKey) {
      providers.push("google");
    }
    if (globalSettings?.claudeApiKey) {
      providers.push("anthropic");
    }
    return providers;
  }

  private getProjectMaxTokens(
    projectSettings?: ProjectSettings,
  ): number | undefined {
    return projectSettings?.projectSpecificConfig?.maxTokensPerRequest;
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
