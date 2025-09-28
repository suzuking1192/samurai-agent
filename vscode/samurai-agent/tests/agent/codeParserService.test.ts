import * as path from "path";
import type * as vscodeTypes from "vscode";
import { CodeParserService } from "../../src/agent/code_parser/CodeParserService";
import type { LLMProviderService } from "../../src/agent/llm/llmProviderService";
import type { ApiResponse } from "../../src/common/models/response-models";
import type { LLMMessage, LLMResponse } from "../../src/common/models/llm-models";
import { CodeElement, FileInfo } from "../../src/common/models/context-models";

const vscode = jest.requireMock("vscode") as typeof vscodeTypes;

const normalize = (targetPath: string): string => path.resolve(targetPath).replace(/\\/g, "/");

type MockFileEntry = {
  type: vscode.FileType;
  data?: string;
  mtime?: number;
  size?: number;
};

describe("CodeParserService", () => {
  let service: CodeParserService;
  let mockFiles: Record<string, MockFileEntry>;
  const llmProvider = {
    chat: jest.fn(),
  } as unknown as LLMProviderService;

  class TestableCodeParserService extends CodeParserService {
    public override async loadPrompt(): Promise<string> {
      return "PROMPT {{USER_REQUEST}} {{FILE_ELEMENTS_SUMMARY}}";
    }
  }

  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    mockFiles = {};
    const now = Date.now();

    const addFile = (filePath: string, data: string) => {
      mockFiles[normalize(filePath)] = {
        type: vscode.FileType.File,
        data,
        mtime: now,
        size: data.length,
      };
    };

    const addDirectory = (dirPath: string) => {
      mockFiles[normalize(dirPath)] = {
        type: vscode.FileType.Directory,
        mtime: now,
        size: 0,
      };
    };

    addDirectory("/workspace");
    addDirectory("/workspace/src");
    addDirectory("/workspace/src/utils");
    addDirectory("/workspace/src/components");
    addDirectory("/workspace/node_modules");

    addFile(
      "/workspace/src/app.py",
      [
        "class Foo:",
        "    def method(self):",
        "        pass",
        "",
        "def function():",
        "    return True",
        "",
      ].join("\n"),
    );

    addFile(
      "/workspace/src/utils/helpers.ts",
      [
        "export function helper() {",
        "  return 42;",
        "}",
      ].join("\n"),
    );

    addFile(
      "/workspace/src/components/Button.jsx",
      [
        "export const Button = () => {",
        "  return <button />;",
        "};",
      ].join("\n"),
    );

    addFile("/workspace/node_modules/module.js", "module.exports = {};\n");
    addFile("/workspace/README.md", "# Project\n");

    Object.defineProperty(vscode.workspace, "workspaceFolders", {
      value: [
        {
          uri: {
            fsPath: normalize("/workspace"),
          },
        },
      ],
      configurable: true,
    });

    jest.spyOn(vscode.workspace.fs, "readFile").mockImplementation(async (uri: vscode.Uri) => {
      const entry = mockFiles[normalize(uri.fsPath)];
      if (!entry || entry.type !== vscode.FileType.File) {
        throw new Error(`File not found: ${uri.fsPath}`);
      }
      return new TextEncoder().encode(entry.data ?? "");
    });

    jest.spyOn(vscode.workspace.fs, "stat").mockImplementation(async (uri: vscode.Uri) => {
      const entry = mockFiles[normalize(uri.fsPath)];
      if (!entry) {
        throw new Error(`Entry not found: ${uri.fsPath}`);
      }
      return {
        type: entry.type,
        mtime: entry.mtime ?? now,
        size: entry.size ?? 0,
        ctime: now,
        permissions: 0,
      };
    });

    jest.spyOn(vscode.workspace.fs, "readDirectory").mockImplementation(async (uri: vscode.Uri) => {
      const directoryPath = normalize(uri.fsPath);
      const entries: [string, vscode.FileType][] = [];
      const seen = new Set<string>();
      const prefix = `${directoryPath}/`;

      for (const [filePath, entry] of Object.entries(mockFiles)) {
        if (filePath === directoryPath || !filePath.startsWith(prefix)) {
          continue;
        }

        const relative = filePath.slice(prefix.length);
        const segment = relative.split("/")[0];
        if (!segment || seen.has(segment)) {
          continue;
        }

        seen.add(segment);
        const childPath = `${directoryPath}/${segment}`;
        const childEntry = mockFiles[childPath];
        entries.push([
          segment,
          childEntry ? childEntry.type : vscode.FileType.File,
        ]);
      }

      return entries;
    });

    llmProvider.chat = jest.fn();
    service = new TestableCodeParserService(normalize("/workspace"));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("detects languages based on file extension", () => {
    expect(service.detectLanguage("foo.py")).toBe("python");
    expect(service.detectLanguage("foo.ts")).toBe("typescript");
    expect(service.detectLanguage("foo.java")).toBe("java");
    expect(service.detectLanguage("foo.unknown")).toBeNull();
  });

  it("ignores files matching ignore patterns", () => {
    expect(service.shouldIgnoreFile(normalize("/workspace/node_modules/module.js"))).toBe(true);
    expect(service.shouldIgnoreFile(normalize("/workspace/src/app.py"))).toBe(false);
  });

  it("identifies functional code files", () => {
    expect(service.isFunctionalCodeFile("foo.py")).toBe(true);
    expect(service.isFunctionalCodeFile("foo.txt")).toBe(false);
    expect(service.isFunctionalCodeFile("package.json")).toBe(true);
  });

  it("extracts elements from Python files", async () => {
    const pythonLines = [
      "class Foo:",
      "    def method(self):",
      "        pass",
      "",
      "def function():",
      "    return True",
    ];
    jest.spyOn(service as unknown as { readFileLines: (path: string) => Promise<string[] | null> }, "readFileLines").mockResolvedValue(pythonLines);

    const elements = await service.extractElementsFromFile(
      normalize("/workspace/src/app.py"),
      "python",
    );
    const names = elements.map((element) => element.name);
    expect(names).toContain("Foo");
    expect(names).toContain("method");
    expect(names).toContain("function");
  });

  it("extracts elements from TypeScript files", async () => {
    const tsLines = [
      "export function helper() {",
      "  return 42;",
      "}",
    ];
    jest.spyOn(service as unknown as { readFileLines: (path: string) => Promise<string[] | null> }, "readFileLines").mockResolvedValue(tsLines);

    const elements = await service.extractElementsFromFile(
      normalize("/workspace/src/utils/helpers.ts"),
      "typescript",
    );
    expect(elements.some((element) => element.name === "helper")).toBe(true);
  });

  it("scans codebase and returns file info for relevant files", async () => {
    const fileInfos = new Map<string, FileInfo>();
    fileInfos.set(normalize("/workspace/src/app.py"), {
      path: normalize("/workspace/src/app.py"),
      name: "app.py",
      extension: ".py",
      language: "python",
      size: 10,
      elements: [{
        name: "function",
        type: "function",
        lineNumber: 1,
        filePath: normalize("/workspace/src/app.py"),
      } as CodeElement],
          lastModified: new Date(0),
    });
    fileInfos.set(normalize("/workspace/src/utils/helpers.ts"), {
      path: normalize("/workspace/src/utils/helpers.ts"),
      name: "helpers.ts",
      extension: ".ts",
      language: "typescript",
      size: 10,
      elements: [{
        name: "helper",
        type: "function",
        lineNumber: 1,
        filePath: normalize("/workspace/src/utils/helpers.ts"),
      } as CodeElement],
      lastModified: new Date(0),
    });

    const ranked = service.rankByHeuristics(fileInfos, "helper", 10);
    expect(ranked[0]).toBe(normalize("/workspace/src/utils/helpers.ts"));
  });

  it("ranks relevant files by query", async () => {
    const fileInfos = new Map<string, FileInfo>();
    fileInfos.set(normalize("/workspace/src/app.py"), {
      path: normalize("/workspace/src/app.py"),
      name: "app.py",
      extension: ".py",
      language: "python",
      size: 10,
      elements: [
        {
          name: "function",
          type: "function",
          lineNumber: 1,
          filePath: normalize("/workspace/src/app.py"),
        } as CodeElement,
      ],
      lastModified: new Date(0),
    });
    fileInfos.set(normalize("/workspace/src/utils/helpers.ts"), {
      path: normalize("/workspace/src/utils/helpers.ts"),
      name: "helpers.ts",
      extension: ".ts",
      language: "typescript",
      size: 10,
      elements: [
        {
          name: "helper",
          type: "function",
          lineNumber: 1,
          filePath: normalize("/workspace/src/utils/helpers.ts"),
        } as CodeElement,
      ],
      lastModified: new Date(0),
    });

    const results = await service.getRelevantFiles(fileInfos, "helper");
    expect(results[0]).toBe(normalize("/workspace/src/utils/helpers.ts"));
  });

  it("throws when scanning without valid root", async () => {
    const instance = new TestableCodeParserService();
    await expect(instance.scanCodebase("/non-existent", 10)).rejects.toThrow();
  });

  it("falls back to heuristic ranking when LLM is unavailable", async () => {
    const fileInfos = new Map<string, FileInfo>();
    fileInfos.set(normalize("/workspace/src/a.ts"), {
      path: normalize("/workspace/src/a.ts"),
      name: "a.ts",
      extension: ".ts",
      language: "typescript",
      size: 1,
      elements: [
        {
          name: "foo",
          type: "function",
          lineNumber: 1,
          filePath: normalize("/workspace/src/a.ts"),
        } as CodeElement,
      ],
      lastModified: new Date(0),
    });

    const results = await service.getRelevantFiles(fileInfos, "foo");

    expect(results).toContain(normalize("/workspace/src/a.ts"));
  });

  it("uses LLM response to prioritize files when available", async () => {
    const fileInfos = new Map<string, FileInfo>();
    fileInfos.set(normalize("/workspace/src/a.ts"), {
      path: normalize("/workspace/src/a.ts"),
      name: "a.ts",
      extension: ".ts",
      language: "typescript",
      size: 1,
      elements: [
        {
          name: "alpha",
          type: "function",
          lineNumber: 1,
          filePath: normalize("/workspace/src/a.ts"),
        } as CodeElement,
      ],
      lastModified: new Date(0),
    });

    fileInfos.set(normalize("/workspace/src/b.ts"), {
      path: normalize("/workspace/src/b.ts"),
      name: "b.ts",
      extension: ".ts",
      language: "typescript",
      size: 1,
      elements: [
        {
          name: "beta",
          type: "function",
          lineNumber: 1,
          filePath: normalize("/workspace/src/b.ts"),
        } as CodeElement,
      ],
      lastModified: new Date(0),
    });

    const llmResponse: ApiResponse<LLMResponse> = {
      type: "success",
      requestId: "1",
      timestamp: new Date(),
      payload: {
        id: "response",
        requestId: "1",
        provider: "openai",
        model: "gpt",
        content: JSON.stringify({
          [normalize("/workspace/src/a.ts")]: ["alpha"],
        }),
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
    } as ApiResponse<LLMResponse>;

    (llmProvider.chat as jest.Mock).mockResolvedValue(llmResponse);
    const llmEnabledService = new TestableCodeParserService(normalize("/workspace"), llmProvider);

    const results = await llmEnabledService.getRelevantFiles(
      fileInfos,
      "alpha",
      10,
      "project",
    );

    expect(results[0]).toBe(normalize("/workspace/src/a.ts"));
    expect(llmProvider.chat).toHaveBeenCalled();
  });
});
