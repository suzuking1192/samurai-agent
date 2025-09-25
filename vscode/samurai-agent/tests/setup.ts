/**
 * Jest test setup file
 */

// VS Code API is mocked via __mocks__/vscode.js

// Mock fs module
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn()
}));

// Mock path module
jest.mock('path', () => ({
    join: jest.fn((...segments: string[]) => segments.join('/'))
}));

// Global test setup
beforeEach(() => {
    jest.clearAllMocks();
});

// Global test teardown
afterEach(() => {
    jest.resetAllMocks();
});
