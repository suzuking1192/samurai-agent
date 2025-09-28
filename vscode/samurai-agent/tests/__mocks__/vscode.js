const path = require('path');

const makeUri = (targetPath) => {
  const resolved = path.resolve(targetPath);
  return {
    fsPath: resolved,
    toString: () => resolved,
  };
};

const FileType = {
  Unknown: 0,
  File: 1,
  Directory: 2,
  SymbolicLink: 64,
};

const workspace = {
  workspaceFolders: undefined,
  fs: {
    readFile: jest.fn(),
    stat: jest.fn(),
    readDirectory: jest.fn(),
  },
};

module.exports = {
  FileType,
  Uri: {
    file: jest.fn((targetPath) => makeUri(targetPath)),
    joinPath: jest.fn((base, ...segments) => {
      const basePath = typeof base === 'string' ? base : base.fsPath;
      return makeUri(path.join(basePath, ...segments));
    }),
    parse: jest.fn((targetPath) => makeUri(targetPath)),
  },
  workspace,
  WebviewViewProvider: class MockWebviewViewProvider {},
  CancellationToken: class MockCancellationToken {},
};
