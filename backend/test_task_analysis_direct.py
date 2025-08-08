"""
Direct test for TaskAnalysisAgent functionality.
"""

import sys
import os
import uuid

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_task_analysis_agent_direct():
    """Test TaskAnalysisAgent directly."""
    print("🔍 Testing TaskAnalysisAgent directly...")
    
    try:
        # Import the agent directly
        sys.path.append(os.path.join(os.path.dirname(__file__), 'services'))
        from task_analysis_agent import TaskAnalysisAgent
        
        agent = TaskAnalysisAgent()
        
        # Test with different types of task descriptions
        test_cases = [
            {
                "title": "Add login",
                "description": "Make users able to login",
                "expected_warnings": "high"
            },
            {
                "title": "Implement user authentication",
                "description": """
                Create a comprehensive user authentication system with:
                - JWT token-based authentication
                - Password hashing using bcrypt
                - User registration and login endpoints
                - Error handling for invalid credentials
                - Input validation and sanitization
                - Unit tests for all endpoints
                """,
                "expected_warnings": "low"
            },
            {
                "title": "Fix bug",
                "description": "Fix the bug",
                "expected_warnings": "high"
            }
        ]
        
        for i, case in enumerate(test_cases):
            print(f"   Testing case {i+1}: {case['title']}")
            warnings = agent.analyze_task(case['title'], case['description'])
            
            # Test warning structure
            for warning in warnings:
                assert hasattr(warning, 'message')
                assert hasattr(warning, 'reasoning')
                assert warning.message
                assert warning.reasoning
                print(f"     Warning: {warning.message}")
                print(f"     Reasoning: {warning.reasoning}")
            
            print(f"     Generated {len(warnings)} warnings")
            
            # Verify that bad tasks generate more warnings
            if case['expected_warnings'] == 'high':
                assert len(warnings) >= 3, f"Expected high warnings, got {len(warnings)}"
            elif case['expected_warnings'] == 'low':
                assert len(warnings) <= 2, f"Expected low warnings, got {len(warnings)}"
        
        print("✅ TaskAnalysisAgent works correctly")
        return True
        
    except Exception as e:
        print(f"❌ TaskAnalysisAgent test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_task_warning_creation():
    """Test TaskWarning creation directly."""
    print("🔍 Testing TaskWarning creation...")
    
    try:
        from models import TaskWarning
        
        # Create various warnings
        warnings = [
            TaskWarning(
                message="Error handling not explicitly mentioned",
                reasoning="The task description should consider error cases and how to handle them to ensure robust implementation."
            ),
            TaskWarning(
                message="Testing requirements not specified",
                reasoning="Consider adding specific testing requirements or acceptance criteria to ensure quality."
            ),
            TaskWarning(
                message="Security considerations may be missing",
                reasoning="Task involves sensitive operations but doesn't explicitly address security measures."
            )
        ]
        
        # Test each warning
        for i, warning in enumerate(warnings):
            assert warning.message
            assert warning.reasoning
            print(f"   Warning {i+1}: {warning.message}")
        
        print("✅ TaskWarning creation works correctly")
        return True
        
    except Exception as e:
        print(f"❌ TaskWarning creation test failed: {e}")
        return False

def test_task_with_warnings_creation():
    """Test Task creation with warnings."""
    print("🔍 Testing Task creation with warnings...")
    
    try:
        from models import Task, TaskWarning
        
        # Create warnings
        warnings = [
            TaskWarning(message="Warning 1", reasoning="Reason 1"),
            TaskWarning(message="Warning 2", reasoning="Reason 2")
        ]
        
        # Create task
        task = Task(
            id=str(uuid.uuid4()),
            project_id=str(uuid.uuid4()),
            title="Test Task with Warnings",
            description="This task has warnings",
            review_warnings=warnings
        )
        
        # Verify task properties
        assert task.id
        assert task.title == "Test Task with Warnings"
        assert len(task.review_warnings) == 2
        assert task.review_warnings[0].message == "Warning 1"
        assert task.review_warnings[1].reasoning == "Reason 2"
        
        print("✅ Task creation with warnings works correctly")
        return True
        
    except Exception as e:
        print(f"❌ Task creation with warnings test failed: {e}")
        return False

def run_direct_tests():
    """Run direct tests."""
    print("🚀 Starting Direct Task Analysis Tests")
    print("=" * 50)
    
    tests = [
        ("TaskWarning Creation", test_task_warning_creation),
        ("Task with Warnings Creation", test_task_with_warnings_creation),
        ("TaskAnalysisAgent Direct", test_task_analysis_agent_direct)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                print(f"❌ {test_name} failed")
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Task analysis implementation is working correctly.")
    else:
        print("⚠️  Some tests failed. Please check the implementation.")
    
    return passed == total

if __name__ == "__main__":
    success = run_direct_tests()
    sys.exit(0 if success else 1)
