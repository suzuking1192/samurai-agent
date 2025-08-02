#!/usr/bin/env python3
"""
Basic test file to verify test structure without AI API calls
"""

import pytest
import uuid
import os
from datetime import datetime

# Import models
from models import Project, Task, Memory, ChatMessage

class TestBasicStructure:
    """Basic tests that don't require AI services"""
    
    def setup_method(self):
        """Set up test environment"""
        self.test_project_id = "test-basic-" + str(uuid.uuid4())[:8]
        self.test_project_context = {
            "name": "Test Project",
            "description": "A test project",
            "tech_stack": "React + FastAPI"
        }
    
    def teardown_method(self):
        """Clean up test data"""
        test_files = [
            f"data/project-{self.test_project_id}-chat.json",
            f"data/project-{self.test_project_id}-tasks.json",
            f"data/project-{self.test_project_id}-memories.json"
        ]
        
        for file_path in test_files:
            if os.path.exists(file_path):
                os.remove(file_path)
    
    def test_model_creation(self):
        """Test that models can be created correctly"""
        
        # Test Project model
        project = Project(
            id=self.test_project_id,
            name="Test Project",
            description="A test project",
            tech_stack="React + FastAPI",
            created_at=datetime.now()
        )
        
        assert project.id == self.test_project_id
        assert project.name == "Test Project"
        assert project.tech_stack == "React + FastAPI"
        
        # Test Task model
        task = Task(
            id=str(uuid.uuid4()),
            title="Test Task",
            description="A test task",
            prompt="Test prompt",
            completed=False,
            order=1,
            created_at=datetime.now()
        )
        
        assert task.title == "Test Task"
        assert task.completed == False
        assert task.order == 1
        
        # Test Memory model
        memory = Memory(
            id=str(uuid.uuid4()),
            title="Test Memory",
            content="Test content",
            type="decision",
            created_at=datetime.now()
        )
        
        assert memory.title == "Test Memory"
        assert memory.type == "decision"
        
        # Test ChatMessage model
        message = ChatMessage(
            id=str(uuid.uuid4()),
            role="user",
            content="Test message",
            timestamp=datetime.now()
        )
        
        assert message.role == "user"
        assert message.content == "Test message"
        
        print("✅ All models created successfully")
    
    def test_file_service_import(self):
        """Test that file service can be imported"""
        try:
            from services.file_service import FileService
            file_service = FileService()
            assert file_service is not None
            print("✅ FileService imported successfully")
        except ImportError as e:
            pytest.fail(f"Failed to import FileService: {e}")
    
    def test_ai_agent_import(self):
        """Test that AI agent can be imported"""
        try:
            from services.ai_agent import SamuraiAgent
            agent = SamuraiAgent()
            assert agent is not None
            print("✅ SamuraiAgent imported successfully")
        except ImportError as e:
            pytest.fail(f"Failed to import SamuraiAgent: {e}")
    
    def test_test_scenarios_import(self):
        """Test that test scenarios can be imported"""
        try:
            from test_scenarios import AUTHENTICATION_FLOW_SCENARIOS
            assert AUTHENTICATION_FLOW_SCENARIOS is not None
            assert "vague_request" in AUTHENTICATION_FLOW_SCENARIOS
            print("✅ Test scenarios imported successfully")
        except ImportError as e:
            pytest.fail(f"Failed to import test scenarios: {e}")


def run_basic_tests():
    """Run basic tests without AI dependencies"""
    
    print("🧪 Running Basic Structure Tests")
    print("=" * 40)
    
    test_instance = TestBasicStructure()
    
    try:
        test_instance.setup_method()
        
        print("\n🔍 Test 1: Model Creation")
        test_instance.test_model_creation()
        
        print("\n🔍 Test 2: File Service Import")
        test_instance.test_file_service_import()
        
        print("\n🔍 Test 3: AI Agent Import")
        test_instance.test_ai_agent_import()
        
        print("\n🔍 Test 4: Test Scenarios Import")
        test_instance.test_test_scenarios_import()
        
        print("\n✅ All basic tests passed!")
        print("🎉 Test structure is working correctly!")
        
    except Exception as e:
        print(f"\n❌ Basic test failed: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        test_instance.teardown_method()


if __name__ == "__main__":
    run_basic_tests() 