// Mock VS Code API for testing
module.exports = {
    Uri: {
        file: jest.fn((path) => ({ fsPath: path })),
        joinPath: jest.fn((base, ...segments) => ({
            fsPath: [base.fsPath, ...segments].join('/')
        }))
    },
    workspace: {
        workspaceFolders: undefined
    },
    WebviewViewProvider: class MockWebviewViewProvider {},
    CancellationToken: class MockCancellationToken {}
};

