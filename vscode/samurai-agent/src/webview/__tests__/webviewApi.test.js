/**
 * Unit tests for WebviewApi utility
 */

// Mock the VS Code API
global.window = {
    acquireVsCodeApi: jest.fn(() => ({
        postMessage: jest.fn()
    }))
};

// Import the webviewApi module
// Note: In a real test environment, you'd need to properly mock the module loading
describe('WebviewApi', () => {
    let mockVscodeApi;

    beforeEach(() => {
        jest.clearAllMocks();
        mockVscodeApi = {
            postMessage: jest.fn()
        };
        window.acquireVsCodeApi.mockReturnValue(mockVscodeApi);
        
        // Reset the global WebviewApi
        delete window.WebviewApi;
        delete window.postCommand;
        
        // Re-import the module to reset state
        jest.resetModules();
    });

    describe('postCommand', () => {
        it('should send message to VS Code API', async () => {
            // Mock successful response
            const mockResponse = {
                type: 'success',
                requestId: 'req_123',
                payload: { result: 'success' }
            };

            // Set up message listener
            setTimeout(() => {
                window.dispatchEvent(new MessageEvent('message', {
                    data: mockResponse
                }));
            }, 10);

            // Import the module after setting up the mock
            require('../webviewApi.js');

            const result = await window.postCommand('testCommand', { data: 'test' });

            expect(mockVscodeApi.postMessage).toHaveBeenCalledWith({
                command: 'testCommand',
                requestId: expect.any(String),
                payload: { data: 'test' }
            });

            expect(result).toEqual({ result: 'success' });
        });

        it('should handle error responses', async () => {
            const mockErrorResponse = {
                type: 'error',
                requestId: 'req_456',
                error: 'Test error message'
            };

            setTimeout(() => {
                window.dispatchEvent(new MessageEvent('message', {
                    data: mockErrorResponse
                }));
            }, 10);

            require('../webviewApi.js');

            await expect(window.postCommand('testCommand')).rejects.toThrow('Test error message');
        });

        it('should timeout after specified duration', async () => {
            require('../webviewApi.js');

            await expect(window.postCommand('testCommand', null, 100)).rejects.toThrow('Request timeout after 100ms');
        });

        it('should generate unique request IDs', () => {
            require('../webviewApi.js');

            const calls = [];
            mockVscodeApi.postMessage.mockImplementation((message) => {
                calls.push(message.requestId);
            });

            window.postCommand('command1');
            window.postCommand('command2');
            window.postCommand('command3');

            expect(calls[0]).not.toBe(calls[1]);
            expect(calls[1]).not.toBe(calls[2]);
            expect(calls[0]).not.toBe(calls[2]);
        });
    });

    describe('persistence API', () => {
        beforeEach(() => {
            require('../webviewApi.js');
        });

        it('should provide persistence API methods', () => {
            expect(window.WebviewApi).toBeDefined();
            expect(window.WebviewApi.persistence).toBeDefined();
            expect(typeof window.WebviewApi.persistence.loadSpecs).toBe('function');
            expect(typeof window.WebviewApi.persistence.saveSpec).toBe('function');
            expect(typeof window.WebviewApi.persistence.loadGlobalSettings).toBe('function');
            expect(typeof window.WebviewApi.persistence.saveGlobalSettings).toBe('function');
        });

        it('should call postCommand with correct parameters for loadSpecs', async () => {
            const mockResponse = {
                type: 'success',
                requestId: 'req_load_specs',
                payload: [{ id: 'spec1', title: 'Test Spec' }]
            };

            setTimeout(() => {
                window.dispatchEvent(new MessageEvent('message', {
                    data: mockResponse
                }));
            }, 10);

            const result = await window.WebviewApi.persistence.loadSpecs();

            expect(mockVscodeApi.postMessage).toHaveBeenCalledWith({
                command: 'loadSpecs',
                requestId: expect.any(String),
                payload: null
            });

            expect(result).toEqual([{ id: 'spec1', title: 'Test Spec' }]);
        });

        it('should call postCommand with correct parameters for saveSpec', async () => {
            const spec = { id: 'spec1', title: 'Test Spec', spec: 'Test spec' };
            const mockResponse = {
                type: 'success',
                requestId: 'req_save_spec',
                payload: spec
            };

            setTimeout(() => {
                window.dispatchEvent(new MessageEvent('message', {
                    data: mockResponse
                }));
            }, 10);

            const result = await window.WebviewApi.persistence.saveSpec(spec);

            expect(mockVscodeApi.postMessage).toHaveBeenCalledWith({
                command: 'saveSpec',
                requestId: expect.any(String),
                payload: spec
            });

            expect(result).toEqual(spec);
        });
    });

    describe('UI feedback utilities', () => {
        beforeEach(() => {
            require('../webviewApi.js');
        });

        it('should provide UI feedback methods', () => {
            expect(window.WebviewApi).toBeDefined();
            expect(window.WebviewApi.ui).toBeDefined();
            expect(typeof window.WebviewApi.ui.showLoading).toBe('function');
            expect(typeof window.WebviewApi.ui.showSuccess).toBe('function');
            expect(typeof window.WebviewApi.ui.showError).toBe('function');
            expect(typeof window.WebviewApi.ui.showGlobalLoading).toBe('function');
        });

        it('should show loading state on element', () => {
            const mockElement = {
                innerHTML: 'Original content',
                disabled: false
            };

            const restore = window.WebviewApi.ui.showLoading(mockElement, 'Loading...');

            expect(mockElement.innerHTML).toBe('<span class="loading-indicator">Loading...</span>');
            expect(mockElement.disabled).toBe(true);

            // Test restore function
            restore();
            expect(mockElement.innerHTML).toBe('Original content');
            expect(mockElement.disabled).toBe(false);
        });

        it('should show success message temporarily', (done) => {
            const mockElement = {
                textContent: 'Original',
                style: { backgroundColor: '' }
            };

            window.WebviewApi.ui.showSuccess(mockElement, 'Success!', 100);

            expect(mockElement.textContent).toBe('Success!');
            expect(mockElement.style.backgroundColor).toBe('#28a745');

            setTimeout(() => {
                expect(mockElement.textContent).toBe('Original');
                expect(mockElement.style.backgroundColor).toBe('');
                done();
            }, 150);
        });

        it('should show error message temporarily', (done) => {
            const mockElement = {
                textContent: 'Original',
                style: { backgroundColor: '' }
            };

            window.WebviewApi.ui.showError(mockElement, 'Error!', 100);

            expect(mockElement.textContent).toBe('Error!');
            expect(mockElement.style.backgroundColor).toBe('#dc3545');

            setTimeout(() => {
                expect(mockElement.textContent).toBe('Original');
                expect(mockElement.style.backgroundColor).toBe('');
                done();
            }, 150);
        });
    });
});
