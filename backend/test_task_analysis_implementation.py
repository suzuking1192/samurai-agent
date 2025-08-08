"""
Test file for task analysis implementation.
Tests the TaskAnalysisAgent, TaskService, and integration with task creation/update.
"""

import asyncio
import json
import os
import sys
import tempfile
import uuid
from datetime import datetime
from typing import List, Dict, Any

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from models import Task, TaskWarning
    from services.task_analysis_agent import TaskAnalysisAgent
    from services.task_service import TaskService
    from services.agent_tools import CreateTaskTool, UpdateTaskTool
    from services.file_service import FileService
except ImportError as e:
    print(f"Import error: {e}")
    # Try alternative import paths
    try:
        import sys
        import os
        sys.path.append(os.path.join(os.path.dirname(__file__), 'services'))
        from task_analysis_agent import TaskAnalysisAgent
        from task_service import TaskService
        from agent_tools import CreateTaskTool, UpdateTaskTool
        from file_service import FileService
    except ImportError as e2:
        print(f"Alternative import also failed: {e2}")
        sys.exit(1)

class TaskAnalysisImplementationTest:
    """Test class for task analysis implementation."""
    
    def __init__(self):
        self.test_project_id = str(uuid.uuid4())
        self.test_task_id = str(uuid.uuid4())
        self.temp_dir = None
        self.original_data_dir = None
        
    def setup_test_environment(self):
        """Set up test environment with temporary data directory."""
        # Create temporary directory for test data
        self.temp_dir = tempfile.mkdtemp()
        self.original_data_dir = "data"
        
        # Create test data directory
        os.makedirs(f"{self.temp_dir}/data", exist_ok=True)
        
        # Mock the data directory
        import services.file_service
        services.file_service.DATA_DIR = f"{self.temp_dir}/data"
        
        print(f"✅ Test environment set up: {self.temp_dir}")
    
    def cleanup_test_environment(self):
        """Clean up test environment."""
        if self.temp_dir and os.path.exists(self.temp_dir):
            import shutil
            shutil.rmtree(self.temp_dir)
            print("✅ Test environment cleaned up")
    
    def test_task_warning_model(self):
        """Test TaskWarning model creation and serialization."""
        print("\n🔍 Testing TaskWarning model...")
        
        try:
            # Create a warning
            warning = TaskWarning(
                message="Test warning message",
                reasoning="This is a test reasoning for the warning"
            )
            
            # Test serialization
            warning_dict = warning.dict()
            assert "message" in warning_dict
            assert "reasoning" in warning_dict
            assert warning_dict["message"] == "Test warning message"
            assert warning_dict["reasoning"] == "This is a test reasoning for the warning"
            
            # Test JSON serialization
            warning_json = warning.json()
            assert "message" in warning_json
            assert "reasoning" in warning_json
            
            print("✅ TaskWarning model works correctly")
            return True
            
        except Exception as e:
            print(f"❌ TaskWarning model test failed: {e}")
            return False
    
    def test_task_model_with_warnings(self):
        """Test Task model with review warnings field."""
        print("\n🔍 Testing Task model with warnings...")
        
        try:
            # Create warnings
            warnings = [
                TaskWarning(message="Warning 1", reasoning="Reason 1"),
                TaskWarning(message="Warning 2", reasoning="Reason 2")
            ]
            
            # Create task with warnings
            task = Task(
                id=self.test_task_id,
                project_id=self.test_project_id,
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
    
    def test_task_analysis_agent(self):
        """Test TaskAnalysisAgent functionality."""
        print("\n🔍 Testing TaskAnalysisAgent...")
        
        try:
            agent = TaskAnalysisAgent()
            
            # Test with a good task description
            good_task_title = "Implement user authentication"
            good_task_description = """
            Create a comprehensive user authentication system with the following features:
            - JWT token-based authentication
            - Password hashing using bcrypt
            - User registration and login endpoints
            - Error handling for invalid credentials
            - Input validation and sanitization
            - Unit tests for all endpoints
            - Integration tests for the complete flow
            """
            
            good_warnings = agent.analyze_task(good_task_title, good_task_description)
            print(f"   Good task warnings: {len(good_warnings)}")
            
            # Test with a problematic task description
            bad_task_title = "Add login"
            bad_task_description = "Make users able to login"
            
            bad_warnings = agent.analyze_task(bad_task_title, bad_task_description)
            print(f"   Bad task warnings: {len(bad_warnings)}")
            
            # Should have more warnings for the bad task
            assert len(bad_warnings) > len(good_warnings), "Bad task should have more warnings"
            
            # Test warning structure
            for warning in bad_warnings:
                assert hasattr(warning, 'message')
                assert hasattr(warning, 'reasoning')
                assert warning.message
                assert warning.reasoning
            
            print("✅ TaskAnalysisAgent works correctly")
            return True
            
        except Exception as e:
            print(f"❌ TaskAnalysisAgent test failed: {e}")
            return False
    
    def test_task_service(self):
        """Test TaskService functionality."""
        print("\n🔍 Testing TaskService...")
        
        try:
            service = TaskService()
            
            # Test task creation with analysis
            task = asyncio.run(service.create_task(
                title="Test Task",
                description="This is a test task with minimal detail",
                project_id=self.test_project_id
            ))
            
            # Verify task was created
            assert task.id
            assert task.title == "Test Task"
            assert task.project_id == self.test_project_id
            
            # Verify warnings were generated
            assert hasattr(task, 'review_warnings')
            assert isinstance(task.review_warnings, list)
            print(f"   Generated {len(task.review_warnings)} warnings")
            
            # Test task update with re-analysis
            updated_task = asyncio.run(service.update_task(
                project_id=self.test_project_id,
                task_id=task.id,
                updates={"description": "Updated description with more detail and error handling"}
            ))
            
            # Verify task was updated
            assert updated_task.description == "Updated description with more detail and error handling"
            assert updated_task.updated_at != task.updated_at
            
            # Verify warnings were re-analyzed
            assert len(updated_task.review_warnings) != len(task.review_warnings)
            
            print("✅ TaskService works correctly")
            return True
            
        except Exception as e:
            print(f"❌ TaskService test failed: {e}")
            return False
    
    def test_create_task_tool(self):
        """Test CreateTaskTool with analysis integration."""
        print("\n🔍 Testing CreateTaskTool...")
        
        try:
            tool = CreateTaskTool()
            
            # Test task creation
            result = asyncio.run(tool.execute(
                title="Tool Test Task",
                description="This task has minimal detail and no error handling",
                project_id=self.test_project_id
            ))
            
            # Verify success
            assert result["success"] == True
            assert "task_id" in result
            assert "warning" in result["message"].lower() or "warnings" in result["message"].lower()
            
            print(f"   Tool result: {result['message']}")
            print("✅ CreateTaskTool works correctly")
            return True
            
        except Exception as e:
            print(f"❌ CreateTaskTool test failed: {e}")
            return False
    
    def test_update_task_tool(self):
        """Test UpdateTaskTool with analysis integration."""
        print("\n🔍 Testing UpdateTaskTool...")
        
        try:
            # First create a task
            service = TaskService()
            task = asyncio.run(service.create_task(
                title="Update Test Task",
                description="Original description",
                project_id=self.test_project_id
            ))
            
            # Test task update
            tool = UpdateTaskTool()
            result = asyncio.run(tool.execute(
                task_id=task.id,
                project_id=self.test_project_id,
                updates={
                    "description": "Updated description with comprehensive error handling and testing requirements"
                }
            ))
            
            # Verify success
            assert result["success"] == True
            assert "Updated task" in result["message"]
            
            print(f"   Tool result: {result['message']}")
            print("✅ UpdateTaskTool works correctly")
            return True
            
        except Exception as e:
            print(f"❌ UpdateTaskTool test failed: {e}")
            return False
    
    def test_file_persistence(self):
        """Test that tasks with warnings are properly saved and loaded."""
        print("\n🔍 Testing file persistence with warnings...")
        
        try:
            service = TaskService()
            
            # Create a task with warnings
            task = asyncio.run(service.create_task(
                title="Persistence Test Task",
                description="This task should generate warnings",
                project_id=self.test_project_id
            ))
            
            # Verify warnings were generated
            assert len(task.review_warnings) > 0
            
            # Load the task from file
            loaded_task = asyncio.run(service.get_task(self.test_project_id, task.id))
            
            # Verify task was loaded correctly
            assert loaded_task is not None
            assert loaded_task.id == task.id
            assert loaded_task.title == task.title
            assert len(loaded_task.review_warnings) == len(task.review_warnings)
            
            # Verify warning content
            for i, warning in enumerate(loaded_task.review_warnings):
                assert warning.message == task.review_warnings[i].message
                assert warning.reasoning == task.review_warnings[i].reasoning
            
            print("✅ File persistence with warnings works correctly")
            return True
            
        except Exception as e:
            print(f"❌ File persistence test failed: {e}")
            return False
    
    def run_all_tests(self):
        """Run all tests and report results."""
        print("🚀 Starting Task Analysis Implementation Tests")
        print("=" * 50)
        
        self.setup_test_environment()
        
        tests = [
            ("TaskWarning Model", self.test_task_warning_model),
            ("Task Model with Warnings", self.test_task_model_with_warnings),
            ("TaskAnalysisAgent", self.test_task_analysis_agent),
            ("TaskService", self.test_task_service),
            ("CreateTaskTool", self.test_create_task_tool),
            ("UpdateTaskTool", self.test_update_task_tool),
            ("File Persistence", self.test_file_persistence)
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
        
        self.cleanup_test_environment()
        return passed == total

if __name__ == "__main__":
    test = TaskAnalysisImplementationTest()
    success = test.run_all_tests()
    sys.exit(0 if success else 1)
