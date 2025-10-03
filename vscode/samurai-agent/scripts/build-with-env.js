#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

// Get the command line arguments (everything after the script name)
const args = process.argv.slice(2);
// Prepend npx to ensure we use the locally installed webpack
const command = 'npx ' + args.join(' ');

console.log('Loading environment variables from:', envPath);
console.log('POSTHOG_API_KEY: HARDCODED in webpack config');
console.log('Running command:', command);

// Execute the command with the loaded environment variables
try {
    execSync(command, { 
        stdio: 'inherit',
        env: { ...process.env }
    });
} catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
}
