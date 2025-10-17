/**
 * Phase 10: Performance Optimization - Caching Layer
 * 
 * Caches parsed results to avoid re-parsing unchanged files:
 * - Element cache (keyed by file path + modification time)
 * - Relationship cache
 * - Pattern cache
 * - Auto-invalidation on file changes
 */

import { CodeElement, CodeRelationships, CodePatterns } from '../../common/models/context-models';

interface CacheEntry {
    elements: CodeElement[];
    relationships: CodeRelationships;
    patterns: CodePatterns;
    lastModified: number;
}

export class CodeParserCache {
    private cache: Map<string, CacheEntry> = new Map();
    private maxCacheSize: number = 1000; // Maximum number of files to cache

    /**
     * Get cached parse results if available and not stale
     */
    public get(filePath: string, lastModified: number): CacheEntry | null {
        const cached = this.cache.get(filePath);
        
        if (!cached) {
            return null;
        }

        // Check if cache is stale
        if (cached.lastModified !== lastModified) {
            this.cache.delete(filePath);
            return null;
        }

        return cached;
    }

    /**
     * Store parse results in cache
     */
    public set(
        filePath: string,
        elements: CodeElement[],
        relationships: CodeRelationships,
        patterns: CodePatterns,
        lastModified: number
    ): void {
        // Enforce cache size limit (LRU-style)
        if (this.cache.size >= this.maxCacheSize) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(filePath, {
            elements,
            relationships,
            patterns,
            lastModified,
        });
    }

    /**
     * Invalidate cache for a specific file
     */
    public invalidate(filePath: string): void {
        this.cache.delete(filePath);
    }

    /**
     * Clear entire cache
     */
    public clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    public getStats(): { size: number; maxSize: number; hitRate: number } {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            hitRate: 0, // Would need hit/miss tracking to calculate
        };
    }
}

