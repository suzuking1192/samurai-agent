/**
 * LLM Constants
 * 
 * Centralized definition of LLM-related constants for the Samurai Agent extension.
 */

/**
 * Company's shared Gemini API key for the free tier model
 * This key is used automatically when the gemini-2.5-flash-free-tier model is selected
 */
export const FREE_TIER_GEMINI_API_KEY = 'AIzaSyAvdjFomKdWvyBktetbGk3jZaZ_PmCXHWc';

/**
 * Dedicated Gemini API key for beta testing users
 * Sponsored access with $3 monthly limit per user
 */
export const BETA_GEMINI_API_KEY = 'AIzaSyABtXJC_UMtIw0SjJ7NABpL0PJAA2GmSHs';

/**
 * Valid beta testing code that users must enter in settings
 * to access the sponsored beta testing model
 */
export const VALID_BETA_CODE = 'BETA-SA-2025-7K9M';

/**
 * Monthly cost limit for beta testing users (in USD)
 * Once this limit is reached, users must switch to free tier or their own API key
 */
export const BETA_MONTHLY_LIMIT = 3.00;

/**
 * Backend proxy URL for gemini-2.5-flash-beta requests
 * This proxy validates betaCode server-side and uses the sponsored API key
 */
export const GEMINI_BETA_PROXY_URL = 'https://samurai-agent-beta-proxy.onrender.com/api/gemini-beta';


