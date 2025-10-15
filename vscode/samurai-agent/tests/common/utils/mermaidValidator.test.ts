import { repairMermaidSyntax, isValidMermaid } from '../../../src/common/utils/mermaidValidator';

describe('mermaidValidator', () => {
  describe('repairMermaidSyntax', () => {
    it('should return valid mermaid unchanged', () => {
      const validMermaid = `graph TD
    A[Start] --> B[End]`;
      
      const result = repairMermaidSyntax(validMermaid);
      
      expect(result.wasRepaired).toBe(false);
      expect(result.errors).toEqual([]);
      expect(result.repaired).toBe(validMermaid);
    });

    it('should remove incomplete style definitions at the end', () => {
      const incompleteStyle = `graph TD
    A[Start] --> B[End]
    style LLM_PS`;
      
      const result = repairMermaidSyntax(incompleteStyle);
      
      expect(result.wasRepaired).toBe(true);
      expect(result.repaired).not.toContain('style LLM_PS');
      // The originalErrors should mention the incomplete style
      expect(result.originalErrors).toContain('Incomplete style definition at end');
      // After repair, the error should be gone
      expect(result.errors).not.toContain('Incomplete style definition at end');
    });

    it('should handle escaped newlines', () => {
      // Create a string with literal \n characters (not actual newlines)
      const escapedNewlines = 'graph TD\\n    A[Start] --> B[End]';
      
      const result = repairMermaidSyntax(escapedNewlines);
      
      // The repair should convert \\n to actual newlines
      expect(result.repaired).toContain('\n');
      expect(result.repaired).not.toContain('\\n');
      // Check that it creates a valid graph (flexible on arrow syntax)
      expect(result.repaired).toMatch(/graph TD\s+A\[Start\] -+> B\[End\]/);
    });

    it('should remove markdown code fences', () => {
      const withFences = '```mermaid\ngraph TD\n    A --> B\n```';
      
      const result = repairMermaidSyntax(withFences);
      
      expect(result.wasRepaired).toBe(true);
      expect(result.repaired).not.toContain('```');
      expect(result.repaired).toContain('graph TD');
    });

    it('should add graph TD if missing but has arrows', () => {
      const missingType = `    A[Start] --> B[End]`;
      
      const result = repairMermaidSyntax(missingType);
      
      expect(result.wasRepaired).toBe(true);
      expect(result.repaired).toMatch(/^graph TD\n/);
    });

    it('should handle empty or invalid input', () => {
      const result = repairMermaidSyntax('');
      
      expect(result.wasRepaired).toBe(true);
      expect(result.errors).toContain('Input was empty or invalid');
      expect(result.repaired).toContain('Invalid Diagram');
    });

    it('should handle complex diagram with multiple issues', () => {
      const complex = '```mermaid\\ngraph TD\\n    A[Start] --> B[Process]\\n    style LLM_PS';
      
      const result = repairMermaidSyntax(complex);
      
      expect(result.wasRepaired).toBe(true);
      expect(result.repaired).toContain('graph TD');
      expect(result.repaired).not.toContain('```');
      expect(result.repaired).not.toContain('\\n');
      expect(result.repaired).not.toContain('style LLM_PS');
    });

    it('should handle real-world truncated artifact case', () => {
      // This is similar to the user's error screenshot
      const truncated = `graph TD
    subgraph VSCode Extension
        U[User] -->|Interacts| WV(Webview)
    end
    
    style WV fill:#E0BBE4,stroke:#8D6B9D,stroke-width:2px
    style LLM_PS`;
      
      const result = repairMermaidSyntax(truncated);
      
      expect(result.wasRepaired).toBe(true);
      expect(result.repaired).not.toContain('style LLM_PS');
      expect(result.repaired).toContain('style WV');
      // Check that the incomplete style was removed
      const lines = result.repaired.split('\n');
      const hasIncompletestyle = lines.some(line => 
        line.trim() === 'style LLM_PS' || line.trim().startsWith('style LLM_PS')
      );
      expect(hasIncompletestyle).toBe(false);
    });
  });

  describe('isValidMermaid', () => {
    it('should validate correct mermaid syntax', () => {
      const valid = `graph TD
    A[Start] --> B[End]`;
      
      expect(isValidMermaid(valid)).toBe(true);
    });

    it('should invalidate incorrect syntax', () => {
      const invalid = `not valid mermaid at all`;
      
      expect(isValidMermaid(invalid)).toBe(false);
    });

    it('should invalidate unbalanced brackets', () => {
      const unbalanced = `graph TD
    A[Start --> B[End]`;
      
      expect(isValidMermaid(unbalanced)).toBe(false);
    });
  });
});

