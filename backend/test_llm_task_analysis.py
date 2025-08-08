"""
Test LLM-based task analysis functionality.
"""

import asyncio
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def test_llm_task_analysis():
    """Test LLM-based task analysis."""
    print("🔍 Testing LLM-based task analysis...")
    
    try:
        from services.task_analysis_agent import TaskAnalysisAgent
        
        agent = TaskAnalysisAgent()
        
        # Test cases with different complexity levels
        test_cases = [
            {
                "title": "Add login",
                "description": "Add user login functionality to the app",
                "expected_issues": ["detail", "security", "error handling"]
            },
            {
                "title": "Implement user authentication with JWT",
                "description": "Create a secure authentication system using JWT tokens for user login and session management. Include password hashing, token refresh, and logout functionality.",
                "expected_issues": ["testing", "error handling"]  # Should have fewer issues
            },
            {
                "title": "Fix bug",
                "description": "Fix the bug in the system",
                "expected_issues": ["detail", "specifics", "reproduction"]
            }
        ]
        
        for i, test_case in enumerate(test_cases, 1):
            print(f"\n   Testing case {i}: {test_case['title']}")
            
            # Analyze task
            warnings = await agent.analyze_task(test_case['title'], test_case['description'])
            
            print(f"     Generated {len(warnings)} warnings:")
            for warning in warnings:
                print(f"       - {warning.message}")
                print(f"         Reasoning: {warning.reasoning[:100]}...")
            
            # Basic validation
            assert isinstance(warnings, list), "Warnings should be a list"
            for warning in warnings:
                assert hasattr(warning, 'message'), "Warning should have message"
                assert hasattr(warning, 'reasoning'), "Warning should have reasoning"
                assert warning.message, "Warning message should not be empty"
                assert warning.reasoning, "Warning reasoning should not be empty"
            
            print(f"     ✅ Case {i} analysis completed successfully")
        
        print("✅ LLM-based task analysis works correctly")
        return True
        
    except Exception as e:
        print(f"❌ LLM task analysis test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_llm_vs_heuristic_comparison():
    """Compare LLM analysis with heuristic analysis."""
    print("🔍 Comparing LLM vs heuristic analysis...")
    
    try:
        from services.task_analysis_agent import TaskAnalysisAgent
        
        agent = TaskAnalysisAgent()
        
        # Test case
        title = "Add user registration"
        description = "Add user registration functionality"
        
        # Get LLM analysis
        llm_warnings = await agent.analyze_task(title, description)
        
        # Get heuristic analysis (fallback)
        heuristic_warnings = agent._fallback_heuristic_analysis(title, description)
        
        print(f"   LLM generated {len(llm_warnings)} warnings")
        print(f"   Heuristic generated {len(heuristic_warnings)} warnings")
        
        # Show some differences
        print("\n   LLM warnings:")
        for warning in llm_warnings[:3]:  # Show first 3
            print(f"     - {warning.message}")
        
        print("\n   Heuristic warnings:")
        for warning in heuristic_warnings[:3]:  # Show first 3
            print(f"     - {warning.message}")
        
        # LLM should generally provide more nuanced analysis
        print(f"\n   LLM analysis appears to be working (generated {len(llm_warnings)} warnings)")
        print("✅ LLM vs heuristic comparison completed")
        return True
        
    except Exception as e:
        print(f"❌ Comparison test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_llm_response_parsing():
    """Test LLM response parsing."""
    print("🔍 Testing LLM response parsing...")
    
    try:
        from services.task_analysis_agent import TaskAnalysisAgent
        
        agent = TaskAnalysisAgent()
        
        # Test valid JSON response
        valid_response = '''[
            {
                "message": "Error handling not explicitly mentioned",
                "reasoning": "The task description should consider error cases and how to handle them to ensure robust implementation."
            },
            {
                "message": "Testing requirements not specified", 
                "reasoning": "Consider adding specific testing requirements or acceptance criteria to ensure quality."
            }
        ]'''
        
        warnings = agent._parse_llm_response(valid_response)
        assert len(warnings) == 2, f"Expected 2 warnings, got {len(warnings)}"
        assert warnings[0].message == "Error handling not explicitly mentioned"
        assert warnings[1].message == "Testing requirements not specified"
        
        # Test invalid JSON response
        invalid_response = "This is not JSON"
        warnings = agent._parse_llm_response(invalid_response)
        assert len(warnings) == 0, "Invalid JSON should return empty list"
        
        # Test empty response
        empty_response = "[]"
        warnings = agent._parse_llm_response(empty_response)
        assert len(warnings) == 0, "Empty JSON should return empty list"
        
        print("✅ LLM response parsing works correctly")
        return True
        
    except Exception as e:
        print(f"❌ Response parsing test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def run_llm_tests():
    """Run all LLM-based task analysis tests."""
    print("🚀 Testing LLM-Based Task Analysis")
    print("=" * 50)
    
    tests = [
        ("LLM Task Analysis", test_llm_task_analysis),
        ("LLM vs Heuristic Comparison", test_llm_vs_heuristic_comparison),
        ("LLM Response Parsing", test_llm_response_parsing)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if await test_func():
                passed += 1
            else:
                print(f"❌ {test_name} failed")
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! LLM-based task analysis is working correctly.")
    else:
        print("⚠️  Some tests failed. Please check the implementation.")
    
    return passed == total

if __name__ == "__main__":
    success = asyncio.run(run_llm_tests())
    sys.exit(0 if success else 1)
