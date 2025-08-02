#!/usr/bin/env python3
"""
Simple test runner for the AI Agent
"""

import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from test_ai_agent import run_full_test_suite

if __name__ == "__main__":
    print("🥷 Samurai Agent Test Runner")
    print("Running comprehensive test suite...")
    
    try:
        asyncio.run(run_full_test_suite())
    except KeyboardInterrupt:
        print("\n⏹️  Tests interrupted by user")
    except Exception as e:
        print(f"\n💥 Test runner failed: {e}")
        sys.exit(1) 