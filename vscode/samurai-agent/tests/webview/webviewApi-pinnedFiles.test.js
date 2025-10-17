/**
 * Unit tests for WebviewApi - pinnedFilePaths fix verification
 * These tests verify that pinnedFilePaths are correctly passed through the agent.execute API
 */

// Create event listeners storage
const eventListeners = {};

// Mock the VS Code API
global.window = {
    acquireVsCodeApi: jest.fn(() => ({
        postMessage: jest.fn()
    })),
    addEventListener: jest.fn((event, handler) => {
        if (!eventListeners[event]) {
            eventListeners[event] = [];
        }
        eventListeners[event].push(handler);
    }),
    dispatchEvent: jest.fn((event) => {
        const listeners = eventListeners[event.type] || [];
        listeners.forEach(handler => handler(event));
    })
};

describe('WebviewApi - Pinned Files Fix', () => {
    let mockVscodeApi;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Clear event listeners
        Object.keys(eventListeners).forEach(key => delete eventListeners[key]);
        
        mockVscodeApi = {
            postMessage: jest.fn()
        };
        window.acquireVsCodeApi.mockReturnValue(mockVscodeApi);
        
        // Reset the global WebviewApi
        delete window.WebviewApi;
        delete window.postCommand;
        
        // Re-import the module to reset state
        jest.resetModules();
        
        // Load the webviewApi module
        require('../../src/webview/webviewApi.js');
    });

    describe('agent.execute API', () => {
        it('should provide agent API methods', () => {
            expect(window.WebviewApi).toBeDefined();
            expect(window.WebviewApi.agent).toBeDefined();
            expect(typeof window.WebviewApi.agent.execute).toBe('function');
        });

        it('should include pinnedFilePaths in payload when provided', () => {
            const userMessage = {
                id: 'user-123',
                content: 'Fix bug',
                role: 'user'
            };
            const session = {
                id: 'session-456',
                projectId: 'project-789'
            };
            const pinnedFilePaths = ['/path/to/file1.ts', '/path/to/file2.ts'];

            // Call execute (it will return a pending promise, but we just care about the postMessage call)
            window.WebviewApi.agent.execute({
                userMessage,
                session,
                pinnedFilePaths
            });

            // Verify postMessage was called with correct payload structure
            expect(mockVscodeApi.postMessage).toHaveBeenCalledTimes(1);
            
            const call = mockVscodeApi.postMessage.mock.calls[0][0];
            expect(call.command).toBe('samurai-agent.execute');
            expect(call.requestId).toBeDefined();
            expect(call.payload).toBeDefined();
            expect(call.payload.userMessage).toEqual(userMessage);
            expect(call.payload.session).toEqual(session);
            expect(call.payload.pinnedFilePaths).toEqual(pinnedFilePaths);
        });

        it('should not include pinnedFilePaths in payload when not provided', () => {
            const userMessage = {
                id: 'user-123',
                content: 'Test',
                role: 'user'
            };
            const session = {
                id: 'session-456',
                projectId: 'project-789'
            };

            window.WebviewApi.agent.execute({
                userMessage,
                session
            });

            const call = mockVscodeApi.postMessage.mock.calls[0][0];
            expect(call.payload.pinnedFilePaths).toBeUndefined();
        });

        it('should include empty pinnedFilePaths array when provided', () => {
            const userMessage = {
                id: 'user-123',
                content: 'Test',
                role: 'user'
            };
            const session = {
                id: 'session-456'
            };
            const pinnedFilePaths = [];

            window.WebviewApi.agent.execute({
                userMessage,
                session,
                pinnedFilePaths
            });

            const call = mockVscodeApi.postMessage.mock.calls[0][0];
            // Empty array is truthy, so it should be included
            expect(call.payload.pinnedFilePaths).toEqual([]);
        });

        it('should pass pinnedFilePaths along with constructed userMessage', () => {
            const session = {
                id: 'session-456',
                metadata: { projectId: 'project-789' }
            };
            const message = 'Test message';
            const pinnedFilePaths = ['/file.ts'];

            window.WebviewApi.agent.execute({
                message,
                session,
                pinnedFilePaths
            });

            const call = mockVscodeApi.postMessage.mock.calls[0][0];
            expect(call.payload.userMessage).toBeDefined();
            expect(call.payload.userMessage.content).toBe(message);
            expect(call.payload.pinnedFilePaths).toEqual(pinnedFilePaths);
        });

        it('should handle multiple pinned files (up to 5)', () => {
            const userMessage = {
                id: 'user-999',
                content: 'Review',
                role: 'user'
            };
            const session = { id: 'session-999' };
            const pinnedFilePaths = [
                '/src/file1.ts',
                '/src/file2.ts',
                '/src/file3.ts',
                '/src/file4.ts',
                '/src/file5.ts'
            ];

            window.WebviewApi.agent.execute({
                userMessage,
                session,
                pinnedFilePaths
            });

            const call = mockVscodeApi.postMessage.mock.calls[0][0];
            expect(call.payload.pinnedFilePaths).toHaveLength(5);
            expect(call.payload.pinnedFilePaths).toEqual(pinnedFilePaths);
        });
    });
});

