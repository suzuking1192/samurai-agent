// TypeScript Imports Test Fixture
// Tests import extraction including type-only imports and re-exports

// Regular imports
import { User } from './types';
import * as utils from './utils';
import defaultExport from './default';

// Phase 4: Type-only imports
import type { UserId, UserRole } from './types';
import type { ApiResponse } from './api';

// Dynamic imports
const module = await import('./dynamic-module');

// Re-exports (Phase 4)
export { User } from './types';
export * from './utils';
export { default as MyClass } from './MyClass';

// Regular code
export function processUser(user: User): void {
    console.log(user);
}

