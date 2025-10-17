<!-- fb5371c6-499f-4875-8a3b-52eee28a709a 52e81455-a4b4-45b1-975c-139e95fa83e5 -->
# Improve Code Extraction Context - Language Agnostic

## Problem Analysis

Current code extraction misses critical context needed for:

- **Bug analysis**: Missing call graphs, type flows, side effects
- **Feature planning**: Incomplete architectural relationships, dependency chains
- **Code flow understanding**: No execution paths, data flow, relationship tracking
- **Language coverage**: Heavily biased toward TypeScript/JavaScript, incomplete support for Python, Java, C++, Go, Rust, PHP, Ruby, C#

## Core Issues Identified

1. **Missing Code Elements**: No type aliases, enums, constants, decorators/annotations, named exports
2. **Language Bias**: Extraction logic assumes JS/TS, doesn't handle language-specific constructs
3. **Incomplete Dependencies**: Missing transitive dependencies, type-only imports, re-exports
4. **No Relationship Tracking**: No call graphs, inheritance chains, data flow
5. **Limited Snippets**: Missing related imports, type definitions, helper functions
6. **Weak Prompts**: LLM prompts don't request architectural/flow context

---

## Implementation Strategy

### Phase 1: Language-Agnostic Code Element Extraction

**Goal**: Extract ALL code elements for ALL supported languages (15+)

**Files to modify:**

- `vscode/samurai-agent/src/agent/code_parser/CodeParserService.ts`
- `vscode/samurai-agent/src/common/models/context-models.ts`

**Changes:**

1. **Extend `CodeElementType` to be language-agnostic**:

   - `type_definition` (covers: type aliases, typedef, interface, protocol, trait)
   - `enum` (enum in most languages, Enum class in Python)
   - `constant` (const, final, static final, UPPER_CASE conventions)
   - `annotation` (decorators in Python/TS, annotations in Java, attributes in C#/PHP8+)
   - `export` (export in JS/TS, public in Java/C#, pub in Rust, etc.)
   - `generic_parameter` (generics, templates across languages)
   - `namespace` (namespace, package, module)

2. **Create `LanguageElementExtractor` interface**:
   ```typescript
   interface LanguageElementExtractor {
     extractTypes(node: any): CodeElement[];
     extractEnums(node: any): CodeElement[];
     extractConstants(node: any): CodeElement[];
     extractAnnotations(node: any): CodeElement[];
     extractExports(node: any): CodeElement[];
     extractGenerics(node: any): CodeElement[];
   }
   ```

3. **Implement language-specific extractors** extending base interface:

   - `TypeScriptExtractor`: type aliases, enums, decorators, export statements
   - `PythonExtractor`: TypeAlias (PEP 613), Enum classes, decorators, `__all__` exports
   - `JavaExtractor`: interfaces, enums, annotations, public modifiers
   - `CppExtractor`: typedef, enum class, templates, namespace
   - `GoExtractor`: type declarations, const blocks, interfaces
   - `RustExtractor`: type aliases, enum items, attributes, pub visibility
   - `CSharpExtractor`: interfaces, enums, attributes, public modifiers
   - `PHPExtractor`: interfaces, const, attributes (PHP 8+)
   - `RubyExtractor`: modules, constants, class << self singletons

4. **Update `getTreeSitterQueryPatterns()` per language**:

| Language | Type Defs | Enums | Annotations | Exports | Generics |

|----------|-----------|-------|-------------|---------|----------|

| TypeScript | type_alias_declaration | enum_declaration | decorator | export_statement | type_parameter |

| Python | type_alias_statement | class_definition(Enum) | decorator | assignment(**all**) | generic_type |

| Java | interface_declaration | enum_declaration | annotation | modifier(public) | type_parameter |

| C++ | typedef_declaration | enum_specifier | - | namespace_definition | template_parameter |

| Go | type_declaration | const_declaration | - | - | type_parameter_list |

| Rust | type_item | enum_item | attribute_item | visibility_modifier(pub) | generic_params |

| C# | interface_declaration | enum_declaration | attribute_list | modifier(public) | type_parameter_list |

5. **Update regex fallback patterns per language**:

   - TypeScript: `type\s+(\w+)\s*=`, `enum\s+(\w+)`, `export\s+`
   - Python: `class\s+(\w+)\(Enum\)`, `(\w+)\s*:\s*TypeAlias`, `@(\w+)`
   - Java: `interface\s+(\w+)`, `enum\s+(\w+)`, `@(\w+)`, `public\s+(?:static\s+)?final`
   - C++: `typedef\s+`, `enum\s+(?:class\s+)?(\w+)`, `template\s*<`
   - Go: `type\s+(\w+)\s+(?:struct|interface)`, `const\s+(\w+)`
   - Rust: `type\s+(\w+)\s*=`, `enum\s+(\w+)`, `#\[(\w+)\]`, `pub\s+`
   - C#: `interface\s+(\w+)`, `enum\s+(\w+)`, `\[(\w+)\]`

---

### Phase 2: Language-Agnostic Documentation Extraction

**Goal**: Extract documentation comments for ALL languages

**Files to modify:**

- `vscode/samurai-agent/src/agent/code_parser/CodeParserService.ts`
- `vscode/samurai-agent/src/common/models/context-models.ts`

**Changes:**

1. **Add language-agnostic `documentation` field**:
   ```typescript
   documentation?: {
     summary?: string;
     params?: Array<{name: string; type?: string; description: string}>;
     returns?: {type?: string; description: string};
     throws?: Array<{type: string; description: string}>;
     examples?: string[];
     inlineComments?: string[];
     deprecated?: boolean;
   }
   ```

2. **Create `DocumentationExtractor` per language**:

   - **TypeScript/JavaScript**: JSDoc (`/** */`), TSDoc tags (@param, @returns, @throws)
   - **Python**: Docstrings (triple quotes), Sphinx/Google/NumPy formats, type hints
   - **Java**: Javadoc (`/** */`), @param, @return, @throws
   - **C++**: Doxygen (`/** */`, `///`), @param, @return, @brief
   - **Go**: Godoc (// comments before declarations)
   - **Rust**: Rustdoc (`///`, `//!`), markdown support
   - **C#**: XML documentation (`/// <summary>`)
   - **PHP**: PHPDoc (`/** */`), @param, @return
   - **Ruby**: RDoc (`##`, `#`), YARD tags

3. **Extract inline comments** (language-agnostic):

   - Single-line: `//`, `#`, `--`, `;`
   - Multi-line: `/* */`, `""" """`, `=begin =end`

---

### Phase 3: Language-Agnostic Relationship Tracking

**Goal**: Build call graphs, inheritance, dependencies for all languages

**Files to create:**

- `vscode/samurai-agent/src/agent/code_parser/RelationshipTracker.ts`

**Files to modify:**

- `vscode/samurai-agent/src/agent/code_parser/CodeParserService.ts`
- `vscode/samurai-agent/src/common/models/context-models.ts`

**Changes:**

1. **Create `RelationshipTracker` with language-agnostic methods**:

   - `buildCallGraph()`: Function/method calls (all languages)
   - `trackInheritance()`: Class hierarchies (extends, implements, derives, inherits)
   - `trackTypeDependencies()`: Type → type dependencies
   - `trackDataFlow()`: Variable usage, transformations

2. **Language-specific call patterns**:

   - **TypeScript/JavaScript**: function_call, method_call, new_expression
   - **Python**: call, attribute (method calls)
   - **Java**: method_invocation, object_creation_expression
   - **C++**: call_expression, member_expression
   - **Go**: call_expression, selector_expression
   - **Rust**: call_expression, method_call_expression
   - **C#**: invocation_expression, object_creation_expression

3. **Language-specific inheritance patterns**:

   - **TypeScript/JavaScript**: extends, implements (classes/interfaces)
   - **Python**: class definition with bases
   - **Java**: extends, implements
   - **C++**: base_class_clause
   - **Go**: interface embedding (no class inheritance)
   - **Rust**: trait implementation (`impl Trait for Type`)
   - **C#**: base_list (: BaseClass, IInterface)

---

### Phase 4: Language-Agnostic Dependency Resolution

**Goal**: Resolve ALL imports/dependencies across languages

**Files to modify:**

- `vscode/samurai-agent/src/agent/tools/extractCodeTool.ts`
- `vscode/samurai-agent/src/agent/code_parser/CodeParserService.ts`

**Changes:**

1. **Update `extractImportsFromContent()` per language**:

| Language | Import Syntax | Type-Only | Re-exports |

|----------|--------------|-----------|------------|

| TypeScript | `import X from 'Y'` | `import type` | `export * from` |

| JavaScript | `import`, `require()` | N/A | `export {X} from` |

| Python | `import X`, `from X import Y` | TYPE_CHECKING | `from X import *` |

| Java | `import x.y.Z` | N/A | N/A |

| C++ | `#include "x.h"` | N/A | N/A |

| Go | `import "x/y"` | N/A | N/A |

| Rust | `use x::y` | N/A | `pub use` |

| C# | `using X.Y` | N/A | N/A |

| PHP | `use X\Y`, `require` | N/A | N/A |

2. **Resolve import paths per language conventions**:

   - TypeScript/JS: relative (`./`, `../`), node_modules, path aliases
   - Python: relative (`.`), absolute (package.module), PYTHONPATH
   - Java: package structure maps to directories
   - C++: include paths, system vs local headers
   - Go: module path resolution
   - Rust: crate dependencies, mod paths
   - C#: namespace to assembly mapping

3. **Track transitive dependencies** (language-agnostic):

   - Build dependency graph
   - Resolve chains: A→B→C
   - Detect circular dependencies

---

### Phase 5: Enriched Language-Agnostic Snippets

**Goal**: Include full context in snippets for all languages

**Files to modify:**

- `vscode/samurai-agent/src/agent/code_parser/CodeParserService.ts`
- `vscode/samurai-agent/src/agent/tools/extractCodeTool.ts`

**Changes:**

1. **Create `buildEnrichedSnippet()` per language**:

   - Include imports/includes at top (language-specific)
   - Include type definitions used
   - Include constants/configs referenced
   - Include helper functions called (up to 2 levels)
   - Add context lines (3 before, 3 after)

2. **Language-specific snippet headers**:

   - **TypeScript/JS**: imports, type definitions, interfaces
   - **Python**: imports, type aliases, global constants
   - **Java**: package, imports, class context
   - **C++**: includes, forward declarations, namespace
   - **Go**: package, imports, type definitions
   - **Rust**: use statements, type definitions, trait constraints

---

### Phase 6: Language-Agnostic Pattern Detection

**Goal**: Detect architectural patterns across all languages

**Files to create:**

- `vscode/samurai-agent/src/agent/code_parser/PatternDetector.ts`

**Changes:**

1. **Detect framework-specific patterns**:

   - **JavaScript/TypeScript**: React hooks, Express routes, Next.js pages
   - **Python**: Django views, Flask routes, FastAPI endpoints, dataclasses
   - **Java**: Spring @Controller/@Service, JPA entities, servlets
   - **Go**: http.HandlerFunc, gRPC services, context.Context usage
   - **Rust**: Rocket routes, Actix handlers, async/await patterns
   - **C#**: ASP.NET controllers, Entity Framework, LINQ patterns
   - **PHP**: Laravel controllers, Symfony routes, WordPress hooks

2. **Detect architectural layers** (language-agnostic):

   - Controllers (handle requests): naming patterns, annotations
   - Services (business logic): service suffix, @Service annotation
   - Repositories (data access): repository suffix, DAO pattern
   - Models/Entities (data): @Entity, dataclass, struct tags
   - Utilities (helpers): util/helper naming, no dependencies

3. **Detect entry points** (language-specific):

   - **TypeScript/JS**: `app.listen()`, route handlers, `main()` equivalent
   - **Python**: `if __name__ == "__main__"`, CLI decorators
   - **Java**: `public static void main(String[] args)`
   - **C++**: `int main()`
   - **Go**: `func main()`
   - **Rust**: `fn main()`
   - **C#**: `static void Main()`

---

### Phase 7: Enhanced LLM Prompts (Language-Agnostic)

**Goal**: Update prompts to work across all languages

**Files to modify:**

- `vscode/samurai-agent/src/agent/prompts/codeParser/step2_identify_relevant_elements.md`
- `vscode/samurai-agent/src/agent/prompts/codeParser/extract_code_context.md`

**Changes:**

1. **Update prompts to mention language context**:

   - "Consider the programming language: {LANGUAGE}"
   - "Include language-specific type definitions (interfaces/protocols/traits)"
   - "Include language-specific annotations/decorators/attributes"
   - "Follow language-specific import/dependency conventions"

2. **Request architectural context** (language-agnostic):

   - "Identify architectural layer (controller/service/repository/model)"
   - "Include helper/utility functions called by selected elements"
   - "Track execution flow from entry points through call chains"
   - "Include constants/configurations referenced"

---

### Phase 8: Export Analysis (Language-Agnostic)

**Goal**: Understand public API vs internal across languages

**Files to modify:**

- `vscode/samurai-agent/src/agent/code_parser/CodeParserService.ts`

**Changes:**

1. **Track visibility/exports per language**:

   - **TypeScript/JS**: `export` keyword (named, default, re-export)
   - **Python**: `__all__` list, no leading underscore
   - **Java**: `public` modifier
   - **C++**: header file declarations
   - **Go**: capitalized identifiers
   - **Rust**: `pub` modifier
   - **C#**: `public` modifier
   - **PHP**: `public` modifier

2. **Identify module boundaries**:

   - **TypeScript/JS**: barrel files (index.ts)
   - **Python**: `__init__.py` re-exports
   - **Java**: package structure
   - **Go**: package per directory
   - **Rust**: mod.rs files

---

### Phase 9: Integration & Cross-Language Testing

**Goal**: Ensure all languages work correctly

**Changes:**

1. **Test with multi-language codebases**:

   - Monorepo with TypeScript + Python backend
   - Java microservices
   - Rust + C++ system code
   - Full-stack apps (React + Node + Go)

2. **Verify language-specific features**:

   - Python: decorators, dataclasses, type hints extracted
   - Java: annotations, generics, inheritance tracked
   - Rust: traits, lifetimes, pub visibility detected
   - Go: interfaces, goroutines, context.Context patterns

3. **Measure completeness per language**:

   - % of types extracted
   - % of dependencies resolved
   - Call graph completeness
   - Documentation extraction rate

---

### Phase 10: Performance Optimization

**Goal**: Optimize for speed while maintaining completeness

**Changes:**

- Cache parsed ASTs per language
- Parallel processing of files
- Incremental updates per language

---

## Success Metrics

✅ Support for 15+ languages with feature parity

✅ Complete call graphs across all languages

✅ Full type/interface dependency chains

✅ Language-specific pattern detection

✅ Documentation extraction per language conventions

✅ Cross-language dependency tracking (e.g., TS calling Python API)

## Testing Strategy (Critical - Apply to ALL Phases)

### Testing Requirements for Each Phase

**Every phase MUST include:**

1. **Unit Tests**:
   - Test new functionality in isolation
   - Mock dependencies where appropriate
   - Minimum 80% code coverage for new code
   - 100% coverage for critical paths

2. **Regression Tests**:
   - Run ALL existing tests before and after changes
   - Ensure no breaking changes to existing functionality
   - Verify backward compatibility
   - Test with existing real codebase samples

3. **Integration Tests**:
   - Test new feature integrated with existing code
   - Test cross-component interactions
   - Verify end-to-end workflows still work

4. **Language-Specific Tests** (Phases 1-8):
   - Create test fixtures for each language (TS, Python, Java, C++, Go, Rust, C#, PHP, Ruby)
   - Test with real-world code samples from each language
   - Verify language-specific features work correctly

5. **Test Fixtures Directory Structure**:
   ```
   tests/agent/code_parser/fixtures/
     typescript/
       - sample_types.ts (type aliases, interfaces)
       - sample_enums.ts
       - sample_decorators.ts
       - sample_exports.ts
     python/
       - sample_types.py (TypeAlias, protocols)
       - sample_enums.py (Enum classes)
       - sample_decorators.py
     java/
       - SampleTypes.java (interfaces)
       - SampleEnums.java
       - SampleAnnotations.java
     [... for all 15+ languages]
   ```

### Phase-Specific Testing Checklist

**Phase 1: Element Extraction**
- [ ] Unit test: TypeScript type alias extraction
- [ ] Unit test: Python Enum class extraction
- [ ] Unit test: Java interface extraction
- [ ] Unit test: Each of 15+ languages
- [ ] Regression test: Existing function/class extraction still works
- [ ] Integration test: New elements appear in ExtractCodeTool results

**Phase 2: Documentation Extraction**
- [ ] Unit test: JSDoc parsing (TypeScript/JavaScript)
- [ ] Unit test: Docstring parsing (Python)
- [ ] Unit test: Javadoc parsing (Java)
- [ ] Unit test: Each documentation format for 15+ languages
- [ ] Regression test: Code extraction still works without docs
- [ ] Integration test: Documentation appears in LLM context

**Phase 3: Relationship Tracking**
- [ ] Unit test: Call graph building (per language)
- [ ] Unit test: Inheritance tracking (per language)
- [ ] Unit test: Type dependency tracking
- [ ] Regression test: Element extraction unaffected
- [ ] Integration test: Relationships exposed in API results

**Phase 4: Dependency Resolution**
- [ ] Unit test: Import path resolution (per language)
- [ ] Unit test: Transitive dependency chains
- [ ] Unit test: Circular dependency detection
- [ ] Regression test: Existing import extraction works
- [ ] Integration test: Dependencies auto-loaded by ExtractCodeTool

**Phase 5: Enriched Snippets**
- [ ] Unit test: Snippet enrichment (per language)
- [ ] Unit test: Import inclusion in snippets
- [ ] Unit test: Helper function inclusion
- [ ] Regression test: Basic snippets still work
- [ ] Integration test: Enriched snippets in LLM prompts

**Phase 6: Pattern Detection**
- [ ] Unit test: React pattern detection
- [ ] Unit test: Spring pattern detection (Java)
- [ ] Unit test: FastAPI pattern detection (Python)
- [ ] Unit test: Framework patterns for major frameworks
- [ ] Regression test: Code extraction unaffected
- [ ] Integration test: Patterns used in file ranking

**Phase 7: Enhanced Prompts**
- [ ] Unit test: Prompt variable substitution
- [ ] Unit test: Language context injection
- [ ] Regression test: Existing prompts still work
- [ ] Integration test: LLM responses improved

**Phase 8: Export Analysis**
- [ ] Unit test: Export tracking (per language)
- [ ] Unit test: Module boundary detection
- [ ] Regression test: Element extraction unaffected
- [ ] Integration test: Public API identified correctly

**Phase 9: Integration Testing**
- [ ] End-to-end test: Bug analysis scenario
- [ ] End-to-end test: Feature planning scenario
- [ ] Multi-language test: TypeScript + Python project
- [ ] Multi-language test: Java microservices
- [ ] Performance test: Large codebase (10,000+ files)
- [ ] Regression test: ALL existing tests pass

**Phase 10: Performance**
- [ ] Performance test: Caching improves speed
- [ ] Performance test: Parallel processing faster
- [ ] Regression test: Results identical to before optimization
- [ ] Load test: Handle 50,000+ file codebase

### Test Execution Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/agent/code_parser/LanguageElementExtraction.test.ts

# Run with coverage
npm test -- --coverage

# Run only unit tests
npm test -- --testPathPattern=unit

# Run only integration tests  
npm test -- --testPathPattern=integration

# Run only regression tests
npm test -- --testPathPattern=regression
```

### Continuous Testing

- **Before starting each phase**: Run all existing tests to establish baseline
- **During implementation**: Run relevant unit tests frequently  
- **After completing each phase**: Run full test suite (unit + integration + regression)
- **Before committing**: Ensure ALL tests pass
- **Never proceed to next phase**: Until all tests pass

### Test Failure Protocol

If tests fail:
1. **Stop implementation** - Don't proceed to next phase
2. **Identify root cause** - Debug failing test
3. **Fix the issue** - Either fix code or fix test (if test is wrong)
4. **Re-run all tests** - Ensure fix doesn't break other tests
5. **Only then continue** - Proceed to next phase

### Success Criteria

Each phase is considered complete ONLY when:
- ✅ All new unit tests pass
- ✅ All existing regression tests pass
- ✅ All integration tests pass
- ✅ Code coverage meets minimum thresholds
- ✅ No breaking changes to existing API
- ✅ Performance benchmarks met (if applicable)

## Implementation Order

Execute phases 1-10 incrementally, with **comprehensive testing after each phase**. Do not proceed to the next phase until all tests pass.

### To-dos

- [ ] Phase 1: Extract all code elements (types, enums, constants, decorators, exports, generics)
- [ ] Phase 2: Extract documentation (JSDoc, comments, inline comments)
- [ ] Phase 3: Build relationship tracking (call graphs, inheritance, type dependencies, data flow)
- [ ] Phase 4: Enhanced dependency resolution (type-only imports, re-exports, transitive dependencies)
- [ ] Phase 5: Build enriched code snippets with full context (imports, types, helpers, usage)
- [ ] Phase 6: Detect architectural patterns (React hooks, MVC layers, entry points, DI)
- [ ] Phase 7: Enhance LLM prompts for code flow understanding and architectural relationships
- [ ] Phase 8: Analyze exports and module boundaries (public API, barrel files, inter-module deps)
- [ ] Phase 9: Integrate all enhancements and test with real bug analysis and feature planning scenarios
- [ ] Phase 10: Performance optimization (caching, parallel processing, incremental updates)