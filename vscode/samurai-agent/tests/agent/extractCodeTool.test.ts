import * as assert from "assert";
import type * as vscodeTypes from "vscode";
import { ExtractCodeTool, ExtractCodeParameters } from "../../src/agent/tools/extractCodeTool";
import { LLMProviderService } from "../../src/agent/llm/llmProviderService";
import type { ApiResponse } from "../../src/common/models/response-models";
import type { LLMResponse } from "../../src/common/models/llm-models";
import type { CodeElement, FileInfo } from "../../src/common/models/context-models";
import type { CodeParserService } from "../../src/agent/code_parser/CodeParserService";

const vscode = jest.requireMock("vscode") as typeof vscodeTypes;

type ChatCall = {
  request: any;
};

class MockLLMProviderService extends LLMProviderService {
  public readonly chatCalls: ChatCall[] = [];

  constructor(private readonly response: ApiResponse<LLMResponse>) {
    super({} as any);
  }

  public override async chat(request: any): Promise<ApiResponse<LLMResponse>> {
    this.chatCalls.push({ request });
    return this.response;
  }
}

const buildMockResponse = (json: string): ApiResponse<LLMResponse> => ({
  type: "success",
  timestamp: new Date(),
  payload: {
    id: "response",
    requestId: "extract-code",
    provider: "openai",
    model: "gpt",
    content: json,
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    },
    cost: 0,
    processingTime: 0,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
});

describe("ExtractCodeTool", () => {
  const baseParams: ExtractCodeParameters = {
    query: "Find function",
    projectId: "project-123",
    connectedCodebasePath: "/repo",
  };

  const buildFileInfos = (): Map<string, FileInfo> => {
    const filePath = "/repo/src/file.ts";
    const elements: CodeElement[] = [
      {
        name: "foo",
        type: "function",
        lineNumber: 10,
        filePath,
        signature: "function foo() {}",
      },
    ];

    return new Map([
      [
        filePath,
        {
          path: filePath,
          name: "file.ts",
          extension: ".ts",
          language: "typescript",
          size: 20,
          elements,
          lastModified: new Date(),
        },
      ],
    ]);
  };

  const stubCodeParser = (fileInfos: Map<string, FileInfo>): CodeParserService => {
    return {
      scanCodebase: jest.fn(async () => fileInfos),
      getRelevantFiles: jest.fn(async () => Array.from(fileInfos.keys())),
      loadPrompt: jest.fn(async () => "PROMPT {{USER_REQUEST}} {{CODE_CONTENT}}"),
    } as unknown as CodeParserService;
  };

  beforeEach(() => {
    (vscode.workspace.fs.readFile as jest.Mock).mockReset();
  });

  it("defines tool metadata and schema", () => {
    const tool = new ExtractCodeTool(new LLMProviderService({} as any));

    assert.strictEqual(tool.definition.name, "extract_relevant_code");
    assert.ok(tool.definition.parameters.properties.projectId);
    assert.strictEqual(tool.definition.required.includes("projectId"), true);
  });

  it("requests context once when executed", async () => {
    const provider = new MockLLMProviderService(
      buildMockResponse(
        JSON.stringify({
          relevance_score: 8,
          context: "Details",
          file_path: "/repo/src/file.ts",
        }),
      ),
    );
    const fileInfos = buildFileInfos();
    const parser = stubCodeParser(fileInfos);
    const tool = new ExtractCodeTool(
      provider as unknown as LLMProviderService,
      parser,
    );

    jest
      .spyOn(tool as unknown as { prepareCodeElementsForLlmAnalysis: (files: string[], fileInfos: Map<string, FileInfo>) => Promise<Map<string, { path: string; snippet: string; element?: any }>> }, "prepareCodeElementsForLlmAnalysis")
      .mockResolvedValue(new Map([["/repo/src/file.ts", { path: "/repo/src/file.ts", snippet: "function foo()" }]]));

    const result = await tool.execute(baseParams);

    expect(provider.chatCalls).toHaveLength(1);
    expect(result.success).toBe(true);
    expect(result.result?.analysis.context).toBe("Details");
    expect(result.result?.files[0]?.path).toBe("/repo/src/file.ts");
    expect(result.result?.files[0]?.snippet).toContain("function foo()");
  });

  it("uses LLM analysis result and included file path", async () => {
    const provider = new MockLLMProviderService(
      buildMockResponse(
        JSON.stringify({
          relevance_score: 5,
          context: "Summary",
          file_path: "/repo/src/file.ts",
        }),
      ),
    );
    const fileInfos = buildFileInfos();
    const parser = stubCodeParser(fileInfos);
    const tool = new ExtractCodeTool(
      provider as unknown as LLMProviderService,
      parser,
    );

    jest
      .spyOn(tool as unknown as { prepareCodeElementsForLlmAnalysis: (files: string[], fileInfos: Map<string, FileInfo>) => Promise<Map<string, { path: string; snippet: string; element?: any }>> }, "prepareCodeElementsForLlmAnalysis")
      .mockResolvedValue(new Map([["/repo/src/file.ts", { path: "/repo/src/file.ts", snippet: "function foo()" }]]));

    const result = await tool.execute(baseParams);

    expect(result.result?.analysis.file_path).toBe("/repo/src/file.ts");
    expect(result.result?.files[0]?.path).toBe("/repo/src/file.ts");
    expect(result.result?.files[0]?.snippet).toContain("function foo()");
  });
});

