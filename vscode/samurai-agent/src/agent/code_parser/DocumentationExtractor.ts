/**
 * Phase 2: Language-Agnostic Documentation Extraction
 */

import { Documentation } from '../../common/models/context-models';

export class DocumentationExtractor {
    /**
     * Extract documentation for a code element based on language
     */
    public extractDocumentation(
        lines: string[],
        elementStartLine: number,
        language: string
    ): Documentation | undefined {
        const lang = language.toLowerCase();
        
        if (lang === 'typescript' || lang === 'javascript' || lang === 'tsx' || lang === 'jsx') {
            return this.extractJSDoc(lines, elementStartLine);
        }
        
        if (lang === 'python') {
            return this.extractPythonDocstring(lines, elementStartLine);
        }
        
        if (lang === 'java') {
            return this.extractJavadoc(lines, elementStartLine);
        }
        
        if (lang === 'cpp' || lang === 'c') {
            return this.extractDoxygen(lines, elementStartLine);
        }
        
        if (lang === 'rust') {
            return this.extractRustdoc(lines, elementStartLine);
        }
        
        if (lang === 'csharp') {
            return this.extractXMLDoc(lines, elementStartLine);
        }
        
        if (lang === 'php') {
            return this.extractPHPDoc(lines, elementStartLine);
        }
        
        if (lang === 'ruby') {
            return this.extractRDoc(lines, elementStartLine);
        }
        
        if (lang === 'go') {
            return this.extractGodoc(lines, elementStartLine);
        }
        
        return undefined;
    }

    private extractJSDoc(lines: string[], elementStartLine: number): Documentation | undefined {
        const doc: Documentation = {};
        const docLines: string[] = [];
        
        let currentLine = elementStartLine - 1;
        let inDocBlock = false;
        
        // Find JSDoc block working backwards
        while (currentLine >= 0 && (elementStartLine - currentLine) < 50) {
            const line = lines[currentLine].trim();
            
            if (line.endsWith('*/')) {
                inDocBlock = true;
            } else if (line.startsWith('/**')) {
                if (inDocBlock) {
                    break;
                }
            } else if (!line.startsWith('*') && !line.startsWith('//') && inDocBlock) {
                return undefined;
            }
            
            if (inDocBlock) {
                docLines.unshift(lines[currentLine]);
            }
            
            currentLine--;
        }

        if (docLines.length === 0) {
            return undefined;
        }

        const fullDoc = docLines.join('\n');
        doc.summary = this.extractJSDocSummary(fullDoc);
        doc.params = this.extractJSDocParams(fullDoc);
        doc.returns = this.extractJSDocReturns(fullDoc);
        doc.throws = this.extractJSDocThrows(fullDoc);
        doc.examples = this.extractJSDocExamples(fullDoc);
        doc.deprecated = fullDoc.includes('@deprecated');

        if (Object.keys(doc).length > 0) {
            return doc;
        }
        return undefined;
    }

    private extractJSDocSummary(docBlock: string): string | undefined {
        const lines = docBlock.split('\n');
        const summaryLines: string[] = [];
        
        for (const line of lines) {
            let cleaned = line.trim();
            // Remove comment markers
            cleaned = cleaned.replace(/^\/\*\*/, '').replace(/^\*/, '').replace(/\*\/$/, '').trim();
            
            if (!cleaned || cleaned.startsWith('@')) {
                if (summaryLines.length > 0) {
                    break;
                }
                continue;
            }
            summaryLines.push(cleaned);
        }
        
        return summaryLines.length > 0 ? summaryLines.join(' ') : undefined;
    }

    private extractJSDocParams(docBlock: string): Array<{name: string; type?: string; description: string}> | undefined {
        const params: Array<{name: string; type?: string; description: string}> = [];
        const paramPattern = /@param\s+(?:\{([^}]+)\}\s+)?(\w+)\s*-?\s*(.*)/g;
        
        let match;
        while ((match = paramPattern.exec(docBlock)) !== null) {
            params.push({
                name: match[2],
                type: match[1],
                description: match[3] || '',
            });
        }
        
        return params.length > 0 ? params : undefined;
    }

    private extractJSDocReturns(docBlock: string): {type?: string; description: string} | undefined {
        const returnPattern = /@returns?\s+(?:\{([^}]+)\}\s+)?(.*)/;
        const match = docBlock.match(returnPattern);
        
        if (match) {
            return {
                type: match[1],
                description: match[2] || '',
            };
        }
        
        return undefined;
    }

    private extractJSDocThrows(docBlock: string): Array<{type: string; description: string}> | undefined {
        const throws: Array<{type: string; description: string}> = [];
        const throwsPattern = /@throws\s+(?:\{([^}]+)\}\s+)?(.*)/g;
        
        let match;
        while ((match = throwsPattern.exec(docBlock)) !== null) {
            throws.push({
                type: match[1] || 'Error',
                description: match[2] || '',
            });
        }
        
        return throws.length > 0 ? throws : undefined;
    }

    private extractJSDocExamples(docBlock: string): string[] | undefined {
        const examples: string[] = [];
        const examplePattern = /@example\s+((?:.|\n)*?)(?=@\w+|$)/g;
        
        let match;
        while ((match = examplePattern.exec(docBlock)) !== null) {
            examples.push(match[1].trim());
        }
        
        return examples.length > 0 ? examples : undefined;
    }

    private extractPythonDocstring(lines: string[], elementStartLine: number): Documentation | undefined {
        const doc: Documentation = {};
        
        // Python docstrings come AFTER the function/class definition
        // Check the next line (or next non-empty line)
        let docstringStartLine = elementStartLine + 1;
        
        // Skip to next non-empty line
        while (docstringStartLine < lines.length && !lines[docstringStartLine].trim()) {
            docstringStartLine++;
        }
        
        if (docstringStartLine >= lines.length) {
            return undefined;
        }
        
        const firstDocLine = lines[docstringStartLine].trim();
        const isTripleDoubleQuote = firstDocLine.startsWith('"""');
        const isTripleSingleQuote = firstDocLine.startsWith("'''");
        
        if (!isTripleDoubleQuote && !isTripleSingleQuote) {
            return undefined;
        }
        
        const quoteType = isTripleDoubleQuote ? '"""' : "'''";
        const docLines: string[] = [];
        let foundEnd = false;
        
        // Check if it's a one-line docstring
        if (firstDocLine.endsWith(quoteType) && firstDocLine.length > 6) {
            // One-line docstring like: """Summary"""
            const content = firstDocLine.substring(3, firstDocLine.length - 3).trim();
            return {
                summary: content,
            };
        }
        
        // Multi-line docstring
        for (let i = docstringStartLine; i < lines.length && i < docstringStartLine + 100; i++) {
            const line = lines[i];
            docLines.push(line);
            
            if (i > docstringStartLine && line.trim().endsWith(quoteType)) {
                foundEnd = true;
                break;
            }
        }
        
        if (!foundEnd) {
            return undefined;
        }
        
        const fullDoc = docLines.join('\n');
        doc.summary = this.extractPythonDocstringSummary(fullDoc, quoteType);
        doc.params = this.extractPythonDocstringParams(fullDoc);
        doc.returns = this.extractPythonDocstringReturns(fullDoc);
        
        if (Object.keys(doc).length > 0) {
            return doc;
        }
        return undefined;
    }

    private extractPythonDocstringSummary(docBlock: string, quoteType: string): string | undefined {
        let cleaned = docBlock;
        cleaned = cleaned.replace(new RegExp(quoteType, 'g'), '');
        cleaned = cleaned.trim();
        
        const lines = cleaned.split('\n');
        const summaryLines: string[] = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                if (summaryLines.length > 0) {
                    break;
                }
                continue;
            }
            if (trimmed.startsWith('Args:') || trimmed.startsWith('Returns:') || 
                trimmed.startsWith('Raises:') || trimmed.startsWith('Parameters:')) {
                break;
            }
            summaryLines.push(trimmed);
        }
        
        return summaryLines.length > 0 ? summaryLines.join(' ') : undefined;
    }

    private extractPythonDocstringParams(docBlock: string): Array<{name: string; type?: string; description: string}> | undefined {
        const params: Array<{name: string; type?: string; description: string}> = [];
        
        const argsMatch = docBlock.match(/(?:Args|Parameters):([\s\S]*?)(?=Returns:|Raises:|$)/);
        if (argsMatch) {
            const argsSection = argsMatch[1];
            const paramPattern = /(\w+)\s*(?:\(([^)]+)\))?\s*:\s*(.+)/g;
            
            let match;
            while ((match = paramPattern.exec(argsSection)) !== null) {
                params.push({
                    name: match[1],
                    type: match[2],
                    description: match[3].trim(),
                });
            }
        }
        
        return params.length > 0 ? params : undefined;
    }

    private extractPythonDocstringReturns(docBlock: string): {type?: string; description: string} | undefined {
        const returnsMatch = docBlock.match(/Returns:\s*([\s\S]*?)(?=Raises:|$)/);
        if (returnsMatch) {
            return {
                description: returnsMatch[1].trim(),
            };
        }
        return undefined;
    }

    private extractJavadoc(lines: string[], elementStartLine: number): Documentation | undefined {
        return this.extractJSDoc(lines, elementStartLine);
    }

    private extractDoxygen(lines: string[], elementStartLine: number): Documentation | undefined {
        const tripleSlashDoc = this.extractTripleSlashComments(lines, elementStartLine);
        if (tripleSlashDoc) {
            return tripleSlashDoc;
        }
        return this.extractJSDoc(lines, elementStartLine);
    }

    private extractTripleSlashComments(lines: string[], elementStartLine: number): Documentation | undefined {
        const docLines: string[] = [];
        let currentLine = elementStartLine - 1;
        
        while (currentLine >= 0 && (elementStartLine - currentLine) < 50) {
            const line = lines[currentLine].trim();
            if (line.startsWith('///')) {
                const cleaned = line.substring(3).trim();
                docLines.unshift(cleaned);
            } else if (line && !line.startsWith('//')) {
                break;
            }
            currentLine--;
        }
        
        if (docLines.length === 0) {
            return undefined;
        }
        
        return {
            summary: docLines.join(' '),
        };
    }

    private extractRustdoc(lines: string[], elementStartLine: number): Documentation | undefined {
        return this.extractTripleSlashComments(lines, elementStartLine);
    }

    private extractXMLDoc(lines: string[], elementStartLine: number): Documentation | undefined {
        const docLines: string[] = [];
        let currentLine = elementStartLine - 1;
        
        while (currentLine >= 0 && (elementStartLine - currentLine) < 50) {
            const line = lines[currentLine].trim();
            if (line.startsWith('///')) {
                docLines.unshift(line);
            } else if (line && !line.startsWith('//')) {
                break;
            }
            currentLine--;
        }
        
        if (docLines.length === 0) {
            return undefined;
        }
        
        const fullDoc = docLines.join('\n');
        
        const summaryMatch = fullDoc.match(/<summary>([\s\S]*?)<\/summary>/);
        const summary = summaryMatch ? summaryMatch[1].trim().replace(/\/\/\/ ?/g, '') : undefined;
        
        const params: Array<{name: string; description: string}> = [];
        const paramPattern = /<param name="(\w+)">([\s\S]*?)<\/param>/g;
        let match: RegExpExecArray | null;
        while ((match = paramPattern.exec(fullDoc)) !== null) {
            params.push({
                name: match[1],
                description: match[2].trim().replace(/\/\/\/ ?/g, ''),
            });
        }
        
        const returnsMatch = fullDoc.match(/<returns>([\s\S]*?)<\/returns>/);
        const returns = returnsMatch ? {
            description: returnsMatch[1].trim().replace(/\/\/\/ ?/g, ''),
        } : undefined;
        
        return {
            summary,
            params: params.length > 0 ? params : undefined,
            returns,
        };
    }

    private extractPHPDoc(lines: string[], elementStartLine: number): Documentation | undefined {
        return this.extractJSDoc(lines, elementStartLine);
    }

    private extractRDoc(lines: string[], elementStartLine: number): Documentation | undefined {
        const docLines: string[] = [];
        let currentLine = elementStartLine - 1;
        
        while (currentLine >= 0 && (elementStartLine - currentLine) < 50) {
            const line = lines[currentLine].trim();
            if (line.startsWith('#') && !line.startsWith('#!/')) {
                const cleaned = line.replace(/^#+ ?/, '');
                docLines.unshift(cleaned);
            } else if (line) {
                break;
            }
            currentLine--;
        }
        
        if (docLines.length === 0) {
            return undefined;
        }
        
        return {
            summary: docLines.join(' '),
        };
    }

    private extractGodoc(lines: string[], elementStartLine: number): Documentation | undefined {
        const docLines: string[] = [];
        let currentLine = elementStartLine - 1;
        
        while (currentLine >= 0 && (elementStartLine - currentLine) < 50) {
            const line = lines[currentLine].trim();
            if (line.startsWith('//')) {
                const cleaned = line.substring(2).trim();
                docLines.unshift(cleaned);
            } else if (line) {
                break;
            }
            currentLine--;
        }
        
        if (docLines.length === 0) {
            return undefined;
        }
        
        return {
            summary: docLines.join(' '),
        };
    }

    /**
     * Extract inline comments from code snippet
     */
    public extractInlineComments(codeSnippet: string, language: string): string[] {
        const comments: string[] = [];
        const lines = codeSnippet.split('\n');
        const lang = language.toLowerCase();
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            if (lang === 'python') {
                if (trimmed.startsWith('#') && !trimmed.startsWith('#!/')) {
                    comments.push(trimmed.substring(1).trim());
                }
            } else if (lang === 'ruby') {
                if (trimmed.startsWith('#')) {
                    comments.push(trimmed.substring(1).trim());
                }
            } else {
                // Most C-style languages use //
                if (trimmed.startsWith('//')) {
                    comments.push(trimmed.substring(2).trim());
                }
            }
        }
        
        return comments;
    }
}
