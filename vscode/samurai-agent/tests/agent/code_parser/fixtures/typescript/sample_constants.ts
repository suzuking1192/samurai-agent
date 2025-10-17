// TypeScript Constants Test Fixture
// Tests constant element extraction

export const API_BASE_URL = 'https://api.example.com';
export const MAX_RETRIES = 3;
export const TIMEOUT_MS = 5000;

const DEFAULT_PAGE_SIZE = 20;
const CACHE_TTL_SECONDS = 3600;

// Exported constants
export const CONFIG = {
    apiKey: process.env.API_KEY,
    environment: 'production'
} as const;

export const FEATURE_FLAGS = {
    ENABLE_BETA: true,
    ENABLE_ANALYTICS: false
};

// Regular variable (should not be extracted as constant)
let counter = 0;
var tempValue = 'test';

