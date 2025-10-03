import { randomUUID } from "crypto";
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

const DEFAULT_MAX_ITERATIONS = 2;
const DEFAULT_MAX_FILES = 5000;
const DEFAULT_MAX_RESULTS = 300;
const GLOBAL_CONTEXT_TOKEN_LIMIT = 300000; // Global limit for all files combined

type NormalizedExtractCodeParameters = ExtractCodeParameters & {
  query: string;
  projectId: string;
  maxIterations: number;
  model: string;
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

      const relevantElementSelections = await this.rankRelevantFileswithLLM(
        filteredFileInfos,
        normalizedParams.query,
        normalizedParams.projectId,
        normalizedParams.model,
      );

      let structuredContext = await this.buildStructuredCodeContextSnippets(
        filteredFileInfos,
        relevantElementSelections,
        GLOBAL_CONTEXT_TOKEN_LIMIT,
      );

      if (structuredContext.length === 0) {
        const fallbackSelections = this.heuristicFallbackSelections(
          filteredFileInfos,
          normalizedParams.query,
        );

        if (fallbackSelections.size) {
          structuredContext = await this.buildStructuredCodeContextSnippets(
            filteredFileInfos,
            fallbackSelections,
            GLOBAL_CONTEXT_TOKEN_LIMIT,
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
        filteredFileInfos,
        structuredContext,
        normalizedParams,
      );

      let structuredContext_after_step2 = await this.buildStructuredCodeContextSnippets(
        filteredFileInfos,
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
      maxIterations: params.maxIterations
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
    };
  }

  private async scanCodebase(
    params: NormalizedExtractCodeParameters,
  ): Promise<Map<string, FileInfo>> {
    const root = params.connectedCodebasePath;
    try {
      return await this.codeParser.scanCodebase(root, DEFAULT_MAX_FILES);
    } catch (error) {
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
      return this.fallbackToFileRanking(fileInfos, query);
    }
  }

  private async identifyRelevantCodeElementsWithLLM(
    fileInfos: Map<string, FileInfo>,
    structuredContext: Array<{ path: string; elements: CodeElement[]; snippet: string; }>,
    params: NormalizedExtractCodeParameters,
  ): Promise<any> {
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
  ): Promise<Array<{ path: string; elements: CodeElement[]; snippet: string; }>> {
    const results: Array<{ path: string; elements: CodeElement[]; snippet: string; }> = [];
    let totalTokenCount = 0;

    // Process files in order of importance (based on the order in relevantElementSelections)
    // This ensures the most important files are processed first
    const orderedFilePaths = Array.from(relevantElementSelections.keys());

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
      return undefined;
    }
  }

  private async loadPrompt(relativePath: string): Promise<string> {
    return this.codeParser.loadPrompt(relativePath);
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
}

