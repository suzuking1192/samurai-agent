/**
 * Unit tests for RecentFilesTracker
 */

import * as vscode from 'vscode';
import { RecentFilesTracker } from '../../src/services/RecentFilesTracker';

// Mock VS Code API
jest.mock('vscode', () => {
  const mockDisposable = { dispose: jest.fn() };
  const mockWorkspaceFolders = [
    {
      uri: { fsPath: '/Users/test/workspace1' },
      name: 'workspace1',
      index: 0,
    },
    {
      uri: { fsPath: '/Users/test/workspace2' },
      name: 'workspace2',
      index: 1,
    },
  ];

  return {
    workspace: {
      workspaceFolders: mockWorkspaceFolders,
      onDidOpenTextDocument: jest.fn(() => mockDisposable),
      getWorkspaceFolder: jest.fn((uri) => {
        const fsPath = uri.fsPath;
        if (fsPath.startsWith('/Users/test/workspace1')) {
          return mockWorkspaceFolders[0];
        } else if (fsPath.startsWith('/Users/test/workspace2')) {
          return mockWorkspaceFolders[1];
        }
        return undefined;
      }),
      textDocuments: [],
    },
    window: {
      tabGroups: {
        all: [],
      },
    },
    Uri: {
      file: jest.fn((path) => ({ fsPath: path, scheme: 'file' })),
    },
    TabInputText: class TabInputText {
      constructor(public uri: any) {}
    },
  };
});

describe('RecentFilesTracker', () => {
  let tracker: RecentFilesTracker;
  let onDidOpenTextDocumentCallback: ((doc: vscode.TextDocument) => void) | null = null;

  beforeEach(() => {
    // Reset singleton instance for each test
    (RecentFilesTracker as any).instance = undefined;
    
    // Reset mock
    jest.clearAllMocks();
    
    // Capture the onDidOpenTextDocument callback
    (vscode.workspace.onDidOpenTextDocument as jest.Mock).mockImplementation((callback) => {
      onDidOpenTextDocumentCallback = callback;
      return { dispose: jest.fn() };
    });

    // Initialize with empty open documents
    (vscode.workspace as any).textDocuments = [];
    (vscode.window.tabGroups as any).all = [];

    tracker = RecentFilesTracker.getInstance();
  });

  afterEach(() => {
    tracker.dispose();
    onDidOpenTextDocumentCallback = null;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when getInstance is called multiple times', () => {
      const instance1 = RecentFilesTracker.getInstance();
      const instance2 = RecentFilesTracker.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should create a new instance after dispose', () => {
      const instance1 = RecentFilesTracker.getInstance();
      tracker.dispose();
      
      (RecentFilesTracker as any).instance = undefined; // Reset for new instance
      const instance2 = RecentFilesTracker.getInstance();
      
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should register onDidOpenTextDocument event listener', () => {
      tracker.initialize();
      
      expect(vscode.workspace.onDidOpenTextDocument).toHaveBeenCalled();
    });

    it('should not initialize twice', () => {
      tracker.initialize();
      tracker.initialize();
      
      // Should only be called once
      expect(vscode.workspace.onDidOpenTextDocument).toHaveBeenCalledTimes(1);
    });

    it('should track currently open documents on initialization', () => {
      const mockDoc1 = {
        uri: { fsPath: '/Users/test/workspace1/file1.ts', scheme: 'file' },
        isUntitled: false,
      } as vscode.TextDocument;

      const mockDoc2 = {
        uri: { fsPath: '/Users/test/workspace1/file2.ts', scheme: 'file' },
        isUntitled: false,
      } as vscode.TextDocument;

      (vscode.workspace as any).textDocuments = [mockDoc1, mockDoc2];

      tracker.initialize();

      const recentFiles = tracker.getRecentlyOpenedFilePaths(10, '/Users/test/workspace1');
      expect(recentFiles).toContain('/Users/test/workspace1/file1.ts');
      expect(recentFiles).toContain('/Users/test/workspace1/file2.ts');
    });
  });

  describe('File Tracking via Events', () => {
    beforeEach(() => {
      tracker.initialize();
    });

    it('should track when a file is opened', () => {
      const mockDoc = {
        uri: { fsPath: '/Users/test/workspace1/newfile.ts', scheme: 'file' },
        isUntitled: false,
      } as vscode.TextDocument;

      onDidOpenTextDocumentCallback?.(mockDoc);

      const recentFiles = tracker.getRecentlyOpenedFilePaths(10, '/Users/test/workspace1');
      expect(recentFiles).toContain('/Users/test/workspace1/newfile.ts');
    });

    it('should not track untitled documents', () => {
      const mockDoc = {
        uri: { fsPath: 'Untitled-1', scheme: 'untitled' },
        isUntitled: true,
      } as vscode.TextDocument;

      onDidOpenTextDocumentCallback?.(mockDoc);

      const recentFiles = tracker.getRecentlyOpenedFilePaths(10, '/Users/test/workspace1');
      expect(recentFiles).not.toContain('Untitled-1');
    });

    it('should not track non-file URIs', () => {
      const mockDoc = {
        uri: { fsPath: 'output://extension-output', scheme: 'output' },
        isUntitled: false,
      } as vscode.TextDocument;

      onDidOpenTextDocumentCallback?.(mockDoc);

      const recentFiles = tracker.getRecentlyOpenedFilePaths(10, '/Users/test/workspace1');
      expect(recentFiles).toHaveLength(0);
    });

    it('should move already tracked file to front when reopened', () => {
      const mockDoc1 = {
        uri: { fsPath: '/Users/test/workspace1/file1.ts', scheme: 'file' },
        isUntitled: false,
      } as vscode.TextDocument;

      const mockDoc2 = {
        uri: { fsPath: '/Users/test/workspace1/file2.ts', scheme: 'file' },
        isUntitled: false,
      } as vscode.TextDocument;

      onDidOpenTextDocumentCallback?.(mockDoc1);
      onDidOpenTextDocumentCallback?.(mockDoc2);

      let recentFiles = tracker.getRecentlyOpenedFilePaths(10, '/Users/test/workspace1');
      expect(recentFiles[0]).toBe('/Users/test/workspace1/file2.ts');
      expect(recentFiles[1]).toBe('/Users/test/workspace1/file1.ts');

      // Reopen file1
      onDidOpenTextDocumentCallback?.(mockDoc1);

      recentFiles = tracker.getRecentlyOpenedFilePaths(10, '/Users/test/workspace1');
      expect(recentFiles[0]).toBe('/Users/test/workspace1/file1.ts');
      expect(recentFiles[1]).toBe('/Users/test/workspace1/file2.ts');
    });

    it('should maintain max cache size of 50 files', () => {
      // Track 60 files
      for (let i = 0; i < 60; i++) {
        const mockDoc = {
          uri: { fsPath: `/Users/test/workspace1/file${i}.ts`, scheme: 'file' },
          isUntitled: false,
        } as vscode.TextDocument;
        onDidOpenTextDocumentCallback?.(mockDoc);
      }

      const recentFiles = tracker.getRecentlyOpenedFilePaths(100, '/Users/test/workspace1');
      expect(recentFiles.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Workspace Filtering', () => {
    beforeEach(() => {
      tracker.initialize();
    });

    it('should only return files from the specified workspace', () => {
      const mockDoc1 = {
        uri: { fsPath: '/Users/test/workspace1/file1.ts', scheme: 'file' },
        isUntitled: false,
      } as vscode.TextDocument;

      const mockDoc2 = {
        uri: { fsPath: '/Users/test/workspace2/file2.ts', scheme: 'file' },
        isUntitled: false,
      } as vscode.TextDocument;

      onDidOpenTextDocumentCallback?.(mockDoc1);
      onDidOpenTextDocumentCallback?.(mockDoc2);

      const workspace1Files = tracker.getRecentlyOpenedFilePaths(10, '/Users/test/workspace1');
      expect(workspace1Files).toContain('/Users/test/workspace1/file1.ts');
      expect(workspace1Files).not.toContain('/Users/test/workspace2/file2.ts');

      const workspace2Files = tracker.getRecentlyOpenedFilePaths(10, '/Users/test/workspace2');
      expect(workspace2Files).toContain('/Users/test/workspace2/file2.ts');
      expect(workspace2Files).not.toContain('/Users/test/workspace1/file1.ts');
    });

    it('should not track files outside any workspace', () => {
      const mockDoc = {
        uri: { fsPath: '/Users/other/external/file.ts', scheme: 'file' },
        isUntitled: false,
      } as vscode.TextDocument;

      onDidOpenTextDocumentCallback?.(mockDoc);

      const recentFiles = tracker.getRecentlyOpenedFilePaths(10, '/Users/test/workspace1');
      expect(recentFiles).not.toContain('/Users/other/external/file.ts');
    });

    it('should use first workspace folder as default', () => {
      const mockDoc = {
        uri: { fsPath: '/Users/test/workspace1/file1.ts', scheme: 'file' },
        isUntitled: false,
      } as vscode.TextDocument;

      onDidOpenTextDocumentCallback?.(mockDoc);

      // Call without workspace parameter
      const recentFiles = tracker.getRecentlyOpenedFilePaths(10);
      expect(recentFiles).toContain('/Users/test/workspace1/file1.ts');
    });

    it('should return empty array when no workspace folders exist', () => {
      (vscode.workspace as any).workspaceFolders = undefined;

      const recentFiles = tracker.getRecentlyOpenedFilePaths(10);
      expect(recentFiles).toEqual([]);
    });
  });

  describe('Hybrid Approach: Open Tabs + Event Tracking', () => {
    beforeEach(() => {
      tracker.initialize();
    });

    it('should prioritize currently open tabs over recently closed files', () => {
      // Track some files via events
      const closedDoc1 = {
        uri: { fsPath: '/Users/test/workspace1/closed1.ts', scheme: 'file' },
        isUntitled: false,
      } as vscode.TextDocument;

      const closedDoc2 = {
        uri: { fsPath: '/Users/test/workspace1/closed2.ts', scheme: 'file' },
        isUntitled: false,
      } as vscode.TextDocument;

      onDidOpenTextDocumentCallback?.(closedDoc1);
      onDidOpenTextDocumentCallback?.(closedDoc2);

      // Mock currently open tabs
      const TabInputText = (vscode as any).TabInputText;
      (vscode.window.tabGroups as any).all = [
        {
          tabs: [
            {
              input: new TabInputText({
                fsPath: '/Users/test/workspace1/open1.ts',
                scheme: 'file',
              }),
            },
            {
              input: new TabInputText({
                fsPath: '/Users/test/workspace1/open2.ts',
                scheme: 'file',
              }),
            },
          ],
        },
      ];

      const recentFiles = tracker.getRecentlyOpenedFilePaths(10, '/Users/test/workspace1');

      // Open tabs should come first
      expect(recentFiles[0]).toBe('/Users/test/workspace1/open1.ts');
      expect(recentFiles[1]).toBe('/Users/test/workspace1/open2.ts');
      // Then recently closed files
      expect(recentFiles).toContain('/Users/test/workspace1/closed2.ts');
      expect(recentFiles).toContain('/Users/test/workspace1/closed1.ts');
    });

    it('should not duplicate files that are both open and in event history', () => {
      // Track a file via event
      const mockDoc = {
        uri: { fsPath: '/Users/test/workspace1/file1.ts', scheme: 'file' },
        isUntitled: false,
      } as vscode.TextDocument;

      onDidOpenTextDocumentCallback?.(mockDoc);

      // Same file is currently open in tab
      const TabInputText = (vscode as any).TabInputText;
      (vscode.window.tabGroups as any).all = [
        {
          tabs: [
            {
              input: new TabInputText({
                fsPath: '/Users/test/workspace1/file1.ts',
                scheme: 'file',
              }),
            },
          ],
        },
      ];

      const recentFiles = tracker.getRecentlyOpenedFilePaths(10, '/Users/test/workspace1');

      // Should only appear once
      expect(recentFiles.filter(f => f === '/Users/test/workspace1/file1.ts').length).toBe(1);
    });

    it('should filter open tabs by workspace', () => {
      const TabInputText = (vscode as any).TabInputText;
      (vscode.window.tabGroups as any).all = [
        {
          tabs: [
            {
              input: new TabInputText({
                fsPath: '/Users/test/workspace1/file1.ts',
                scheme: 'file',
              }),
            },
            {
              input: new TabInputText({
                fsPath: '/Users/test/workspace2/file2.ts',
                scheme: 'file',
              }),
            },
          ],
        },
      ];

      const workspace1Files = tracker.getRecentlyOpenedFilePaths(10, '/Users/test/workspace1');
      expect(workspace1Files).toContain('/Users/test/workspace1/file1.ts');
      expect(workspace1Files).not.toContain('/Users/test/workspace2/file2.ts');
    });

    it('should handle multiple tab groups', () => {
      const TabInputText = (vscode as any).TabInputText;
      (vscode.window.tabGroups as any).all = [
        {
          tabs: [
            {
              input: new TabInputText({
                fsPath: '/Users/test/workspace1/file1.ts',
                scheme: 'file',
              }),
            },
          ],
        },
        {
          tabs: [
            {
              input: new TabInputText({
                fsPath: '/Users/test/workspace1/file2.ts',
                scheme: 'file',
              }),
            },
          ],
        },
      ];

      const recentFiles = tracker.getRecentlyOpenedFilePaths(10, '/Users/test/workspace1');
      expect(recentFiles).toContain('/Users/test/workspace1/file1.ts');
      expect(recentFiles).toContain('/Users/test/workspace1/file2.ts');
    });

    it('should ignore non-file tabs', () => {
      (vscode.window.tabGroups as any).all = [
        {
          tabs: [
            {
              input: {
                uri: { fsPath: 'output://logs', scheme: 'output' },
              },
            },
          ],
        },
      ];

      const recentFiles = tracker.getRecentlyOpenedFilePaths(10, '/Users/test/workspace1');
      expect(recentFiles).toHaveLength(0);
    });
  });

  describe('Limit Parameter', () => {
    beforeEach(() => {
      tracker.initialize();
    });

    it('should respect the limit parameter', () => {
      // Track 10 files
      for (let i = 0; i < 10; i++) {
        const mockDoc = {
          uri: { fsPath: `/Users/test/workspace1/file${i}.ts`, scheme: 'file' },
          isUntitled: false,
        } as vscode.TextDocument;
        onDidOpenTextDocumentCallback?.(mockDoc);
      }

      const recentFiles = tracker.getRecentlyOpenedFilePaths(5, '/Users/test/workspace1');
      expect(recentFiles.length).toBe(5);
    });

    it('should use default limit of 10', () => {
      // Track 20 files
      for (let i = 0; i < 20; i++) {
        const mockDoc = {
          uri: { fsPath: `/Users/test/workspace1/file${i}.ts`, scheme: 'file' },
          isUntitled: false,
        } as vscode.TextDocument;
        onDidOpenTextDocumentCallback?.(mockDoc);
      }

      // Don't specify limit (defaults to 10)
      const recentFiles = tracker.getRecentlyOpenedFilePaths();
      expect(recentFiles.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Dispose', () => {
    it('should dispose event listener', () => {
      const disposeMock = jest.fn();
      (vscode.workspace.onDidOpenTextDocument as jest.Mock).mockReturnValue({
        dispose: disposeMock,
      });

      tracker.initialize();
      tracker.dispose();

      expect(disposeMock).toHaveBeenCalled();
    });

    it('should clear recent files on dispose', () => {
      tracker.initialize();

      const mockDoc = {
        uri: { fsPath: '/Users/test/workspace1/file1.ts', scheme: 'file' },
        isUntitled: false,
      } as vscode.TextDocument;

      onDidOpenTextDocumentCallback?.(mockDoc);

      let recentFiles = tracker.getRecentlyOpenedFilePaths(10, '/Users/test/workspace1');
      expect(recentFiles.length).toBeGreaterThan(0);

      tracker.dispose();

      recentFiles = tracker.getRecentlyOpenedFilePaths(10, '/Users/test/workspace1');
      expect(recentFiles.length).toBe(0);
    });

    it('should handle multiple dispose calls gracefully', () => {
      tracker.initialize();
      
      expect(() => {
        tracker.dispose();
        tracker.dispose();
      }).not.toThrow();
    });
  });
});

