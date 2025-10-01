/**
 * Unit tests for Code Review functionality in spec.js
 * 
 * These tests verify the core JavaScript functions for code review workflow
 */

const assert = require('assert');

/**
 * Mock implementation of loadSpecAndDescendants for testing
 * This simulates the actual function from spec.js
 */
function loadSpecAndDescendants(specId, specs) {
    const result = [];
    const visited = new Set();
    
    // Find the root spec
    const rootSpec = specs.find(s => s.id === specId);
    if (!rootSpec) {
        return result;
    }
    
    // Add root spec
    result.push(rootSpec);
    visited.add(specId);
    
    // Recursively find all descendants using BFS
    const queue = [specId];
    
    while (queue.length > 0) {
        const currentId = queue.shift();
        
        // Find all children of current spec
        const children = specs.filter(s => s.parentSpecId === currentId);
        
        for (const child of children) {
            if (!visited.has(child.id)) {
                result.push(child);
                visited.add(child.id);
                queue.push(child.id);
            }
        }
    }
    
    return result;
}

/**
 * Mock implementation of message formatting
 */
function formatCodeReviewMessage(specsToReview) {
    let messageContent = "Attention required: Please conduct a thorough code review. Verify the latest codebase against the following specifications to ensure accurate and complete implementation:\n\n";
    
    specsToReview.forEach((spec) => {
        messageContent += `**${spec.title}**\n\n`;
        messageContent += "```\n";
        messageContent += spec.spec || '(No specification content)';
        messageContent += "\n```\n\n";
    });
    
    return messageContent;
}

suite('Spec Code Review Unit Tests', () => {
    
    suite('loadSpecAndDescendants', () => {
        
        test('Should return single spec with no descendants', () => {
            const specs = [
                { id: 'spec-1', title: 'Spec 1', spec: 'Content 1', parentSpecId: null, depth: 1 }
            ];
            
            const result = loadSpecAndDescendants('spec-1', specs);
            
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].id, 'spec-1');
        });
        
        test('Should return spec with direct children', () => {
            const specs = [
                { id: 'spec-1', title: 'Parent', spec: 'Parent content', parentSpecId: null, depth: 1 },
                { id: 'spec-2', title: 'Child 1', spec: 'Child 1 content', parentSpecId: 'spec-1', depth: 2 },
                { id: 'spec-3', title: 'Child 2', spec: 'Child 2 content', parentSpecId: 'spec-1', depth: 2 }
            ];
            
            const result = loadSpecAndDescendants('spec-1', specs);
            
            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].id, 'spec-1'); // Parent first
            assert.ok(result.some(s => s.id === 'spec-2')); // Contains child 1
            assert.ok(result.some(s => s.id === 'spec-3')); // Contains child 2
        });
        
        test('Should return spec with multiple levels of descendants', () => {
            const specs = [
                { id: 'spec-1', title: 'Parent', spec: 'Parent content', parentSpecId: null, depth: 1 },
                { id: 'spec-2', title: 'Child 1', spec: 'Child 1 content', parentSpecId: 'spec-1', depth: 2 },
                { id: 'spec-3', title: 'Child 2', spec: 'Child 2 content', parentSpecId: 'spec-1', depth: 2 },
                { id: 'spec-4', title: 'Grandchild 1', spec: 'GC 1 content', parentSpecId: 'spec-2', depth: 3 },
                { id: 'spec-5', title: 'Grandchild 2', spec: 'GC 2 content', parentSpecId: 'spec-2', depth: 3 },
                { id: 'spec-6', title: 'Great-grandchild', spec: 'GGC content', parentSpecId: 'spec-4', depth: 4 }
            ];
            
            const result = loadSpecAndDescendants('spec-1', specs);
            
            assert.strictEqual(result.length, 6);
            assert.strictEqual(result[0].id, 'spec-1'); // Parent first
            
            // Verify BFS order: parent, then children, then grandchildren, then great-grandchildren
            const parentIndex = result.findIndex(s => s.id === 'spec-1');
            const child1Index = result.findIndex(s => s.id === 'spec-2');
            const grandchild1Index = result.findIndex(s => s.id === 'spec-4');
            
            assert.ok(parentIndex < child1Index);
            assert.ok(child1Index < grandchild1Index);
        });
        
        test('Should return empty array for non-existent spec', () => {
            const specs = [
                { id: 'spec-1', title: 'Spec 1', spec: 'Content 1', parentSpecId: null, depth: 1 }
            ];
            
            const result = loadSpecAndDescendants('non-existent', specs);
            
            assert.strictEqual(result.length, 0);
        });
        
        test('Should not include specs from other branches', () => {
            const specs = [
                { id: 'spec-1', title: 'Parent 1', spec: 'P1 content', parentSpecId: null, depth: 1 },
                { id: 'spec-2', title: 'Child 1-1', spec: 'C1-1 content', parentSpecId: 'spec-1', depth: 2 },
                { id: 'spec-3', title: 'Parent 2', spec: 'P2 content', parentSpecId: null, depth: 1 },
                { id: 'spec-4', title: 'Child 2-1', spec: 'C2-1 content', parentSpecId: 'spec-3', depth: 2 }
            ];
            
            const result = loadSpecAndDescendants('spec-1', specs);
            
            assert.strictEqual(result.length, 2);
            assert.ok(result.some(s => s.id === 'spec-1'));
            assert.ok(result.some(s => s.id === 'spec-2'));
            assert.ok(!result.some(s => s.id === 'spec-3')); // Should not include other branch
            assert.ok(!result.some(s => s.id === 'spec-4')); // Should not include other branch
        });
    });
    
    suite('formatCodeReviewMessage', () => {
        
        test('Should format message with correct header', () => {
            const specs = [
                { id: 'spec-1', title: 'Test Spec', spec: 'Test content', depth: 1 }
            ];
            
            const message = formatCodeReviewMessage(specs);
            
            assert.ok(message.startsWith('Attention required: Please conduct a thorough code review.'));
        });
        
        test('Should include spec title in bold', () => {
            const specs = [
                { id: 'spec-1', title: 'Test Spec', spec: 'Test content', depth: 1 }
            ];
            
            const message = formatCodeReviewMessage(specs);
            
            assert.ok(message.includes('**Test Spec**'));
        });
        
        test('Should include spec content in code block', () => {
            const specs = [
                { id: 'spec-1', title: 'Test Spec', spec: 'Test content', depth: 1 }
            ];
            
            const message = formatCodeReviewMessage(specs);
            
            assert.ok(message.includes('```\nTest content\n```'));
        });
        
        test('Should handle multiple specs', () => {
            const specs = [
                { id: 'spec-1', title: 'Spec 1', spec: 'Content 1', depth: 1 },
                { id: 'spec-2', title: 'Spec 2', spec: 'Content 2', depth: 2 },
                { id: 'spec-3', title: 'Spec 3', spec: 'Content 3', depth: 2 }
            ];
            
            const message = formatCodeReviewMessage(specs);
            
            assert.ok(message.includes('**Spec 1**'));
            assert.ok(message.includes('**Spec 2**'));
            assert.ok(message.includes('**Spec 3**'));
            assert.ok(message.includes('Content 1'));
            assert.ok(message.includes('Content 2'));
            assert.ok(message.includes('Content 3'));
        });
        
        test('Should handle spec with empty content', () => {
            const specs = [
                { id: 'spec-1', title: 'Empty Spec', spec: '', depth: 1 }
            ];
            
            const message = formatCodeReviewMessage(specs);
            
            assert.ok(message.includes('(No specification content)'));
        });
        
        test('Should handle spec with null content', () => {
            const specs = [
                { id: 'spec-1', title: 'Null Spec', spec: null, depth: 1 }
            ];
            
            const message = formatCodeReviewMessage(specs);
            
            assert.ok(message.includes('(No specification content)'));
        });
        
        test('Should handle spec with undefined content', () => {
            const specs = [
                { id: 'spec-1', title: 'Undefined Spec', depth: 1 }
            ];
            
            const message = formatCodeReviewMessage(specs);
            
            assert.ok(message.includes('(No specification content)'));
        });
        
        test('Should preserve special characters in spec content', () => {
            const specs = [
                { id: 'spec-1', title: 'Special Chars', spec: 'Content with <html> & special chars', depth: 1 }
            ];
            
            const message = formatCodeReviewMessage(specs);
            
            assert.ok(message.includes('Content with <html> & special chars'));
        });
        
        test('Should format message with correct structure', () => {
            const specs = [
                { id: 'spec-1', title: 'Test Spec', spec: 'Test content', depth: 1 }
            ];
            
            const message = formatCodeReviewMessage(specs);
            
            // Verify structure: header, title, content, spacing
            const lines = message.split('\n');
            assert.ok(lines[0].startsWith('Attention required:'));
            assert.ok(lines.some(line => line === '**Test Spec**'));
            assert.ok(lines.some(line => line === '```'));
            assert.ok(lines.some(line => line === 'Test content'));
        });
    });
});

module.exports = {
    loadSpecAndDescendants,
    formatCodeReviewMessage
};
