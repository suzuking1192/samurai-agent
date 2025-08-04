#!/usr/bin/env python3
"""
Test runner for context understanding and tool calling fixes.

This script runs all the tests to verify that the agent context understanding
and tool calling issues have been resolved.
"""

import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def main():
    """Run all context understanding and tool calling tests"""
    print("🧪 Context Understanding and Tool Calling Test Suite")
    print("=" * 60)
    print()
    
    # Import test modules
    try:
        from test_context_understanding_and_tool_calling import run_all_tests as run_unit_tests
        from test_context_fixes_integration import run_integration_tests as run_integration_tests
    except ImportError as e:
        print(f"❌ Error importing test modules: {e}")
        print("Make sure you're running this from the backend directory")
        return 1
    
    # Run unit tests
    print("📋 Running Unit Tests...")
    print("-" * 40)
    unit_passed, unit_failed = asyncio.run(run_unit_tests())
    
    print()
    
    # Run integration tests
    print("🔗 Running Integration Tests...")
    print("-" * 40)
    integration_passed, integration_failed = asyncio.run(run_integration_tests())
    
    # Summary
    print()
    print("=" * 60)
    print("📊 FINAL TEST RESULTS")
    print("=" * 60)
    print(f"Unit Tests: {unit_passed} passed, {unit_failed} failed")
    print(f"Integration Tests: {integration_passed} passed, {integration_failed} failed")
    print(f"Total: {unit_passed + integration_passed} passed, {unit_failed + integration_failed} failed")
    
    total_passed = unit_passed + integration_passed
    total_failed = unit_failed + integration_failed
    
    if total_failed == 0:
        print()
        print("🎉 ALL TESTS PASSED!")
        print("✅ Context understanding is working correctly")
        print("✅ Tool calling is working correctly")
        print("✅ Agent can understand 'those tasks' references")
        print("✅ Agent uses tools instead of explaining")
        print("✅ Agent takes action instead of asking for clarification")
        return 0
    else:
        print()
        print("⚠️  SOME TESTS FAILED")
        print("❌ Context understanding or tool calling issues remain")
        print("Review the failed tests above to identify the problems")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code) 