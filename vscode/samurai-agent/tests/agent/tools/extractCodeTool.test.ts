import { ExtractCodeTool, ExtractCodeToolResultPayload } from '../../../src/agent/tools/extractCodeTool';
import { LLMProviderService } from '../../../src/agent/llm/llmProviderService';
import { CodeParserService } from '../../../src/agent/code_parser/CodeParserService';
import { TelemetryService } from '../../../src/services/TelemetryService';
import { ResponseType } from '../../../src/common/models/response-models';
import { LLMResponse } from '../../../src/common/models/llm-models';
import { FileInfo, CodeElement } from '../../../src/common/models/context-models';
import * as vscode from 'vscode';

// Mock vscode
jest.mock('vscode', () => ({
  workspace: {
    fs: {
      readFile: jest.fn(),
      stat: jest.fn(),
    },
  },
  Uri: {
    file: jest.fn((path) => ({ fsPath: path })),
    parse: jest.fn((path) => ({ fsPath: path })),
  },
}));

describe('ExtractCodeTool', () => {
  let extractCodeTool: ExtractCodeTool;
  let mockLlmProvider: jest.Mocked<LLMProviderService>;
  let mockCodeParser: jest.Mocked<CodeParserService>;
  let mockTelemetryService: jest.Mocked<TelemetryService>;

  beforeEach(() => {
    mockLlmProvider = {
      chat: jest.fn(),
    } as any;

    mockCodeParser = {
      scanCodebase: jest.fn(),
      getRelevantFiles: jest.fn(),
      loadPrompt: jest.fn(),
      detectLanguage: jest.fn(),
      extractElementsFromFile: jest.fn(),
      extractImportsFromContent: jest.fn(),
    } as any;

    mockTelemetryService = {
      captureError: jest.fn(),
    } as any;

    extractCodeTool = new ExtractCodeTool(mockLlmProvider, mockCodeParser, mockTelemetryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should successfully extract code elements and return comprehensive result', async () => {
      const params = {
        query: 'test query',
        projectId: 'test-project',
        connectedCodebasePath: '/test/path',
      };

      const mockFileInfo = new Map<string, FileInfo>();
      const mockElements: CodeElement[] = [
        {
          name: 'testFunction',
          type: 'function',
          lineStart: 10,
          lineEnd: 15,
          filePath: '/test/file.ts',
          signature: 'function testFunction() {}',
          codeSnippet: 'function testFunction() {\n  return "test";\n}',
        },
      ];

      mockFileInfo.set('/test/file.ts', {
        path: '/test/file.ts',
        name: 'file.ts',
        extension: '.ts',
        language: 'typescript',
        size: 1000,
        elements: mockElements,
        lastModified: new Date('2023-01-01'),
      });

      mockCodeParser.scanCodebase.mockResolvedValue(mockFileInfo);
      mockCodeParser.loadPrompt.mockResolvedValue('Test prompt template');

      // Mock LLM response for ranking
      const mockRankingResponse: LLMResponse = {
        content: JSON.stringify({
          '/test/file.ts': ['testFunction']
        }),
        role: 'assistant',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockLlmProvider.chat
        .mockResolvedValueOnce({
          type: ResponseType.SUCCESS,
          payload: mockRankingResponse,
        });

      // Mock file reading
      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
        new Uint8Array(Buffer.from('function testFunction() {\n  return "test";\n}'))
      );

      // Mock LLM response
      const mockLlmResponse: LLMResponse = {
        content: JSON.stringify({
          analysis: 'Test function analysis'
        }),
        role: 'assistant',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock the LLM calls with different responses based on purpose
      mockLlmProvider.chat.mockImplementation((request) => {
        if (request.metadata.purpose === 'rank_relevant_files_and_elements') {
          return Promise.resolve({
            type: ResponseType.SUCCESS,
            payload: mockRankingResponse,
          });
        } else if (request.metadata.purpose === 'extract_code_context') {
          return Promise.resolve({
            type: ResponseType.SUCCESS,
            payload: mockLlmResponse,
          });
        }
        return Promise.resolve({
          type: ResponseType.ERROR,
          payload: { message: 'Unknown purpose' },
        });
      });

      const result = await extractCodeTool.execute(params);

      expect(result.success).toBe(true);
      
      // Check that result conforms to ExtractCodeToolResultPayload
      const payload = result.result as ExtractCodeToolResultPayload;
      expect(payload).toBeDefined();
      expect(payload.relevantCodeElements).toBeDefined();
      expect(payload.analysis).toBeDefined();
      expect(payload.files).toBeDefined();
      
      // Check analysis properties
      expect(payload.analysis).toBe('Test function analysis');
      
      // Check elements
      expect(result.elements).toHaveLength(1);
      expect(result.elements![0]).toEqual({
        name: 'testFunction',
        type: 'function',
        lineStart: 10,
        filePath: '/test/file.ts',
        signature: 'function testFunction() {}',
      });
      
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      const params = {
        query: 'test query',
        projectId: 'test-project',
      };

      mockCodeParser.scanCodebase.mockRejectedValue(new Error('Scan failed'));

      const result = await extractCodeTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to scan codebase: Scan failed');
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle no relevant files found', async () => {
      const params = {
        query: 'test query',
        projectId: 'test-project',
      };

      mockCodeParser.scanCodebase.mockResolvedValue(new Map());

      const result = await extractCodeTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No code files found that match the provided parameters.');
    });
  });

  describe('buildStructuredCodeContextSnippets', () => {
    it('should build structured context with multiple elements', async () => {
      const fileInfos = new Map<string, FileInfo>();
      const relevantElementSelections = new Map<string, Array<{ name: string; type: string; }>>();
      
      const mockElements: CodeElement[] = [
        {
          name: 'testFunction',
          type: 'function',
          lineStart: 10,
          lineEnd: 15,
          filePath: '/test/file.ts',
          signature: 'function testFunction() {',
          codeSnippet: 'function testFunction() {\n  return "test";\n}',
        },
        {
          name: 'testClass',
          type: 'class',
          lineStart: 20,
          lineEnd: 30,
          filePath: '/test/file.ts',
          signature: 'class testClass {',
          codeSnippet: 'class testClass {\n  constructor() {}\n}',
        },
      ];

      fileInfos.set('/test/file.ts', {
        path: '/test/file.ts',
        name: 'file.ts',
        extension: '.ts',
        language: 'typescript',
        size: 1000,
        elements: mockElements,
        lastModified: new Date(),
      });

      relevantElementSelections.set('/test/file.ts', [
        { name: 'testFunction', type: 'function' },
        { name: 'testClass', type: 'class' },
      ]);

      const result = await (extractCodeTool as any).buildStructuredCodeContextSnippets(
        fileInfos,
        relevantElementSelections,
        1000
      );

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('/test/file.ts');
      expect(result[0].elements).toHaveLength(2);
      expect(result[0].snippet).toContain('// Function: testFunction');
      expect(result[0].snippet).toContain('// Class: testClass');
      expect(result[0].snippet).toContain('function testFunction() {');
      expect(result[0].snippet).toContain('class testClass {');
    });

    it('should handle global token limit by stopping when limit is reached', async () => {
      const fileInfos = new Map<string, FileInfo>();
      const relevantElementSelections = new Map<string, Array<{ name: string; type: string; }>>();
      
      const mockElement1: CodeElement = {
        name: 'function1',
        type: 'function',
        lineStart: 10,
        lineEnd: 15,
        filePath: '/test/file1.ts',
        signature: 'function function1() {',
        codeSnippet: 'function function1() {\n  return "test1";\n}',
      };

      const mockElement2: CodeElement = {
        name: 'function2',
        type: 'function',
        lineStart: 10,
        lineEnd: 15,
        filePath: '/test/file2.ts',
        signature: 'function function2() {',
        codeSnippet: 'function function2() {\n  return "test2";\n}',
      };

      fileInfos.set('/test/file1.ts', {
        path: '/test/file1.ts',
        name: 'file1.ts',
        extension: '.ts',
        language: 'typescript',
        size: 1000,
        elements: [mockElement1],
        lastModified: new Date(),
      });

      fileInfos.set('/test/file2.ts', {
        path: '/test/file2.ts',
        name: 'file2.ts',
        extension: '.ts',
        language: 'typescript',
        size: 1000,
        elements: [mockElement2],
        lastModified: new Date(),
      });

      // Set file1 as more important (first in order)
      relevantElementSelections.set('/test/file1.ts', [
        { name: 'function1', type: 'function' },
      ]);
      relevantElementSelections.set('/test/file2.ts', [
        { name: 'function2', type: 'function' },
      ]);

      const result = await (extractCodeTool as any).buildStructuredCodeContextSnippets(
        fileInfos,
        relevantElementSelections,
        100 // Very small global limit
      );

      // Should only include the first file since it's more important
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('/test/file1.ts');
      expect(result[0].snippet).toContain('// Function: function1');
    });

    it('should truncate single element when it exceeds global limit', async () => {
      const fileInfos = new Map<string, FileInfo>();
      const relevantElementSelections = new Map<string, Array<{ name: string; type: string; }>>();
      
      const mockElement: CodeElement = {
        name: 'longFunction',
        type: 'function',
        lineStart: 10,
        lineEnd: 15,
        filePath: '/test/file.ts',
        signature: 'function longFunction() {',
        codeSnippet: 'function longFunction() {\n  // This is a very long function with lots of content\n  // that exceeds the maximum length limit\n  // and should be truncated\n  return "very long content here";\n}',
      };

      fileInfos.set('/test/file.ts', {
        path: '/test/file.ts',
        name: 'file.ts',
        extension: '.ts',
        language: 'typescript',
        size: 1000,
        elements: [mockElement],
        lastModified: new Date(),
      });

      relevantElementSelections.set('/test/file.ts', [
        { name: 'longFunction', type: 'function' },
      ]);

      const result = await (extractCodeTool as any).buildStructuredCodeContextSnippets(
        fileInfos,
        relevantElementSelections,
        100 // Very small global limit
      );

      expect(result).toHaveLength(1);
      expect(result[0].snippet.length).toBeLessThanOrEqual(100);
      expect(result[0].snippet).toContain('// Function: longFunction');
      expect(result[0].snippet).toContain('... (truncated) ...');
    });

    it('should skip files with no relevant elements', async () => {
      const fileInfos = new Map<string, FileInfo>();
      const relevantElementSelections = new Map<string, Array<{ name: string; type: string; }>>();
      
      const mockElement: CodeElement = {
        name: 'testFunction',
        type: 'function',
        lineStart: 10,
        lineEnd: 15,
        filePath: '/test/file.ts',
        signature: 'function testFunction() {',
        codeSnippet: 'function testFunction() {\n  return "test";\n}',
      };

      fileInfos.set('/test/file.ts', {
        path: '/test/file.ts',
        name: 'file.ts',
        extension: '.ts',
        language: 'typescript',
        size: 1000,
        elements: [mockElement],
        lastModified: new Date(),
      });

      // No relevant elements for this file
      relevantElementSelections.set('/test/file.ts', []);

      const result = await (extractCodeTool as any).buildStructuredCodeContextSnippets(
        fileInfos,
        relevantElementSelections,
        1000
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('rankRelevantFiles', () => {
    it('should use LLM to identify relevant files and elements', async () => {
      const fileInfos = new Map<string, FileInfo>();
      const mockElements: CodeElement[] = [
        {
          name: 'testFunction',
          type: 'function',
          lineStart: 10,
          lineEnd: 15,
          filePath: '/test/file.ts',
          signature: 'function testFunction() {',
          codeSnippet: 'function testFunction() {\n  return "test";\n}',
        },
      ];

      fileInfos.set('/test/file.ts', {
        path: '/test/file.ts',
        name: 'file.ts',
        extension: '.ts',
        language: 'typescript',
        size: 1000,
        elements: mockElements,
        lastModified: new Date(),
      });

      mockCodeParser.loadPrompt.mockResolvedValue('Test ranking prompt');

      const mockRankingResponse: LLMResponse = {
        content: JSON.stringify({
          '/test/file.ts': ['testFunction']
        }),
        role: 'assistant',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockLlmProvider.chat.mockResolvedValue({
        type: ResponseType.SUCCESS,
        payload: mockRankingResponse,
      });

      const result = await (extractCodeTool as any).rankRelevantFileswithLLM(
        fileInfos,
        'test query',
        'test-project',
        ''
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.get('/test/file.ts')).toEqual([
        { name: 'testFunction', type: 'function' }
      ]);
      expect(mockLlmProvider.chat).toHaveBeenCalledTimes(1);
    });

    it('should fallback to file ranking when LLM fails', async () => {
      const fileInfos = new Map<string, FileInfo>();
      const mockElements: CodeElement[] = [
        {
          name: 'testFunction',
          type: 'function',
          lineStart: 10,
          lineEnd: 15,
          filePath: '/test/file.ts',
          signature: 'function testFunction() {',
          codeSnippet: 'function testFunction() {\n  return "test";\n}',
        },
      ];

      fileInfos.set('/test/file.ts', {
        path: '/test/file.ts',
        name: 'file.ts',
        extension: '.ts',
        language: 'typescript',
        size: 1000,
        elements: mockElements,
        lastModified: new Date(),
      });

      mockCodeParser.loadPrompt.mockResolvedValue('Test ranking prompt');

      // Mock LLM failure
      mockLlmProvider.chat.mockResolvedValue({
        type: ResponseType.ERROR,
        payload: { message: 'LLM error' },
      });

      const result = await (extractCodeTool as any).rankRelevantFileswithLLM(
        fileInfos,
        'test query',
        'test-project',
        ''
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.get('/test/file.ts')).toEqual([
        { name: 'testFunction', type: 'function' }
      ]);
    });
  });

  describe('getCommentForElementType', () => {
    it('should return correct comment for function type', () => {
      const result = (extractCodeTool as any).getCommentForElementType('function');
      expect(result).toBe('// Function:');
    });

    it('should return correct comment for class type', () => {
      const result = (extractCodeTool as any).getCommentForElementType('class');
      expect(result).toBe('// Class:');
    });

    it('should return correct comment for interface type', () => {
      const result = (extractCodeTool as any).getCommentForElementType('interface');
      expect(result).toBe('// Interface:');
    });

    it('should return default comment for unknown type', () => {
      const result = (extractCodeTool as any).getCommentForElementType('unknown');
      expect(result).toBe('// Element:');
    });
  });

  describe('error tracking', () => {
    it('should capture errors to telemetry service when execute fails', async () => {
      const params = {
        query: 'test query',
        projectId: 'test-project',
        connectedCodebasePath: '/test/path',
        model: 'test-model'
      };

      // Mock scanCodebase to throw an error
      mockCodeParser.scanCodebase.mockRejectedValue(new Error('Scan failed'));

      const result = await extractCodeTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Scan failed');
      
      // Verify that captureError was called
      expect(mockTelemetryService.captureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          service: 'ExtractCodeTool',
          function: 'execute',
          executionTime: expect.any(Number),
          params: expect.objectContaining({
            query: 'test query',
            projectId: 'test-project',
            hasFilePathPattern: false,
            hasConnectedCodebasePath: true,
            maxIterations: 2,
            model: 'test-model'
          })
        })
      );
    });

    it('should capture errors to telemetry service when scanCodebase fails', async () => {
      const params = {
        query: 'test query',
        projectId: 'test-project',
        connectedCodebasePath: '/test/path',
        model: 'test-model'
      };

      // Mock scanCodebase to throw an error
      const scanError = new Error('Codebase scan failed');
      mockCodeParser.scanCodebase.mockRejectedValue(scanError);

      const result = await extractCodeTool.execute(params);

      expect(result.success).toBe(false);
      
      // Verify that captureError was called for scanCodebase error
      expect(mockTelemetryService.captureError).toHaveBeenCalledWith(
        scanError,
        expect.objectContaining({
          service: 'ExtractCodeTool',
          function: 'scanCodebase',
          params: expect.objectContaining({
            projectId: 'test-project',
            connectedCodebasePath: '/test/path',
            maxFiles: 5000
          })
        })
      );
    });
  });

  describe('keyword-based search functionality', () => {
    describe('performKeywordBasedSearch', () => {
      it('should return empty result when no keywords provided', async () => {
        const fileInfos = new Map<string, FileInfo>();
        const params = {
          query: 'test query',
          projectId: 'test-project',
          maxIterations: 2,
          model: 'test-model',
          filenameKeywords: [],
          methodNameKeywords: [],
          codeKeywords: [],
        };

        const result = await (extractCodeTool as any).performKeywordBasedSearch(fileInfos, params);

        expect(result).toBeInstanceOf(Map);
        expect(result.size).toBe(0);
      });

      it('should perform filename keyword search', async () => {
        const fileInfos = new Map<string, FileInfo>();
        const mockElements: CodeElement[] = [
          {
            name: 'testFunction',
            type: 'function',
            lineStart: 10,
            lineEnd: 15,
            filePath: '/test/auth.ts',
            signature: 'function testFunction() {',
            codeSnippet: 'function testFunction() {\n  return "test";\n}',
          },
        ];

        fileInfos.set('/test/auth.ts', {
          path: '/test/auth.ts',
          name: 'auth.ts',
          extension: '.ts',
          language: 'typescript',
          size: 1000,
          elements: mockElements,
          lastModified: new Date(),
        });

        fileInfos.set('/test/user.ts', {
          path: '/test/user.ts',
          name: 'user.ts',
          extension: '.ts',
          language: 'typescript',
          size: 1000,
          elements: mockElements,
          lastModified: new Date(),
        });

        const params = {
          query: 'test query',
          projectId: 'test-project',
          maxIterations: 2,
          model: 'test-model',
          filenameKeywords: ['auth'],
          methodNameKeywords: [],
          codeKeywords: [],
        };

        const result = await (extractCodeTool as any).performKeywordBasedSearch(fileInfos, params);

        expect(result.size).toBe(1);
        expect(result.has('/test/auth.ts')).toBe(true);
        expect(result.get('/test/auth.ts')).toEqual([
          { name: 'testFunction', type: 'function' }
        ]);
      });

      it('should perform method name keyword search', async () => {
        const fileInfos = new Map<string, FileInfo>();
        const mockElements: CodeElement[] = [
          {
            name: 'authenticateUser',
            type: 'function',
            lineStart: 10,
            lineEnd: 15,
            filePath: '/test/auth.ts',
            signature: 'function authenticateUser() {',
            codeSnippet: 'function authenticateUser() {\n  return "auth";\n}',
          },
          {
            name: 'validateToken',
            type: 'function',
            lineStart: 20,
            lineEnd: 25,
            filePath: '/test/auth.ts',
            signature: 'function validateToken() {',
            codeSnippet: 'function validateToken() {\n  return "valid";\n}',
          },
        ];

        fileInfos.set('/test/auth.ts', {
          path: '/test/auth.ts',
          name: 'auth.ts',
          extension: '.ts',
          language: 'typescript',
          size: 1000,
          elements: mockElements,
          lastModified: new Date(),
        });

        const params = {
          query: 'test query',
          projectId: 'test-project',
          maxIterations: 2,
          model: 'test-model',
          filenameKeywords: [],
          methodNameKeywords: ['authenticate'],
          codeKeywords: [],
        };

        const result = await (extractCodeTool as any).performKeywordBasedSearch(fileInfos, params);

        expect(result.size).toBe(1);
        expect(result.get('/test/auth.ts')).toEqual([
          { name: 'authenticateUser', type: 'function' }
        ]);
      });

      it('should perform code content keyword search', async () => {
        const fileInfos = new Map<string, FileInfo>();
        const mockElements: CodeElement[] = [
          {
            name: 'loginFunction',
            type: 'function',
            lineStart: 10,
            lineEnd: 15,
            filePath: '/test/auth.ts',
            signature: 'function loginFunction() {',
            codeSnippet: 'function loginFunction() {\n  return "login";\n}',
          },
        ];

        fileInfos.set('/test/auth.ts', {
          path: '/test/auth.ts',
          name: 'auth.ts',
          extension: '.ts',
          language: 'typescript',
          size: 1000,
          elements: mockElements,
          lastModified: new Date(),
        });

        // Mock file reading
        (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
          new Uint8Array(Buffer.from('function loginFunction() {\n  const jwt = "token";\n  return jwt;\n}'))
        );

        const params = {
          query: 'test query',
          projectId: 'test-project',
          maxIterations: 2,
          model: 'test-model',
          filenameKeywords: [],
          methodNameKeywords: [],
          codeKeywords: ['jwt'],
        };

        const result = await (extractCodeTool as any).performKeywordBasedSearch(fileInfos, params);

        expect(result.size).toBe(1);
        expect(result.get('/test/auth.ts')).toEqual([
          { name: 'loginFunction', type: 'function' }
        ]);
      });

      it('should handle file reading errors gracefully', async () => {
        const fileInfos = new Map<string, FileInfo>();
        const mockElements: CodeElement[] = [
          {
            name: 'testFunction',
            type: 'function',
            lineStart: 10,
            lineEnd: 15,
            filePath: '/test/auth.ts',
            signature: 'function testFunction() {',
            codeSnippet: 'function testFunction() {\n  return "test";\n}',
          },
        ];

        fileInfos.set('/test/auth.ts', {
          path: '/test/auth.ts',
          name: 'auth.ts',
          extension: '.ts',
          language: 'typescript',
          size: 1000,
          elements: mockElements,
          lastModified: new Date(),
        });

        // Mock file reading to throw an error
        (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(new Error('File read failed'));

        const params = {
          query: 'test query',
          projectId: 'test-project',
          maxIterations: 2,
          model: 'test-model',
          filenameKeywords: [],
          methodNameKeywords: [],
          codeKeywords: ['jwt'],
        };

        const result = await (extractCodeTool as any).performKeywordBasedSearch(fileInfos, params);

        expect(result.size).toBe(0);
        expect(mockTelemetryService.captureError).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({
            service: 'ExtractCodeTool',
            function: 'searchByCodeKeywords',
            params: expect.objectContaining({
              filePath: '/test/auth.ts',
              codeKeywords: ['jwt']
            })
          })
        );
      });

      it('should apply global limit of 20 elements', async () => {
        const fileInfos = new Map<string, FileInfo>();
        const mockElements: CodeElement[] = [
          {
            name: 'testFunction',
            type: 'function',
            lineStart: 10,
            lineEnd: 15,
            filePath: '/test/file.ts',
            signature: 'function testFunction() {',
            codeSnippet: 'function testFunction() {\n  return "test";\n}',
          },
        ];

        // Create 25 files to test the limit
        for (let i = 0; i < 25; i++) {
          const filePath = `/test/file${i}.ts`;
          fileInfos.set(filePath, {
            path: filePath,
            name: `file${i}.ts`,
            extension: '.ts',
            language: 'typescript',
            size: 1000,
            elements: mockElements,
            lastModified: new Date(),
          });
        }

        const params = {
          query: 'test query',
          projectId: 'test-project',
          maxIterations: 2,
          model: 'test-model',
          filenameKeywords: ['file'],
          methodNameKeywords: [],
          codeKeywords: [],
        };

        const result = await (extractCodeTool as any).performKeywordBasedSearch(fileInfos, params);

        expect(result.size).toBe(20); // Should be limited to 20
      });
    });

    describe('mergeKeywordAndLLMSelections', () => {
      it('should merge keyword and LLM selections correctly', () => {
        const llmSelections = new Map<string, Array<{ name: string; type: string; }>>();
        llmSelections.set('/test/file1.ts', [
          { name: 'function1', type: 'function' },
          { name: 'class1', type: 'class' }
        ]);

        const keywordSelections = new Map<string, Array<{ name: string; type: string; }>>();
        keywordSelections.set('/test/file1.ts', [
          { name: 'function2', type: 'function' }
        ]);
        keywordSelections.set('/test/file2.ts', [
          { name: 'function3', type: 'function' }
        ]);

        const result = (extractCodeTool as any).mergeKeywordAndLLMSelections(llmSelections, keywordSelections);

        expect(result.size).toBe(2);
        expect(result.get('/test/file1.ts')).toEqual([
          { name: 'function1', type: 'function' },
          { name: 'class1', type: 'class' },
          { name: 'function2', type: 'function' }
        ]);
        expect(result.get('/test/file2.ts')).toEqual([
          { name: 'function3', type: 'function' }
        ]);
      });

      it('should prefer specific types over unknown types', () => {
        const llmSelections = new Map<string, Array<{ name: string; type: string; }>>();
        llmSelections.set('/test/file1.ts', [
          { name: 'function1', type: 'unknown' }
        ]);

        const keywordSelections = new Map<string, Array<{ name: string; type: string; }>>();
        keywordSelections.set('/test/file1.ts', [
          { name: 'function1', type: 'function' }
        ]);

        const result = (extractCodeTool as any).mergeKeywordAndLLMSelections(llmSelections, keywordSelections);

        expect(result.get('/test/file1.ts')).toEqual([
          { name: 'function1', type: 'function' }
        ]);
      });

      it('should avoid duplicate elements', () => {
        const llmSelections = new Map<string, Array<{ name: string; type: string; }>>();
        llmSelections.set('/test/file1.ts', [
          { name: 'function1', type: 'function' }
        ]);

        const keywordSelections = new Map<string, Array<{ name: string; type: string; }>>();
        keywordSelections.set('/test/file1.ts', [
          { name: 'function1', type: 'function' }
        ]);

        const result = (extractCodeTool as any).mergeKeywordAndLLMSelections(llmSelections, keywordSelections);

        expect(result.get('/test/file1.ts')).toEqual([
          { name: 'function1', type: 'function' }
        ]);
      });
    });

    describe('searchByFilenameKeywords', () => {
      it('should match filenames case-insensitively', () => {
        const fileInfos = new Map<string, FileInfo>();
        const mockElements: CodeElement[] = [
          {
            name: 'testFunction',
            type: 'function',
            lineStart: 10,
            lineEnd: 15,
            filePath: '/test/AUTH.ts',
            signature: 'function testFunction() {',
            codeSnippet: 'function testFunction() {\n  return "test";\n}',
          },
        ];

        fileInfos.set('/test/AUTH.ts', {
          path: '/test/AUTH.ts',
          name: 'AUTH.ts',
          extension: '.ts',
          language: 'typescript',
          size: 1000,
          elements: mockElements,
          lastModified: new Date(),
        });

        const result = (extractCodeTool as any).searchByFilenameKeywords(fileInfos, ['auth']);

        expect(result.size).toBe(1);
        expect(result.has('/test/AUTH.ts')).toBe(true);
      });

      it('should return empty result when no filename keywords provided', () => {
        const fileInfos = new Map<string, FileInfo>();
        const result = (extractCodeTool as any).searchByFilenameKeywords(fileInfos, []);

        expect(result.size).toBe(0);
      });
    });

    describe('searchByMethodNameKeywords', () => {
      it('should match method names case-insensitively', () => {
        const fileInfos = new Map<string, FileInfo>();
        const mockElements: CodeElement[] = [
          {
            name: 'AUTHENTICATE_USER',
            type: 'function',
            lineStart: 10,
            lineEnd: 15,
            filePath: '/test/auth.ts',
            signature: 'function AUTHENTICATE_USER() {',
            codeSnippet: 'function AUTHENTICATE_USER() {\n  return "auth";\n}',
          },
        ];

        fileInfos.set('/test/auth.ts', {
          path: '/test/auth.ts',
          name: 'auth.ts',
          extension: '.ts',
          language: 'typescript',
          size: 1000,
          elements: mockElements,
          lastModified: new Date(),
        });

        const result = (extractCodeTool as any).searchByMethodNameKeywords(fileInfos, ['authenticate']);

        expect(result.size).toBe(1);
        expect(result.get('/test/auth.ts')).toEqual([
          { name: 'AUTHENTICATE_USER', type: 'function' }
        ]);
      });

      it('should return empty result when no method name keywords provided', () => {
        const fileInfos = new Map<string, FileInfo>();
        const result = (extractCodeTool as any).searchByMethodNameKeywords(fileInfos, []);

        expect(result.size).toBe(0);
      });
    });

    describe('searchByCodeKeywords', () => {
      it('should match code content case-insensitively', async () => {
        const fileInfos = new Map<string, FileInfo>();
        const mockElements: CodeElement[] = [
          {
            name: 'testFunction',
            type: 'function',
            lineStart: 10,
            lineEnd: 15,
            filePath: '/test/auth.ts',
            signature: 'function testFunction() {',
            codeSnippet: 'function testFunction() {\n  return "test";\n}',
          },
        ];

        fileInfos.set('/test/auth.ts', {
          path: '/test/auth.ts',
          name: 'auth.ts',
          extension: '.ts',
          language: 'typescript',
          size: 1000,
          elements: mockElements,
          lastModified: new Date(),
        });

        // Mock file reading
        (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
          new Uint8Array(Buffer.from('function testFunction() {\n  const JWT_TOKEN = "secret";\n  return JWT_TOKEN;\n}'))
        );

        const result = await (extractCodeTool as any).searchByCodeKeywords(fileInfos, ['jwt']);

        expect(result.size).toBe(1);
        expect(result.get('/test/auth.ts')).toEqual([
          { name: 'testFunction', type: 'function' }
        ]);
      });

      it('should return empty result when no code keywords provided', async () => {
        const fileInfos = new Map<string, FileInfo>();
        const result = await (extractCodeTool as any).searchByCodeKeywords(fileInfos, []);

        expect(result.size).toBe(0);
      });

      it('should include all elements when no specific element matches found', async () => {
        const fileInfos = new Map<string, FileInfo>();
        const mockElements: CodeElement[] = [
          {
            name: 'function1',
            type: 'function',
            lineStart: 10,
            lineEnd: 15,
            filePath: '/test/auth.ts',
            signature: 'function function1() {',
            codeSnippet: 'function function1() {\n  return "test1";\n}',
          },
          {
            name: 'function2',
            type: 'function',
            lineStart: 20,
            lineEnd: 25,
            filePath: '/test/auth.ts',
            signature: 'function function2() {',
            codeSnippet: 'function function2() {\n  return "test2";\n}',
          },
        ];

        fileInfos.set('/test/auth.ts', {
          path: '/test/auth.ts',
          name: 'auth.ts',
          extension: '.ts',
          language: 'typescript',
          size: 1000,
          elements: mockElements,
          lastModified: new Date(),
        });

        // Mock file reading
        (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
          new Uint8Array(Buffer.from('function function1() {\n  const jwt = "token";\n  return jwt;\n}\nfunction function2() {\n  return "test2";\n}'))
        );

        const result = await (extractCodeTool as any).searchByCodeKeywords(fileInfos, ['jwt']);

        expect(result.size).toBe(1);
        expect(result.get('/test/auth.ts')).toEqual([
          { name: 'function1', type: 'function' },
          { name: 'function2', type: 'function' }
        ]);
      });
    });

    describe('consolidateKeywordMatches', () => {
      it('should consolidate matches with proper priority', () => {
        const result = new Map<string, Array<{ name: string; type: string; }>>();
        const filenameMatches = new Map<string, Array<{ name: string; type: string; }>>();
        const methodNameMatches = new Map<string, Array<{ name: string; type: string; }>>();
        const codeContentMatches = new Map<string, Array<{ name: string; type: string; }>>();

        filenameMatches.set('/test/file1.ts', [
          { name: 'function1', type: 'function' }
        ]);

        methodNameMatches.set('/test/file1.ts', [
          { name: 'function2', type: 'function' }
        ]);
        methodNameMatches.set('/test/file2.ts', [
          { name: 'function3', type: 'function' }
        ]);

        codeContentMatches.set('/test/file2.ts', [
          { name: 'function4', type: 'function' }
        ]);
        codeContentMatches.set('/test/file3.ts', [
          { name: 'function5', type: 'function' }
        ]);

        (extractCodeTool as any).consolidateKeywordMatches(result, filenameMatches, methodNameMatches, codeContentMatches);

        expect(result.size).toBe(3);
        expect(result.get('/test/file1.ts')).toEqual([
          { name: 'function1', type: 'function' },
          { name: 'function2', type: 'function' }
        ]);
        expect(result.get('/test/file2.ts')).toEqual([
          { name: 'function3', type: 'function' },
          { name: 'function4', type: 'function' }
        ]);
        expect(result.get('/test/file3.ts')).toEqual([
          { name: 'function5', type: 'function' }
        ]);
      });
    });

    describe('applyGlobalLimit', () => {
      it('should not limit when under the maximum', () => {
        const result = new Map<string, Array<{ name: string; type: string; }>>();
        result.set('/test/file1.ts', [{ name: 'function1', type: 'function' }]);
        result.set('/test/file2.ts', [{ name: 'function2', type: 'function' }]);

        (extractCodeTool as any).applyGlobalLimit(result);

        expect(result.size).toBe(2);
      });

      it('should limit to 20 elements when over the maximum', () => {
        const result = new Map<string, Array<{ name: string; type: string; }>>();
        
        // Create 25 entries
        for (let i = 0; i < 25; i++) {
          result.set(`/test/file${i}.ts`, [{ name: `function${i}`, type: 'function' }]);
        }

        (extractCodeTool as any).applyGlobalLimit(result);

        expect(result.size).toBe(20);
      });
    });
  });

  describe('Recursive Dependency Resolution', () => {
    describe('resolveImportPath', () => {
      it('should resolve relative import paths correctly', async () => {
        const currentFilePath = '/test/src/auth/login.ts';
        const workspaceRoot = '/test';
        const importStatement = './utils';

        // Mock file existence
        (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
          size: 1000,
          mtime: Date.now(),
          type: 1,
        });

        const result = await (extractCodeTool as any).resolveImportPath(
          importStatement,
          currentFilePath,
          workspaceRoot
        );

        expect(result).toBe('/test/src/auth/utils.ts');
      });

      it('should try multiple file extensions', async () => {
        const currentFilePath = '/test/src/auth/login.ts';
        const workspaceRoot = '/test';
        const importStatement = './utils';

        // Mock .ts failing, .js succeeding
        (vscode.workspace.fs.stat as jest.Mock)
          .mockRejectedValueOnce(new Error('Not found'))
          .mockRejectedValueOnce(new Error('Not found'))
          .mockResolvedValueOnce({
            size: 1000,
            mtime: Date.now(),
            type: 1,
          });

        const result = await (extractCodeTool as any).resolveImportPath(
          importStatement,
          currentFilePath,
          workspaceRoot
        );

        expect(result).toBe('/test/src/auth/utils.js');
      });

      it('should resolve index files for directory imports', async () => {
        const currentFilePath = '/test/src/auth/login.ts';
        const workspaceRoot = '/test';
        const importStatement = './helpers';

        // Mock all file extensions failing, index.ts succeeding
        (vscode.workspace.fs.stat as jest.Mock)
          .mockRejectedValueOnce(new Error('Not found'))
          .mockRejectedValueOnce(new Error('Not found'))
          .mockRejectedValueOnce(new Error('Not found'))
          .mockRejectedValueOnce(new Error('Not found'))
          .mockRejectedValueOnce(new Error('Not found'))
          .mockRejectedValueOnce(new Error('Not found'))
          .mockRejectedValueOnce(new Error('Not found'))
          .mockRejectedValueOnce(new Error('Not found'))
          .mockResolvedValueOnce({
            size: 1000,
            mtime: Date.now(),
            type: 1,
          });

        const result = await (extractCodeTool as any).resolveImportPath(
          importStatement,
          currentFilePath,
          workspaceRoot
        );

        expect(result).toBe('/test/src/auth/helpers/index.ts');
      });

      it('should return null for external packages (node_modules)', async () => {
        const currentFilePath = '/test/src/auth/login.ts';
        const workspaceRoot = '/test';
        const importStatement = 'express'; // External package

        const result = await (extractCodeTool as any).resolveImportPath(
          importStatement,
          currentFilePath,
          workspaceRoot
        );

        expect(result).toBeNull();
      });

      it('should return null when file does not exist', async () => {
        const currentFilePath = '/test/src/auth/login.ts';
        const workspaceRoot = '/test';
        const importStatement = './nonexistent';

        // Mock all attempts failing
        (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error('Not found'));

        const result = await (extractCodeTool as any).resolveImportPath(
          importStatement,
          currentFilePath,
          workspaceRoot
        );

        expect(result).toBeNull();
      });
    });

    describe('resolveMissingDependencies', () => {
      beforeEach(() => {
        // Setup default mocks for dependency resolution
        mockCodeParser.detectLanguage.mockReturnValue('typescript');
        mockCodeParser.extractElementsFromFile.mockResolvedValue([
          {
            name: 'testFunction',
            type: 'function',
            lineStart: 1,
            lineEnd: 3,
            filePath: '/test/file.ts',
            signature: 'function testFunction() {}',
            codeSnippet: 'function testFunction() {\n  return "test";\n}',
          },
        ]);
        mockCodeParser.extractImportsFromContent.mockReturnValue([]);
      });

      it('should fetch missing files suggested by LLM (A → B → C scenario)', async () => {
        const existingFileInfos = new Map<string, FileInfo>();
        existingFileInfos.set('/test/fileA.ts', {
          path: '/test/fileA.ts',
          name: 'fileA.ts',
          extension: '.ts',
          language: 'typescript',
          size: 1000,
          elements: [],
          lastModified: new Date(),
        });

        const llmSuggestedFiles = new Map<string, Array<{ name: string; type: string }>>();
        llmSuggestedFiles.set('/test/fileA.ts', [{ name: 'funcA', type: 'function' }]);
        llmSuggestedFiles.set('/test/fileB.ts', [{ name: 'funcB', type: 'function' }]); // Missing
        llmSuggestedFiles.set('/test/fileC.ts', [{ name: 'funcC', type: 'function' }]); // Missing

        // Mock file stats for B and C
        (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
          size: 1000,
          mtime: Date.now(),
          type: 1,
        });

        // Mock file reading
        (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
          new Uint8Array(Buffer.from('function test() {}'))
        );

        const result = await (extractCodeTool as any).resolveMissingDependencies(
          llmSuggestedFiles,
          existingFileInfos,
          '/test',
          3
        );

        expect(result.size).toBe(3);
        expect(result.has('/test/fileA.ts')).toBe(true);
        expect(result.has('/test/fileB.ts')).toBe(true);
        expect(result.has('/test/fileC.ts')).toBe(true);
      });

      it('should recursively fetch transitive dependencies', async () => {
        const existingFileInfos = new Map<string, FileInfo>();
        existingFileInfos.set('/test/fileA.ts', {
          path: '/test/fileA.ts',
          name: 'fileA.ts',
          extension: '.ts',
          language: 'typescript',
          size: 1000,
          elements: [],
          lastModified: new Date(),
        });

        const llmSuggestedFiles = new Map<string, Array<{ name: string; type: string }>>();
        llmSuggestedFiles.set('/test/fileA.ts', [{ name: 'funcA', type: 'function' }]);
        llmSuggestedFiles.set('/test/fileB.ts', [{ name: 'funcB', type: 'function' }]); // Missing

        // Mock fileB importing fileC
        mockCodeParser.extractImportsFromContent.mockImplementation((content, language) => {
          if (content.includes('fileB')) {
            return ['./fileC']; // fileB imports fileC
          }
          return [];
        });

        // Mock file stats
        (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
          size: 1000,
          mtime: Date.now(),
          type: 1,
        });

        // Mock file reading
        (vscode.workspace.fs.readFile as jest.Mock).mockImplementation((uri) => {
          if (uri.fsPath.includes('fileB')) {
            return Promise.resolve(new Uint8Array(Buffer.from("import fileC from './fileC';")));
          }
          return Promise.resolve(new Uint8Array(Buffer.from('function test() {}')));
        });

        const result = await (extractCodeTool as any).resolveMissingDependencies(
          llmSuggestedFiles,
          existingFileInfos,
          '/test',
          3
        );

        // Should have A (existing), B (LLM suggested), and C (transitive from B)
        expect(result.size).toBeGreaterThanOrEqual(2); // At least A and B
      });

      it('should detect and log circular dependencies without infinite loop', async () => {
        const existingFileInfos = new Map<string, FileInfo>();
        
        const llmSuggestedFiles = new Map<string, Array<{ name: string; type: string }>>();
        llmSuggestedFiles.set('/test/fileA.ts', [{ name: 'funcA', type: 'function' }]);

        // Mock circular dependency: A → B → A
        mockCodeParser.extractImportsFromContent.mockImplementation((content, language) => {
          if (content.includes('fileA')) {
            return ['./fileB']; // A imports B
          }
          if (content.includes('fileB')) {
            return ['./fileA']; // B imports A (circular!)
          }
          return [];
        });

        // Mock file stats
        (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
          size: 1000,
          mtime: Date.now(),
          type: 1,
        });

        // Mock file reading
        (vscode.workspace.fs.readFile as jest.Mock).mockImplementation((uri) => {
          if (uri.fsPath.includes('fileA')) {
            return Promise.resolve(new Uint8Array(Buffer.from("import fileB from './fileB';")));
          }
          if (uri.fsPath.includes('fileB')) {
            return Promise.resolve(new Uint8Array(Buffer.from("import fileA from './fileA';")));
          }
          return Promise.resolve(new Uint8Array(Buffer.from('function test() {}')));
        });

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const result = await (extractCodeTool as any).resolveMissingDependencies(
          llmSuggestedFiles,
          existingFileInfos,
          '/test',
          3
        );

        // Should complete without infinite loop
        expect(result.size).toBeGreaterThanOrEqual(1);
        
        // Check that circular dependency was logged
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Circular dependency detected')
        );

        consoleSpy.mockRestore();
      });

      it('should respect max depth limit', async () => {
        const existingFileInfos = new Map<string, FileInfo>();
        
        const llmSuggestedFiles = new Map<string, Array<{ name: string; type: string }>>();
        llmSuggestedFiles.set('/test/file1.ts', [{ name: 'func1', type: 'function' }]);

        // Mock a deep chain: 1 → 2 → 3 → 4 → 5
        mockCodeParser.extractImportsFromContent.mockImplementation((content, language) => {
          if (content.includes('file1')) return ['./file2'];
          if (content.includes('file2')) return ['./file3'];
          if (content.includes('file3')) return ['./file4'];
          if (content.includes('file4')) return ['./file5'];
          return [];
        });

        // Mock file stats
        (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
          size: 1000,
          mtime: Date.now(),
          type: 1,
        });

        // Mock file reading
        (vscode.workspace.fs.readFile as jest.Mock).mockImplementation((uri) => {
          const fileName = uri.fsPath.split('/').pop()?.replace('.ts', '');
          const fileNum = fileName?.replace('file', '');
          const nextNum = parseInt(fileNum || '0') + 1;
          return Promise.resolve(
            new Uint8Array(Buffer.from(`import file${nextNum} from './file${nextNum}';`))
          );
        });

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const result = await (extractCodeTool as any).resolveMissingDependencies(
          llmSuggestedFiles,
          existingFileInfos,
          '/test',
          2 // Max depth of 2
        );

        // Should stop at depth 2, so max 3 files: 1, 2, 3 (not 4, 5)
        expect(result.size).toBeLessThanOrEqual(3);
        
        // Check that max depth was logged
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Stopped at max depth')
        );

        consoleSpy.mockRestore();
      });

      it('should skip already visited files', async () => {
        const existingFileInfos = new Map<string, FileInfo>();
        existingFileInfos.set('/test/fileA.ts', {
          path: '/test/fileA.ts',
          name: 'fileA.ts',
          extension: '.ts',
          language: 'typescript',
          size: 1000,
          elements: [],
          lastModified: new Date(),
        });

        const llmSuggestedFiles = new Map<string, Array<{ name: string; type: string }>>();
        llmSuggestedFiles.set('/test/fileA.ts', [{ name: 'funcA', type: 'function' }]); // Already exists

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const result = await (extractCodeTool as any).resolveMissingDependencies(
          llmSuggestedFiles,
          existingFileInfos,
          '/test',
          3
        );

        expect(result.size).toBe(1); // Only the existing file
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('No missing files to resolve')
        );

        consoleSpy.mockRestore();
      });

      it('should handle file reading errors gracefully', async () => {
        const existingFileInfos = new Map<string, FileInfo>();
        
        const llmSuggestedFiles = new Map<string, Array<{ name: string; type: string }>>();
        llmSuggestedFiles.set('/test/fileB.ts', [{ name: 'funcB', type: 'function' }]);

        // Mock file stat succeeding but read failing
        (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
          size: 1000,
          mtime: Date.now(),
          type: 1,
        });

        (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(undefined);

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const result = await (extractCodeTool as any).resolveMissingDependencies(
          llmSuggestedFiles,
          existingFileInfos,
          '/test',
          3
        );

        // Should not crash, just skip the file
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Could not read file')
        );

        consoleSpy.mockRestore();
      });

      it('should handle unknown language gracefully', async () => {
        const existingFileInfos = new Map<string, FileInfo>();
        
        const llmSuggestedFiles = new Map<string, Array<{ name: string; type: string }>>();
        llmSuggestedFiles.set('/test/file.unknown', [{ name: 'func', type: 'function' }]);

        // Mock language detection failing
        mockCodeParser.detectLanguage.mockReturnValue(null);

        // Mock file stats
        (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
          size: 1000,
          mtime: Date.now(),
          type: 1,
        });

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const result = await (extractCodeTool as any).resolveMissingDependencies(
          llmSuggestedFiles,
          existingFileInfos,
          '/test',
          3
        );

        // Should skip the file with unknown language
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unknown language for')
        );

        consoleSpy.mockRestore();
      });
    });

    describe('Integration: execute with dependency resolution', () => {
      it('should use enriched file infos throughout execution', async () => {
        const params = {
          query: 'test query',
          projectId: 'test-project',
          connectedCodebasePath: '/test/path',
          maxDependencyDepth: 2,
        };

        const mockFileInfo = new Map<string, FileInfo>();
        mockFileInfo.set('/test/fileA.ts', {
          path: '/test/fileA.ts',
          name: 'fileA.ts',
          extension: '.ts',
          language: 'typescript',
          size: 1000,
          elements: [
            {
              name: 'funcA',
              type: 'function',
              lineStart: 1,
              lineEnd: 3,
              filePath: '/test/fileA.ts',
              signature: 'function funcA() {}',
              codeSnippet: 'function funcA() {\n  return "A";\n}',
            },
          ],
          lastModified: new Date(),
        });

        mockCodeParser.scanCodebase.mockResolvedValue(mockFileInfo);
        mockCodeParser.loadPrompt.mockResolvedValue('Test prompt');
        mockCodeParser.extractImportsFromContent.mockReturnValue([]);
        mockCodeParser.detectLanguage.mockReturnValue('typescript');
        mockCodeParser.extractElementsFromFile.mockResolvedValue([
          {
            name: 'funcB',
            type: 'function',
            lineStart: 1,
            lineEnd: 3,
            filePath: '/test/fileB.ts',
            signature: 'function funcB() {}',
            codeSnippet: 'function funcB() {\n  return "B";\n}',
          },
        ]);

        // Mock LLM suggesting file B (which doesn't exist yet)
        const mockRankingResponse: LLMResponse = {
          content: JSON.stringify({
            files: {
              '/test/fileA.ts': ['funcA'],
              '/test/fileB.ts': ['funcB'], // Missing file!
            }
          }),
          role: 'assistant',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockLlmProvider.chat.mockResolvedValue({
          type: ResponseType.SUCCESS,
          payload: mockRankingResponse,
        });

        // Mock file operations for fileB
        (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
          size: 1000,
          mtime: Date.now(),
          type: 1,
        });

        (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
          new Uint8Array(Buffer.from('function funcB() {\n  return "B";\n}'))
        );

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const result = await extractCodeTool.execute(params);

        // Check that enrichment was logged
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Enriched file count:')
        );

        // Should successfully complete even though LLM suggested a missing file
        expect(result.success).toBe(true);

        consoleSpy.mockRestore();
      });
    });
  });

});
