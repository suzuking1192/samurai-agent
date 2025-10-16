import { randomUUID } from "crypto";
import * as path from "path";
import {
  ToolDefinition,
  ToolExecutionResult,
} from "../../common/models/tool-models";
import {
  LLMMessage,
  LLMRequest,
  LLMResponse,
} from "../../common/models/llm-models";
import { LLMProviderService } from "../llm/llmProviderService";
import { CodeParserService } from "../code_parser/CodeParserService";
import { CodeElement, FileInfo } from "../../common/models/context-models";
import { ResponseType } from "../../common/models/response-models";
import { TextDecoder } from "util";
import * as vscode from "vscode";
import { extractJsonFromLLMResponse } from "../../common/utils/llmResponseParser";
import { TelemetryService } from "../../services/TelemetryService";
import { RecentFilesTracker } from "../../services/RecentFilesTracker";

const DEFAULT_MAX_ITERATIONS = 2;
const DEFAULT_MAX_FILES = 5000;
const DEFAULT_MAX_RESULTS = 300;
const GLOBAL_CONTEXT_TOKEN_LIMIT = 300000; // Global limit for all files combined

type NormalizedExtractCodeParameters = ExtractCodeParameters & {
  query: string;
  projectId: string;
  maxIterations: number;
  model: string;
  filenameKeywords: string[];
  methodNameKeywords: string[];
  codeKeywords: string[];
  maxDependencyDepth: number;
  manuallyPinnedFilePaths: string[];
};

export interface ExtractCodeToolResultPayload {
  relevantCodeElements: Array<{
    path: string;
    elements: CodeElement[];
    snippet: string;
  }>;
  files: Array<{
    path: string;
    snippet: string;
  }>;
}

export interface ExtractCodeParameters {
  query: string;
  filePathPattern?: string;
  projectId: string;
  connectedCodebasePath?: string;
  sessionId?: string;
  maxIterations?: number;
  model?: string; // User's selected model
  filenameKeywords?: string[];
  methodNameKeywords?: string[];
  codeKeywords?: string[];
  maxDependencyDepth?: number; // Maximum depth for recursive dependency resolution (default: 3)
  manuallyPinnedFilePaths?: string[]; // Optional array of absolute file paths to unconditionally include
}

export class ExtractCodeTool {
  public readonly definition: ToolDefinition = {
    id: randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "extract_relevant_code",
    description:
      "Extracts code snippets relevant to the provided query. Placeholder implementation.",
      parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Description of the code to extract.",
        },
        filePathPattern: {
          type: "string",
          description: "Optional glob or regex pattern to narrow file search.",
        },
          projectId: {
            type: "string",
            description: "Identifier of the current project for LLM routing and persistence.",
          },
          connectedCodebasePath: {
            type: "string",
            description: "Absolute path to the connected codebase root.",
          },
          sessionId: {
            type: "string",
            description: "Optional session identifier for associating extracted context.",
          },
          maxIterations: {
            type: "number",
            description: "Maximum number of iterative refinement passes to run.",
            default: DEFAULT_MAX_ITERATIONS,
          },
          model: {
            type: "string",
            description: "User's selected LLM model for code extraction.",
          },
          filenameKeywords: {
            type: "array",
            items: { type: "string" },
            description: "Optional array of keywords to match against filenames.",
          },
          methodNameKeywords: {
            type: "array",
            items: { type: "string" },
            description: "Optional array of keywords to match against method/function names.",
          },
          codeKeywords: {
            type: "array",
            items: { type: "string" },
            description: "Optional array of keywords to match against file content.",
          },
          maxDependencyDepth: {
            type: "number",
            description: "Maximum depth for recursive dependency resolution. Higher values find more transitive dependencies but take longer.",
            default: 3,
          },
      },
      required: ["query", "projectId"],
      additionalProperties: false,
    },
    required: ["query", "projectId"],
    category: "code_analysis",
    enabled: true,
    metadata: {},
  };

  constructor(
    private readonly llmProvider: LLMProviderService,
    private readonly codeParser: CodeParserService = new CodeParserService(),
    private readonly telemetryService: TelemetryService,
  ) {}

  public async execute(
    params: ExtractCodeParameters,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const normalizedParams = this.normalizeParams(params);
      this.logInvocation(normalizedParams);

      const fileInfos = await this.scanCodebase(normalizedParams);
      const filteredFileInfos = this.filterFileInfos(
        fileInfos,
        normalizedParams.filePathPattern,
      );

      if (!filteredFileInfos.size) {
        throw new Error("No code files found that match the provided parameters.");
      }

      // Process pinned files early
      const workspaceRoot = normalizedParams.connectedCodebasePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      const pinnedFileInfos = await this.processPinnedFiles(
        normalizedParams.manuallyPinnedFilePaths,
        workspaceRoot
      );

      // Merge pinned files into filteredFileInfos
      const mergedFileInfos = new Map([...filteredFileInfos, ...pinnedFileInfos]);
      console.log(`ExtractCodeTool: Total files after pinning: ${mergedFileInfos.size} (pinned: ${pinnedFileInfos.size})`);

      const relevantElementSelections = await this.rankRelevantFileswithLLM(
        mergedFileInfos,
        normalizedParams.query,
        normalizedParams.projectId,
        normalizedParams.model,
      );

      // NEW: Resolve missing dependencies identified by LLM
      const enrichedFileInfos = await this.resolveMissingDependencies(
        relevantElementSelections,
        mergedFileInfos,
        workspaceRoot,
        normalizedParams.maxDependencyDepth
      );

      console.log(`ExtractCodeTool: Enriched file count: ${enrichedFileInfos.size} (original: ${mergedFileInfos.size})`);

      // Use enrichedFileInfos for all subsequent operations
      const keywordSelections = await this.performKeywordBasedSearch(
        enrichedFileInfos,
        normalizedParams,
      );

      const mergedSelections = this.mergeKeywordAndLLMSelections(
        relevantElementSelections,
        keywordSelections,
      );

      let structuredContext = await this.buildStructuredCodeContextSnippets(
        enrichedFileInfos,
        mergedSelections,
        GLOBAL_CONTEXT_TOKEN_LIMIT,
        normalizedParams.manuallyPinnedFilePaths,
      );

      if (structuredContext.length === 0) {
        const fallbackSelections = this.heuristicFallbackSelections(
          enrichedFileInfos,
          normalizedParams.query,
        );

        if (fallbackSelections.size) {
          structuredContext = await this.buildStructuredCodeContextSnippets(
            enrichedFileInfos,
            fallbackSelections,
            GLOBAL_CONTEXT_TOKEN_LIMIT,
            normalizedParams.manuallyPinnedFilePaths,
          );
        }
      }

      if (structuredContext.length === 0) {
        throw new Error("No relevant code elements found for the given query.");
      }

      console.log("ExtractCodeTool: Structured context prepared", structuredContext.map(ctx => ({
        path: ctx.path,
        elementNames: ctx.elements.map(el => `${el.type}:${el.name}`),
        snippetPreview: ctx.snippet.slice(0, 120),
      })));

      const relevantElementSelections_after_step2 = await this.identifyRelevantCodeElementsWithLLM(
        enrichedFileInfos,
        structuredContext,
        normalizedParams,
      );

      let structuredContext_after_step2 = await this.buildStructuredCodeContextSnippets(
        enrichedFileInfos,
        relevantElementSelections_after_step2,
        GLOBAL_CONTEXT_TOKEN_LIMIT,
      );

      const executionTime = Date.now() - startTime;
      
      // Extract identified elements for the result
      const identifiedElements: Array<{
        name: string;
        type: string;
        lineStart: number;
        filePath: string;
        signature?: string;
      }> = [];
      
      for (const context of structuredContext_after_step2) {
        for (const element of context.elements) {
          identifiedElements.push({
            name: element.name,
            type: element.type,
            lineStart: element.lineStart,
            filePath: element.filePath,
            signature: element.signature,
          });
        }
      }

      return {
        success: true,
        result: {
          relevantCodeElements: structuredContext_after_step2,
          files: structuredContext_after_step2.map(context => ({ path: context.path, snippet: context.snippet })),
        } as ExtractCodeToolResultPayload,
        executionTime,
        metadata: {
          projectId: normalizedParams.projectId,
        },
        elements: identifiedElements,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Capture critical error to PostHog for monitoring
      this.telemetryService.captureError(error as Error, { 
        service: 'ExtractCodeTool', 
        function: 'execute',
        executionTime,
        params: {
          query: params.query,
          projectId: params.projectId,
          hasFilePathPattern: !!params.filePathPattern,
          hasConnectedCodebasePath: !!params.connectedCodebasePath,
          maxIterations: params.maxIterations || DEFAULT_MAX_ITERATIONS,
          model: params.model
        }
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime,
        metadata: {},
      };
    }
  }

  private logInvocation(params: ExtractCodeParameters): void {
    console.log("ExtractCodeTool invoked with parameters:", {
      query: params.query,
      queryLength: params.query?.length,
      filePathPattern: params.filePathPattern,
      projectId: params.projectId,
      sessionId: params.sessionId,
      connectedCodebasePath: params.connectedCodebasePath,
      maxIterations: params.maxIterations,
      filenameKeywords: params.filenameKeywords,
      methodNameKeywords: params.methodNameKeywords,
      codeKeywords: params.codeKeywords
    });
  }

  private normalizeParams(params: ExtractCodeParameters): NormalizedExtractCodeParameters {
    if (!params.projectId || !params.projectId.trim()) {
      throw new Error("projectId is required for ExtractCodeTool.");
    }

    const query = params.query?.trim();
    if (!query) {
      throw new Error("query must be a non-empty string.");
    }

    const projectId = params.projectId.trim();
    const maxIterations = Math.max(
      1,
      params.maxIterations ?? DEFAULT_MAX_ITERATIONS,
    );
    const model = params.model || "";

    return {
      ...params,
      query,
      projectId,
      maxIterations,
      model,
      filenameKeywords: params.filenameKeywords || [],
      methodNameKeywords: params.methodNameKeywords || [],
      codeKeywords: params.codeKeywords || [],
      maxDependencyDepth: params.maxDependencyDepth ?? 3,
      manuallyPinnedFilePaths: params.manuallyPinnedFilePaths || [],
    };
  }

  private async scanCodebase(
    params: NormalizedExtractCodeParameters,
  ): Promise<Map<string, FileInfo>> {
    const root = params.connectedCodebasePath;
    try {
      return await this.codeParser.scanCodebase(root, DEFAULT_MAX_FILES);
    } catch (error) {
      // Capture error to PostHog for monitoring
      this.telemetryService.captureError(error as Error, { 
        service: 'ExtractCodeTool', 
        function: 'scanCodebase',
        params: {
          projectId: params.projectId,
          connectedCodebasePath: root,
          maxFiles: DEFAULT_MAX_FILES
        }
      });
      
      throw new Error(
        `Failed to scan codebase${root ? ` at ${root}` : ""}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private filterFileInfos(
    fileInfos: Map<string, FileInfo>,
    pattern?: string,
  ): Map<string, FileInfo> {
    if (!pattern || !pattern.trim()) {
      return fileInfos;
    }

    const regex = this.compilePattern(pattern);
    if (!regex) {
      return fileInfos;
    }

    const filtered = new Map<string, FileInfo>();
    for (const [path, info] of fileInfos.entries()) {
      if (regex.test(path) || regex.test(info.name)) {
        filtered.set(path, info);
      }
    }

    return filtered.size ? filtered : fileInfos;
  }

  private compilePattern(pattern: string): RegExp | undefined {
    const trimmed = pattern.trim();
    if (!trimmed) {
      return undefined;
    }

    if (trimmed.startsWith("/") && trimmed.endsWith("/") && trimmed.length > 2) {
      try {
        return new RegExp(trimmed.slice(1, -1), "i");
      } catch {
        return undefined;
      }
    }

    const escaped = trimmed.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    const globConverted = escaped
      .replace(/\\\*/g, ".*")
      .replace(/\\\?/g, ".");

    try {
      return new RegExp(globConverted, "i");
    } catch {
      try {
        return new RegExp(trimmed, "i");
      } catch {
        return undefined;
      }
    }
  }

  private async rankRelevantFileswithLLM(
    fileInfos: Map<string, FileInfo>,
    query: string,
    projectId: string,
    model: string,
  ): Promise<Map<string, Array<{ name: string; type: string; }>>> {
    // Build folder structure context for LLM
    const folderStructure = this.buildFolderStructureContext(fileInfos);

    // Build recently opened files context (workspace-aware)
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const recentFilesContext = this.buildRecentlyOpenedFilesContext(10, workspaceRoot);

    // Build a summary of all files with their elements for LLM analysis
    const fileElementsSummary = Array.from(fileInfos.entries())
      .map(([filePath, fileInfo]) => {
        const elementsList = fileInfo.elements
          .map(element => `${element.type}: ${element.name}`)
          .join(', ');
        return `${filePath}: [${elementsList}]`;
      })
      .join('\n');

    const promptTemplate = await this.loadPrompt(
      "codeParser/step2_identify_relevant_elements.md"
    );

    const prompt = promptTemplate
      .replace("{{USER_REQUEST}}", query)
      .replace("{{FOLDER_STRUCTURE}}", folderStructure)
      .replace("{{RECENTLY_OPENED_FILES}}", recentFilesContext)
      .replace("{{FILE_ELEMENTS_SUMMARY}}", fileElementsSummary);

    console.log("ExtractCodeTool: Ranking prompt prepared", {
      fileCount: fileInfos.size,
      query,
      projectId,
      promptPreview: prompt.slice(0, 300),
    });

    const messages: LLMMessage[] = [
      { role: "system", content: prompt },
    ];

    const request: LLMRequest = {
      id: `rank-files-${Date.now()}`,
      provider: "auto",
      model: model || "",
      messages,
      metadata: {
        projectId,
        purpose: "rank_relevant_files_and_elements",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      maxTokens: 20000,
    };

    console.log('[EXTRACT CODE DEBUG] Setting explicit maxTokens for file ranking:', request.maxTokens);

    try {
      console.log("=== LLM RANKING DEBUG START ===");
      console.log("Request details:", {
        requestId: request.id,
        provider: request.provider,
        model: request.model,
        messageCount: request.messages.length,
        messageLengths: request.messages.map(m => m.content.length),
        metadata: request.metadata
      });

      // Log the prompt content for debugging (especially important for Gemini safety issues)
      console.log("=== PROMPT CONTENT DEBUG ===");
      request.messages.forEach((message, index) => {
        console.log(`Message ${index} (${message.role}):`, {
          contentLength: message.content.length,
          contentPreview: message.content.substring(0, 200) + (message.content.length > 200 ? '...' : ''),
          fullContent: message.content
        });
      });
      console.log("=== END PROMPT CONTENT DEBUG ===");

      const response = await this.llmProvider.chat(request);
      
      console.log("Raw LLM response:", {
        responseType: response.type,
        hasPayload: !!response.payload,
        error: response.error || 'none',
        responseKeys: Object.keys(response)
      });

      if (response.type !== ResponseType.SUCCESS || !response.payload) {
        console.warn("LLM ranking failed, falling back to file-level ranking. Response details:", {
          type: response.type,
          error: response.error,
          hasPayload: !!response.payload,
          payload: response.payload
        });
        console.log("=== LLM RANKING DEBUG END (FAILED) ===");
        return this.fallbackToFileRanking(fileInfos, query);
      }

      const payload = response.payload as LLMResponse;
      console.log("LLM payload details:", {
        payloadKeys: Object.keys(payload),
        contentType: typeof payload.content,
        contentLength: payload.content?.length || 0,
        contentPreview: payload.content?.substring(0, 100) + (payload.content && payload.content.length > 100 ? '...' : ''),
        fullContent: payload.content,
        hasUsage: !!payload.usage,
        usage: payload.usage,
        provider: payload.provider,
        model: payload.model,
        hasMetadata: !!payload.metadata,
        metadataKeys: payload.metadata ? Object.keys(payload.metadata) : [],
        rawResponse: payload.metadata?.rawResponse
      });

      // Additional Gemini-specific debugging
      if (payload.provider === 'google' && payload.metadata?.rawResponse) {
        const rawResponse = payload.metadata.rawResponse;
        console.log("=== GEMINI RAW RESPONSE DEBUG ===");
        console.log("Raw response structure:", {
          hasResponse: !!rawResponse.response,
          responseKeys: rawResponse.response ? Object.keys(rawResponse.response) : [],
          hasCandidates: !!rawResponse.response?.candidates,
          candidatesLength: rawResponse.response?.candidates?.length || 0,
          hasPromptFeedback: !!rawResponse.response?.promptFeedback,
          hasUsageMetadata: !!rawResponse.response?.usageMetadata
        });

        // Check for safety-related information
        if (rawResponse.response?.promptFeedback) {
          console.log("Gemini prompt feedback:", rawResponse.response.promptFeedback);
        }

        if (rawResponse.response?.candidates) {
          rawResponse.response.candidates.forEach((candidate: any, index: number) => {
            console.log(`Candidate ${index}:`, {
              hasContent: !!candidate.content,
              hasFinishReason: !!candidate.finishReason,
              finishReason: candidate.finishReason,
              hasSafetyRatings: !!candidate.safetyRatings,
              safetyRatings: candidate.safetyRatings,
              hasCitationMetadata: !!candidate.citationMetadata,
              citationMetadata: candidate.citationMetadata
            });

            if (candidate.safetyRatings) {
              console.log(`Candidate ${index} safety ratings:`, candidate.safetyRatings.map((rating: any) => ({
                category: rating.category,
                probability: rating.probability,
                blocked: rating.blocked
              })));
            }

            if (candidate.finishReason) {
              console.log(`Candidate ${index} finish reason:`, candidate.finishReason);
            }
          });
        }

        console.log("=== END GEMINI RAW RESPONSE DEBUG ===");
      }

      const json = extractJsonFromLLMResponse(
        payload.content,
      );

      console.log("JSON extraction result:", {
        jsonType: typeof json,
        jsonIsNull: json === null,
        jsonKeys: json && typeof json === 'object' ? Object.keys(json) : 'not an object',
        jsonPreview: JSON.stringify(json)?.substring(0, 200) + (JSON.stringify(json) && JSON.stringify(json).length > 200 ? '...' : '')
      });

      // Check if JSON parsing was successful
      if (!json || typeof json !== 'object') {
        console.warn("LLM response parsing failed or returned invalid JSON:", {
          json: json,
          jsonType: typeof json,
          payloadContent: payload.content,
          payloadContentLength: payload.content?.length || 0,
          payloadContentType: typeof payload.content,
          responseType: response.type,
          responseError: response.error
        });
        console.log("=== LLM RANKING DEBUG END (PARSE FAILED) ===");
        return this.fallbackToFileRanking(fileInfos, query);
      }

      const filesObject = json.files || {};

      const result = new Map<string, Array<{ name: string; type: string }>>();

      for (const [filePath, elements] of Object.entries(filesObject)) {
        if (!Array.isArray(elements)) {
          continue;
        }

        const fileInfo = fileInfos.get(filePath);
        console.log(`Processing file ${filePath} with elements:`, elements);
        console.log(`Available elements in file:`, fileInfo?.elements.map(el => `${el.name} (${el.type})`).join(', '));

        const elementSelections = elements.map((elementName) => {
          const element = fileInfo?.elements.find((el) => el.name === elementName);
          const result = {
            name: elementName,
            type: element?.type || "unknown",
          };
          console.log(`Element ${elementName} -> ${result.type} (found: ${!!element})`);
          return result;
        });

        result.set(filePath, elementSelections);
      }

      console.log("=== LLM RANKING DEBUG END (SUCCESS) ===");
      return result;
    } catch (error) {
      console.warn("Error in LLM ranking:", error);
      console.log("=== LLM RANKING DEBUG END (EXCEPTION) ===");
      
      // Capture error to PostHog for monitoring
      this.telemetryService.captureError(error as Error, { 
        service: 'ExtractCodeTool', 
        function: 'rankRelevantFileswithLLM',
        params: {
          query,
          projectId,
          model,
          fileCount: fileInfos.size
        }
      });
      
      return this.fallbackToFileRanking(fileInfos, query);
    }
  }

  private async identifyRelevantCodeElementsWithLLM(
    fileInfos: Map<string, FileInfo>,
    structuredContext: Array<{ path: string; elements: CodeElement[]; snippet: string; }>,
    params: NormalizedExtractCodeParameters,
  ): Promise<any> {
    // Build folder structure context for LLM
    const folderStructure = this.buildFolderStructureContext(fileInfos);

    // Build recently opened files context (workspace-aware)
    const workspaceRoot = params.connectedCodebasePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const recentFilesContext = this.buildRecentlyOpenedFilesContext(10, workspaceRoot);

    const promptTemplate = await this.loadPrompt(
      "codeParser/extract_code_context.md",
    );

    const combinedContent = structuredContext
      .map(context => {
        const elementTypes = context.elements.map(el => `${el.type}: ${el.name}`).join(', ');
        const header = `=== FILE: ${context.path} (${elementTypes}) ===`;
        return `${header}\n${context.snippet}`;
      })
      .join("\n\n");

    const prompt = promptTemplate
      .replace("{{USER_REQUEST}}", params.query)
      .replace("{{FOLDER_STRUCTURE}}", folderStructure)
      .replace("{{RECENTLY_OPENED_FILES}}", recentFilesContext)
      .replace("{{CODE_CONTENT}}", combinedContent);

    const messages: LLMMessage[] = [
      { role: "system", content: prompt },
    ];

    const request: LLMRequest = {
      id: `extract-code-${Date.now()}`,
      provider: "auto",
      model: params.model || "",
      messages,
      metadata: {
        projectId: params.projectId,
        purpose: "extract_code_context",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      maxTokens: 20000,
    };

    console.log('[EXTRACT CODE DEBUG] Setting explicit maxTokens for code extraction:', request.maxTokens);

    console.log("=== LLM CODE ELEMENT IDENTIFICATION DEBUG START ===");
    console.log("Request details:", {
      requestId: request.id,
      provider: request.provider,
      model: request.model,
      messageCount: request.messages.length,
      messageLengths: request.messages.map(m => m.content.length),
      metadata: request.metadata
    });

    // Log the prompt content for debugging (especially important for Gemini safety issues)
    console.log("=== CODE ELEMENT IDENTIFICATION PROMPT CONTENT DEBUG ===");
    request.messages.forEach((message, index) => {
      console.log(`Message ${index} (${message.role}):`, {
        contentLength: message.content.length,
        contentPreview: message.content.substring(0, 200) + (message.content.length > 200 ? '...' : ''),
        fullContent: message.content
      });
    });
    console.log("=== END CODE ELEMENT IDENTIFICATION PROMPT CONTENT DEBUG ===");

    const response = await this.llmProvider.chat(request);
    
    console.log("Raw LLM response:", {
      responseType: response.type,
      hasPayload: !!response.payload,
      error: response.error || 'none',
      responseKeys: Object.keys(response)
    });

    if (response.type !== ResponseType.SUCCESS || !response.payload) {
      console.warn("LLM extraction failed. Response details:", {
        type: response.type,
        error: response.error,
        hasPayload: !!response.payload,
        payload: response.payload
      });
      console.log("=== LLM CODE ELEMENT IDENTIFICATION DEBUG END (FAILED) ===");
      throw new Error("LLM extraction failed");
    }

    const payload = response.payload as LLMResponse;
    console.log("LLM payload details:", {
      payloadKeys: Object.keys(payload),
      contentType: typeof payload.content,
      contentLength: payload.content?.length || 0,
      contentPreview: payload.content?.substring(0, 100) + (payload.content && payload.content.length > 100 ? '...' : ''),
      fullContent: payload.content,
      hasUsage: !!payload.usage,
      usage: payload.usage,
      provider: payload.provider,
      model: payload.model,
      hasMetadata: !!payload.metadata,
      metadataKeys: payload.metadata ? Object.keys(payload.metadata) : [],
      rawResponse: payload.metadata?.rawResponse
    });

    // Additional Gemini-specific debugging
    if (payload.provider === 'google' && payload.metadata?.rawResponse) {
      const rawResponse = payload.metadata.rawResponse;
      console.log("=== GEMINI CODE ELEMENT IDENTIFICATION RAW RESPONSE DEBUG ===");
      console.log("Raw response structure:", {
        hasResponse: !!rawResponse.response,
        responseKeys: rawResponse.response ? Object.keys(rawResponse.response) : [],
        hasCandidates: !!rawResponse.response?.candidates,
        candidatesLength: rawResponse.response?.candidates?.length || 0,
        hasPromptFeedback: !!rawResponse.response?.promptFeedback,
        hasUsageMetadata: !!rawResponse.response?.usageMetadata
      });

      // Check for safety-related information
      if (rawResponse.response?.promptFeedback) {
        console.log("Gemini prompt feedback:", rawResponse.response.promptFeedback);
      }

      if (rawResponse.response?.candidates) {
        rawResponse.response.candidates.forEach((candidate: any, index: number) => {
          console.log(`Candidate ${index}:`, {
            hasContent: !!candidate.content,
            hasFinishReason: !!candidate.finishReason,
            finishReason: candidate.finishReason,
            hasSafetyRatings: !!candidate.safetyRatings,
            safetyRatings: candidate.safetyRatings,
            hasCitationMetadata: !!candidate.citationMetadata,
            citationMetadata: candidate.citationMetadata
          });

          if (candidate.safetyRatings) {
            console.log(`Candidate ${index} safety ratings:`, candidate.safetyRatings.map((rating: any) => ({
              category: rating.category,
              probability: rating.probability,
              blocked: rating.blocked
            })));
          }

          if (candidate.finishReason) {
            console.log(`Candidate ${index} finish reason:`, candidate.finishReason);
          }
        });
      }

      console.log("=== END GEMINI CODE ELEMENT IDENTIFICATION RAW RESPONSE DEBUG ===");
    }

    const json = extractJsonFromLLMResponse(payload.content);

    console.log("JSON extraction result:", {
      jsonType: typeof json,
      jsonIsNull: json === null,
      jsonKeys: json && typeof json === 'object' ? Object.keys(json) : 'not an object',
      jsonPreview: JSON.stringify(json)?.substring(0, 200) + (JSON.stringify(json) && JSON.stringify(json).length > 200 ? '...' : '')
    });

    // Check if JSON parsing was successful
    if (!json || typeof json !== 'object') {
      console.warn("LLM response parsing failed in identifyRelevantCodeElementsWithLLM:", {
        json: json,
        jsonType: typeof json,
        payloadContent: payload.content,
        payloadContentLength: payload.content?.length || 0,
        payloadContentType: typeof payload.content,
        responseType: response.type,
        responseError: response.error
      });
      console.log("=== LLM CODE ELEMENT IDENTIFICATION DEBUG END (PARSE FAILED) ===");
      throw new Error("Failed to parse LLM response for code element identification");
    }

    const filesObject = json.files || {};

    const result = new Map<string, Array<{ name: string; type: string }>>();

    for (const [filePath, elements] of Object.entries(filesObject)) {
      if (!Array.isArray(elements)) {
        continue;
      }

      const fileInfo = fileInfos.get(filePath);
      console.log(`Processing file ${filePath} with elements:`, elements);
      console.log(`Available elements in file:`, fileInfo?.elements.map(el => `${el.name} (${el.type})`).join(', '));

      const elementSelections = elements.map((elementName) => {
        const element = fileInfo?.elements.find((el) => el.name === elementName);
        const result = {
          name: elementName,
          type: element?.type || "unknown",
        };
        console.log(`Element ${elementName} -> ${result.type} (found: ${!!element})`);
        return result;
      });

      result.set(filePath, elementSelections);
      }

    console.log("=== LLM CODE ELEMENT IDENTIFICATION DEBUG END (SUCCESS) ===");
    return result;
    
  }

  private async buildStructuredCodeContextSnippets(
    fileInfos: Map<string, FileInfo>,
    relevantElementSelections: Map<string, Array<{ name: string; type: string; }>>,
    globalTokenLimit: number = GLOBAL_CONTEXT_TOKEN_LIMIT,
    pinnedFilePaths: string[] = [],
  ): Promise<Array<{ path: string; elements: CodeElement[]; snippet: string; }>> {
    const results: Array<{ path: string; elements: CodeElement[]; snippet: string; }> = [];
    let totalTokenCount = 0;

    // First, process pinned files (priority)
    console.log(`[Context File Pinning] Building snippets with ${pinnedFilePaths.length} pinned files`);
    
    for (const pinnedPath of pinnedFilePaths) {
      const fileInfo = fileInfos.get(pinnedPath);
      if (!fileInfo) {
        console.warn(`[Context File Pinning] Pinned file not found in fileInfos: ${pinnedPath}`);
        continue;
      }

      // Include ALL elements from pinned files
      const allElements = fileInfo.elements;
      if (allElements.length === 0) {
        console.warn(`[Context File Pinning] Pinned file has no elements: ${pinnedPath}`);
        continue;
      }
      
      const snippet = this.buildFileSnippet(fileInfo, allElements);
      const tokenCount = snippet.length;

      results.push({
        path: pinnedPath,
        elements: allElements,
        snippet: snippet,
      });
      
      totalTokenCount += tokenCount;
      console.log(`[Context File Pinning] Added pinned file: ${pinnedPath} (${tokenCount} tokens, ${allElements.length} elements)`);
    }
    
    console.log(`[Context File Pinning] Total tokens from pinned files: ${totalTokenCount}`);

    // Then process auto-extracted files (regular priority)
    // Filter out already-pinned files to avoid duplicates
    const orderedFilePaths = Array.from(relevantElementSelections.keys())
      .filter(path => !pinnedFilePaths.includes(path));

    for (const filePath of orderedFilePaths) {
      const fileInfo = fileInfos.get(filePath);
      if (!fileInfo) {
        continue;
      }

      const relevantElements = relevantElementSelections.get(filePath) || [];
      if (relevantElements.length === 0) {
        continue;
      }

      // Find matching elements from the file info
      const selectedElements: CodeElement[] = [];
      for (const relevantElement of relevantElements) {
        // First try exact match (name and type)
        let matchingElement = fileInfo.elements.find(
          element => element.name === relevantElement.name && element.type === relevantElement.type
        );
        
        // If exact match fails, try name-only match (LLM might return "unknown" type)
        if (!matchingElement) {
          matchingElement = fileInfo.elements.find(
            element => element.name === relevantElement.name
          );
        }
        
        // If still no match, try fuzzy matching for common variations
        if (!matchingElement) {
          const normalizedName = relevantElement.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          matchingElement = fileInfo.elements.find(
            element => {
              const elementNormalizedName = element.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              return elementNormalizedName === normalizedName;
            }
          );
        }
        
        if (matchingElement) {
          selectedElements.push(matchingElement);
        } else {
          console.warn(`Element ${relevantElement.name} (${relevantElement.type}) not found in file ${filePath}. Available elements:`, 
            fileInfo.elements.map(el => `${el.name} (${el.type})`).join(', '));
        }
      }

      if (selectedElements.length === 0) {
        // If no specific elements were found, include all elements from the file as fallback
        console.log(`No specific elements found for ${filePath}, including all elements as fallback`);
        const allElements = fileInfo.elements.slice(0, 5); // Limit to first 10 elements to avoid overwhelming
        if (allElements.length > 0) {
          selectedElements.push(...allElements);
        } else {
          continue;
        }
      }

      // Build the snippet for this file
      const snippetParts: string[] = [];
      let fileTokenCount = 0;
      let includedElements: CodeElement[] = [];

      for (const element of selectedElements) {
        if (!element.codeSnippet) {
          continue;
        }

        const comment = this.getCommentForElementType(element.type);
        const elementSnippet = `${comment} ${element.name}\n${element.codeSnippet}`;
        const elementTokenCount = elementSnippet.length;

        // Check if adding this element would exceed the global limit
        if (totalTokenCount + fileTokenCount + elementTokenCount > globalTokenLimit) {
          // If this is the first element and it would exceed the limit, truncate it
          if (includedElements.length === 0) {
            const remainingTokens = globalTokenLimit - totalTokenCount;
            if (remainingTokens > 50) { // Only include if we have meaningful space
              const truncatedSnippet = this.truncateElementSnippet(elementSnippet, remainingTokens - 20); // -20 for truncation indicator
              snippetParts.push(`${truncatedSnippet}\n... (truncated) ...`);
              includedElements.push(element);
              totalTokenCount = globalTokenLimit; // We've reached the limit
            }
          }
          // Stop processing this file and all subsequent files
          break;
        }

        snippetParts.push(elementSnippet);
        includedElements.push(element);
        fileTokenCount += elementTokenCount;
      }

      if (snippetParts.length === 0) {
        continue;
      }

      const combinedSnippet = snippetParts.join('\n\n');
      totalTokenCount += combinedSnippet.length;

      results.push({
        path: filePath,
        elements: includedElements,
        snippet: combinedSnippet,
      });

      // If we've reached the global limit, stop processing more files
      if (totalTokenCount >= globalTokenLimit) {
        break;
      }
    }

    return results;
  }

  /**
   * Builds a complete file snippet from FileInfo and elements
   * @param fileInfo - File information
   * @param elements - Code elements to include
   * @returns Formatted snippet string
   */
  private buildFileSnippet(fileInfo: FileInfo, elements: CodeElement[]): string {
    const snippetParts: string[] = [];
    
    for (const element of elements) {
      if (!element.codeSnippet) continue;
      const comment = this.getCommentForElementType(element.type);
      snippetParts.push(`${comment} ${element.name}\n${element.codeSnippet}`);
    }
    
    return snippetParts.join('\n\n');
  }

  private truncateElementSnippet(
    elementSnippet: string,
    maxLength: number
  ): string {
    if (elementSnippet.length <= maxLength) {
      return elementSnippet;
    }

    // Truncate the element snippet to fit within the limit
    return elementSnippet.substring(0, maxLength);
  }

  private truncateSnippetToMaxLength(
    snippet: string,
    elements: CodeElement[],
    maxLength: number
  ): { snippet: string; elements: CodeElement[] } {
    if (snippet.length <= maxLength) {
      return { snippet, elements };
    }

    // Try to truncate by removing whole elements from the end
    let truncatedSnippet = snippet;
    let truncatedElements = [...elements];
    
    while (truncatedSnippet.length > maxLength && truncatedElements.length > 1) {
      // Remove the last element and its corresponding snippet part
      const removedElement = truncatedElements.pop();
      if (removedElement) {
        const comment = this.getCommentForElementType(removedElement.type);
        const elementSnippet = `${comment} ${removedElement.name}\n${removedElement.codeSnippet || ''}`;
        
        // Remove the element snippet from the end
        const lastIndex = truncatedSnippet.lastIndexOf(elementSnippet);
        if (lastIndex !== -1) {
          truncatedSnippet = truncatedSnippet.substring(0, lastIndex).replace(/\n\n$/, '');
        }
      }
    }

    // If still too long, truncate the last element's content
    if (truncatedSnippet.length > maxLength && truncatedElements.length > 0) {
      const lastElement = truncatedElements[truncatedElements.length - 1];
      const comment = this.getCommentForElementType(lastElement.type);
      const elementSnippet = `${comment} ${lastElement.name}\n${lastElement.codeSnippet || ''}`;
      
      const lastIndex = truncatedSnippet.lastIndexOf(elementSnippet);
      if (lastIndex !== -1) {
        const beforeElement = truncatedSnippet.substring(0, lastIndex);
        const remainingLength = maxLength - beforeElement.length - comment.length - lastElement.name.length - 2; // -2 for newlines
        
        if (remainingLength > 0 && lastElement.codeSnippet) {
          const truncatedElementSnippet = lastElement.codeSnippet.substring(0, remainingLength - 20); // -20 for truncation indicator
          truncatedSnippet = `${beforeElement}${comment} ${lastElement.name}\n${truncatedElementSnippet}\n... (truncated) ...`;
        } else {
          truncatedSnippet = beforeElement;
        }
      }
    }

    return { snippet: truncatedSnippet, elements: truncatedElements };
  }

  private getCommentForElementType(type: string): string {
    switch (type) {
      case 'function':
      case 'method':
        return '// Function:';
      case 'class':
        return '// Class:';
      case 'interface':
        return '// Interface:';
      case 'variable':
        return '// Variable:';
      case 'arrow_function':
        return '// Arrow Function:';
      case 'struct':
        return '// Struct:';
      case 'enum':
        return '// Enum:';
      case 'import':
        return '// Import:';
      case 'export':
        return '// Export:';
      default:
        return '// Element:';
    }
  }


  private async readFileSafe(filePath: string): Promise<string | undefined> {
    try {
      const uri = filePath.startsWith("file:")
        ? vscode.Uri.parse(filePath)
        : vscode.Uri.file(filePath);
      const data = await vscode.workspace.fs.readFile(uri);
      return new TextDecoder("utf-8").decode(data);
    } catch (error) {
      console.warn(`Failed to read file ${filePath}:`, error);
      
      // Capture error to PostHog for monitoring
      this.telemetryService.captureError(error as Error, { 
        service: 'ExtractCodeTool', 
        function: 'readFileContent',
        params: {
          filePath
        }
      });
      
      return undefined;
    }
  }

  /**
   * Resolve import path to absolute file path
   * Returns null for node_modules or unresolvable imports
   */
  private async resolveImportPath(
    importStatement: string,
    currentFilePath: string,
    workspaceRoot: string
  ): Promise<string | null> {
    // Skip external packages (node_modules)
    if (!importStatement.startsWith('.') && !importStatement.startsWith('/')) {
      return null;
    }
    
    const currentDir = path.dirname(currentFilePath);
    let candidatePath: string;
    
    if (importStatement.startsWith('.')) {
      // Relative import: ./utils or ../helpers
      candidatePath = path.resolve(currentDir, importStatement);
    } else {
      // Absolute import from workspace root: /src/utils
      candidatePath = path.join(workspaceRoot, importStatement);
    }
    
    // Try common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.go'];
    
    for (const ext of extensions) {
      const withExt = candidatePath + ext;
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(withExt));
        return withExt;
      } catch {
        // File doesn't exist, try next
      }
    }
    
    // Try index files for directory imports
    const indexPatterns = ['index.ts', 'index.tsx', 'index.js', '__init__.py'];
    for (const indexFile of indexPatterns) {
      const indexPath = path.join(candidatePath, indexFile);
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(indexPath));
        return indexPath;
      } catch {
        // Continue
      }
    }
    
    return null;
  }

  /**
   * Recursively resolve and fetch missing dependencies
   * Protection against infinite recursion:
   * 1. Visited set tracks all processed files
   * 2. Max depth limits recursion levels
   * 3. Only follows local imports (skips node_modules)
   */
  private async resolveMissingDependencies(
    llmSuggestedFiles: Map<string, Array<{name: string; type: string}>>,
    existingFileInfos: Map<string, FileInfo>,
    workspaceRoot: string,
    maxDepth: number = 3
  ): Promise<Map<string, FileInfo>> {
    
    const allFileInfos = new Map(existingFileInfos);
    const visited = new Set<string>(existingFileInfos.keys()); // Track all seen files
    const circularDeps = new Map<string, string[]>(); // Track circular dependencies
    
    console.log('[Dependency Resolver] Starting with', existingFileInfos.size, 'files');
    
    // Find files suggested by LLM but missing from initial scan
    const missingFiles = new Set<string>();
    for (const [filePath] of llmSuggestedFiles.entries()) {
      if (!existingFileInfos.has(filePath)) {
        missingFiles.add(filePath);
        console.log('[Dependency Resolver] LLM suggested missing file:', filePath);
      }
    }
    
    if (missingFiles.size === 0) {
      console.log('[Dependency Resolver] No missing files to resolve');
      return allFileInfos;
    }
    
    // Process files level by level
    let currentLevel = Array.from(missingFiles);
    let currentDepth = 0;
    
    while (currentLevel.length > 0 && currentDepth < maxDepth) {
      console.log(`[Dependency Resolver] Processing level ${currentDepth} with ${currentLevel.length} files`);
      const nextLevel: string[] = [];
      
      for (const filePath of currentLevel) {
        // Skip if already visited (prevents infinite loops)
        if (visited.has(filePath)) {
          console.log('[Dependency Resolver] Skipping already visited:', filePath);
          continue;
        }
        
        visited.add(filePath);
        
        try {
          // Check if file exists
          const uri = vscode.Uri.file(filePath);
          await vscode.workspace.fs.stat(uri);
          
          // Parse the file
          const language = this.codeParser.detectLanguage(filePath);
          if (!language) {
            console.log('[Dependency Resolver] Unknown language for:', filePath);
            continue;
          }
          
          const elements = await this.codeParser.extractElementsFromFile(filePath, language);
          const fileContent = await this.readFileSafe(filePath);
          
          if (!fileContent) {
            console.log('[Dependency Resolver] Could not read file:', filePath);
            continue;
          }
          
          // Extract imports from this file
          const imports = this.codeParser.extractImportsFromContent(fileContent, language);
          console.log(`[Dependency Resolver] Found ${imports.length} imports in ${filePath}`);
          
          // Resolve each import to absolute path
          const resolvedImports: string[] = [];
          for (const importPath of imports) {
            const resolved = await this.resolveImportPath(importPath, filePath, workspaceRoot);
            if (resolved) {
              resolvedImports.push(resolved);
              
              // Check for circular dependency
              if (visited.has(resolved)) {
                if (!circularDeps.has(filePath)) {
                  circularDeps.set(filePath, []);
                }
                circularDeps.get(filePath)!.push(resolved);
                console.log('[Dependency Resolver] Circular dependency detected:', filePath, '->', resolved);
              } else if (!allFileInfos.has(resolved)) {
                // New file to process in next level
                nextLevel.push(resolved);
              }
            }
          }
          
          // Add file to results
          const stat = await vscode.workspace.fs.stat(uri);
          allFileInfos.set(filePath, {
            path: filePath,
            name: path.basename(filePath),
            extension: path.extname(filePath),
            language,
            size: stat.size,
            elements,
            lastModified: new Date(stat.mtime),
          });
          
          console.log(`[Dependency Resolver] Added ${filePath} with ${elements.length} elements`);
          
        } catch (error) {
          console.warn(`[Dependency Resolver] Error processing ${filePath}:`, error);
          // Continue with other files
        }
      }
      
      currentLevel = nextLevel;
      currentDepth++;
    }
    
    if (currentLevel.length > 0) {
      console.log(`[Dependency Resolver] Stopped at max depth ${maxDepth}. Remaining files:`, currentLevel.length);
    }
    
    if (circularDeps.size > 0) {
      console.log('[Dependency Resolver] Circular dependencies found:', 
        Array.from(circularDeps.entries()).map(([file, deps]) => `${file} -> ${deps.join(', ')}`));
    }
    
    console.log(`[Dependency Resolver] Completed. Total files: ${allFileInfos.size} (added ${allFileInfos.size - existingFileInfos.size})`);
    
    return allFileInfos;
  }

  /**
   * Processes manually pinned files to include in code context unconditionally
   * @param pinnedPaths - Array of absolute file paths to pin
   * @param workspaceRoot - Workspace root path
   * @returns Map of file paths to FileInfo objects for pinned files
   */
  private async processPinnedFiles(
    pinnedPaths: string[],
    workspaceRoot: string
  ): Promise<Map<string, FileInfo>> {
    const pinnedFileInfos = new Map<string, FileInfo>();
    
    if (!pinnedPaths || pinnedPaths.length === 0) {
      return pinnedFileInfos;
    }
    
    console.log(`[Context File Pinning] Processing ${pinnedPaths.length} pinned files`);
    
    for (const filePath of pinnedPaths) {
      try {
        const content = await this.readFileSafe(filePath);
        if (!content) {
          console.warn(`[Context File Pinning] Could not read file: ${filePath}`);
          continue;
        }
        
        const language = this.codeParser.detectLanguage(filePath) || 'unknown';
        const elements = await this.codeParser.extractElementsFromFile(filePath, language);
        
        // Get file stats
        const uri = vscode.Uri.file(filePath);
        const stat = await vscode.workspace.fs.stat(uri);
        
        const fileInfo: FileInfo = {
          path: filePath,
          name: filePath.split('/').pop() || filePath,
          extension: filePath.split('.').pop() || '',
          language: language,
          size: stat.size,
          elements: elements,
          lastModified: new Date(stat.mtime),
        };
        
        pinnedFileInfos.set(filePath, fileInfo);
        console.log(`[Context File Pinning] Processed file: ${filePath} (${elements.length} elements)`);
      } catch (error) {
        console.error(`[Context File Pinning] Failed to process pinned file ${filePath}:`, error);
      }
    }
    
    console.log(`[Context File Pinning] Successfully processed ${pinnedFileInfos.size} pinned files`);
    return pinnedFileInfos;
  }

  private async loadPrompt(relativePath: string): Promise<string> {
    return this.codeParser.loadPrompt(relativePath);
  }

  /**
   * Builds recently opened files context (HYBRID APPROACH)
   * Priority: 1) Currently open tabs, 2) Recently closed files
   * Workspace-aware: Only includes files from current workspace
   * 
   * @param maxFiles - Maximum number of files to include
   * @param workspaceRoot - Workspace root to filter files by
   * @returns Formatted markdown string with recently opened files
   */
  private buildRecentlyOpenedFilesContext(maxFiles: number, workspaceRoot: string): string {
    const recentFiles = RecentFilesTracker.getInstance().getRecentlyOpenedFilePaths(maxFiles, workspaceRoot);
    
    if (recentFiles.length === 0) {
      return "## Recently Opened Files\n\nNo recently opened files in current workspace.";
    }

    const fileList = recentFiles.map(filePath => `- ${filePath}`).join('\n');
    return `## Recently Opened Files (top ${recentFiles.length})\n\n${fileList}`;
  }

  /**
   * Builds a high-level folder structure context from file paths (2 levels deep)
   * to help LLM disambiguate between similar code in different project sections
   * @param fileInfos - Map of file paths to FileInfo objects
   * @returns Formatted markdown string with folder structure and auto-generated descriptions
   */
  private buildFolderStructureContext(fileInfos: Map<string, FileInfo>): string {
    // Extract unique 2-level folder paths
    const folderSet = new Set<string>();
    
    for (const filePath of fileInfos.keys()) {
      const parts = filePath.split('/');
      if (parts.length >= 2) {
        // Get first two levels (e.g., "vscode/samurai-agent" from "vscode/samurai-agent/src/...")
        const twoLevelPath = `${parts[0]}/${parts[1]}`;
        folderSet.add(twoLevelPath);
      } else if (parts.length === 1) {
        // Single level folder
        folderSet.add(parts[0]);
      }
    }

    // Sort folders alphabetically for consistent output
    const folders = Array.from(folderSet).sort();

    // Generate descriptions for each folder based on common naming patterns
    const folderDescriptions = folders.map(folder => {
      const description = this.generateFolderDescription(folder);
      return `- ${folder}/ - ${description}`;
    });

    if (folderDescriptions.length === 0) {
      return "## Project Structure\n\nNo folder structure detected.";
    }

    return `## Project Structure (2 levels)\n\n${folderDescriptions.join('\n')}`;
  }

  /**
   * Auto-generates human-readable descriptions for folder paths based on common patterns
   * @param folderPath - 2-level folder path (e.g., "vscode/samurai-agent")
   * @returns Human-readable description
   */
  private generateFolderDescription(folderPath: string): string {
    const lowerPath = folderPath.toLowerCase();
    
    // Check common patterns
    if (lowerPath.includes('vscode') || lowerPath.includes('vs-code')) {
      return 'VS Code Extension implementation';
    }
    if (lowerPath.includes('frontend') || lowerPath.includes('client')) {
      return 'Web Frontend application';
    }
    if (lowerPath.includes('backend') || lowerPath.includes('server')) {
      return 'Backend API/Services';
    }
    if (lowerPath.includes('integration-test') || lowerPath.includes('e2e')) {
      return 'Integration/E2E test suite';
    }
    if (lowerPath.includes('test') || lowerPath.includes('spec')) {
      return 'Test files';
    }
    if (lowerPath.includes('doc') || lowerPath.includes('documentation')) {
      return 'Documentation';
    }
    if (lowerPath.includes('script') || lowerPath.includes('scripts')) {
      return 'Build/utility scripts';
    }
    if (lowerPath.includes('config') || lowerPath.includes('configuration')) {
      return 'Configuration files';
    }
    if (lowerPath.includes('util') || lowerPath.includes('helper')) {
      return 'Utility/helper functions';
    }
    if (lowerPath.includes('component')) {
      return 'UI Components';
    }
    if (lowerPath.includes('service')) {
      return 'Service layer';
    }
    if (lowerPath.includes('model') || lowerPath.includes('entity')) {
      return 'Data models/entities';
    }
    if (lowerPath.includes('api')) {
      return 'API endpoints/routes';
    }
    if (lowerPath.includes('lib') || lowerPath.includes('library')) {
      return 'Shared library code';
    }
    if (lowerPath.includes('core')) {
      return 'Core functionality';
    }
    if (lowerPath.includes('common') || lowerPath.includes('shared')) {
      return 'Shared/common code';
    }
    
    // Default: capitalize and clean up the folder name
    const parts = folderPath.split('/');
    const lastPart = parts[parts.length - 1];
    const cleaned = lastPart.replace(/[-_]/g, ' ');
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  private fallbackToFileRanking(
    fileInfos: Map<string, FileInfo>,
    query: string,
  ): Map<string, Array<{ name: string; type: string; }>> {
    // Fallback: select first few files and all their elements
    const result = new Map<string, Array<{ name: string; type: string; }>>();
    const filePaths = Array.from(fileInfos.keys()).slice(0, DEFAULT_MAX_RESULTS);
    
    console.log(`Using fallback ranking for query: ${query}`);
    
    for (const filePath of filePaths) {
      const fileInfo = fileInfos.get(filePath);
      if (fileInfo && fileInfo.elements.length > 0) {
        const elements = fileInfo.elements.map(element => ({
          name: element.name,
          type: element.type
        }));
        result.set(filePath, elements);
        console.log(`Fallback: Added ${elements.length} elements from ${filePath}`);
      }
    }
    
    console.log(`Fallback ranking complete: ${result.size} files selected`);
    return result;
  }

  private heuristicFallbackSelections(
    fileInfos: Map<string, FileInfo>,
    query: string,
  ): Map<string, Array<{ name: string; type: string }>> {
    const keywords = query.toLowerCase();
    const matches: Array<{ path: string; elements: Array<{ name: string; type: string }> }> = [];

    const candidatePatterns = [
      /cost/i,
      /llm/i,
      /consumption/i,
      /tracking/i,
      /usage/i,
      /pricing/i,
    ];

    for (const [filePath, info] of fileInfos.entries()) {
      const haystack = `${info.name} ${filePath}`.toLowerCase();
      if (
        candidatePatterns.some((pattern) => pattern.test(haystack)) ||
        candidatePatterns.some((pattern) =>
          info.elements.some((el) => pattern.test(el.name)),
        )
      ) {
        matches.push({
          path: filePath,
          elements: info.elements.slice(0, 5).map((el) => ({
            name: el.name,
            type: el.type,
          })),
        });
      }
    }

    if (!matches.length && keywords.includes("cost")) {
      const largestFiles = Array.from(fileInfos.values())
        .sort((a, b) => b.size - a.size)
        .slice(0, 3);

      for (const file of largestFiles) {
        matches.push({
          path: file.path,
          elements: file.elements.slice(0, 5).map((el) => ({
            name: el.name,
            type: el.type,
          })),
        });
      }
    }

    const result = new Map<string, Array<{ name: string; type: string }>>();
    for (const match of matches) {
      if (match.elements.length) {
        result.set(match.path, match.elements);
      }
    }

    return result;
  }

  /**
   * Performs keyword-based search across filenames, method names, and file contents
   * @param fileInfos - Map of file paths to FileInfo objects
   * @param params - Normalized extract code parameters containing keyword arrays
   * @returns Map of file paths to arrays of matching elements
   */
  private async performKeywordBasedSearch(
    fileInfos: Map<string, FileInfo>,
    params: NormalizedExtractCodeParameters,
  ): Promise<Map<string, Array<{ name: string; type: string; }>>> {
    const result = new Map<string, Array<{ name: string; type: string; }>>();
    
    // Skip if no keywords provided
    if (params.filenameKeywords.length === 0 && 
        params.methodNameKeywords.length === 0 && 
        params.codeKeywords.length === 0) {
      return result;
    }

    console.log("ExtractCodeTool: Performing keyword-based search", {
      filenameKeywords: params.filenameKeywords,
      methodNameKeywords: params.methodNameKeywords,
      codeKeywords: params.codeKeywords,
      fileCount: fileInfos.size
    });

    // Step 1: Filename keyword matching
    const filenameMatches = this.searchByFilenameKeywords(fileInfos, params.filenameKeywords);
    
    // Step 2: Method name keyword matching
    const methodNameMatches = this.searchByMethodNameKeywords(fileInfos, params.methodNameKeywords);
    
    // Step 3: Code content keyword matching
    const codeContentMatches = await this.searchByCodeKeywords(fileInfos, params.codeKeywords);
    
    // Step 4: Consolidate all matches
    this.consolidateKeywordMatches(result, filenameMatches, methodNameMatches, codeContentMatches);
    
    // Step 5: Apply global limit of 20 distinct files/elements
    this.applyGlobalLimit(result);
    
    console.log("ExtractCodeTool: Keyword search completed", {
      totalMatches: result.size,
      matches: Array.from(result.entries()).map(([path, elements]) => ({
        path,
        elementCount: elements.length,
        elements: elements.map(el => `${el.name} (${el.type})`)
      }))
    });
    
    return result;
  }

  /**
   * Searches files by filename keywords
   */
  private searchByFilenameKeywords(
    fileInfos: Map<string, FileInfo>,
    filenameKeywords: string[],
  ): Map<string, Array<{ name: string; type: string; }>> {
    const matches = new Map<string, Array<{ name: string; type: string; }>>();
    
    if (filenameKeywords.length === 0) {
      return matches;
    }

    for (const [filePath, fileInfo] of fileInfos.entries()) {
      const fileName = fileInfo.name.toLowerCase();
      
      for (const keyword of filenameKeywords) {
        if (fileName.includes(keyword.toLowerCase())) {
          // Include all elements from this file
          const elements = fileInfo.elements.map(element => ({
            name: element.name,
            type: element.type
          }));
          matches.set(filePath, elements);
          break; // Found a match, no need to check other keywords for this file
        }
      }
    }
    
    return matches;
  }

  /**
   * Searches files by method name keywords
   */
  private searchByMethodNameKeywords(
    fileInfos: Map<string, FileInfo>,
    methodNameKeywords: string[],
  ): Map<string, Array<{ name: string; type: string; }>> {
    const matches = new Map<string, Array<{ name: string; type: string; }>>();
    
    if (methodNameKeywords.length === 0) {
      return matches;
    }

    for (const [filePath, fileInfo] of fileInfos.entries()) {
      const matchingElements: Array<{ name: string; type: string; }> = [];
      
      for (const element of fileInfo.elements) {
        const elementName = element.name.toLowerCase();
        
        for (const keyword of methodNameKeywords) {
          if (elementName.includes(keyword.toLowerCase())) {
            matchingElements.push({
              name: element.name,
              type: element.type
            });
            break; // Found a match, no need to check other keywords for this element
          }
        }
      }
      
      if (matchingElements.length > 0) {
        matches.set(filePath, matchingElements);
      }
    }
    
    return matches;
  }

  /**
   * Searches files by code content keywords
   */
  private async searchByCodeKeywords(
    fileInfos: Map<string, FileInfo>,
    codeKeywords: string[],
  ): Promise<Map<string, Array<{ name: string; type: string; }>>> {
    const matches = new Map<string, Array<{ name: string; type: string; }>>();
    
    if (codeKeywords.length === 0) {
      return matches;
    }

    for (const [filePath, fileInfo] of fileInfos.entries()) {
      try {
        const fileContent = await this.readFileSafe(filePath);
        
        if (!fileContent) {
          continue;
        }
        
        const content = fileContent.toLowerCase();
        let hasMatch = false;
        
        for (const keyword of codeKeywords) {
          if (content.includes(keyword.toLowerCase())) {
            hasMatch = true;
            break;
          }
        }
        
        if (hasMatch) {
          // Try to find specific elements related to the match
          const matchingElements = this.findElementsRelatedToCodeMatch(fileInfo, codeKeywords, fileContent);
          
          if (matchingElements.length > 0) {
            matches.set(filePath, matchingElements);
          } else {
            // If no specific elements found, include up to 10 all elements from the file
            const allElements = fileInfo.elements.slice(0, 10).map(element => ({
              name: element.name,
              type: element.type
            }));
            matches.set(filePath, allElements);
          }
        }
      } catch (error) {
        // Capture error to telemetry
        this.telemetryService.captureError(error as Error, {
          service: 'ExtractCodeTool',
          function: 'searchByCodeKeywords',
          params: {
            filePath,
            codeKeywords
          }
        });
        console.warn(`Failed to read file ${filePath} for code keyword search:`, error);
      }
    }
    
    return matches;
  }

  /**
   * Attempts to find specific elements related to code keyword matches
   */
  private findElementsRelatedToCodeMatch(
    fileInfo: FileInfo,
    codeKeywords: string[],
    fileContent: string,
  ): Array<{ name: string; type: string; }> {
    const matchingElements: Array<{ name: string; type: string; }> = [];
    
    for (const element of fileInfo.elements) {
      const elementName = element.name.toLowerCase();
      
      // Check if element name contains any of the code keywords
      for (const keyword of codeKeywords) {
        if (elementName.includes(keyword.toLowerCase())) {
          matchingElements.push({
            name: element.name,
            type: element.type
          });
          break;
        }
      }
    }
    
    return matchingElements;
  }

  /**
   * Consolidates keyword matches from different search types
   */
  private consolidateKeywordMatches(
    result: Map<string, Array<{ name: string; type: string; }>>,
    filenameMatches: Map<string, Array<{ name: string; type: string; }>>,
    methodNameMatches: Map<string, Array<{ name: string; type: string; }>>,
    codeContentMatches: Map<string, Array<{ name: string; type: string; }>>,
  ): void {
    // Add filename matches (highest priority)
    for (const [filePath, elements] of filenameMatches.entries()) {
      result.set(filePath, elements);
    }
    
    // Add method name matches (medium priority)
    for (const [filePath, elements] of methodNameMatches.entries()) {
      if (result.has(filePath)) {
        // Merge with existing elements, avoiding duplicates
        const existingElements = result.get(filePath)!;
        const newElements = elements.filter(newEl => 
          !existingElements.some(existingEl => 
            existingEl.name === newEl.name && existingEl.type === newEl.type
          )
        );
        result.set(filePath, [...existingElements, ...newElements]);
      } else {
        result.set(filePath, elements);
      }
    }
    
    // Add code content matches (lowest priority)
    for (const [filePath, elements] of codeContentMatches.entries()) {
      if (result.has(filePath)) {
        // Merge with existing elements, avoiding duplicates
        const existingElements = result.get(filePath)!;
        const newElements = elements.filter(newEl => 
          !existingElements.some(existingEl => 
            existingEl.name === newEl.name && existingEl.type === newEl.type
          )
        );
        result.set(filePath, [...existingElements, ...newElements]);
      } else {
        result.set(filePath, elements);
      }
    }
  }

  /**
   * Applies global limit of 20 distinct files/elements with priority ordering
   */
  private applyGlobalLimit(
    result: Map<string, Array<{ name: string; type: string; }>>,
  ): void {
    const MAX_ELEMENTS = 20;
    
    if (result.size <= MAX_ELEMENTS) {
      return;
    }
    
    // Convert to array and sort by priority (filename > method name > code content)
    const entries = Array.from(result.entries());
    
    // For now, we'll just take the first MAX_ELEMENTS entries
    // In a more sophisticated implementation, we could prioritize based on match type
    const limitedEntries = entries.slice(0, MAX_ELEMENTS);
    
    result.clear();
    for (const [filePath, elements] of limitedEntries) {
      result.set(filePath, elements);
    }
  }

  /**
   * Merges keyword search results with LLM selections
   */
  private mergeKeywordAndLLMSelections(
    llmSelections: Map<string, Array<{ name: string; type: string; }>>,
    keywordSelections: Map<string, Array<{ name: string; type: string; }>>,
  ): Map<string, Array<{ name: string; type: string; }>> {
    const merged = new Map<string, Array<{ name: string; type: string; }>>();
    
    // Start with LLM selections
    for (const [filePath, elements] of llmSelections.entries()) {
      merged.set(filePath, [...elements]);
    }
    
    // Merge keyword selections
    for (const [filePath, elements] of keywordSelections.entries()) {
      if (merged.has(filePath)) {
        const existingElements = merged.get(filePath)!;
        const newElements = elements.filter(newEl => 
          newEl && // Add null check
          !existingElements.some(existingEl => 
            existingEl.name === newEl.name && existingEl.type === newEl.type
          )
        );
        
        // Merge elements, preferring specific types over "unknown"
        const mergedElements = [...existingElements];
        for (const newEl of newElements) {
          const existingIndex = mergedElements.findIndex(existingEl => 
            existingEl.name === newEl.name
          );
          
          if (existingIndex >= 0) {
            // Prefer specific type over "unknown"
            if (mergedElements[existingIndex].type === "unknown" && newEl.type !== "unknown") {
              mergedElements[existingIndex] = newEl;
            }
          } else {
            mergedElements.push(newEl);
          }
        }
        
        merged.set(filePath, mergedElements);
      } else {
        merged.set(filePath, [...elements]);
      }
    }
    
    return merged;
  }
}

