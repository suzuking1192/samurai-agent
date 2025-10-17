/**
 * Phase 6: Language-Agnostic Pattern Detection
 * 
 * Detects architectural patterns across languages:
 * - Framework-specific patterns (React, Spring, Django, etc.)
 * - Architectural layers (controller, service, repository, model)
 * - Entry points (main functions, route handlers)
 * - Dependency injection patterns
 */

import { CodePatterns, CodeElement } from '../../common/models/context-models';

export class PatternDetector {
    /**
     * Detect patterns in a file based on its elements and language
     */
    public detectPatterns(
        filePath: string,
        elements: CodeElement[],
        language: string
    ): CodePatterns {
        const patterns: CodePatterns = {};

        // Detect architectural layer
        patterns.architecturalLayer = this.detectArchitecturalLayer(filePath, elements);

        // Detect framework-specific patterns
        patterns.frameworkPatterns = this.detectFrameworkPatterns(elements, language);

        // Detect if this file contains entry points
        patterns.isEntryPoint = this.detectEntryPoints(elements, language);

        // Detect dependency injection
        patterns.dependencyInjection = this.detectDependencyInjection(elements, language);

        return patterns;
    }

    /**
     * Detect architectural layer based on naming and location
     */
    private detectArchitecturalLayer(
        filePath: string,
        elements: CodeElement[]
    ): 'controller' | 'service' | 'repository' | 'model' | 'utility' | undefined {
        const pathLower = filePath.toLowerCase();
        const fileName = filePath.split('/').pop()?.toLowerCase() || '';

        // Controller patterns
        if (pathLower.includes('/controller') || fileName.includes('controller') ||
            elements.some(e => e.name.toLowerCase().includes('controller'))) {
            return 'controller';
        }

        // Service patterns
        if (pathLower.includes('/service') || fileName.includes('service') ||
            elements.some(e => e.name.toLowerCase().includes('service'))) {
            return 'service';
        }

        // Repository/DAO patterns
        if (pathLower.includes('/repository') || pathLower.includes('/dao') ||
            fileName.includes('repository') || fileName.includes('dao') ||
            elements.some(e => e.name.toLowerCase().includes('repository') || 
                             e.name.toLowerCase().includes('dao'))) {
            return 'repository';
        }

        // Model/Entity patterns
        if (pathLower.includes('/model') || pathLower.includes('/entity') ||
            fileName.includes('model') || fileName.includes('entity') ||
            elements.some(e => e.metadata?.modifiers?.includes('@Entity') ||
                             e.type === 'class' && e.name.endsWith('Model'))) {
            return 'model';
        }

        // Utility patterns
        if (pathLower.includes('/util') || pathLower.includes('/helper') ||
            fileName.includes('util') || fileName.includes('helper')) {
            return 'utility';
        }

        return undefined;
    }

    /**
     * Detect framework-specific patterns
     */
    private detectFrameworkPatterns(
        elements: CodeElement[],
        language: string
    ): string[] {
        const patterns: string[] = [];
        const lang = language.toLowerCase();

        if (lang === 'typescript' || lang === 'javascript' || lang === 'tsx' || lang === 'jsx') {
            patterns.push(...this.detectJSFrameworkPatterns(elements));
        } else if (lang === 'python') {
            patterns.push(...this.detectPythonFrameworkPatterns(elements));
        } else if (lang === 'java') {
            patterns.push(...this.detectJavaFrameworkPatterns(elements));
        } else if (lang === 'csharp') {
            patterns.push(...this.detectCSharpFrameworkPatterns(elements));
        } else if (lang === 'go') {
            patterns.push(...this.detectGoFrameworkPatterns(elements));
        } else if (lang === 'rust') {
            patterns.push(...this.detectRustFrameworkPatterns(elements));
        } else if (lang === 'php') {
            patterns.push(...this.detectPHPFrameworkPatterns(elements));
        }

        return patterns;
    }

    private detectJSFrameworkPatterns(elements: CodeElement[]): string[] {
        const patterns: string[] = [];

        for (const element of elements) {
            const name = element.name;
            const code = element.codeSnippet || '';

            // React hooks
            if (name.startsWith('use') && element.type === 'function') {
                patterns.push('react-hook');
            }

            // React components
            if (code.includes('React.') || code.includes('jsx') || code.includes('<')) {
                patterns.push('react-component');
            }

            // Express routes
            if (code.includes('app.get(') || code.includes('app.post(') || 
                code.includes('router.get(') || code.includes('router.post(')) {
                patterns.push('express-route');
            }

            // Next.js pages/API routes
            if (code.includes('getServerSideProps') || code.includes('getStaticProps') ||
                code.includes('NextApiRequest')) {
                patterns.push('nextjs-page');
            }

            // GraphQL resolvers
            if (name.includes('Resolver') || code.includes('@Resolver') ||
                code.includes('Query') || code.includes('Mutation')) {
                patterns.push('graphql-resolver');
            }
        }

        return [...new Set(patterns)];
    }

    private detectPythonFrameworkPatterns(elements: CodeElement[]): string[] {
        const patterns: string[] = [];

        for (const element of elements) {
            const name = element.name;
            const code = element.codeSnippet || '';
            const signature = element.signature || '';

            // Django views
            if (code.includes('request') && code.includes('HttpResponse') ||
                signature.includes('(request')) {
                patterns.push('django-view');
            }

            // Flask routes
            if (code.includes('@app.route') || code.includes('@bp.route')) {
                patterns.push('flask-route');
            }

            // FastAPI endpoints
            if (code.includes('@app.get') || code.includes('@app.post') ||
                code.includes('@router.get') || code.includes('@router.post')) {
                patterns.push('fastapi-endpoint');
            }

            // Dataclasses
            if (signature.includes('@dataclass') || code.includes('@dataclass')) {
                patterns.push('dataclass');
            }

            // Pydantic models
            if (signature.includes('BaseModel') || code.includes('Field(')) {
                patterns.push('pydantic-model');
            }
        }

        return [...new Set(patterns)];
    }

    private detectJavaFrameworkPatterns(elements: CodeElement[]): string[] {
        const patterns: string[] = [];

        for (const element of elements) {
            const signature = element.signature || '';
            const code = element.codeSnippet || '';

            // Spring annotations
            if (signature.includes('@Controller') || code.includes('@Controller')) {
                patterns.push('spring-controller');
            }
            if (signature.includes('@Service') || code.includes('@Service')) {
                patterns.push('spring-service');
            }
            if (signature.includes('@Repository') || code.includes('@Repository')) {
                patterns.push('spring-repository');
            }
            if (signature.includes('@RestController') || code.includes('@RestController')) {
                patterns.push('spring-rest-controller');
            }

            // JPA/Hibernate entities
            if (signature.includes('@Entity') || code.includes('@Entity')) {
                patterns.push('jpa-entity');
            }

            // Servlets
            if (signature.includes('extends HttpServlet')) {
                patterns.push('servlet');
            }
        }

        return [...new Set(patterns)];
    }

    private detectCSharpFrameworkPatterns(elements: CodeElement[]): string[] {
        const patterns: string[] = [];

        for (const element of elements) {
            const signature = element.signature || '';
            const code = element.codeSnippet || '';

            // ASP.NET controllers
            if (signature.includes(': Controller') || signature.includes(': ControllerBase')) {
                patterns.push('aspnet-controller');
            }

            // Entity Framework
            if (signature.includes(': DbContext') || code.includes('DbSet<')) {
                patterns.push('entity-framework');
            }

            // LINQ patterns
            if (code.includes('.Where(') || code.includes('.Select(') || code.includes('.FirstOrDefault(')) {
                patterns.push('linq');
            }
        }

        return [...new Set(patterns)];
    }

    private detectGoFrameworkPatterns(elements: CodeElement[]): string[] {
        const patterns: string[] = [];

        for (const element of elements) {
            const signature = element.signature || '';
            const code = element.codeSnippet || '';

            // HTTP handlers
            if (signature.includes('http.HandlerFunc') || signature.includes('http.Handler')) {
                patterns.push('http-handler');
            }

            // gRPC services
            if (code.includes('grpc.') || signature.includes('Server')) {
                patterns.push('grpc-service');
            }

            // Context usage
            if (signature.includes('context.Context') || code.includes('ctx ')) {
                patterns.push('context-usage');
            }
        }

        return [...new Set(patterns)];
    }

    private detectRustFrameworkPatterns(elements: CodeElement[]): string[] {
        const patterns: string[] = [];

        for (const element of elements) {
            const code = element.codeSnippet || '';

            // Actix/Rocket web handlers
            if (code.includes('#[get(') || code.includes('#[post(') ||
                code.includes('#[route(')) {
                patterns.push('web-handler');
            }

            // Async patterns
            if (code.includes('async fn') || code.includes('.await')) {
                patterns.push('async-await');
            }
        }

        return [...new Set(patterns)];
    }

    private detectPHPFrameworkPatterns(elements: CodeElement[]): string[] {
        const patterns: string[] = [];

        for (const element of elements) {
            const signature = element.signature || '';
            const code = element.codeSnippet || '';

            // Laravel controllers
            if (signature.includes('extends Controller')) {
                patterns.push('laravel-controller');
            }

            // Symfony routes
            if (code.includes('@Route')) {
                patterns.push('symfony-route');
            }

            // WordPress hooks
            if (code.includes('add_action(') || code.includes('add_filter(')) {
                patterns.push('wordpress-hook');
            }
        }

        return [...new Set(patterns)];
    }

    /**
     * Detect entry points in the code
     */
    private detectEntryPoints(elements: CodeElement[], language: string): boolean {
        const lang = language.toLowerCase();

        for (const element of elements) {
            const name = element.name;
            const code = element.codeSnippet || '';
            const signature = element.signature || '';

            // Language-specific entry point patterns
            switch (lang) {
                case 'typescript':
                case 'javascript':
                case 'tsx':
                case 'jsx':
                    if (code.includes('app.listen(') || code.includes('server.listen(') ||
                        name === 'main' || signature.includes('app.get(')) {
                        return true;
                    }
                    break;

                case 'python':
                    // Check in code snippets
                    if (code.includes('if __name__ == "__main__"') ||
                        code.includes('if __name__ == \'__main__\'') || 
                        signature.includes('@click.command') ||
                        signature.includes('@app.route')) {
                        return true;
                    }
                    // Also check in signature (for module-level if statements)
                    if (signature.includes('__name__')) {
                        return true;
                    }
                    break;

                case 'java':
                    if (signature.includes('public static void main(String') ||
                        signature.includes('public static void main(String[]')) {
                        return true;
                    }
                    break;

                case 'cpp':
                case 'c':
                    if (name === 'main' && signature.includes('int main(')) {
                        return true;
                    }
                    break;

                case 'go':
                    if (name === 'main' && signature.includes('func main(')) {
                        return true;
                    }
                    break;

                case 'rust':
                    if (name === 'main' && signature.includes('fn main(')) {
                        return true;
                    }
                    break;

                case 'csharp':
                    if (signature.includes('static void Main(') ||
                        signature.includes('static async Task Main(')) {
                        return true;
                    }
                    break;
            }
        }

        return false;
    }

    /**
     * Detect dependency injection patterns
     */
    private detectDependencyInjection(elements: CodeElement[], language: string): boolean {
        const lang = language.toLowerCase();

        for (const element of elements) {
            const signature = element.signature || '';
            const code = element.codeSnippet || '';

            // Constructor injection (common across languages)
            if (element.type === 'method' && element.name === 'constructor' ||
                element.name === '__init__') {
                // Check if constructor has dependencies injected
                if (signature.includes(':') && signature.split(':').length > 2) {
                    return true;
                }
            }

            // Annotation-based DI
            if (lang === 'typescript' || lang === 'java' || lang === 'csharp') {
                if (signature.includes('@Injectable') || signature.includes('@Inject') ||
                    signature.includes('@Autowired') || code.includes('@Inject')) {
                    return true;
                }
            }

            // Python dependency injection frameworks
            if (lang === 'python') {
                if (code.includes('@inject') || code.includes('Depends(')) {
                    return true;
                }
            }
        }

        return false;
    }
}

