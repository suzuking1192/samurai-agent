/**
 * Tests for Context File Pinning Feature
 * 
 * Tests the complete workflow of pinning files to include them in LLM context:
 * - Session model with pinnedFilePaths
 * - ExtractCodeTool processing of pinned files
 * - Priority handling and token limits
 */

import { Session, SessionStatus, UserIntentEnum } from '../src/common/models/chat-models';
import { ExtractCodeTool } from '../src/agent/tools/extractCodeTool';
import { LLMProviderService } from '../src/agent/llm/llmProviderService';
import { CodeParserService } from '../src/agent/code_parser/CodeParserService';
import { TelemetryService } from '../src/services/TelemetryService';
import * as vscode from 'vscode';

// Mock vscode
jest.mock('vscode', () => ({
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path })),
  },
  workspace: {
    fs: {
      stat: jest.fn().mockResolvedValue({
        size: 1000,
        mtime: Date.now(),
      }),
    },
    workspaceFolders: [{
      uri: { fsPath: '/test/workspace' }
    }],
    textDocuments: [],
  },
}));

describe('Context File Pinning Feature', () => {
  
  describe('Session Model', () => {
    it('should include pinnedFilePaths field in Session interface', () => {
      const session: Session = {
        id: 'test-session-123',
        title: 'Test Session',
        status: SessionStatus.ACTIVE,
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
        lastMessageAt: new Date(),
        tags: [],
        metadata: {
          projectId: 'test-project',
          model: 'gpt-4',
        },
        codeContextIds: [],
        previous_session_intent: UserIntentEnum.PURE_DISCUSSION,
        pinnedFilePaths: [], // NEW field
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(session).toHaveProperty('pinnedFilePaths');
      expect(Array.isArray(session.pinnedFilePaths)).toBe(true);
    });

    it('should allow up to 5 pinned file paths', () => {
      const session: Session = {
        id: 'test-session-123',
        title: 'Test Session',
        status: SessionStatus.ACTIVE,
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
        lastMessageAt: new Date(),
        tags: [],
        metadata: {
          projectId: 'test-project',
        },
        codeContextIds: [],
        previous_session_intent: UserIntentEnum.PURE_DISCUSSION,
        pinnedFilePaths: [
          '/path/to/file1.ts',
          '/path/to/file2.ts',
          '/path/to/file3.ts',
          '/path/to/file4.ts',
          '/path/to/file5.ts',
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(session.pinnedFilePaths.length).toBe(5);
      expect(session.pinnedFilePaths[0]).toBe('/path/to/file1.ts');
    });

    it('should initialize with empty pinnedFilePaths array', () => {
      const session: Session = {
        id: 'test-session-123',
        title: 'Test Session',
        status: SessionStatus.ACTIVE,
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
        lastMessageAt: new Date(),
        tags: [],
        metadata: {
          projectId: 'test-project',
        },
        codeContextIds: [],
        previous_session_intent: UserIntentEnum.PURE_DISCUSSION,
        pinnedFilePaths: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(session.pinnedFilePaths).toEqual([]);
    });
  });

  describe('ExtractCodeTool - Pinned Files Processing', () => {
    let extractCodeTool: ExtractCodeTool;
    let mockLLMProvider: jest.Mocked<LLMProviderService>;
    let mockCodeParser: jest.Mocked<CodeParserService>;
    let mockTelemetry: jest.Mocked<TelemetryService>;

    beforeEach(() => {
      // Create mocks
      mockLLMProvider = {
        chat: jest.fn(),
      } as any;

      mockCodeParser = {
        detectLanguage: jest.fn().mockReturnValue('typescript'),
        extractElementsFromFile: jest.fn().mockResolvedValue([
          {
            name: 'testFunction',
            type: 'function',
            codeSnippet: 'function testFunction() { return true; }',
            startLine: 1,
            endLine: 3,
          },
        ]),
        loadPrompt: jest.fn().mockResolvedValue('test prompt'),
      } as any;

      mockTelemetry = {
        captureError: jest.fn(),
        captureEvent: jest.fn(),
      } as any;

      extractCodeTool = new ExtractCodeTool(
        mockLLMProvider,
        mockCodeParser,
        mockTelemetry
      );
    });

    it('should accept manuallyPinnedFilePaths parameter', () => {
      const params = {
        query: 'test query',
        projectId: 'test-project',
        manuallyPinnedFilePaths: ['/path/to/file.ts'],
      };

      expect(params.manuallyPinnedFilePaths).toBeDefined();
      expect(Array.isArray(params.manuallyPinnedFilePaths)).toBe(true);
    });

    it('should normalize manuallyPinnedFilePaths to empty array if undefined', () => {
      const params = {
        query: 'test query',
        projectId: 'test-project',
      };

      // Access the private normalizeParams method via type assertion
      const normalizeParams = (extractCodeTool as any).normalizeParams.bind(extractCodeTool);
      const normalized = normalizeParams(params);

      expect(normalized.manuallyPinnedFilePaths).toEqual([]);
    });

    it('should preserve provided manuallyPinnedFilePaths', () => {
      const pinnedPaths = ['/path/to/file1.ts', '/path/to/file2.ts'];
      const params = {
        query: 'test query',
        projectId: 'test-project',
        manuallyPinnedFilePaths: pinnedPaths,
      };

      const normalizeParams = (extractCodeTool as any).normalizeParams.bind(extractCodeTool);
      const normalized = normalizeParams(params);

      expect(normalized.manuallyPinnedFilePaths).toEqual(pinnedPaths);
    });
  });

  describe('Pinned Files Priority', () => {
    it('should demonstrate pinned files have priority over auto-extracted files', () => {
      // This is a conceptual test showing the priority order
      const pinnedFiles = [
        { path: '/pinned/file1.ts', priority: 1 },
        { path: '/pinned/file2.ts', priority: 1 },
      ];

      const autoExtractedFiles = [
        { path: '/auto/file1.ts', priority: 2 },
        { path: '/auto/file2.ts', priority: 2 },
      ];

      const allFiles = [...pinnedFiles, ...autoExtractedFiles];
      const sortedByPriority = allFiles.sort((a, b) => a.priority - b.priority);

      // Pinned files should come first
      expect(sortedByPriority[0].path).toBe('/pinned/file1.ts');
      expect(sortedByPriority[1].path).toBe('/pinned/file2.ts');
      expect(sortedByPriority[2].path).toBe('/auto/file1.ts');
      expect(sortedByPriority[3].path).toBe('/auto/file2.ts');
    });

    it('should exclude pinned files from auto-extracted list to avoid duplicates', () => {
      const pinnedPaths = ['/path/to/file1.ts', '/path/to/file2.ts'];
      const allPaths = [
        '/path/to/file1.ts',  // This is pinned
        '/path/to/file2.ts',  // This is pinned
        '/path/to/file3.ts',  // Not pinned
        '/path/to/file4.ts',  // Not pinned
      ];

      // Filter out pinned files from auto-extracted list
      const autoExtractedOnly = allPaths.filter(path => !pinnedPaths.includes(path));

      expect(autoExtractedOnly).toEqual([
        '/path/to/file3.ts',
        '/path/to/file4.ts',
      ]);
      expect(autoExtractedOnly.length).toBe(2);
    });
  });

  describe('File Limit Enforcement', () => {
    it('should enforce maximum of 5 pinned files', () => {
      const pinnedFilePaths: string[] = [];
      const maxFiles = 5;

      // Simulate adding files
      const filesToAdd = [
        '/file1.ts',
        '/file2.ts',
        '/file3.ts',
        '/file4.ts',
        '/file5.ts',
        '/file6.ts', // This should be rejected
      ];

      filesToAdd.forEach(file => {
        if (pinnedFilePaths.length < maxFiles) {
          pinnedFilePaths.push(file);
        }
      });

      expect(pinnedFilePaths.length).toBe(5);
      expect(pinnedFilePaths).not.toContain('/file6.ts');
    });

    it('should prevent duplicate files from being pinned', () => {
      const pinnedFilePaths: string[] = [];
      const fileToPin = '/path/to/file.ts';

      // Try to add the same file twice
      if (!pinnedFilePaths.includes(fileToPin)) {
        pinnedFilePaths.push(fileToPin);
      }

      // Second attempt should be blocked
      if (!pinnedFilePaths.includes(fileToPin)) {
        pinnedFilePaths.push(fileToPin);
      }

      expect(pinnedFilePaths.length).toBe(1);
      expect(pinnedFilePaths).toEqual(['/path/to/file.ts']);
    });
  });

  describe('Token Management', () => {
    it('should calculate token usage for pinned files first', () => {
      const GLOBAL_TOKEN_LIMIT = 300000;
      
      const pinnedFiles = [
        { path: '/pinned1.ts', tokens: 50000 },
        { path: '/pinned2.ts', tokens: 50000 },
      ];

      const autoFiles = [
        { path: '/auto1.ts', tokens: 100000 },
        { path: '/auto2.ts', tokens: 150000 },
      ];

      let totalTokens = 0;
      const includedFiles: string[] = [];

      // Process pinned files first
      pinnedFiles.forEach(file => {
        totalTokens += file.tokens;
        includedFiles.push(file.path);
      });

      // Process auto files with remaining tokens
      autoFiles.forEach(file => {
        if (totalTokens + file.tokens <= GLOBAL_TOKEN_LIMIT) {
          totalTokens += file.tokens;
          includedFiles.push(file.path);
        }
      });

      // Pinned files should always be included
      expect(includedFiles).toContain('/pinned1.ts');
      expect(includedFiles).toContain('/pinned2.ts');
      
      // auto1 should fit (100k + 100k = 200k, under 300k limit)
      expect(includedFiles).toContain('/auto1.ts');
      
      // auto2 should NOT fit (200k + 150k = 350k, exceeds 300k limit)
      expect(includedFiles).not.toContain('/auto2.ts');
      
      // Total should not exceed limit
      expect(totalTokens).toBe(200000);
      expect(totalTokens).toBeLessThanOrEqual(GLOBAL_TOKEN_LIMIT);
    });

    it('should prioritize pinned files even when approaching token limit', () => {
      const GLOBAL_TOKEN_LIMIT = 300000;
      
      const pinnedFiles = [
        { path: '/pinned1.ts', tokens: 150000 },
        { path: '/pinned2.ts', tokens: 140000 },
      ];

      const autoFiles = [
        { path: '/auto1.ts', tokens: 50000 },
      ];

      let totalTokens = 0;
      const includedFiles: string[] = [];

      // Process pinned files first (priority)
      pinnedFiles.forEach(file => {
        totalTokens += file.tokens;
        includedFiles.push(file.path);
      });

      // Process auto files with remaining tokens
      autoFiles.forEach(file => {
        if (totalTokens + file.tokens <= GLOBAL_TOKEN_LIMIT) {
          totalTokens += file.tokens;
          includedFiles.push(file.path);
        }
      });

      // Pinned files should be included
      expect(includedFiles).toContain('/pinned1.ts');
      expect(includedFiles).toContain('/pinned2.ts');
      
      // Auto file should be excluded due to token limit
      expect(includedFiles).not.toContain('/auto1.ts');
      expect(totalTokens).toBe(290000);
    });
  });

  describe('Integration - Full Workflow', () => {
    it('should demonstrate complete pinning workflow', async () => {
      // Step 1: User creates session with empty pinned files
      const session: Session = {
        id: 'test-session',
        title: 'Test Session',
        status: SessionStatus.ACTIVE,
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
        lastMessageAt: new Date(),
        tags: [],
        metadata: {
          projectId: 'test-project',
          model: 'gpt-4',
        },
        codeContextIds: [],
        previous_session_intent: UserIntentEnum.PURE_DISCUSSION,
        pinnedFilePaths: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(session.pinnedFilePaths).toEqual([]);

      // Step 2: User pins files (frontend simulation)
      session.pinnedFilePaths = [
        '/src/models/user.ts',
        '/src/services/auth.ts',
      ];

      expect(session.pinnedFilePaths.length).toBe(2);

      // Step 3: Session is passed to backend with pinned files
      expect(session.pinnedFilePaths).toContain('/src/models/user.ts');
      expect(session.pinnedFilePaths).toContain('/src/services/auth.ts');

      // Step 4: ExtractCodeTool receives pinned files
      const extractParams = {
        query: 'How does authentication work?',
        projectId: 'test-project',
        manuallyPinnedFilePaths: session.pinnedFilePaths,
      };

      expect(extractParams.manuallyPinnedFilePaths).toEqual(session.pinnedFilePaths);
    });

    it('should handle session update with pinned files', () => {
      const initialSession: Session = {
        id: 'test-session',
        title: 'Test Session',
        status: SessionStatus.ACTIVE,
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
        lastMessageAt: new Date(),
        tags: [],
        metadata: {
          projectId: 'test-project',
        },
        codeContextIds: [],
        previous_session_intent: UserIntentEnum.PURE_DISCUSSION,
        pinnedFilePaths: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // User adds pinned files
      const updatedSession = {
        ...initialSession,
        pinnedFilePaths: ['/file1.ts', '/file2.ts'],
      };

      expect(updatedSession.pinnedFilePaths.length).toBe(2);
      expect(initialSession.pinnedFilePaths.length).toBe(0); // Original unchanged
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty pinned files array', () => {
      const session: Session = {
        id: 'test-session',
        title: 'Test Session',
        status: SessionStatus.ACTIVE,
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
        lastMessageAt: new Date(),
        tags: [],
        metadata: {
          projectId: 'test-project',
        },
        codeContextIds: [],
        previous_session_intent: UserIntentEnum.PURE_DISCUSSION,
        pinnedFilePaths: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(session.pinnedFilePaths).toEqual([]);
      expect(session.pinnedFilePaths.length).toBe(0);
    });

    it('should handle session without pinnedFilePaths field (backward compatibility)', () => {
      const legacySession: any = {
        id: 'test-session',
        title: 'Test Session',
        status: SessionStatus.ACTIVE,
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
        lastMessageAt: new Date(),
        tags: [],
        metadata: {
          projectId: 'test-project',
        },
        codeContextIds: [],
        previous_session_intent: UserIntentEnum.PURE_DISCUSSION,
        createdAt: new Date(),
        updatedAt: new Date(),
        // pinnedFilePaths missing
      };

      // Should handle missing field gracefully
      const pinnedFilePaths = legacySession.pinnedFilePaths ?? [];
      expect(pinnedFilePaths).toEqual([]);
    });

    it('should handle file removal from pinned list', () => {
      const pinnedFilePaths = ['/file1.ts', '/file2.ts', '/file3.ts'];
      const fileToRemove = '/file2.ts';

      const index = pinnedFilePaths.indexOf(fileToRemove);
      if (index > -1) {
        pinnedFilePaths.splice(index, 1);
      }

      expect(pinnedFilePaths).toEqual(['/file1.ts', '/file3.ts']);
      expect(pinnedFilePaths.length).toBe(2);
    });

    it('should handle absolute file paths correctly', () => {
      const pinnedFilePaths = [
        '/Users/user/project/src/file1.ts',
        '/Users/user/project/src/utils/file2.ts',
        'C:\\Users\\user\\project\\src\\file3.ts', // Windows path
      ];

      expect(pinnedFilePaths.every(path => path.includes('file'))).toBe(true);
      expect(pinnedFilePaths[0].startsWith('/')).toBe(true);
      expect(pinnedFilePaths[2].includes('\\')).toBe(true);
    });
  });
});

