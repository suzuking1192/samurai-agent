import * as path from "path";
import { TextDecoder } from "util";
import * as vscode from "vscode";
import { CodeElement, CodeElementType, FileInfo } from "../../common/models/context-models";
import { LLMProviderService } from "../llm/llmProviderService";
import { LLMMessage, LLMRequest, LLMResponse } from "../../common/models/llm-models";
import { ResponseType } from "../../common/models/response-models";
import { promises as fsPromises } from "fs";
import { TreeSitterLoaderService } from "./TreeSitterLoaderService";

const textDecoder = new TextDecoder("utf-8");
const parserDownloadBaseUrl = "https://github.com/tree-sitter/tree-sitter/releases/download";
const supportedTreeSitterLanguages = new Map<string, { grammar: string; fileName: string }>([
    ["typescript", { grammar: "tree-sitter-typescript", fileName: "typescript.wasm" }],
    ["javascript", { grammar: "tree-sitter-javascript", fileName: "javascript.wasm" }],
    ["tsx", { grammar: "tree-sitter-typescript", fileName: "tsx.wasm" }],
]);

const buildPatternMap = <T extends Record<string, Record<string, RegExp>>>(patterns: T): Map<string, Record<string, RegExp>> => {
    return new Map<string, Record<string, RegExp>>(Object.entries(patterns));
};

interface RelevantFileSelection {
    [filePath: string]: string[];
}

export class CodeParserService {
    private readonly workspaceRoot: string | null;
    private readonly llmProvider?: LLMProviderService;
    private readonly treeSitterLoader?: TreeSitterLoaderService;
    private readonly promptCache: Map<string, string> = new Map();
    private readonly languagePatterns: Array<[string, RegExp]> = [
        ["python", /\.(py|pyw)$/i],
        ["javascript", /\.(js|jsx)$/i],
        ["typescript", /\.(ts|tsx)$/i],
        ["java", /\.(java)$/i],
        ["cpp", /\.(cpp|cc|cxx|h|hpp|hxx)$/i],
        ["csharp", /\.(cs)$/i],
        ["go", /\.(go)$/i],
        ["rust", /\.(rs)$/i],
        ["php", /\.(php)$/i],
        ["ruby", /\.(rb)$/i],
        ["shell", /\.(sh|bash|zsh|fish)$/i],
        ["powershell", /\.(ps1)$/i],
        ["batch", /\.(bat|cmd)$/i],
        ["html", /\.(html|htm)$/i],
        ["css", /\.(css|scss|sass|less)$/i],
        ["json", /\.(json)$/i],
        ["yaml", /\.(ya?ml)$/i],
        ["sql", /\.(sql)$/i],
        ["markdown", /\.(md|markdown)$/i],
    ];
    private readonly elementPatterns: Map<string, Record<string, RegExp>> = buildPatternMap({
        python: {
            function: /^\s*(?:async\s+)?def\s+(\w+)\s*\(/,
            class: /^\s*class\s+(\w+)/,
        },
        javascript: {
            function: /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/,
            class: /^\s*(?:export\s+)?class\s+(\w+)/,
            method: /^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/,
            arrow_function: /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/,
        },
        typescript: {
            function: /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/,
            class: /^\s*(?:export\s+)?class\s+(\w+)/,
            method: /^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/,
            arrow_function: /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/,
            interface: /^\s*(?:export\s+)?interface\s+(\w+)/,
        },
        java: {
            class: /^\s*(?:public\s+)?(?:abstract\s+)?(?:final\s+)?class\s+(\w+)/,
            method: /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:abstract\s+)?(?:synchronized\s+)?(?:native\s+)?(?:strictfp\s+)?(?:<[^>]+>\s+)?(?:[\w<>\[\]]+\s+)?(\w+)\s*\(/,
            interface: /^\s*(?:public\s+)?interface\s+(\w+)/,
        },
        cpp: {
            class: /^\s*(?:class|struct)\s+(\w+)/,
            function: /^\s*(?:[\w<>\[\]]+\s+)?(\w+)\s*\([^)]*\)\s*\{?/
        },
        csharp: {
            class: /^\s*(?:public\s+)?(?:abstract\s+)?(?:sealed\s+)?(?:partial\s+)?class\s+(\w+)/,
            method: /^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(?:virtual\s+)?(?:abstract\s+)?(?:override\s+)?(?:sealed\s+)?(?:async\s+)?(?:<[^>]+>\s+)?(?:[\w<>\[\]]+\s+)?(\w+)\s*\(/,
            interface: /^\s*(?:public\s+)?interface\s+(\w+)/,
        },
        go: {
            function: /^\s*func\s+(\w+)\s*\(/,
            method: /^\s*func\s*\([^)]+\)\s+(\w+)\s*\(/,
            struct: /^\s*type\s+(\w+)\s+struct/,
            interface: /^\s*type\s+(\w+)\s+interface/,
        },
        rust: {
            function: /^\s*(?:pub\s+)?fn\s+(\w+)\s*\(/,
            struct: /^\s*(?:pub\s+)?struct\s+(\w+)/,
            impl: /^\s*impl\s+(\w+)/,
            trait: /^\s*(?:pub\s+)?trait\s+(\w+)/,
        },
        php: {
            function: /^\s*(?:public|private|protected)?\s*(?:static\s+)?function\s+(\w+)\s*\(/,
            class: /^\s*class\s+(\w+)/,
            interface: /^\s*interface\s+(\w+)/,
        },
        ruby: {
            method: /^\s*def\s+(\w+)/,
            class: /^\s*class\s+(\w+)/,
            module: /^\s*module\s+(\w+)/,
        },
    });
    private readonly ignorePatternSources: string[] = [
        "\\.git",
        "\\.svn",
        "\\.hg",
        "node_modules",
        "__pycache__",
        "\\.pytest_cache",
        "\\.venv",
        "venv",
        "env",
        "\\.env",
        "\\.env\\..*",
        "pip.*\\.log",
        "lib/python\\d+\\.\\d+/site-packages",
        "lib64/python\\d+\\.\\d+/site-packages",
        "lib/python\\d+\\.\\d+/dist-packages",
        "lib64/python\\d+\\.\\d+/dist-packages",
        "site-packages",
        "dist-packages",
        "\\.local/lib/python\\d+\\.\\d+/site-packages",
        "\\.local/lib64/python\\d+\\.\\d+/site-packages",
        "bin/python\\d+\\.\\d+",
        "Scripts/python\\d+\\.\\d+",
        "\\.python-version",
        "\\.npm",
        "\\.yarn",
        "\\.pnpm",
        "\\.cargo",
        "\\.maven",
        "\\.gradle",
        "\\.conda",
        "\\.anaconda",
        "\\.miniconda",
        "\\.poetry",
        "\\.pip",
        "\\.pipenv",
        "\\.virtualenv",
        "\\.virtualenvs",
        "\\.pyenv",
        "\\.pyenv-versions",
        "\\.rbenv",
        "\\.rvm",
        "\\.nvm",
        "\\.nvm-versions",
        "\\.jenv",
        "\\.sdkman",
        "\\.asdf",
        "\\.asdf-versions",
        "\\.DS_Store",
        "\\.idea",
        "\\.vscode",
        "\\.sublime",
        "\\.vim",
        "\\.emacs",
        "\\.cache",
        "\\.build",
        "dist",
        "/build/",
        "^build/",
        "build$",
        "/target/",
        "^target/",
        "target$",
        "/bin/",
        "^bin/",
        "bin$",
        "/obj/",
        "^obj/",
        "obj$",
        "/out/",
        "^out/",
        "out$",
        "\\.next",
        "\\.nuxt",
        "\\.output",
        "\\.parcel-cache",
        "\\.webpack",
        "coverage",
        "\\.coverage",
        "\\.nyc_output",
        "\\.lcov",
        "htmlcov",
        "\\.tox",
        "\\.log$",
        "\\.tmp$",
        "\\.temp$",
        "\\.swp$",
        "\\.swo$",
        "\\.bak$",
        "\\.backup$",
        "package-lock\\.json$",
        "yarn\\.lock$",
        "pnpm-lock\\.yaml$",
        "poetry\\.lock$",
        "pipfile\\.lock$",
        "readme\\.md$",
        "changelog\\.md$",
        "history\\.md$",
        "contributing\\.md$",
        "contributors\\.md$",
        "code_of_conduct\\.md$",
        "security\\.md$",
        "support\\.md$",
        "funding\\.yml$",
        "license$",
        "license\\.md$",
        "license\\.txt$",
        "copying$",
        "authors$",
        "maintainers$",
        "\\.rst$",
        "\\.md$",
        "readme\\.txt$",
        "changelog\\.txt$",
        "history\\.txt$",
        "license\\.txt$",
        "authors\\.txt$",
        "contributors\\.txt$",
        "maintainers\\.txt$",
        "copying\\.txt$",
        "docs?\\.txt$",
        "notes?\\.txt$",
        "manual\\.txt$",
        "guide\\.txt$",
        "tutorial\\.txt$",
        "help\\.txt$",
        "about\\.txt$",
        "info\\.txt$",
        "\\.doc$",
        "\\.docx$",
        "\\.pdf$",
        "\\.rtf$",
        "\\.tex$",
        "\\.latex$",
        "\\.eslintrc",
        "\\.prettierrc",
        "\\.babelrc",
        "\\.browserslistrc",
        "\\.editorconfig",
        "\\.gitignore",
        "\\.gitattributes",
        "\\.dockerignore",
        "\\.npmignore",
        "\\.min\\.js$",
        "\\.min\\.css$",
        "\\.bundle\\.js$",
        "\\.chunk\\.js$",
        "\\.png$",
        "\\.jpg$",
        "\\.jpeg$",
        "\\.gif$",
        "\\.bmp$",
        "\\.tiff$",
        "\\.tif$",
        "\\.webp$",
        "\\.svg$",
        "\\.ico$",
        "\\.icns$",
        "\\.woff$",
        "\\.woff2$",
        "\\.ttf$",
        "\\.otf$",
        "\\.eot$",
        "\\.mp4$",
        "\\.avi$",
        "\\.mov$",
        "\\.wmv$",
        "\\.flv$",
        "\\.webm$",
        "\\.mkv$",
        "\\.m4v$",
        "\\.mp3$",
        "\\.wav$",
        "\\.flac$",
        "\\.aac$",
        "\\.ogg$",
        "\\.m4a$",
        "\\.zip$",
        "\\.tar$",
        "\\.gz$",
        "\\.bz2$",
        "\\.xz$",
        "\\.rar$",
        "\\.7z$",
        "\\.dmg$",
        "\\.iso$",
        "\\.db$",
        "\\.sqlite$",
        "\\.sqlite3$",
        "\\.csv$",
        "\\.xlsx$",
        "\\.xls$",
        "\\.ods$",
        "\\.ppt$",
        "\\.pptx$",
        "\\.odp$",
        "\\.exe$",
        "\\.dll$",
        "\\.so$",
        "\\.dylib$",
        "\\.bin$",
        "\\.app$",
        "\\.deb$",
        "\\.rpm$",
        "\\.msi$",
        "\\.lock$",
        "\\.pid$",
        "~$",
        "\\.orig$",
        "\\.rej$",
        "thumbs\\.db$",
        "\\.trashes",
        "\\.spotlight-v100",
        "\\.fseventsd",
        "\\.github",
        "\\.gitlab-ci\\.yml$",
        "\\.travis\\.yml$",
        "\\.circleci",
        "\\.jenkins",
        "\\.pem$",
        "\\.key$",
        "\\.crt$",
        "\\.cer$",
        "\\.p12$",
        "\\.pfx$",
    ];
    private readonly ignorePatterns: RegExp[];
    private readonly coreCodeExtensions = new Set<string>([
        ".py",
        ".js",
        ".ts",
        ".jsx",
        ".tsx",
        ".java",
        ".cpp",
        ".cc",
        ".cxx",
        ".c",
        ".h",
        ".hpp",
        ".cs",
        ".go",
        ".rs",
        ".php",
        ".rb",
        ".swift",
        ".kt",
        ".m",
        ".mm",
    ]);
    private readonly secondaryCodeExtensions = new Set<string>([
        ".vue",
        ".svelte",
        ".r",
        ".scala",
        ".clj",
        ".cljs",
        ".hs",
        ".ml",
        ".fs",
        ".dart",
        ".elm",
        ".ex",
        ".exs",
        ".erl",
        ".jl",
        ".lua",
        ".pl",
        ".pm",
        ".sh",
        ".bash",
        ".zsh",
        ".fish",
        ".ps1",
        ".bat",
        ".cmd",
    ]);
    private readonly webCodeExtensions = new Set<string>([
        ".html",
        ".htm",
        ".css",
        ".scss",
        ".sass",
        ".less",
        ".styl",
    ]);
    private readonly functionalConfigExtensions = new Set<string>([
        ".sql",
        ".graphql",
        ".gql",
        ".proto",
        ".thrift",
    ]);
    private readonly essentialConfigFiles = new Set<string>(
        [
            "package.json",
            "composer.json",
            "cargo.toml",
            "pyproject.toml",
            "setup.py",
            "requirements.txt",
            "gemfile",
            "podfile",
            "build.gradle",
            "pom.xml",
            "makefile",
            "dockerfile",
            "docker-compose.yml",
            "docker-compose.yaml",
            "docker-compose.dev.yml",
            "docker-compose.prod.yml",
            "docker-compose.test.yml",
            "webpack.config.js",
            "webpack.config.ts",
            "vite.config.js",
            "vite.config.ts",
            "rollup.config.js",
            "rollup.config.ts",
            "jest.config.js",
            "jest.config.ts",
            "babel.config.js",
            "babel.config.json",
            "tsconfig.json",
            "jsconfig.json",
            ".eslintrc.js",
            ".eslintrc.json",
            "tailwind.config.js",
            "tailwind.config.ts",
            "next.config.js",
            "nuxt.config.js",
            "vue.config.js",
            "angular.json",
            "ember-cli-build.js",
        ].map((name) => name.toLowerCase())
    );
    private readonly skippedKeywords = new Set<string>([
        "if",
        "for",
        "while",
        "try",
        "catch",
        "finally",
        "switch",
        "case",
    ]);

    private readonly extensionRoot?: string;

    constructor(extensionRoot?: string) {
        this.extensionRoot = extensionRoot;
        this.workspaceRoot =
            extensionRoot ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
        this.ignorePatterns = this.ignorePatternSources.map(
            (pattern) => new RegExp(pattern, "i")
        );
    }

    public detectLanguage(filePath: string): string | null {
        const normalized = this.normalizePath(filePath);
        for (const [language, pattern] of this.languagePatterns) {
            if (pattern.test(normalized)) {
                return language;
            }
        }
        return null;
    }

    public shouldIgnoreFile(filePath: string): boolean {
        const normalized = this.normalizePath(filePath);
        for (const pattern of this.ignorePatterns) {
            if (pattern.test(normalized)) {
                return true;
            }
        }
        return this.isInVirtualEnvironment(normalized);
    }

    public isFunctionalCodeFile(filePath: string): boolean {
        const extension = path.extname(filePath).toLowerCase();

        if (this.coreCodeExtensions.has(extension)) {
            return true;
        }

        if (this.secondaryCodeExtensions.has(extension)) {
            return true;
        }

        if (this.webCodeExtensions.has(extension)) {
            return true;
        }

        if (this.functionalConfigExtensions.has(extension)) {
            return true;
        }

        const fileName = path.basename(filePath).toLowerCase();
        return this.essentialConfigFiles.has(fileName);
    }

    public async extractElementsFromFile(
        filePath: string,
        language: string
    ): Promise<CodeElement[]> {
        try {
            // First attempt: Use tree-sitter parsing if available
            if (this.treeSitterLoader && this.treeSitterLoader.isLanguageSupported(language)) {
                const elements = await this.extractElementsWithTreeSitter(filePath, language);
                if (elements.length > 0) {
                    return elements;
                }
            }

            // Fallback: Use regex-based parsing
            console.log(`Tree-sitter parsing not available for ${language}, falling back to regex parsing`);
            return await this.extractElementsWithRegex(filePath, language);
        } catch (error) {
            console.error(`Error extracting elements from ${filePath} (${language}):`, error);
            // Final fallback to regex parsing
            return await this.extractElementsWithRegex(filePath, language);
        }
    }

    public async scanCodebase(
        rootPath?: string,
        maxFiles = 1000
    ): Promise<Map<string, FileInfo>> {
        if (maxFiles <= 0) {
            return new Map();
        }

        const resolvedRoot = await this.resolveRootPath(rootPath);
        if (!resolvedRoot) {
            throw new Error("No valid workspace root available for scanning.");
        }

        const fileInfos = new Map<string, FileInfo>();
        const files = await this.collectFiles(vscode.Uri.file(resolvedRoot), maxFiles);

        for (const fileUri of files) {
            if (fileInfos.size >= maxFiles) {
                break;
            }

            const filePath = fileUri.fsPath;

            if (!this.isFunctionalCodeFile(filePath)) {
                continue;
            }

            const language = this.detectLanguage(filePath);
            if (!language) {
                continue;
            }

            try {
                const stat = await vscode.workspace.fs.stat(fileUri);
                const elements = await this.extractElementsFromFile(filePath, language);

                // Ensure elements array is populated with comprehensive code analysis
                const enrichedElements = await this.enrichCodeElements(elements, filePath, language);

                fileInfos.set(filePath, {
                    path: filePath,
                    name: path.basename(filePath),
                    extension: path.extname(filePath),
                    language,
                    size: stat.size,
                    elements: enrichedElements,
                    lastModified: new Date(stat.mtime),
                });
            } catch (error) {
                console.warn(`Error processing file ${filePath}:`, error);
            }
        }

        return fileInfos;
    }

    public async getRelevantFiles(
        fileInfos: Map<string, FileInfo>,
        query: string,
        maxResults = 30,
        projectId?: string
    ): Promise<string[]> {
        if (!fileInfos.size || !query.trim()) {
            return [];
        }

        const llmSelection = await this.identifyRelevantFilesWithLLM(
            fileInfos,
            query,
            projectId
        );

        if (!llmSelection.size) {
            return this.rankByHeuristics(fileInfos, query, maxResults);
        }

        const ranked: string[] = [];
        for (const [filePath] of llmSelection) {
            if (fileInfos.has(filePath)) {
                ranked.push(filePath);
            }
        }

        if (ranked.length < maxResults) {
            const remaining = this.rankByHeuristics(fileInfos, query, maxResults)
                .filter((path) => !ranked.includes(path));
            ranked.push(...remaining);
        }

        return ranked.slice(0, maxResults);
    }

    private async identifyRelevantFilesWithLLM(
        fileInfos: Map<string, FileInfo>,
        query: string,
        projectId?: string
    ): Promise<Map<string, string[]>> {
        if (!this.llmProvider) {
            return new Map();
        }

        try {
            const promptText = await this.loadPrompt("codeParser/step2_identify_relevant_elements.md");
            const message = this.buildLLMMessage(promptText, query, fileInfos);

            const request: LLMRequest = {
                id: `code-parser-${Date.now()}`,
                provider: "auto",
                model: "",
                messages: message,
                metadata: {
                    projectId,
                    purpose: "code_parser_relevance",
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const response = await this.llmProvider.chat(request);
            if (response.type !== ResponseType.SUCCESS || !response.payload) {
                return new Map();
            }

            const payload = response.payload as LLMResponse;
            return this.parseLLMSelection(payload.content, fileInfos);
        } catch (error) {
            console.warn("CodeParserService: LLM-assisted relevance selection failed", error);
            return new Map();
        }
    }

    protected rankByHeuristics(
        fileInfos: Map<string, FileInfo>,
        query: string,
        maxResults: number
    ): string[] {
        const queryLower = query.toLowerCase();
        const scored: Array<{ path: string; score: number }> = [];

        for (const [filePath, info] of fileInfos.entries()) {
            let score = 0;

            if (info.name.toLowerCase().includes(queryLower)) {
                score += 3;
            }

            for (const element of info.elements) {
                if (element.name.toLowerCase().includes(queryLower)) {
                    score += 2;
                }
            }

            if (filePath.toLowerCase().includes(queryLower)) {
                score += 1;
            }

            if (score > 0) {
                scored.push({ path: filePath, score });
            }
        }

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, maxResults).map((item) => item.path);
    }

    public async loadPrompt(relativePath: string): Promise<string> {
        const cached = this.promptCache.get(relativePath);
        if (cached) {
            return cached;
        }

        const candidates = this.getPromptCandidates(relativePath);

        for (const candidate of candidates) {
            try {
                const content = await fsPromises.readFile(candidate, "utf-8");
                this.promptCache.set(relativePath, content);
                return content;
            } catch (error) {
                continue;
            }
        }

        throw new Error(`Prompt not found for ${relativePath}`);
    }

    private getPromptCandidates(relativePath: string): string[] {
        const candidates: string[] = [];
        const workspaceRootFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (workspaceRootFolder) {
            const basePath = workspaceRootFolder.fsPath;
            candidates.push(path.join(basePath, "dist", "prompts", relativePath));
            candidates.push(path.join(basePath, "src", "agent", "prompts", relativePath));
        }

        if (this.extensionRoot) {
            candidates.push(path.join(this.extensionRoot, "dist", "prompts", relativePath));
            candidates.push(path.join(this.extensionRoot, "out", "prompts", relativePath));
            candidates.push(path.join(this.extensionRoot, "prompts", relativePath));
            candidates.push(path.join(this.extensionRoot, "src", "agent", "prompts", relativePath));
        }

        candidates.push(path.join(__dirname, "..", "prompts", relativePath));
        candidates.push(path.join(__dirname, "..", "..", "prompts", relativePath));

        return candidates;
    }

    private buildLLMMessage(
        promptTemplate: string,
        query: string,
        fileInfos: Map<string, FileInfo>
    ): LLMMessage[] {
        const summary = this.buildFileElementsSummary(fileInfos);
        const content = promptTemplate
            .replace("{{USER_REQUEST}}", query)
            .replace("{{FILE_ELEMENTS_SUMMARY}}", summary);

        return [{ role: "system", content }];
    }

    private buildFileElementsSummary(fileInfos: Map<string, FileInfo>): string {
        const parts: string[] = [];

        for (const info of fileInfos.values()) {
            const header = `📁 ${info.path} (${info.language}):`;
            const elements = info.elements.length
                ? info.elements.map((element) => `  • ${element.type}: ${element.name}`).join("\n")
                : "  • no elements";

            parts.push(`${header}\n${elements}`);
        }

        return parts.join("\n\n");
    }

    private parseLLMSelection(
        response: string,
        fileInfos: Map<string, FileInfo>
    ): Map<string, string[]> {
        const selection = new Map<string, string[]>();

        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return selection;
            }

            const parsed = JSON.parse(jsonMatch[0]) as RelevantFileSelection;
            for (const [filePath, methods] of Object.entries(parsed)) {
                const resolvedPath = this.resolveFilePath(filePath, fileInfos);
                if (!resolvedPath) {
                    continue;
                }

                const normalizedMethods = Array.isArray(methods)
                    ? methods.filter((item) => typeof item === "string")
                    : [];

                selection.set(resolvedPath, normalizedMethods);
            }
        } catch (error) {
            console.warn("CodeParserService: failed to parse LLM selection", error);
        }

        return selection;
    }

    private resolveFilePath(
        candidate: string,
        fileInfos: Map<string, FileInfo>
    ): string | undefined {
        if (fileInfos.has(candidate)) {
            return candidate;
        }

        const normalizedCandidate = candidate.replace(/\\/g, "/").toLowerCase();

        for (const filePath of fileInfos.keys()) {
            const normalizedPath = filePath.replace(/\\/g, "/").toLowerCase();

            if (
                normalizedPath === normalizedCandidate ||
                normalizedPath.endsWith(normalizedCandidate) ||
                path.basename(normalizedPath) === normalizedCandidate
            ) {
                return filePath;
            }
        }

        return undefined;
    }

    private normalizePath(filePath: string): string {
        return filePath.replace(/\\/g, "/");
    }

    private isInVirtualEnvironment(filePath: string): boolean {
        const parts = filePath.split("/").filter((segment) => segment.length > 0);

        for (let index = 0; index < parts.length; index += 1) {
            const part = parts[index];

            if (part === "site-packages" || part === "dist-packages") {
                return true;
            }

            if (/python\d+\.\d+/i.test(part)) {
                if (
                    index + 1 < parts.length &&
                    (parts[index + 1] === "site-packages" || parts[index + 1] === "dist-packages")
                ) {
                    return true;
                }
            }

            if ((part === "lib" || part === "lib64") && index + 2 < parts.length) {
                if (
                    /python\d+\.\d+/i.test(parts[index + 1]) &&
                    (parts[index + 2] === "site-packages" || parts[index + 2] === "dist-packages")
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    private async resolveRootPath(rootPath?: string): Promise<string | null> {
        if (rootPath) {
            const resolved = path.resolve(rootPath);
            try {
                const stat = await vscode.workspace.fs.stat(vscode.Uri.file(resolved));
                if ((stat.type & vscode.FileType.Directory) !== 0) {
                    return resolved;
                }
                console.warn(
                    `CodeParserService: provided root path is not a directory: ${resolved}`
                );
                return null;
            } catch (error) {
                console.warn(
                    `CodeParserService: unable to access provided root path: ${resolved}`,
                    error
                );
                return null;
            }
        }

        return this.workspaceRoot;
    }

    private async collectFiles(root: vscode.Uri, maxFiles: number): Promise<vscode.Uri[]> {
        const collected: vscode.Uri[] = [];
        const queue: vscode.Uri[] = [root];

        while (queue.length > 0 && collected.length < maxFiles) {
            const current = queue.shift()!;
            let entries: [string, vscode.FileType][];

            try {
                entries = await vscode.workspace.fs.readDirectory(current);
            } catch (error) {
                console.warn(`Error reading directory ${current.fsPath}:`, error);
                continue;
            }

            for (const [name, type] of entries) {
                if (collected.length >= maxFiles) {
                    break;
                }

                const childUri = vscode.Uri.joinPath(current, name);
                const childPath = this.normalizePath(childUri.fsPath);

                if (this.shouldIgnoreFile(childPath)) {
                    continue;
                }

                const isDirectory = (type & vscode.FileType.Directory) !== 0;
                const isFile = (type & vscode.FileType.File) !== 0;

                if (isDirectory) {
                    queue.push(vscode.Uri.file(childPath));
                } else if (isFile) {
                    collected.push(vscode.Uri.file(childPath));
                }
            }
        }

        return collected;
    }

    private async readFileLines(filePath: string): Promise<string[] | null> {
        try {
            const data = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
            const content = textDecoder.decode(data);
            return content.split(/\r?\n/);
        } catch (error) {
            console.warn(`Error reading file ${filePath}:`, error);
            return null;
        }
    }

    private extractUsingPatterns(
        lines: string[],
        filePath: string,
        patterns: Record<string, RegExp>
    ): CodeElement[] {
        const elements: CodeElement[] = [];

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
                return;
            }

            for (const [elementType, pattern] of Object.entries(patterns)) {
                const match = trimmed.match(pattern);
                if (!match) {
                    continue;
                }

                const name = match[1];
                if (!name || this.skippedKeywords.has(name)) {
                    continue;
                }

                // Estimate lineEnd by finding the end of the element
                const lineEnd = this.estimateElementEnd(lines, index, elementType);

                // Extract code snippet
                const codeSnippet = lines.slice(index, lineEnd).join('\n');

                elements.push({
                    name,
                    type: elementType as CodeElementType,
                    lineStart: index + 1,
                    lineEnd: lineEnd + 1,
                    filePath,
                    signature: trimmed,
                    codeSnippet,
                });

                break;
            }
        });

        return elements;
    }

    private extractPythonElements(lines: string[], filePath: string): CodeElement[] {
        const elements: CodeElement[] = [];
        const classStack: Array<{ name: string; indentation: number }> = [];

        lines.forEach((line, index) => {
            if (!line) {
                return;
            }

            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) {
                return;
            }

            const indentation = this.getIndentationLevel(line);

            while (
                classStack.length > 0 &&
                indentation <= classStack[classStack.length - 1].indentation
            ) {
                classStack.pop();
            }

            const classMatch = trimmed.match(/^\s*class\s+(\w+)/);
            if (classMatch) {
                const className = classMatch[1];
                const lineEnd = this.estimateElementEnd(lines, index, "class");
                const codeSnippet = lines.slice(index, lineEnd).join('\n');

                elements.push({
                    name: className,
                    type: "class",
                    lineStart: index + 1,
                    lineEnd: lineEnd + 1,
                    filePath,
                    signature: trimmed,
                    codeSnippet,
                });
                classStack.push({ name: className, indentation });
                return;
            }

            const functionMatch = trimmed.match(/^\s*(?:async\s+)?def\s+(\w+)\s*\(/);
            if (!functionMatch) {
                return;
            }

            const name = functionMatch[1];
            if (this.skippedKeywords.has(name)) {
                return;
            }

            const elementType = classStack.length > 0 ? "method" : "function";
            const lineEnd = this.estimateElementEnd(lines, index, elementType);
            const codeSnippet = lines.slice(index, lineEnd).join('\n');

            elements.push({
                name,
                type: elementType,
                lineStart: index + 1,
                lineEnd: lineEnd + 1,
                filePath,
                signature: trimmed,
                codeSnippet,
            });
        });

        return elements;
    }

    private getIndentationLevel(line: string): number {
        const match = line.match(/^\s*/);
        return match ? match[0].length : 0;
    }

    /**
     * Estimate the end line of a code element for regex-based parsing
     */
    private estimateElementEnd(lines: string[], startIndex: number, elementType: string): number {
        const startLine = lines[startIndex];
        const startIndentation = this.getIndentationLevel(startLine);
        
        // For Python, use indentation-based detection
        if (elementType === "class" || elementType === "function" || elementType === "method") {
            for (let i = startIndex + 1; i < lines.length; i++) {
                const line = lines[i];
                if (!line.trim()) {
                    continue; // Skip empty lines
                }
                
                const currentIndentation = this.getIndentationLevel(line);
                if (currentIndentation <= startIndentation) {
                    return i - 1;
                }
            }
        }
        
        // For other languages, look for closing braces or similar patterns
        let braceCount = 0;
        let inString = false;
        let stringChar = '';
        
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                
                if (!inString) {
                    if (char === '"' || char === "'" || char === '`') {
                        inString = true;
                        stringChar = char;
                    } else if (char === '{') {
                        braceCount++;
                    } else if (char === '}') {
                        braceCount--;
                        if (braceCount === 0 && i > startIndex) {
                            return i;
                        }
                    }
                } else if (char === stringChar && line[j - 1] !== '\\') {
                    inString = false;
                }
            }
            
            // If we're at the start line and no braces were found, assume single line
            if (i === startIndex && braceCount === 0 && !line.includes('{')) {
                return i;
            }
        }
        
        return lines.length - 1;
    }

    private async enrichCodeElements(
        elements: CodeElement[],
        filePath: string,
        language: string
    ): Promise<CodeElement[]> {
        // For now, return the elements as-is, but this method can be enhanced
        // to use tree-sitter or other advanced parsing techniques in the future
        return elements;
    }

    /**
     * Extract code elements using tree-sitter parsing
     */
    private async extractElementsWithTreeSitter(
        filePath: string,
        language: string
    ): Promise<CodeElement[]> {
        try {
            if (!this.treeSitterLoader) {
                throw new Error("TreeSitterLoaderService not available");
            }

            const parser = await this.treeSitterLoader.loadParser(language);
            if (!parser) {
                throw new Error(`Failed to load tree-sitter parser for ${language}`);
            }

            // Read file content
            const fileContent = await this.readFileContent(filePath);
            if (!fileContent) {
                return [];
            }

            // Parse the file
            const tree = parser.parse(fileContent);
            const elements: CodeElement[] = [];

            // Traverse the AST to extract elements
            this.traverseTreeSitterAST(tree.rootNode, fileContent, filePath, elements, language);

            return elements;
        } catch (error) {
            console.error(`Tree-sitter parsing failed for ${filePath} (${language}):`, error);
            throw error;
        }
    }

    /**
     * Extract code elements using regex patterns (fallback method)
     */
    private async extractElementsWithRegex(
        filePath: string,
        language: string
    ): Promise<CodeElement[]> {
        const lines = await this.readFileLines(filePath);
        if (!lines) {
            return [];
        }

        if (language === "python") {
            return this.extractPythonElements(lines, filePath);
        }

        const patterns = this.elementPatterns.get(language);
        if (!patterns) {
            return [];
        }

        return this.extractUsingPatterns(lines, filePath, patterns);
    }

    /**
     * Read file content as a single string
     */
    private async readFileContent(filePath: string): Promise<string | null> {
        try {
            const data = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
            return textDecoder.decode(data);
        } catch (error) {
            console.warn(`Error reading file ${filePath}:`, error);
            return null;
        }
    }

    /**
     * Traverse tree-sitter AST to extract code elements
     */
    private traverseTreeSitterAST(
        node: any,
        fileContent: string,
        filePath: string,
        elements: CodeElement[],
        language: string
    ): void {
        // Define query patterns for different languages and element types
        const queryPatterns = this.getTreeSitterQueryPatterns(language);
        
        for (const [elementType, nodeTypes] of Object.entries(queryPatterns)) {
            if (nodeTypes.includes(node.type)) {
                const element = this.createCodeElementFromNode(node, fileContent, filePath, elementType as CodeElementType);
                if (element) {
                    elements.push(element);
                }
            }
        }

        // Recursively traverse child nodes
        for (const child of node.children) {
            this.traverseTreeSitterAST(child, fileContent, filePath, elements, language);
        }
    }

    /**
     * Get tree-sitter query patterns for different languages
     */
    private getTreeSitterQueryPatterns(language: string): Record<string, string[]> {
        const patterns: Record<string, Record<string, string[]>> = {
            typescript: {
                function: ['function_declaration', 'method_definition', 'arrow_function'],
                class: ['class_declaration'],
                method: ['method_definition'],
                interface: ['interface_declaration'],
                arrow_function: ['arrow_function'],
            },
            javascript: {
                function: ['function_declaration', 'method_definition', 'arrow_function'],
                class: ['class_declaration'],
                method: ['method_definition'],
                arrow_function: ['arrow_function'],
            },
            python: {
                function: ['function_definition'],
                class: ['class_definition'],
                method: ['function_definition'], // Methods are functions inside classes
            },
            java: {
                class: ['class_declaration'],
                method: ['method_declaration'],
                interface: ['interface_declaration'],
            },
            cpp: {
                class: ['class_specifier', 'struct_specifier'],
                function: ['function_definition'],
            },
            c: {
                function: ['function_definition'],
            },
            go: {
                function: ['function_declaration', 'method_declaration'],
                struct: ['type_declaration'],
                interface: ['type_declaration'],
            },
            rust: {
                function: ['function_item'],
                struct: ['struct_item'],
                impl: ['impl_item'],
                trait: ['trait_item'],
            },
            php: {
                function: ['function_definition', 'method_declaration'],
                class: ['class_declaration'],
                interface: ['interface_declaration'],
            },
            ruby: {
                method: ['method'],
                class: ['class'],
                module: ['module'],
            },
        };

        return patterns[language] || {};
    }

    /**
     * Create a CodeElement from a tree-sitter node
     */
    private createCodeElementFromNode(
        node: any,
        fileContent: string,
        filePath: string,
        elementType: CodeElementType
    ): CodeElement | null {
        try {
            // Extract name from the node
            const name = this.extractNodeName(node, elementType);
            if (!name) {
                return null;
            }

            // Calculate line numbers (tree-sitter uses 0-based indexing)
            const lineStart = node.startPosition.row + 1;
            const lineEnd = node.endPosition.row + 1;

            // Extract code snippet
            const codeSnippet = this.extractCodeSnippet(node, fileContent);

            // Extract signature (first line of the element)
            const signature = this.extractSignature(node, fileContent);

            return {
                name,
                type: elementType,
                lineStart,
                lineEnd,
                filePath,
                signature,
                codeSnippet,
            };
        } catch (error) {
            console.warn(`Error creating CodeElement from node:`, error);
            return null;
        }
    }

    /**
     * Extract the name from a tree-sitter node
     */
    private extractNodeName(node: any, elementType: CodeElementType): string | null {
        // Different strategies for different node types
        const nameNode = node.childForFieldName('name') || 
                        node.childForFieldName('declarator') ||
                        node.childForFieldName('identifier') ||
                        node.namedChildren.find((child: any) => child.type === 'identifier');

        if (nameNode) {
            return nameNode.text;
        }

        // Fallback: look for identifier in children
        for (const child of node.namedChildren) {
            if (child.type === 'identifier' || child.type === 'type_identifier') {
                return child.text;
            }
        }

        return null;
    }

    /**
     * Extract code snippet from a tree-sitter node
     */
    private extractCodeSnippet(node: any, fileContent: string): string {
        const lines = fileContent.split('\n');
        const startLine = node.startPosition.row;
        const endLine = node.endPosition.row;
        
        return lines.slice(startLine, endLine + 1).join('\n');
    }

    /**
     * Extract signature (first line) from a tree-sitter node
     */
    private extractSignature(node: any, fileContent: string): string {
        const lines = fileContent.split('\n');
        const startLine = node.startPosition.row;
        
        return lines[startLine] || '';
    }
}
