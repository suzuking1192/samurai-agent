import { TreeSitterLoaderService } from '../../../src/agent/code_parser/TreeSitterLoaderService';
import * as vscode from 'vscode';

// Mock vscode
jest.mock('vscode', () => ({
  workspace: {
    fs: {
      stat: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      createDirectory: jest.fn(),
    },
  },
  Uri: {
    file: jest.fn((path) => ({ fsPath: path })),
  },
  window: {
    showErrorMessage: jest.fn(),
  },
}));

// Mock web-tree-sitter
jest.mock('web-tree-sitter', () => ({
  default: jest.fn().mockImplementation(() => ({
    parse: jest.fn(),
    setLanguage: jest.fn(),
  })),
}));

// Mock fetch
global.fetch = jest.fn();

describe('TreeSitterLoaderService', () => {
  let treeSitterLoaderService: TreeSitterLoaderService;
  let mockGlobalStorageUri: vscode.Uri;

  beforeEach(() => {
    mockGlobalStorageUri = { fsPath: '/test/storage' } as vscode.Uri;
    treeSitterLoaderService = new TreeSitterLoaderService(mockGlobalStorageUri);
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with global storage URI', () => {
      expect(treeSitterLoaderService).toBeDefined();
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return list of supported languages', () => {
      const languages = treeSitterLoaderService.getSupportedLanguages();
      
      expect(languages).toContain('typescript');
      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
      expect(languages).toContain('java');
      expect(languages).toContain('cpp');
      expect(languages).toContain('go');
      expect(languages).toContain('rust');
      expect(languages).toContain('php');
      expect(languages).toContain('ruby');
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for supported languages', () => {
      expect(treeSitterLoaderService.isLanguageSupported('typescript')).toBe(true);
      expect(treeSitterLoaderService.isLanguageSupported('python')).toBe(true);
      expect(treeSitterLoaderService.isLanguageSupported('java')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(treeSitterLoaderService.isLanguageSupported('unsupported')).toBe(false);
      expect(treeSitterLoaderService.isLanguageSupported('')).toBe(false);
    });
  });

  describe('loadParser', () => {
    it('should return null for unsupported language', async () => {
      const result = await treeSitterLoaderService.loadParser('unsupported');
      expect(result).toBeNull();
    });

    it('should load parser from cache if already loaded', async () => {
      const mockParser = { parse: jest.fn(), setLanguage: jest.fn() };
      
      // Mock successful loading
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: 1 }); // File exists
      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(new Uint8Array([1, 2, 3]));
      
      // Mock WebAssembly.compile
      const mockWasmModule = {};
      (WebAssembly.compile as jest.Mock) = jest.fn().mockResolvedValue(mockWasmModule);
      
      // Mock tree-sitter module
      const mockTreeSitter = jest.fn().mockImplementation(() => mockParser);
      const webTreeSitter = require('web-tree-sitter');
      webTreeSitter.default = mockTreeSitter;

      const result1 = await treeSitterLoaderService.loadParser('typescript');
      const result2 = await treeSitterLoaderService.loadParser('typescript');

      expect(result1).toBe(mockParser);
      expect(result2).toBe(mockParser); // Should return cached parser
      expect(mockTreeSitter).toHaveBeenCalledTimes(1); // Only called once due to caching
    });

    it('should download and cache parser if not found locally', async () => {
      const mockParser = { parse: jest.fn(), setLanguage: jest.fn() };
      
      // Mock file not found locally
      (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      // Mock successful download
      const mockWasmData = new ArrayBuffer(8);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockWasmData),
      });
      
      // Mock file operations
      (vscode.workspace.fs.createDirectory as jest.Mock).mockResolvedValue(undefined);
      (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(new Uint8Array(mockWasmData));
      
      // Mock WebAssembly.compile
      const mockWasmModule = {};
      (WebAssembly.compile as jest.Mock) = jest.fn().mockResolvedValue(mockWasmModule);
      
      // Mock tree-sitter module
      const mockTreeSitter = jest.fn().mockImplementation(() => mockParser);
      const webTreeSitter = require('web-tree-sitter');
      webTreeSitter.default = mockTreeSitter;

      const result = await treeSitterLoaderService.loadParser('typescript');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://github.com/tree-sitter/tree-sitter/releases/download/v0.20.4/typescript.wasm')
      );
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
      expect(result).toBe(mockParser);
    });

    it('should handle download failure gracefully', async () => {
      // Mock file not found locally
      (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      // Mock download failure
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const showErrorSpy = jest.spyOn(vscode.window, 'showErrorMessage').mockImplementation();

      const result = await treeSitterLoaderService.loadParser('typescript');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download typescript.wasm')
      );
      expect(showErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download tree-sitter parser for typescript')
      );

      consoleSpy.mockRestore();
      showErrorSpy.mockRestore();
    });

    it('should handle WASM compilation failure gracefully', async () => {
      // Mock file exists locally
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: 1 });
      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(new Uint8Array([1, 2, 3]));
      
      // Mock WebAssembly compilation failure
      (WebAssembly.compile as jest.Mock) = jest.fn().mockRejectedValue(new Error('WASM compilation failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await treeSitterLoaderService.loadParser('typescript');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load WASM module')
      );

      consoleSpy.mockRestore();
    });

    it('should handle tree-sitter module import failure gracefully', async () => {
      // Mock file exists locally
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: 1 });
      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(new Uint8Array([1, 2, 3]));
      
      // Mock WebAssembly.compile
      const mockWasmModule = {};
      (WebAssembly.compile as jest.Mock) = jest.fn().mockResolvedValue(mockWasmModule);
      
      // Mock tree-sitter import failure
      const webTreeSitter = require('web-tree-sitter');
      webTreeSitter.default = jest.fn().mockRejectedValue(new Error('Import failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await treeSitterLoaderService.loadParser('typescript');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to import web-tree-sitter')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('clearCache', () => {
    it('should clear the parser cache', () => {
      // This is a simple method that just clears the cache
      expect(() => treeSitterLoaderService.clearCache()).not.toThrow();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = treeSitterLoaderService.getCacheStats();
      
      expect(stats).toHaveProperty('cachedParsers');
      expect(stats).toHaveProperty('supportedLanguages');
      expect(Array.isArray(stats.cachedParsers)).toBe(true);
      expect(Array.isArray(stats.supportedLanguages)).toBe(true);
    });
  });
});
