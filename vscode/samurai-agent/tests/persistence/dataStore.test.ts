import { DataStore } from '../../src/persistence/dataStore';
import { ExtractCodeToolResultPayload } from '../../src/common/models/tool-models';
import { Session, UserIntentEnum, SessionStatus } from '../../src/common/models/chat-models';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('DataStore - Code Context Methods', () => {
  let dataStore: DataStore;
  const mockWorkspaceRoot = '/test/workspace';

  beforeEach(() => {
    jest.clearAllMocks();
    dataStore = new DataStore(mockWorkspaceRoot);
  });

  describe('saveCodeContext', () => {
    const mockPayload: ExtractCodeToolResultPayload = {
      relevance_score: 0.9,
      context: 'Test context',
      file_path: 'test.ts',
      relevantCodeElements: []
    };

    it('should save code context and return unique ID', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.writeFileSync.mockImplementation(() => undefined);

      const result = await dataStore.saveCodeContext(mockPayload, 'project-1', 'session-1');

      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('code_contexts'),
        { recursive: true }
      );
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        JSON.stringify(mockPayload, null, 2)
      );
    });

    it('should handle directory creation errors', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(
        dataStore.saveCodeContext(mockPayload, 'project-1', 'session-1')
      ).rejects.toThrow('Permission denied');
    });

    it('should handle file write errors', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });

      await expect(
        dataStore.saveCodeContext(mockPayload, 'project-1', 'session-1')
      ).rejects.toThrow('Disk full');
    });
  });

  describe('loadCodeContext', () => {
    const mockPayload: ExtractCodeToolResultPayload = {
      relevance_score: 0.9,
      context: 'Test context',
      file_path: 'test.ts',
      relevantCodeElements: []
    };

    it('should load code context successfully', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockPayload));

      const result = await dataStore.loadCodeContext('context-1', 'project-1');

      expect(result).toEqual(mockPayload);
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('context-1.json'),
        'utf8'
      );
    });

    it('should return undefined when file does not exist', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = await dataStore.loadCodeContext('context-1', 'project-1');

      expect(result).toBeUndefined();
    });

    it('should return undefined when file read fails', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const result = await dataStore.loadCodeContext('context-1', 'project-1');

      expect(result).toBeUndefined();
    });

    it('should return undefined when JSON parsing fails', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('invalid json');

      const result = await dataStore.loadCodeContext('context-1', 'project-1');

      expect(result).toBeUndefined();
    });
  });

  describe('loadAllCodeContextForSession', () => {
    const mockSession: Session = {
      id: 'session-1',
      title: 'Test Session',
      status: SessionStatus.ACTIVE,
      messageCount: 0,
      totalTokens: 0,
      totalCost: 0,
      lastMessageAt: new Date(),
      tags: [],
      metadata: { projectId: 'project-1' },
      codeContextIds: ['context-1', 'context-2', 'context-3'],
      previous_session_intent: UserIntentEnum.PURE_DISCUSSION,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockPayload1: ExtractCodeToolResultPayload = {
      relevance_score: 0.9,
      context: 'Context 1',
      file_path: 'test1.ts',
      relevantCodeElements: []
    };

    const mockPayload2: ExtractCodeToolResultPayload = {
      relevance_score: 0.8,
      context: 'Context 2',
      file_path: 'test2.ts',
      relevantCodeElements: []
    };

    it('should load all code contexts for a session', async () => {
      // Mock the session loading
      const loadSessionInternalSpy = jest.spyOn(dataStore as any, 'loadSessionInternal');
      loadSessionInternalSpy.mockReturnValue(mockSession);

      // Mock individual context loading
      const loadCodeContextSpy = jest.spyOn(dataStore, 'loadCodeContext');
      loadCodeContextSpy
        .mockResolvedValueOnce(mockPayload1)
        .mockResolvedValueOnce(mockPayload2)
        .mockResolvedValueOnce(undefined); // context-3 fails to load

      const result = await dataStore.loadAllCodeContextForSession('session-1', 'project-1');

      expect(result).toHaveLength(2);
      expect(result).toContain(mockPayload1);
      expect(result).toContain(mockPayload2);
      expect(loadCodeContextSpy).toHaveBeenCalledTimes(3);
    });

    it('should return empty array when session is not found', async () => {
      const loadSessionInternalSpy = jest.spyOn(dataStore as any, 'loadSessionInternal');
      loadSessionInternalSpy.mockReturnValue(null);

      const result = await dataStore.loadAllCodeContextForSession('session-1', 'project-1');

      expect(result).toEqual([]);
    });

    it('should return empty array when session has no code context IDs', async () => {
      const sessionWithoutContext = { ...mockSession, codeContextIds: [] };
      const loadSessionInternalSpy = jest.spyOn(dataStore as any, 'loadSessionInternal');
      loadSessionInternalSpy.mockReturnValue(sessionWithoutContext);

      const result = await dataStore.loadAllCodeContextForSession('session-1', 'project-1');

      expect(result).toEqual([]);
    });

    it('should handle errors gracefully and continue loading other contexts', async () => {
      const loadSessionInternalSpy = jest.spyOn(dataStore as any, 'loadSessionInternal');
      loadSessionInternalSpy.mockReturnValue(mockSession);

      const loadCodeContextSpy = jest.spyOn(dataStore, 'loadCodeContext');
      loadCodeContextSpy
        .mockRejectedValueOnce(new Error('Context 1 error'))
        .mockResolvedValueOnce(mockPayload2)
        .mockResolvedValueOnce(undefined);

      const result = await dataStore.loadAllCodeContextForSession('session-1', 'project-1');

      expect(result).toHaveLength(1);
      expect(result).toContain(mockPayload2);
    });

    it('should handle session loading errors gracefully', async () => {
      const loadSessionInternalSpy = jest.spyOn(dataStore as any, 'loadSessionInternal');
      loadSessionInternalSpy.mockImplementation(() => {
        throw new Error('Session loading error');
      });

      const result = await dataStore.loadAllCodeContextForSession('session-1', 'project-1');

      expect(result).toEqual([]);
    });
  });
});
