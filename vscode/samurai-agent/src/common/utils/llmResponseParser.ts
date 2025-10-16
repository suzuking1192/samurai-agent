/**
 * LLM Response Parser Utility
 * 
 * Provides robust parsing of JSON content from LLM responses that may be
 * wrapped in markdown code blocks or contain malformed JSON.
 * 
 * Key features:
 * - Handles both JSON objects {...} and arrays [...]
 * - Handles nested code blocks within JSON content (e.g., code examples in strings)
 * - Uses balanced brace/bracket counting for reliable extraction
 * - Multiple fallback strategies for various LLM output formats
 * - Handles common JSON formatting issues (trailing commas, unquoted keys, etc.)
 */

/**
 * Sanitizes JSON string by escaping literal newlines and other control characters within string values.
 * LLMs sometimes generate JSON with actual line breaks or control characters inside string values,
 * which is invalid JSON. This function converts them to proper escape sequences.
 * 
 * @param jsonString - The JSON string to sanitize
 * @returns Sanitized JSON string with escaped newlines and control characters
 */
function sanitizeJsonNewlines(jsonString: string): string {
    let result = '';
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];
        
        // Track if we're inside a string
        if (char === '"' && !escapeNext) {
            inString = !inString;
            result += char;
        } else if (char === '\\' && !escapeNext) {
            escapeNext = true;
            result += char;
        } else if (char === '\n') {
            // Replace literal newlines inside strings with \n
            if (inString) {
                result += '\\n';
            } else {
                // Keep newlines outside strings (for formatting)
                result += char;
            }
            escapeNext = false;
        } else if (char === '\r') {
            // Replace literal carriage returns inside strings
            if (inString) {
                result += '\\r';
            } else {
                result += char;
            }
            escapeNext = false;
        } else if (char === '\t' && inString) {
            // Replace literal tabs inside strings with \t
            result += '\\t';
            escapeNext = false;
        } else if (char === '\b' && inString) {
            // Replace literal backspace inside strings
            result += '\\b';
            escapeNext = false;
        } else if (char === '\f' && inString) {
            // Replace literal form feed inside strings
            result += '\\f';
            escapeNext = false;
        } else {
            result += char;
            escapeNext = false;
        }
    }
    
    return result;
}

/**
 * Helper function to get a snippet of text around a specific position for error reporting
 */
function getTextSnippet(text: string, position: number, context: number = 100): string {
    const start = Math.max(0, position - context);
    const end = Math.min(text.length, position + context);
    return text.substring(start, end);
}

/**
 * Advanced JSON repair function that analyzes the specific error and applies targeted fixes
 */
function repairJsonByError(jsonString: string, error: any): string | null {
    const errorMessage = error.message || '';
    const positionMatch = errorMessage.match(/position (\d+)/);
    
    if (!positionMatch) {
        return null;
    }
    
    const errorPosition = parseInt(positionMatch[1], 10);
    
    console.log(`[JSON Repair] Analyzing error at position ${errorPosition}:`, {
        errorMessage,
        snippet: getTextSnippet(jsonString, errorPosition, 50)
    });
    
    // Strategy 0: Handle unterminated strings (common with truncated responses)
    if (errorMessage.includes("Unterminated string")) {
        console.log('[JSON Repair] Detected unterminated string, attempting to close it');
        
        try {
            // The string extends to the end of the input
            // We need to close the string and then complete the JSON structure
            let repaired = jsonString;
            
            // Check if we need to add closing quote
            const lastChar = repaired[repaired.length - 1];
            if (lastChar !== '"') {
                // Close the unterminated string
                repaired += '"';
            }
            
            // Now complete the JSON structure
            const openBraces = (repaired.match(/{/g) || []).length;
            const closeBraces = (repaired.match(/}/g) || []).length;
            const openBrackets = (repaired.match(/\[/g) || []).length;
            const closeBrackets = (repaired.match(/\]/g) || []).length;
            
            // Add missing closing brackets/braces
            repaired += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
            repaired += '}'.repeat(Math.max(0, openBraces - closeBraces));
            
            console.log('[JSON Repair] Attempting to parse repaired string (unterminated):', {
                originalLength: jsonString.length,
                repairedLength: repaired.length,
                addedChars: repaired.length - jsonString.length,
                endsWith: repaired.substring(Math.max(0, repaired.length - 50))
            });
            
            JSON.parse(repaired);
            return repaired;
        } catch (repairError) {
            console.log('[JSON Repair] Unterminated string repair failed:', repairError);
            // Continue to other strategies
        }
    }
    
    // Strategy 1: Handle incomplete array elements
    if (errorMessage.includes("after array element")) {
        // Find the problematic array element and try to fix it
        const repairAttempts = [
            // Remove trailing comma and incomplete element
            jsonString.substring(0, errorPosition).replace(/,\s*$/, '') + jsonString.substring(errorPosition).replace(/^[^\]\}]*/, ''),
            // Close the array at the error position
            jsonString.substring(0, errorPosition) + ']' + jsonString.substring(errorPosition).replace(/^[^\}\]]*/, ''),
            // Remove incomplete string at error position
            jsonString.substring(0, errorPosition).replace(/"[^"]*$/, ''),
        ];
        
        for (const attempt of repairAttempts) {
            try {
                // Try to complete the structure
                let completed = attempt;
                const openBraces = (completed.match(/{/g) || []).length;
                const closeBraces = (completed.match(/}/g) || []).length;
                const openBrackets = (completed.match(/\[/g) || []).length;
                const closeBrackets = (completed.match(/\]/g) || []).length;
                
                // Add missing closing brackets/braces
                completed += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
                completed += '}'.repeat(Math.max(0, openBraces - closeBraces));
                
                JSON.parse(completed);
                return completed;
            } catch {
                continue;
            }
        }
    }
    
    // Strategy 2: Handle incomplete strings
    if (errorMessage.includes("string") || errorMessage.includes("Unexpected")) {
        try {
            // Try to close incomplete string and complete structure
            let repaired = jsonString.substring(0, errorPosition);
            
            // If we're in an incomplete string, close it
            const openQuotes = (repaired.match(/"/g) || []).length;
            if (openQuotes % 2 !== 0) {
                repaired += '"';
            }
            
            // Complete the structure
            const openBraces = (repaired.match(/{/g) || []).length;
            const closeBraces = (repaired.match(/}/g) || []).length;
            const openBrackets = (repaired.match(/\[/g) || []).length;
            const closeBrackets = (repaired.match(/\]/g) || []).length;
            
            repaired += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
            repaired += '}'.repeat(Math.max(0, openBraces - closeBraces));
            
            JSON.parse(repaired);
            return repaired;
        } catch {
            // Continue to next strategy
        }
    }
    
    // Strategy 3: Handle "Expected ',' or '}' after property value" errors
    if (errorMessage.includes("after property value")) {
        console.log('[JSON Repair] Detected "after property value" error, attempting targeted repairs');
        
        const repairAttempts = [];
        
        // Attempt 1: Find the problematic string and escape unescaped quotes
        try {
            let repaired = '';
            let inString = false;
            let escapeNext = false;
            let stringStartPos = -1;
            let foundError = false;
            
            for (let i = 0; i < jsonString.length; i++) {
                const char = jsonString[i];
                
                if (escapeNext) {
                    repaired += char;
                    escapeNext = false;
                    continue;
                }
                
                if (char === '\\') {
                    repaired += char;
                    escapeNext = true;
                    continue;
                }
                
                if (char === '"') {
                    if (!inString) {
                        inString = true;
                        stringStartPos = i;
                    } else {
                        inString = false;
                        stringStartPos = -1;
                    }
                    repaired += char;
                    continue;
                }
                
                // If we're at or past the error position and in a string, we might have found the problem
                if (i >= errorPosition && inString && !foundError) {
                    // We found an unescaped quote or problematic content
                    foundError = true;
                    console.log('[JSON Repair] Found problematic content in string at position', i);
                }
                
                repaired += char;
            }
            
            repairAttempts.push(repaired);
        } catch {
            // Continue to next attempt
        }
        
        // Attempt 2: Truncate at error position and close the structure properly
        try {
            let truncated = jsonString.substring(0, errorPosition);
            
            // Walk backwards to find the start of the problematic property value
            let pos = errorPosition - 1;
            let inStr = false;
            let escNext = false;
            
            // Find the opening quote of the current string value
            while (pos >= 0) {
                const char = truncated[pos];
                
                if (escNext) {
                    escNext = false;
                    pos--;
                    continue;
                }
                
                if (char === '\\') {
                    escNext = true;
                    pos--;
                    continue;
                }
                
                if (char === '"') {
                    if (!inStr) {
                        // Found the closing quote of the string we're in
                        inStr = true;
                    } else {
                        // Found the opening quote - this is where the problematic value starts
                        break;
                    }
                }
                pos--;
            }
            
            // Truncate before the problematic value
            if (pos > 0) {
                // Look for the property name and colon before this
                let beforeValue = truncated.substring(0, pos);
                // Find the last colon which separates property name from value
                const lastColon = beforeValue.lastIndexOf(':');
                if (lastColon > 0) {
                    truncated = beforeValue.substring(0, lastColon);
                    // Remove the property name as well if we're removing the value
                    const lastComma = truncated.lastIndexOf(',');
                    const lastOpenBrace = truncated.lastIndexOf('{');
                    if (lastComma > lastOpenBrace) {
                        truncated = truncated.substring(0, lastComma);
                    }
                }
            }
            
            // Now close the structure
            const openBraces = (truncated.match(/{/g) || []).length;
            const closeBraces = (truncated.match(/}/g) || []).length;
            const openBrackets = (truncated.match(/\[/g) || []).length;
            const closeBrackets = (truncated.match(/\]/g) || []).length;
            
            truncated += '}'.repeat(Math.max(0, openBraces - closeBraces));
            truncated += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
            
            repairAttempts.push(truncated);
            
            console.log('[JSON Repair] Created truncated version:', {
                originalLength: jsonString.length,
                truncatedLength: truncated.length,
                removedChars: jsonString.length - truncated.length
            });
        } catch {
            // Continue to next attempt
        }
        
        // Attempt 3: Simple truncation - just cut at error and close structure
        try {
            let simple = jsonString.substring(0, errorPosition);
            
            // If we're in an incomplete string, close it
            const quotes = (simple.match(/"/g) || []).length;
            if (quotes % 2 !== 0) {
                simple += '"';
            }
            
            // Close the structure
            const openBraces = (simple.match(/{/g) || []).length;
            const closeBraces = (simple.match(/}/g) || []).length;
            const openBrackets = (simple.match(/\[/g) || []).length;
            const closeBrackets = (simple.match(/\]/g) || []).length;
            
            simple += '}'.repeat(Math.max(0, openBraces - closeBraces));
            simple += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
            
            repairAttempts.push(simple);
        } catch {
            // Continue
        }
        
        // Try each repair attempt
        for (let i = 0; i < repairAttempts.length; i++) {
            try {
                JSON.parse(repairAttempts[i]);
                console.log(`[JSON Repair] ✓ Successfully repaired with attempt ${i + 1}/${repairAttempts.length}`);
                return repairAttempts[i];
            } catch (attemptError: any) {
                console.log(`[JSON Repair] Attempt ${i + 1} failed:`, attemptError.message.substring(0, 100));
            }
        }
    }
    
    return null;
}

/**
 * Specialized parser for spec generation responses that may contain markdown syntax
 * within JSON string values. This parser is more resilient to backticks, code blocks,
 * and other markdown formatting that may not be properly escaped.
 * 
 * @param text - The raw LLM response content
 * @returns Array of specs or null if parsing fails
 */
function parseSpecGenerationResponse(text: string): any[] | null {
    console.log('[Spec Parser] Using specialized spec generation parser');
    
    // Strategy 1: Try standard parsing first
    const standardResult = extractJsonFromLLMResponseInternal(text);
    if (standardResult && Array.isArray(standardResult)) {
        console.log('[Spec Parser] ✓ Standard parsing succeeded');
        return standardResult;
    }
    
    // Strategy 2: Try to sanitize backticks and markdown syntax in JSON strings
    console.log('[Spec Parser] Strategy 2: Sanitizing markdown syntax');
    let sanitized = text;
    
    // Extract the JSON content from markdown code blocks first
    const jsonStartMarker = '```json';
    const startIndex = text.indexOf(jsonStartMarker);
    if (startIndex !== -1) {
        const contentStartIndex = startIndex + jsonStartMarker.length;
        const lastEndIndex = text.lastIndexOf('```');
        if (lastEndIndex > contentStartIndex) {
            sanitized = text.substring(contentStartIndex, lastEndIndex).trim();
        }
    }
    
    // Try to fix common issues with markdown in JSON strings
    // This is tricky because we need to distinguish between JSON structural characters
    // and characters within string values
    const sanitizeAttempts = [
        // Attempt 1: Escape unescaped backticks within string values
        (content: string) => {
            let result = '';
            let inString = false;
            let escapeNext = false;
            
            for (let i = 0; i < content.length; i++) {
                const char = content[i];
                
                if (escapeNext) {
                    result += char;
                    escapeNext = false;
                    continue;
                }
                
                if (char === '\\') {
                    result += char;
                    escapeNext = true;
                    continue;
                }
                
                if (char === '"') {
                    inString = !inString;
                    result += char;
                    continue;
                }
                
                // Escape backticks within strings
                if (char === '`' && inString) {
                    result += '\\`';
                } else {
                    result += char;
                }
            }
            
            return result;
        },
        
        // Attempt 2: Try to extract valid specs up to the error point
        (content: string) => {
            // Find where the JSON array starts
            const arrayStart = content.indexOf('[');
            if (arrayStart === -1) return content;
            
            // Try to find complete spec objects
            let validContent = content.substring(0, arrayStart + 1);
            let braceCount = 0;
            let inString = false;
            let escapeNext = false;
            let validSpecs = 0;
            
            for (let i = arrayStart + 1; i < content.length; i++) {
                const char = content[i];
                
                if (escapeNext) {
                    validContent += char;
                    escapeNext = false;
                    continue;
                }
                
                if (char === '\\') {
                    validContent += char;
                    escapeNext = true;
                    continue;
                }
                
                if (char === '"' && !escapeNext) {
                    inString = !inString;
                }
                
                if (!inString) {
                    if (char === '{') braceCount++;
                    if (char === '}') {
                        braceCount--;
                        if (braceCount === 0) {
                            validSpecs++;
                            validContent += char;
                            
                            // Look ahead for comma or closing bracket
                            let j = i + 1;
                            while (j < content.length && /\s/.test(content[j])) {
                                validContent += content[j];
                                j++;
                            }
                            
                            if (j < content.length) {
                                if (content[j] === ',') {
                                    validContent += ',';
                                    i = j;
                                    continue;
                                } else if (content[j] === ']') {
                                    validContent += ']';
                                    console.log(`[Spec Parser] Extracted ${validSpecs} valid specs before error`);
                                    return validContent;
                                }
                            }
                            continue;
                        }
                    }
                }
                
                validContent += char;
            }
            
            // If we got at least one valid spec, close the array
            if (validSpecs > 0) {
                validContent += ']';
                console.log(`[Spec Parser] Extracted ${validSpecs} valid specs with array closure`);
                return validContent;
            }
            
            return content;
        }
    ];
    
    // Try each sanitization attempt
    for (let i = 0; i < sanitizeAttempts.length; i++) {
        try {
            const sanitizedContent = sanitizeAttempts[i](sanitized);
            const sanitizedWithNewlines = sanitizeJsonNewlines(sanitizedContent);
            const parsed = JSON.parse(sanitizedWithNewlines);
            
            if (Array.isArray(parsed)) {
                console.log(`[Spec Parser] ✓ Sanitization attempt ${i + 1} succeeded, extracted ${parsed.length} specs`);
                return parsed;
            }
        } catch (error: any) {
            console.log(`[Spec Parser] Sanitization attempt ${i + 1} failed:`, error.message.substring(0, 100));
        }
    }
    
    // Strategy 3: Try to parse individual specs and build array manually
    console.log('[Spec Parser] Strategy 3: Attempting to extract individual specs');
    try {
        const specs: any[] = [];
        const specMatches = sanitized.matchAll(/\{[^}]*"title"\s*:\s*"[^"]*"[^}]*"description"\s*:\s*"(?:[^"\\]|\\.)*"[^}]*\}/gs);
        
        for (const match of specMatches) {
            try {
                const specJson = match[0];
                const sanitizedSpec = sanitizeJsonNewlines(specJson);
                const spec = JSON.parse(sanitizedSpec);
                specs.push(spec);
            } catch {
                // Skip invalid specs
                continue;
            }
        }
        
        if (specs.length > 0) {
            console.log(`[Spec Parser] ✓ Extracted ${specs.length} individual specs`);
            return specs;
        }
    } catch (error: any) {
        console.log('[Spec Parser] Individual spec extraction failed:', error.message);
    }
    
    console.log('[Spec Parser] ✗ All spec parsing strategies failed');
    return null;
}

/**
 * Extracts JSON from LLM responses that may be wrapped in markdown code blocks or be plain JSON.
 * This function handles multiple formats:
 * 1. JSON wrapped in ```json``` code blocks
 * 2. Plain JSON without code block markers
 * 3. JSON with balanced brace counting for better accuracy
 * 
 * @param text - The raw LLM response content
 * @returns Parsed JSON object or array, or null if parsing fails
 */
function extractJsonFromLLMResponseInternal(text: string): any | null {
    if (!text || typeof text !== 'string') {
        console.error('[JSON Parser] Invalid input: text is not a string', {
            textType: typeof text,
            textValue: text,
            isNull: text === null,
            isUndefined: text === undefined,
            textConstructor: text?.constructor?.name || 'N/A'
        });
        return null;
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
        console.error('[JSON Parser] Invalid input: text is empty after trimming');
        return null;
    }

    console.log('[JSON Parser] Starting JSON extraction, text length:', trimmedText.length);
    console.log('[JSON Parser] Full response text:', {
        firstChars: trimmedText.substring(0, 500),
        lastChars: trimmedText.substring(Math.max(0, trimmedText.length - 500)),
        fullText: trimmedText.length < 2000 ? trimmedText : 'Response too long, see first/last chars'
    });

    // Strategy 1: Try to find JSON wrapped in markdown code blocks
    const jsonStartMarker = '```json';
    const startIndex = trimmedText.indexOf(jsonStartMarker);
    
    console.log('[JSON Parser] Strategy 1: Searching for ```json markers');
    
    if (startIndex !== -1) {
        console.log('[JSON Parser] Found ```json marker at position:', startIndex);
        // Find the position after the ```json marker
        const contentStartIndex = startIndex + jsonStartMarker.length;
        
        // Find the last ``` marker
        const endMarker = '```';
        const lastEndIndex = trimmedText.lastIndexOf(endMarker);
        
        let jsonContent = '';
        
        if (lastEndIndex !== -1 && lastEndIndex > contentStartIndex) {
            // Extract content between the markers
            jsonContent = trimmedText.substring(contentStartIndex, lastEndIndex).trim();
            
            console.log('[JSON Parser] Extracted JSON from code block:', {
                contentLength: jsonContent.length,
                startPos: contentStartIndex,
                endPos: lastEndIndex,
                firstChars: jsonContent.substring(0, 50),
                lastChars: jsonContent.substring(Math.max(0, jsonContent.length - 50))
            });
        } else {
            // No closing ``` found or it's before the opening - extract from opening marker to end
            console.log('[JSON Parser] No valid closing ``` found, extracting from ```json to end of text');
            jsonContent = trimmedText.substring(contentStartIndex).trim();
            
            // Try to find where JSON actually ends (might be followed by non-JSON text)
            // Look for the last } or ] that balances the opening { or [
            let braceCount = 0;
            let bracketCount = 0;
            let lastValidEnd = -1;
            let inString = false;
            let escapeNext = false;
            
            for (let i = 0; i < jsonContent.length; i++) {
                const char = jsonContent[i];
                
                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }
                
                if (char === '\\') {
                    escapeNext = true;
                    continue;
                }
                
                if (char === '"') {
                    inString = !inString;
                    continue;
                }
                
                if (!inString) {
                    if (char === '{') braceCount++;
                    else if (char === '}') {
                        braceCount--;
                        if (braceCount === 0 && bracketCount === 0) {
                            lastValidEnd = i;
                        }
                    } else if (char === '[') bracketCount++;
                    else if (char === ']') {
                        bracketCount--;
                        if (braceCount === 0 && bracketCount === 0) {
                            lastValidEnd = i;
                        }
                    }
                }
            }
            
            if (lastValidEnd !== -1) {
                console.log('[JSON Parser] Found balanced JSON ending at position:', lastValidEnd);
                jsonContent = jsonContent.substring(0, lastValidEnd + 1);
            }
            
            console.log('[JSON Parser] Extracted JSON without closing marker:', {
                contentLength: jsonContent.length,
                startPos: contentStartIndex,
                firstChars: jsonContent.substring(0, 50),
                lastChars: jsonContent.substring(Math.max(0, jsonContent.length - 50))
            });
        }
            
        if (jsonContent) {
            // Sanitize literal newlines in string values
            const sanitizedContent = sanitizeJsonNewlines(jsonContent);
            
            try {
                const parsed = JSON.parse(sanitizedContent);
                console.log('[JSON Parser] ✓ Successfully parsed JSON from code block:', {
                    contentLength: jsonContent.length,
                    hasExtractionQuery: !!parsed.extraction_query,
                    extractionQueryLength: parsed.extraction_query?.length,
                    topLevelKeys: Object.keys(parsed)
                });
                return parsed;
            } catch (error: any) {
                console.error('[JSON Parser] ✗ Failed to parse JSON content from code block:', {
                    error: error.message,
                    errorName: error.name,
                    contentLength: jsonContent.length,
                    snippet: error.message.includes('position') 
                        ? getTextSnippet(jsonContent, parseInt((error.message.match(/position (\d+)/) || [])[1] || '0', 10), 100)
                        : jsonContent.substring(0, 200)
                });
                
                // Try error-specific repair
                console.log('[JSON Parser] Attempting error-specific repair...');
                const repaired = repairJsonByError(sanitizedContent, error);
                if (repaired) {
                    try {
                        const parsed = JSON.parse(repaired);
                        console.log('[JSON Parser] ✓ Successfully repaired and parsed JSON');
                        return parsed;
                    } catch (repairError) {
                        console.error('[JSON Parser] ✗ Repair attempt failed:', repairError);
                    }
                }
                // Fall through to other strategies
            }
        }
    } else {
        console.log('[JSON Parser] Strategy 1: No ```json markers found in response, skipping to Strategy 2');
    }

    // Strategy 2: Try to parse the entire text as JSON (for plain JSON responses)
    console.log('[JSON Parser] Strategy 2: Attempting to parse entire text as JSON');
    try {
        const sanitizedText = sanitizeJsonNewlines(trimmedText);
        const parsed = JSON.parse(sanitizedText);
        console.log('[JSON Parser] ✓ Successfully parsed plain JSON:', {
            contentLength: trimmedText.length,
            hasExtractionQuery: !!parsed.extraction_query,
            extractionQueryLength: parsed.extraction_query?.length,
            topLevelKeys: Object.keys(parsed)
        });
        return parsed;
    } catch (error: any) {
        console.log('[JSON Parser] ✗ Strategy 2 failed:', error.message);
        // Fall through to brace counting strategy
    }

    // Strategy 3: Use balanced brace counting to find JSON object/array
    console.log('[JSON Parser] Strategy 3: Using balanced brace counting');
    let braceCount = 0;
    let startIdx = -1;
    let endIdx = -1;
    let isArray = false;

    for (let i = 0; i < trimmedText.length; i++) {
        const char = trimmedText[i];
        
        if (char === '{' || char === '[') {
            if (braceCount === 0) {
                startIdx = i;
                isArray = char === '[';
            }
            braceCount++;
        } else if (char === '}' || char === ']') {
            braceCount--;
            if (braceCount === 0 && startIdx !== -1) {
                endIdx = i;
                break;
            }
        }
    }

    console.log('[JSON Parser] Brace counting result:', {
        startIdx,
        endIdx,
        isArray,
        finalBraceCount: braceCount
    });

    if (startIdx !== -1 && endIdx !== -1) {
        const jsonCandidate = trimmedText.substring(startIdx, endIdx + 1);
        const sanitizedCandidate = sanitizeJsonNewlines(jsonCandidate);
        
        try {
            const parsed = JSON.parse(sanitizedCandidate);
            console.log('[JSON Parser] ✓ Successfully parsed JSON using brace counting:', {
                contentLength: jsonCandidate.length,
                hasExtractionQuery: !!parsed.extraction_query,
                extractionQueryLength: parsed.extraction_query?.length,
                topLevelKeys: Object.keys(parsed)
            });
            return parsed;
        } catch (error: any) {
            console.error('[JSON Parser] ✗ Failed to parse JSON using brace counting:', {
                error: error.message,
                jsonLength: jsonCandidate.length,
                snippet: error.message.includes('position') 
                    ? getTextSnippet(jsonCandidate, parseInt((error.message.match(/position (\d+)/) || [])[1] || '0', 10), 100)
                    : jsonCandidate.substring(0, 200)
            });
            
            // Try error-specific repair
            const repaired = repairJsonByError(sanitizedCandidate, error);
            if (repaired) {
                try {
                    const parsed = JSON.parse(repaired);
                    console.log('[JSON Parser] ✓ Successfully repaired and parsed JSON from brace counting');
                    return parsed;
                } catch (repairError) {
                    console.error('[JSON Parser] ✗ Repair attempt failed for brace counting:', repairError);
                }
            }
        }
    }

    // Strategy 4: Handle truncated JSON responses (common with token limits)
    if (startIdx !== -1 && endIdx === -1) {
        console.log('[JSON Parser] Strategy 4: Detected potentially truncated JSON response');
        const truncatedJson = trimmedText.substring(startIdx);
        
        console.log('[JSON Parser] Truncated JSON info:', {
            length: truncatedJson.length,
            startsWith: truncatedJson.substring(0, 50),
            endsWith: truncatedJson.substring(Math.max(0, truncatedJson.length - 100)),
            openBraces: (truncatedJson.match(/{/g) || []).length,
            closeBraces: (truncatedJson.match(/}/g) || []).length,
            openBrackets: (truncatedJson.match(/\[/g) || []).length,
            closeBrackets: (truncatedJson.match(/\]/g) || []).length
        });
        
        // Calculate how many brackets/braces we need to close
        const openBraces = (truncatedJson.match(/{/g) || []).length;
        const closeBraces = (truncatedJson.match(/}/g) || []).length;
        const openBrackets = (truncatedJson.match(/\[/g) || []).length;
        const closeBrackets = (truncatedJson.match(/\]/g) || []).length;
        const needCloseBraces = Math.max(0, openBraces - closeBraces);
        const needCloseBrackets = Math.max(0, openBrackets - closeBrackets);
        
        console.log('[JSON Parser] Structure analysis:', {
            needCloseBraces,
            needCloseBrackets,
            totalClosingsNeeded: needCloseBraces + needCloseBrackets
        });
        
        // Try to repair common truncation patterns
        const repairAttempts = [
            // Smart closing based on analysis
            truncatedJson + ']'.repeat(needCloseBrackets) + '}'.repeat(needCloseBraces),
            // Handle incomplete string at the end before closing
            truncatedJson.replace(/"[^"]*$/, '""') + ']'.repeat(needCloseBrackets) + '}'.repeat(needCloseBraces),
            // Handle trailing comma before closing
            truncatedJson.replace(/,\s*$/, '') + ']'.repeat(needCloseBrackets) + '}'.repeat(needCloseBraces),
            // Handle incomplete array element with ellipsis
            truncatedJson.replace(/,\s*"[^"]*$/, '') + ']'.repeat(needCloseBrackets) + '}'.repeat(needCloseBraces),
            truncatedJson.replace(/"[^"]*\.\.\.$/, '""') + ']'.repeat(needCloseBrackets) + '}'.repeat(needCloseBraces),
            truncatedJson.replace(/,\s*"[^"]*\.\.\.$/, '') + ']'.repeat(needCloseBrackets) + '}'.repeat(needCloseBraces),
            // Try basic closing patterns
            truncatedJson + '}',
            truncatedJson + ']}',
            truncatedJson + '}]}',
            truncatedJson + '}]}]}',
            // Handle incomplete string values
            truncatedJson.replace(/"[^"]*$/, '""') + '}',
            truncatedJson.replace(/"[^"]*$/, '""') + ']}',
            truncatedJson.replace(/"[^"]*$/, '""') + '}]}',
            // Handle incomplete array values
            truncatedJson.replace(/,\s*$/, '') + '}',
            truncatedJson.replace(/,\s*$/, '') + ']}',
            truncatedJson.replace(/,\s*$/, '') + '}]}',
        ];

        for (let i = 0; i < repairAttempts.length; i++) {
            try {
                const repaired = repairAttempts[i];
                const sanitized = sanitizeJsonNewlines(repaired);
                const parsed = JSON.parse(sanitized);
                console.log(`[JSON Parser] ✓ Successfully repaired and parsed truncated JSON (attempt ${i + 1}/${repairAttempts.length}):`, {
                    originalLength: truncatedJson.length,
                    repairedLength: repaired.length,
                    hasExtractionQuery: !!parsed.extraction_query,
                    extractionQueryLength: parsed.extraction_query?.length,
                    hasFiles: !!parsed.files,
                    filesCount: parsed.files ? Object.keys(parsed.files).length : 0,
                    topLevelKeys: Object.keys(parsed)
                });
                return parsed;
            } catch (error: any) {
                // Log only the last few failed attempts to reduce noise
                if (i >= repairAttempts.length - 3) {
                    console.log(`[JSON Parser] Repair attempt ${i + 1} failed:`, error.message.substring(0, 100));
                }
            }
        }

        // Strategy 5: Advanced repair for complex truncation patterns
        console.log('[JSON Parser] Strategy 5: Attempting advanced JSON repair for complex truncation patterns');
        
        // Try to repair the specific pattern from the log: incomplete array elements
        const advancedRepairAttempts = [
            // Remove incomplete array elements and close properly with smart closing
            truncatedJson.replace(/,\s*"[^"]*\.\.\.$/, '') + ']'.repeat(needCloseBrackets) + '}'.repeat(needCloseBraces),
            // Remove any incomplete element at the end
            truncatedJson.replace(/,\s*[^,\}\]]*$/, '') + ']'.repeat(needCloseBrackets) + '}'.repeat(needCloseBraces),
            // Handle nested truncation patterns
            truncatedJson.replace(/,\s*"[^"]*\.\.\.$/, '') + '}',
            truncatedJson.replace(/,\s*"[^"]*\.\.\.$/, '') + ']}',
            truncatedJson.replace(/,\s*"[^"]*\.\.\.$/, '') + '}]}',
            truncatedJson.replace(/,\s*"[^"]*\.\.\.$/, '') + '}]}]}',
            // Handle the specific case where we have incomplete string values
            truncatedJson.replace(/"[^"]*\.\.\.$/, '""') + ']}',
            truncatedJson.replace(/"[^"]*\.\.\.$/, '""') + '}]}',
            // Try to find the last complete element and close from there
            truncatedJson.substring(0, truncatedJson.lastIndexOf('"')) + ']'.repeat(needCloseBrackets) + '}'.repeat(needCloseBraces),
        ];

        for (let i = 0; i < advancedRepairAttempts.length; i++) {
            try {
                const repaired = advancedRepairAttempts[i];
                const sanitized = sanitizeJsonNewlines(repaired);
                const parsed = JSON.parse(sanitized);
                console.log(`[JSON Parser] ✓ Successfully repaired truncated JSON with advanced strategy (attempt ${i + 1}/${advancedRepairAttempts.length}):`, {
                    originalLength: truncatedJson.length,
                    repairedLength: repaired.length,
                    hasExtractionQuery: !!parsed.extraction_query,
                    extractionQueryLength: parsed.extraction_query?.length,
                    hasFiles: !!parsed.files,
                    filesCount: parsed.files ? Object.keys(parsed.files).length : 0,
                    topLevelKeys: Object.keys(parsed)
                });
                return parsed;
            } catch (error: any) {
                // Log only the last few failed attempts to reduce noise
                if (i >= advancedRepairAttempts.length - 2) {
                    console.log(`[JSON Parser] Advanced repair attempt ${i + 1} failed:`, error.message.substring(0, 100));
                }
            }
        }

        console.error('[JSON Parser] ✗ Failed to repair truncated JSON response after all attempts');
    }

    // All strategies failed
    console.error('[JSON Parser] ✗ All parsing strategies exhausted, returning null');
    return null;
}

/**
 * Attempts to extract a score value from the end of the response text as a fallback.
 * This handles cases where the main JSON parsing might extract only part of the JSON
 * and miss the score field at the end.
 * 
 * @param text - The raw response text
 * @returns The extracted score number, or null if not found
 */
function extractScoreFromEnd(text: string): number | null {
    if (!text || typeof text !== 'string') {
        return null;
    }
    
    // Look for "score": <number> pattern near the end of the text
    // Match patterns like: "score": 85, "score":85, "score": 85}, "score": 85}
    const scorePattern = /"score"\s*:\s*(\d+)/g;
    let lastScore: number | null = null;
    let match;
    
    // Find all matches and keep the last one (closest to the end)
    while ((match = scorePattern.exec(text)) !== null) {
        const scoreValue = parseInt(match[1], 10);
        if (!isNaN(scoreValue) && scoreValue >= 0 && scoreValue <= 100) {
            lastScore = scoreValue;
        }
    }
    
    if (lastScore !== null) {
        console.log('[JSON Parser] ✓ Extracted score from end of response:', lastScore);
    }
    
    return lastScore;
}

/**
 * Checks if a parsed result appears to be an artifact generation response and repairs
 * missing required fields (mermaidData, textSpec) with placeholder text.
 * This handles cases where the LLM response was truncated before completing all fields.
 * 
 * @param result - The parsed JSON result
 * @returns The repaired result with all required fields, or the original if not an artifact
 */
function repairArtifactFields(result: any): any {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
        return result;
    }
    
    // Check if this looks like an artifact response (has mermaidData or textSpec)
    const isArtifact = 'mermaidData' in result || 'textSpec' in result;
    
    if (!isArtifact) {
        return result;
    }
    
    let wasRepaired = false;
    
    // Add missing mermaidData with placeholder
    if (!result.mermaidData || typeof result.mermaidData !== 'string' || result.mermaidData.trim() === '') {
        console.log('[JSON Parser] Missing or empty mermaidData in artifact, adding placeholder');
        result.mermaidData = 'graph TD\n    A[Response was truncated] --> B[Unable to generate full diagram]';
        wasRepaired = true;
    }
    
    // Add missing textSpec with placeholder
    if (!result.textSpec || typeof result.textSpec !== 'string' || result.textSpec.trim() === '') {
        console.log('[JSON Parser] Missing or empty textSpec in artifact, adding placeholder');
        result.textSpec = '[Response was truncated before specification could be completed. Please try regenerating or provide more specific requirements.]';
        wasRepaired = true;
    }
    
    if (wasRepaired) {
        console.log('[JSON Parser] ✓ Repaired artifact with missing fields:', {
            hasMermaidData: !!result.mermaidData,
            hasTextSpec: !!result.textSpec,
            mermaidDataLength: result.mermaidData?.length || 0,
            textSpecLength: result.textSpec?.length || 0
        });
    }
    
    return result;
}

/**
 * Main export function that chooses the appropriate parsing strategy
 * @param text - The raw LLM response content
 * @param options - Optional configuration
 * @returns Parsed JSON object or array, or null if parsing fails
 */
export function extractJsonFromLLMResponse(text: string, options?: { isSpecGeneration?: boolean }): any | null {
    if (options?.isSpecGeneration) {
        // Use specialized spec generation parser
        return parseSpecGenerationResponse(text);
    }
    
    // Use standard parser
    let result = extractJsonFromLLMResponseInternal(text);
    
    // Fallback 1: If result exists but has undefined or missing score, try to extract from end
    if (result && typeof result === 'object' && !Array.isArray(result)) {
        if ('clarification_text' in result && (result.score === undefined || result.score === null)) {
            console.log('[JSON Parser] Score is missing or undefined, attempting fallback extraction from end of text');
            const extractedScore = extractScoreFromEnd(text);
            if (extractedScore !== null) {
                result.score = extractedScore;
                console.log('[JSON Parser] ✓ Successfully applied fallback score:', extractedScore);
            }
        }
    }
    
    // Fallback 2: If result looks like an artifact, ensure both required fields are present
    if (result && typeof result === 'object' && !Array.isArray(result)) {
        result = repairArtifactFields(result);
    }
    
    return result;
}
