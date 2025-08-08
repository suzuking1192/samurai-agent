"""
Simple test for task analysis implementation.
"""

import sys
import os
import tempfile
import uuid
from datetime import datetime

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_task_warning_model():
    """Test TaskWarning model creation."""
    print("🔍 Testing TaskWarning model...")
    
    try:
        from models import TaskWarning
        
        # Create a warning
        warning = TaskWarning(
            message="Test warning message",
            reasoning="This is a test reasoning for the warning"
        )
        
        # Test basic properties
        assert warning.message == "Test warning message"
        assert warning.reasoning == "This is a test reasoning for the warning"
        
        # Test serialization
        warning_dict = warning.dict()
        assert "message" in warning_dict
        assert "reasoning" in warning_dict
        
        print("✅ TaskWarning model works correctly")
        return True
        
    except Exception as e:
        print(f"❌ TaskWarning model test failed: {e}")
        return False

def test_task_model_with_warnings():
    """Test Task model with review warnings field."""
    print("🔍 Testing Task model with warnings...")
    
    try:
        from models import Task, TaskWarning
        
        # Create warnings
        warnings = [
            TaskWarning(message="Warning 1", reasoning="Reason 1"),
            TaskWarning(message="Warning 2", reasoning="Reason 2")
        ]
        
        # Create task with warnings
        task = Task(
            id=str(uuid.uuid4()),
            project_id=str(uuid.uuid4()),
            title="Test Task",
            description="Test description",
            review_warnings=warnings
        )
        
        # Test that warnings are included
        assert hasattr(task, 'review_warnings')
        assert len(task.review_warnings) == 2
        assert task.review_warnings[0].message == "Warning 1"
        assert task.review_warnings[1].reasoning == "Reason 2"
        
        # Test serialization
        task_dict = task.dict()
        assert "review_warnings" in task_dict
        assert len(task_dict["review_warnings"]) == 2
        
        print("✅ Task model with warnings works correctly")
        return True
        
    except Exception as e:
        print(f"❌ Task model with warnings test failed: {e}")
        return False

def test_task_analysis_agent_basic():
    """Test TaskAnalysisAgent basic functionality."""
    print("🔍 Testing TaskAnalysisAgent...")
    
    try:
        from services.task_analysis_agent import TaskAnalysisAgent
        
        agent = TaskAnalysisAgent()
        
        # Test with a problematic task description
        bad_task_title = "Add login"
        bad_task_description = "Make users able to login"
        
        warnings = agent.analyze_task(bad_task_title, bad_task_description)
        
        # Should generate some warnings
        assert len(warnings) > 0
        
        # Test warning structure
        for warning in warnings:
            assert hasattr(warning, 'message')
            assert hasattr(warning, 'reasoning')
            assert warning.message
            assert warning.reasoning
        
        print(f"✅ TaskAnalysisAgent works correctly - generated {len(warnings)} warnings")
        return True
        
    except Exception as e:
        print(f"❌ TaskAnalysisAgent test failed: {e}")
        return False

def test_task_service_basic():
    """Test TaskService basic functionality."""
    print("🔍 Testing TaskService...")
    
    try:
        from services.task_service import TaskService
        
        service = TaskService()
        
        # Test task creation with analysis
        import asyncio
        task = asyncio.run(service.create_task(
            title="Test Task",
            description="This is a test task with minimal detail",
            project_id=str(uuid.uuid4())
        ))
        
        # Verify task was created
        assert task.id
        assert task.title == "Test Task"
        
        # Verify warnings were generated
        assert hasattr(task, 'review_warnings')
        assert isinstance(task.review_warnings, list)
        
        print(f"✅ TaskService works correctly - generated {len(task.review_warnings)} warnings")
        return True
        
    except Exception as e:
        print(f"❌ TaskService test failed: {e}")
        return False

def run_simple_tests():
    """Run simple tests."""
    print("🚀 Starting Simple Task Analysis Tests")
    print("=" * 50)
    
    tests = [
        ("TaskWarning Model", test_task_warning_model),
        ("Task Model with Warnings", test_task_model_with_warnings),
        ("TaskAnalysisAgent", test_task_analysis_agent_basic),
        ("TaskService", test_task_service_basic)
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
    success = run_simple_tests()
    sys.exit(0 if success else 1)
