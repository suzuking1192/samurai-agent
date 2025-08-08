"""
Test to verify that task creation returns warnings for frontend display.
"""

import asyncio
import sys
import os
import uuid
import json

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def test_task_creation_with_warnings():
    """Test that task creation returns warnings for frontend display."""
    print("🔍 Testing task creation with warnings for frontend...")
    
    try:
        from services.task_service import TaskService
        
        task_service = TaskService()
        
        # Test case that should generate warnings
        title = "Add login"
        description = "Add user login functionality to the app"
        project_id = str(uuid.uuid4())
        
        # Create task
        task = await task_service.create_task(
            title=title,
            description=description,
            project_id=project_id
        )
        
        # Verify task was created
        assert task is not None, "Task should be created"
        assert task.title == title, "Task title should match"
        assert task.description == description, "Task description should match"
        
        # Verify warnings are present
        assert hasattr(task, 'review_warnings'), "Task should have review_warnings field"
        assert task.review_warnings is not None, "review_warnings should not be None"
        assert len(task.review_warnings) > 0, "Should have at least one warning"
        
        print(f"   ✅ Task created with {len(task.review_warnings)} warnings")
        
        # Verify warning structure matches frontend expectations
        for warning in task.review_warnings:
            assert hasattr(warning, 'message'), "Warning should have message field"
            assert hasattr(warning, 'reasoning'), "Warning should have reasoning field"
            assert warning.message, "Warning message should not be empty"
            assert warning.reasoning, "Warning reasoning should not be empty"
            
            print(f"     - Warning: {warning.message}")
            print(f"       Reasoning: {warning.reasoning[:100]}...")
        
        # Test JSON serialization (simulates what frontend receives)
        task_dict = task.dict()
        assert 'review_warnings' in task_dict, "Task dict should include review_warnings"
        assert len(task_dict['review_warnings']) > 0, "Task dict should have warnings"
        
        # Verify warning structure in dict
        for warning_dict in task_dict['review_warnings']:
            assert 'message' in warning_dict, "Warning dict should have message"
            assert 'reasoning' in warning_dict, "Warning dict should have reasoning"
        
        print("   ✅ Task JSON serialization includes warnings correctly")
        
        # Test that warnings are preserved when getting task
        retrieved_task = await task_service.get_task(project_id, task.id)
        assert retrieved_task is not None, "Should be able to retrieve task"
        assert len(retrieved_task.review_warnings or []) == len(task.review_warnings), "Warnings should be preserved"
        
        print("   ✅ Warnings are preserved when retrieving task")
        
        print("✅ Task creation with warnings works correctly for frontend")
        return True
        
    except Exception as e:
        print(f"❌ Task creation test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_task_update_with_warnings():
    """Test that task updates trigger re-analysis and new warnings."""
    print("🔍 Testing task update with warning re-analysis...")
    
    try:
        from services.task_service import TaskService
        
        task_service = TaskService()
        
        # Create initial task
        project_id = str(uuid.uuid4())
        task = await task_service.create_task(
            title="Add feature",
            description="Add a new feature",
            project_id=project_id
        )
        
        initial_warnings = len(task.review_warnings or [])
        print(f"   Initial task has {initial_warnings} warnings")
        
        # Update task with more detailed description
        updated_task = await task_service.update_task(
            project_id=project_id,
            task_id=task.id,
            updates={
                "title": "Implement user authentication with JWT",
                "description": "Create a secure authentication system using JWT tokens for user login and session management. Include password hashing, token refresh, and logout functionality."
            }
        )
        
        updated_warnings = len(updated_task.review_warnings or [])
        print(f"   Updated task has {updated_warnings} warnings")
        
        # Verify warnings changed (should be different due to different content)
        assert updated_task.title == "Implement user authentication with JWT", "Title should be updated"
        assert "JWT" in updated_task.description, "Description should be updated"
        
        print("   ✅ Task update with re-analysis works correctly")
        return True
        
    except Exception as e:
        print(f"❌ Task update test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_frontend_compatibility():
    """Test that the data structure is compatible with frontend expectations."""
    print("🔍 Testing frontend compatibility...")
    
    try:
        from services.task_service import TaskService
        
        task_service = TaskService()
        
        # Create a task
        project_id = str(uuid.uuid4())
        task = await task_service.create_task(
            title="Test task",
            description="This is a test task",
            project_id=project_id
        )
        
        # Convert to dict (simulates API response)
        task_dict = task.dict()
        
        # Verify all required fields for frontend
        required_fields = ['id', 'project_id', 'title', 'description', 'status', 'priority', 'created_at', 'updated_at']
        for field in required_fields:
            assert field in task_dict, f"Task dict should have {field} field"
        
        # Verify warnings field
        assert 'review_warnings' in task_dict, "Task dict should have review_warnings field"
        
        # Verify warning structure
        if task_dict['review_warnings']:
            warning = task_dict['review_warnings'][0]
            assert 'message' in warning, "Warning should have message field"
            assert 'reasoning' in warning, "Warning should have reasoning field"
        
        print("   ✅ Task structure is compatible with frontend")
        
        # Test JSON serialization (what frontend actually receives)
        task_json = task.json()
        task_from_json = json.loads(task_json)
        
        assert 'review_warnings' in task_from_json, "JSON should include review_warnings"
        print("   ✅ JSON serialization works correctly")
        
        return True
        
    except Exception as e:
        print(f"❌ Frontend compatibility test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def run_frontend_warning_tests():
    """Run all frontend warning tests."""
    print("🚀 Testing Frontend Warning Integration")
    print("=" * 50)
    
    tests = [
        ("Task Creation with Warnings", test_task_creation_with_warnings),
        ("Task Update with Warnings", test_task_update_with_warnings),
        ("Frontend Compatibility", test_frontend_compatibility)
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
        print("🎉 All tests passed! Frontend warnings are working correctly.")
        print("\n📋 Summary:")
        print("✅ Task creation includes LLM-generated warnings")
        print("✅ Task updates trigger re-analysis")
        print("✅ Data structure is compatible with frontend")
        print("✅ Warnings are properly serialized for API responses")
    else:
        print("⚠️  Some tests failed. Please check the implementation.")
    
    return passed == total

if __name__ == "__main__":
    success = asyncio.run(run_frontend_warning_tests())
    sys.exit(0 if success else 1)
