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

      const result = await (extractCodeTool as any).rankRelevantFiles(
        fileInfos,
        'test query',
        'test-project'
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

      const result = await (extractCodeTool as any).rankRelevantFiles(
        fileInfos,
        'test query',
        'test-project'
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

});
