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
import { parseAndValidateLlmJson } from "../../common/utils/llmResponseParser";

const DEFAULT_MAX_ITERATIONS = 2;
const DEFAULT_MAX_FILES = 2000;
const DEFAULT_MAX_RESULTS = 50;
const GLOBAL_CONTEXT_TOKEN_LIMIT = 200000; // Global limit for all files combined

type NormalizedExtractCodeParameters = ExtractCodeParameters & {
  query: string;
  projectId: string;
  maxIterations: number;
};

export interface ExtractCodeToolResultPayload {
  relevantCodeElements: Array<{
    path: string;
    elements: CodeElement[];
    snippet: string;
  }>;
  analysis: {
    relevance_score: number;
    context: string;
    file_path: string;
  };
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

      const relevantElementSelections = await this.rankRelevantFiles(
        filteredFileInfos,
        normalizedParams.query,
        normalizedParams.projectId,
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

      const llmAnalysis = await this.identifyRelevantCodeElementsWithLLM(
        structuredContext,
        normalizedParams,
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
      
      for (const context of structuredContext) {
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
          relevantCodeElements: structuredContext,
          analysis: llmAnalysis,
          files: structuredContext.map(context => ({ path: context.path, snippet: context.snippet })),
        } as ExtractCodeToolResultPayload,
        executionTime,
        metadata: {
          projectId: normalizedParams.projectId,
        },
        relevance_score: llmAnalysis?.relevance_score,
        context: llmAnalysis?.context,
        file_path: llmAnalysis?.file_path,
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
    console.log("ExtractCodeTool invoked with parameters:", params);
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

    return {
      ...params,
      query,
      projectId,
      maxIterations,
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

  private async rankRelevantFiles(
    fileInfos: Map<string, FileInfo>,
    query: string,
    projectId: string,
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
      model: "",
      messages,
      metadata: {
        projectId,
        purpose: "rank_relevant_files_and_elements",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const response = await this.llmProvider.chat(request);
      if (response.type !== ResponseType.SUCCESS || !response.payload) {
        console.warn("LLM ranking failed, falling back to file-level ranking");
        return this.fallbackToFileRanking(fileInfos, query);
      }

      const payload = response.payload as LLMResponse;
      const json = parseAndValidateLlmJson<{ files: Record<string, string[]>; reasoning: string }>(
        payload.content,
        ["files", "reasoning"],
      );

      const filesObject = json.files || {};

      const result = new Map<string, Array<{ name: string; type: string }>>();

      for (const [filePath, elements] of Object.entries(filesObject)) {
        if (!Array.isArray(elements)) {
          continue;
        }

        const elementSelections = elements.map((elementName) => {
          const fileInfo = fileInfos.get(filePath);
          const element = fileInfo?.elements.find((el) => el.name === elementName);
          return {
            name: elementName,
            type: element?.type || "unknown",
          };
        });

        result.set(filePath, elementSelections);
      }

      return result;
    } catch (error) {
      console.warn("Error in LLM ranking:", error);
      return this.fallbackToFileRanking(fileInfos, query);
    }
  }

  private async identifyRelevantCodeElementsWithLLM(
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
      model: "",
      messages,
      metadata: {
        projectId: params.projectId,
        purpose: "extract_code_context",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const response = await this.llmProvider.chat(request);
    if (response.type !== ResponseType.SUCCESS || !response.payload) {
      throw new Error("LLM extraction failed");
    }

    const payload = response.payload as LLMResponse;

    const result = parseAndValidateLlmJson<{
      relevance_score: number;
      context: string;
      file_path: string;
      reasoning: string;
    }>(payload.content, ["relevance_score", "context", "file_path", "reasoning"]);

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
        const matchingElement = fileInfo.elements.find(
          element => element.name === relevantElement.name && element.type === relevantElement.type
        );
        if (matchingElement) {
          selectedElements.push(matchingElement);
        } else {
          console.warn(`Element ${relevantElement.name} (${relevantElement.type}) not found in file ${filePath}`);
        }
      }

      if (selectedElements.length === 0) {
        continue;
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
    
    for (const filePath of filePaths) {
      const fileInfo = fileInfos.get(filePath);
      if (fileInfo && fileInfo.elements.length > 0) {
        const elements = fileInfo.elements.map(element => ({
          name: element.name,
          type: element.type
        }));
        result.set(filePath, elements);
      }
    }
    
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

