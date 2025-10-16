import * as vscode from 'vscode';

/**
 * Represents a file with its workspace context
 */
interface TrackedFile {
    filePath: string;
    workspaceRoot: string;
    timestamp: number;
}

/**
 * Singleton service that tracks recently opened files in VS Code
 * Hybrid approach: Prioritizes currently open tabs, then recently closed files
 * Workspace-aware: Only returns files from the current workspace
 */
export class RecentFilesTracker {
    private static instance: RecentFilesTracker;
    private recentFiles: TrackedFile[] = [];
    private readonly maxCacheSize = 50;
    private disposable: vscode.Disposable | null = null;

    private constructor() {}

    public static getInstance(): RecentFilesTracker {
        if (!RecentFilesTracker.instance) {
            RecentFilesTracker.instance = new RecentFilesTracker();
        }
        return RecentFilesTracker.instance;
    }

    /**
     * Initialize the tracker by setting up event listeners
     * Should be called during extension activation
     */
    public initialize(): void {
        if (this.disposable) {
            console.log('RecentFilesTracker: Already initialized');
            return;
        }

        // Listen to document open events
        this.disposable = vscode.workspace.onDidOpenTextDocument((document) => {
            this.trackFileOpen(document);
        });

        // Initialize with currently open documents
        vscode.workspace.textDocuments.forEach((document) => {
            this.trackFileOpen(document);
        });

        console.log('RecentFilesTracker: Initialized successfully');
    }

    /**
     * Track a file being opened
     * @param document The text document that was opened
     */
    private trackFileOpen(document: vscode.TextDocument): void {
        // Filter out non-file URIs (untitled, virtual files, etc.)
        if (document.uri.scheme !== 'file') {
            return;
        }

        // Filter out untitled documents
        if (document.isUntitled) {
            return;
        }

        const filePath = document.uri.fsPath;
        const workspaceRoot = this.getWorkspaceRootForFile(filePath);

        // Skip files not in any workspace
        if (!workspaceRoot) {
            return;
        }

        // Remove from current position if it exists
        const existingIndex = this.recentFiles.findIndex(f => f.filePath === filePath);
        if (existingIndex !== -1) {
            this.recentFiles.splice(existingIndex, 1);
        }

        // Add to the front (most recent)
        this.recentFiles.unshift({
            filePath,
            workspaceRoot,
            timestamp: Date.now()
        });

        // Maintain max cache size
        if (this.recentFiles.length > this.maxCacheSize) {
            this.recentFiles = this.recentFiles.slice(0, this.maxCacheSize);
        }
    }

    /**
     * Get workspace root for a given file path
     */
    private getWorkspaceRootForFile(filePath: string): string | null {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
        return workspaceFolder ? workspaceFolder.uri.fsPath : null;
    }

    /**
     * Get currently open tabs from VS Code's tab groups
     * @param workspaceRoot The workspace root to filter by
     * @returns Array of file paths from currently open tabs
     */
    private getCurrentlyOpenTabs(workspaceRoot: string | null): string[] {
        const openTabs: string[] = [];

        for (const group of vscode.window.tabGroups.all) {
            for (const tab of group.tabs) {
                if (tab.input instanceof vscode.TabInputText) {
                    const uri = tab.input.uri;
                    if (uri.scheme === 'file') {
                        const filePath = uri.fsPath;
                        const fileWorkspaceRoot = this.getWorkspaceRootForFile(filePath);
                        
                        // Only include if in the same workspace
                        if (fileWorkspaceRoot === workspaceRoot) {
                            openTabs.push(filePath);
                        }
                    }
                }
            }
        }

        return openTabs;
    }

    /**
     * Get the most recently opened file paths (HYBRID APPROACH)
     * Priority: 1) Currently open tabs, 2) Recently closed files
     * Workspace-specific: Only returns files from the specified workspace
     * 
     * @param limit Maximum number of file paths to return
     * @param workspaceRoot Optional workspace root to filter by (defaults to first workspace)
     * @returns Array of file paths, ordered by relevance and recency
     */
    public getRecentlyOpenedFilePaths(limit: number = 10, workspaceRoot?: string): string[] {
        // Determine workspace root
        const targetWorkspace = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || null;
        
        if (!targetWorkspace) {
            return [];
        }

        // STEP 1: Get currently open tabs (highest priority)
        const openTabs = this.getCurrentlyOpenTabs(targetWorkspace);

        // STEP 2: Get recently closed files from event tracking (workspace-filtered)
        const recentlyClosed = this.recentFiles
            .filter(f => f.workspaceRoot === targetWorkspace)
            .filter(f => !openTabs.includes(f.filePath)) // Exclude already open tabs
            .map(f => f.filePath);

        // STEP 3: Combine with priority (open tabs first, then recently closed)
        const combined = [...openTabs, ...recentlyClosed];

        // Return limited result
        return combined.slice(0, Math.min(limit, combined.length));
    }

    /**
     * Cleanup resources
     * Should be called during extension deactivation
     */
    public dispose(): void {
        if (this.disposable) {
            this.disposable.dispose();
            this.disposable = null;
        }
        this.recentFiles = [];
        console.log('RecentFilesTracker: Disposed');
    }
}

