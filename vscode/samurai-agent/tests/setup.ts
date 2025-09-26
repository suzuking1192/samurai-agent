/**
 * Jest test setup file
 */

// VS Code API is mocked via __mocks__/vscode.js

beforeEach(() => {
    jest.clearAllMocks();
});

afterEach(() => {
    jest.restoreAllMocks();
});

export {};
