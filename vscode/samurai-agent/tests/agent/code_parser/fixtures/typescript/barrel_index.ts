// Barrel file (index.ts) - Re-exports from multiple files
export { User, UserId, UserRole } from './types';
export { UserService, AdminService } from './services';
export * from './utils';
export { default as Config } from './config';

// Also has its own exports
export const VERSION = '1.0.0';
export function initialize() {
    console.log('Initializing...');
}

