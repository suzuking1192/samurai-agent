/**
 * Jest test setup file
 */

// Mock VS Code API
jest.mock('vscode', () => ({
    Uri: {
        file: jest.fn((path: string) => ({ fsPath: path })),
        joinPath: jest.fn((base: any, ...segments: string[]) => ({
            fsPath: [base.fsPath, ...segments].join('/')
        }))
    },
    workspace: {
        workspaceFolders: undefined
    },
    WebviewViewProvider: class MockWebviewViewProvider {},
    CancellationToken: class MockCancellationToken {}
}));

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
