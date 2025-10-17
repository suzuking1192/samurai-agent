// TypeScript Snippet Enrichment Test Fixture
import { User, UserId } from './types';
import { API_BASE_URL, MAX_RETRIES } from './constants';
import { validateUser } from './validators';

export type ProcessResult = {
    success: boolean;
    message: string;
};

export const DEFAULT_TIMEOUT = 5000;

// Helper function
function logError(message: string): void {
    console.error(`[ERROR] ${message}`);
}

// Helper function
function retryOperation(operation: () => void, maxRetries: number): void {
    for (let i = 0; i < maxRetries; i++) {
        try {
            operation();
            break;
        } catch (error) {
            logError(`Retry ${i + 1} failed`);
        }
    }
}

// Main function that calls helpers and uses types/constants
export function processUser(userId: UserId): ProcessResult {
    const user = validateUser(userId);
    
    if (!user) {
        logError('User not found');
        return { success: false, message: 'User not found' };
    }
    
    retryOperation(() => {
        console.log(`Processing user with timeout: ${DEFAULT_TIMEOUT}`);
    }, MAX_RETRIES);
    
    return { success: true, message: 'User processed' };
}

// Context after processUser
const result = processUser('123');
console.log(result);

