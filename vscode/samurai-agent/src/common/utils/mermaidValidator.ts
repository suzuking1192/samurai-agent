/**
 * Validates and repairs Mermaid diagram syntax
 */

/**
 * Common Mermaid syntax errors and their fixes
 */
const MERMAID_FIXES = [
    // Fix: Remove invalid characters in node IDs
    { pattern: /([A-Za-z0-9_]+)\s*\[/g, fix: (match: string, id: string) => `${id.replace(/[^A-Za-z0-9_]/g, '')}[` },
    
    // Fix: Ensure proper arrow syntax
    { pattern: /-->/g, fix: () => '-->' },
    { pattern: /--->/g, fix: () => '-->' },
    { pattern: /->/g, fix: () => '-->' },
    
    // Fix: Remove trailing commas or semicolons
    { pattern: /[,;]\s*$/gm, fix: () => '' },
    
    // Fix: Ensure quotes are properly closed in labels
    { pattern: /\[([^\]]*?)$/gm, fix: (match: string, content: string) => `[${content}]` },
    { pattern: /\(([^\)]*?)$/gm, fix: (match: string, content: string) => `(${content})` },
    
    // Fix: Remove invalid characters from style definitions
    { pattern: /style\s+([A-Za-z0-9_]+)\s+([^\n]+)/g, fix: (match: string, nodeId: string, styles: string) => {
        // Clean up style definitions
        const cleanStyles = styles.trim();
        return `style ${nodeId} ${cleanStyles}`;
    }},
];

/**
 * Validates basic Mermaid syntax structure
 */
function validateMermaidStructure(mermaidCode: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!mermaidCode || typeof mermaidCode !== 'string') {
        return { valid: false, errors: ['Mermaid code is empty or invalid'] };
    }
    
    const trimmed = mermaidCode.trim();
    
    // Check for markdown code fences (should be removed)
    if (trimmed.includes('```mermaid') || trimmed.includes('```')) {
        errors.push('Contains markdown code fences');
    }
    
    // Check if it starts with a valid diagram type
    const validDiagramTypes = [
        'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 
        'stateDiagram', 'erDiagram', 'gantt', 'pie', 'journey',
        'gitGraph', 'mindmap', 'timeline', 'C4Context'
    ];
    
    const startsWithValidType = validDiagramTypes.some(type => 
        trimmed.startsWith(type) || trimmed.startsWith(`\`\`\`mermaid\n${type}`)
    );
    
    if (!startsWithValidType) {
        errors.push(`Diagram must start with a valid type: ${validDiagramTypes.join(', ')}`);
    }
    
    // Check for balanced brackets and parentheses
    const openBrackets = (mermaidCode.match(/\[/g) || []).length;
    const closeBrackets = (mermaidCode.match(/\]/g) || []).length;
    const openParens = (mermaidCode.match(/\(/g) || []).length;
    const closeParens = (mermaidCode.match(/\)/g) || []).length;
    
    if (openBrackets !== closeBrackets) {
        errors.push(`Unbalanced square brackets: ${openBrackets} opening, ${closeBrackets} closing`);
    }
    
    if (openParens !== closeParens) {
        errors.push(`Unbalanced parentheses: ${openParens} opening, ${closeParens} closing`);
    }
    
    // Check for incomplete style definitions
    const lines = mermaidCode.split('\n');
    const lastNonEmptyLine = lines.filter(line => line.trim().length > 0).pop();
    if (lastNonEmptyLine && lastNonEmptyLine.trim().startsWith('style ')) {
        if (!lastNonEmptyLine.includes('fill:') && !lastNonEmptyLine.includes('stroke:')) {
            errors.push('Incomplete style definition at end');
        }
    }
    
    // Check for common syntax errors
    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('%%')) {
            return;
        }
        
        // Check for invalid node ID characters (except in labels)
        const nodeIdMatch = line.match(/^\s*([A-Za-z0-9_\-]+)\s*[\[\(]/);
        if (nodeIdMatch) {
            const nodeId = nodeIdMatch[1];
            if (!/^[A-Za-z0-9_\-]+$/.test(nodeId)) {
                errors.push(`Line ${index + 1}: Invalid node ID "${nodeId}" - use only letters, numbers, underscores, and hyphens`);
            }
        }
    });
    
    return { valid: errors.length === 0, errors };
}

/**
 * Attempts to repair common Mermaid syntax errors
 */
export function repairMermaidSyntax(mermaidCode: string): { 
    repaired: string; 
    wasRepaired: boolean; 
    errors: string[];
    originalErrors: string[];
} {
    if (!mermaidCode || typeof mermaidCode !== 'string') {
        return { 
            repaired: 'graph TD\n    A[Invalid Diagram] --> B[Please regenerate]', 
            wasRepaired: true,
            errors: ['Input was empty or invalid'],
            originalErrors: ['Input was empty or invalid']
        };
    }
    
    let repaired = mermaidCode;
    let changesApplied = 0;
    
    // Fix escaped newlines first (before validation)
    if (repaired.includes('\\n')) {
        repaired = repaired.replace(/\\n/g, '\n');
        changesApplied++;
    }
    
    // Remove markdown code fences early (before validation)
    if (repaired.includes('```')) {
        repaired = repaired.replace(/^```mermaid\n?/i, '').replace(/\n?```$/i, '');
        changesApplied++;
    }
    
    const originalValidation = validateMermaidStructure(mermaidCode);
    
    // If already valid after basic fixes, validate the repaired version
    if (originalValidation.valid && changesApplied === 0) {
        return { 
            repaired: mermaidCode, 
            wasRepaired: false, 
            errors: [],
            originalErrors: []
        };
    }
    
    // Apply automatic fixes
    MERMAID_FIXES.forEach(({ pattern, fix }) => {
        const before = repaired;
        repaired = repaired.replace(pattern, fix as any);
        if (before !== repaired) {
            changesApplied++;
        }
    });
    
    // Ensure it starts with a valid diagram type
    const trimmed = repaired.trim();
    if (!trimmed.startsWith('graph') && !trimmed.startsWith('flowchart') && 
        !trimmed.startsWith('sequenceDiagram') && !trimmed.startsWith('classDiagram')) {
        // Default to flowchart if no type specified
        if (trimmed.includes('-->') || trimmed.includes('---')) {
            repaired = `graph TD\n${trimmed}`;
            changesApplied++;
        }
    }
    
    // Fix incomplete style definitions at the end
    const lines = repaired.split('\n');
    const lastNonEmptyLine = lines.reverse().find(line => line.trim().length > 0);
    if (lastNonEmptyLine && lastNonEmptyLine.trim().startsWith('style ')) {
        // Check if style definition is incomplete
        if (!lastNonEmptyLine.includes('fill:') && !lastNonEmptyLine.includes('stroke:')) {
            // Remove incomplete style line
            repaired = repaired.split('\n').filter(line => line !== lastNonEmptyLine).join('\n');
            changesApplied++;
        }
    }
    
    // Validate repaired version
    const repairedValidation = validateMermaidStructure(repaired);
    
    console.log('[Mermaid Validator] Repair attempted:', {
        wasRepaired: changesApplied > 0,
        changesApplied,
        originalValid: originalValidation.valid,
        repairedValid: repairedValidation.valid,
        originalErrors: originalValidation.errors,
        remainingErrors: repairedValidation.errors
    });
    
    return {
        repaired,
        wasRepaired: changesApplied > 0,
        errors: repairedValidation.errors,
        originalErrors: originalValidation.errors
    };
}

/**
 * Validates if a string is valid Mermaid syntax
 */
export function isValidMermaid(mermaidCode: string): boolean {
    const validation = validateMermaidStructure(mermaidCode);
    return validation.valid;
}

/**
 * Gets a simplified error message for display
 */
export function getMermaidErrorMessage(errors: string[]): string {
    if (errors.length === 0) {
        return '';
    }
    
    if (errors.length === 1) {
        return errors[0];
    }
    
    return `Multiple syntax errors found:\n${errors.slice(0, 3).map((e, i) => `${i + 1}. ${e}`).join('\n')}`;
}

