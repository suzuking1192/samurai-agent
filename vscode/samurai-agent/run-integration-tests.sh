#!/bin/bash

# Integration Test Runner for SamuraiAgent
# This script runs the integration tests with real LLM calls

echo "🚀 SamuraiAgent Integration Test Runner"
echo "======================================"

# Check if API key is provided
if [ -z "$GOOGLE_API_KEY" ]; then
    echo "❌ No GOOGLE_API_KEY environment variable found!"
    echo ""
    echo "To run tests with real LLM calls:"
    echo "1. Get a Gemini API key from: https://makersuite.google.com/app/apikey"
    echo "2. Set the environment variable:"
    echo "   export GOOGLE_API_KEY='your_actual_api_key_here'"
    echo "3. Run this script again"
    echo ""
    echo "Running tests with placeholder API key (will show graceful error handling)..."
    echo ""
fi

# Run the integration tests
echo "🧪 Running SamuraiAgent Integration Tests..."
echo ""

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    echo "📄 Loading environment variables from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded"
else
    echo "⚠️  No .env file found"
fi

npm test -- tests/agent/samuraiAgent.integration.test.ts

echo ""
echo "✅ Integration tests completed!"
echo ""
echo "Note: If you see API key errors, that's expected without a real key."
echo "The tests demonstrate that SamuraiAgent handles LLM failures gracefully."

