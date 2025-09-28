import * as vscode from "vscode";
import * as path from "path";

/**
 * Service for dynamically loading and caching tree-sitter WASM language parsers
 * 
 * This service manages the lifecycle of tree-sitter language parsers, including:
 * - Downloading WASM parser files from CDN
 * - Caching parsers in the extension's global storage
 * - Loading and instantiating parsers for code analysis
 */
export class TreeSitterLoaderService {
    private readonly globalStorageUri: vscode.Uri;
    private readonly parserCache: Map<string, any> = new Map();
    private readonly supportedLanguages: Map<string, { grammar: string; fileName: string }> = new Map([
        ["typescript", { grammar: "tree-sitter-typescript", fileName: "typescript.wasm" }],
        ["javascript", { grammar: "tree-sitter-javascript", fileName: "javascript.wasm" }],
        ["tsx", { grammar: "tree-sitter-typescript", fileName: "tsx.wasm" }],
        ["python", { grammar: "tree-sitter-python", fileName: "python.wasm" }],
        ["java", { grammar: "tree-sitter-java", fileName: "java.wasm" }],
        ["cpp", { grammar: "tree-sitter-cpp", fileName: "cpp.wasm" }],
        ["c", { grammar: "tree-sitter-c", fileName: "c.wasm" }],
        ["go", { grammar: "tree-sitter-go", fileName: "go.wasm" }],
        ["rust", { grammar: "tree-sitter-rust", fileName: "rust.wasm" }],
        ["php", { grammar: "tree-sitter-php", fileName: "php.wasm" }],
        ["ruby", { grammar: "tree-sitter-ruby", fileName: "ruby.wasm" }],
        ["csharp", { grammar: "tree-sitter-c-sharp", fileName: "c_sharp.wasm" }],
        ["html", { grammar: "tree-sitter-html", fileName: "html.wasm" }],
        ["css", { grammar: "tree-sitter-css", fileName: "css.wasm" }],
        ["json", { grammar: "tree-sitter-json", fileName: "json.wasm" }],
        ["yaml", { grammar: "tree-sitter-yaml", fileName: "yaml.wasm" }],
        ["markdown", { grammar: "tree-sitter-markdown", fileName: "markdown.wasm" }],
    ]);

    // CDN base URL for tree-sitter WASM files
    private readonly cdnBaseUrl = "https://github.com/tree-sitter/tree-sitter/releases/download";

    constructor(globalStorageUri: vscode.Uri) {
        this.globalStorageUri = globalStorageUri;
    }

    /**
     * Load a tree-sitter parser for the specified language
     * @param language The programming language identifier
     * @returns Promise resolving to the parser instance or null if loading fails
     */
    public async loadParser(language: string): Promise<any | null> {
        try {
            // Check if parser is already cached in memory
            if (this.parserCache.has(language)) {
                return this.parserCache.get(language);
            }

            // Check if language is supported
            const languageInfo = this.supportedLanguages.get(language);
            if (!languageInfo) {
                console.warn(`TreeSitterLoaderService: Language '${language}' is not supported`);
                return null;
            }

            // Load tree-sitter module
            const Parser = await this.loadTreeSitterModule();
            if (!Parser) {
                console.error("TreeSitterLoaderService: Failed to load tree-sitter module");
                return null;
            }

            // Get or download the WASM file
            const wasmPath = await this.getOrDownloadWasmFile(language, languageInfo.fileName);
            if (!wasmPath) {
                console.error(`TreeSitterLoaderService: Failed to get WASM file for ${language}`);
                return null;
            }

            // Initialize parser with the WASM file
            const parser = new Parser();
            const wasmModule = await this.loadWasmModule(wasmPath);
            
            if (!wasmModule) {
                console.error(`TreeSitterLoaderService: Failed to load WASM module for ${language}`);
                return null;
            }

            // Set the language for the parser
            parser.setLanguage(wasmModule);

            // Cache the parser
            this.parserCache.set(language, parser);

            return parser;
        } catch (error) {
            console.error(`TreeSitterLoaderService: Error loading parser for ${language}:`, error);
            vscode.window.showErrorMessage(`Failed to load tree-sitter parser for ${language}: ${error}`);
            return null;
        }
    }

    /**
     * Get the list of supported languages
     */
    public getSupportedLanguages(): string[] {
        return Array.from(this.supportedLanguages.keys());
    }

    /**
     * Check if a language is supported
     */
    public isLanguageSupported(language: string): boolean {
        return this.supportedLanguages.has(language);
    }

    /**
     * Load the tree-sitter module
     */
    private async loadTreeSitterModule(): Promise<any | null> {
        try {
            // Dynamic import for web-tree-sitter
            const TreeSitter = await import('web-tree-sitter');
            return TreeSitter.default || TreeSitter;
        } catch (error) {
            console.error("TreeSitterLoaderService: Failed to import web-tree-sitter:", error);
            return null;
        }
    }

    /**
     * Get the WASM file path, downloading it if necessary
     */
    private async getOrDownloadWasmFile(language: string, fileName: string): Promise<string | null> {
        const localPath = path.join(this.globalStorageUri.fsPath, fileName);
        
        try {
            // Check if file already exists locally
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(localPath));
            if (stat.type === vscode.FileType.File) {
                return localPath;
            }
        } catch (error) {
            // File doesn't exist, we'll download it
        }

        // Download the WASM file
        return await this.downloadWasmFile(language, fileName, localPath);
    }

    /**
     * Download a WASM file from the CDN
     */
    private async downloadWasmFile(language: string, fileName: string, localPath: string): Promise<string | null> {
        try {
            const languageInfo = this.supportedLanguages.get(language);
            if (!languageInfo) {
                return null;
            }

            // Construct the download URL
            const downloadUrl = `${this.cdnBaseUrl}/v0.20.4/${fileName}`;
            
            console.log(`TreeSitterLoaderService: Downloading ${fileName} from ${downloadUrl}`);

            // Download the file
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const wasmData = await response.arrayBuffer();

            // Ensure the directory exists
            await vscode.workspace.fs.createDirectory(this.globalStorageUri);

            // Write the file to local storage
            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(localPath),
                new Uint8Array(wasmData)
            );

            console.log(`TreeSitterLoaderService: Successfully downloaded and cached ${fileName}`);
            return localPath;
        } catch (error) {
            console.error(`TreeSitterLoaderService: Failed to download ${fileName}:`, error);
            vscode.window.showErrorMessage(`Failed to download tree-sitter parser for ${language}: ${error}`);
            return null;
        }
    }

    /**
     * Load a WASM module from file
     */
    private async loadWasmModule(wasmPath: string): Promise<any | null> {
        try {
            const wasmData = await vscode.workspace.fs.readFile(vscode.Uri.file(wasmPath));
            const wasmModule = await (globalThis as any).WebAssembly.compile(wasmData);
            return wasmModule;
        } catch (error) {
            console.error(`TreeSitterLoaderService: Failed to load WASM module from ${wasmPath}:`, error);
            return null;
        }
    }

    /**
     * Clear the parser cache
     */
    public clearCache(): void {
        this.parserCache.clear();
    }

    /**
     * Get cache statistics
     */
    public getCacheStats(): { cachedParsers: string[]; supportedLanguages: string[] } {
        return {
            cachedParsers: Array.from(this.parserCache.keys()),
            supportedLanguages: Array.from(this.supportedLanguages.keys())
        };
    }
}
