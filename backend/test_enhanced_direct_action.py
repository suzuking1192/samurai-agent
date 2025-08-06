#!/usr/bin/env python3
"""
Test Enhanced Direct Action Execution

This test file verifies that the enhanced _execute_direct_action method works properly
for task creation, task updates, and memory updates using LLM-based action detection.
"""

import asyncio
import sys
import os
import logging
import json
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext, IntentAnalysis
from models import Task, Memory, ChatMessage
from services.agent_tools import AgentToolRegistry

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TestEnhancedDirectAction:
    """Test class for enhanced direct action execution."""
    
    def __init__(self):
        self.agent = UnifiedSamuraiAgent()
        self.project_id = "test_enhanced_direct_action"
        self.project_context = {
            "name": "Test Project",
            "tech_stack": "Python, FastAPI, PostgreSQL"
        }
        
    def create_test_context(self, tasks=None, memories=None) -> ConversationContext:
        """Create a test conversation context."""
        if tasks is None:
            tasks = []
        if memories is None:
            memories = []
            
        return ConversationContext(
            session_messages=[
                ChatMessage(
                    id="1",
                    session_id="test_session",
                    project_id=self.project_id,
                    message="Hello, I need help with my project",
                    created_at=datetime.now()
                )
            ],
            conversation_summary="User is working on a test project and needs assistance.",
            relevant_tasks=tasks,
            relevant_memories=memories,
            project_context=self.project_context
        )
    
    async def test_task_creation(self):
        """Test task creation through direct action."""
        print("\n🧪 Testing Task Creation")
        
        # Create test context
        context = self.create_test_context()
        
        # Test message for task creation
        message = "Create a task for implementing user authentication with JWT"
        
        try:
            result = await self.agent._execute_direct_action(message, context, self.project_id)
            
            print(f"Result: {json.dumps(result, indent=2)}")
            
            # Verify the result
            assert result["action_type"] in ["single_action", "multiple_actions"], f"Unexpected action type: {result['action_type']}"
            assert result["tool_calls_made"] > 0, "No tool calls were made"
            
            # Check if task was actually created
            tool_results = result.get("tool_results", [])
            success_count = len([r for r in tool_results if r.get("success", False)])
            assert success_count > 0, "No successful tool executions"
            
            print("✅ Task creation test passed")
            return True
            
        except Exception as e:
            print(f"❌ Task creation test failed: {e}")
            return False
    
    async def test_task_status_update(self):
        """Test task status update through direct action."""
        print("\n🧪 Testing Task Status Update")
        
        # First create a task
        context = self.create_test_context()
        create_message = "Create a task for database setup"
        
        try:
            # Create the task first
            create_result = await self.agent._execute_direct_action(create_message, context, self.project_id)
            assert create_result["tool_calls_made"] > 0, "Failed to create initial task"
            
            # Now test status update
            update_message = "Mark the database setup task as completed"
            
            # Create context with the task
            test_task = Task(
                id="test_task_1",
                project_id=self.project_id,
                title="Database Setup",
                description="Set up the database for the project",
                status="pending",
                priority="medium",
                completed=False,
                order=0,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
            context_with_task = self.create_test_context(tasks=[test_task])
            
            result = await self.agent._execute_direct_action(update_message, context_with_task, self.project_id)
            
            print(f"Result: {json.dumps(result, indent=2)}")
            
            # Verify the result
            assert result["action_type"] in ["single_action", "multiple_actions"], f"Unexpected action type: {result['action_type']}"
            assert result["tool_calls_made"] > 0, "No tool calls were made"
            
            print("✅ Task status update test passed")
            return True
            
        except Exception as e:
            print(f"❌ Task status update test failed: {e}")
            return False
    
    async def test_memory_creation(self):
        """Test memory creation through direct action."""
        print("\n🧪 Testing Memory Creation")
        
        # Create test context
        context = self.create_test_context()
        
        # Test message for memory creation
        message = "Create a memory about choosing PostgreSQL as our database"
        
        try:
            result = await self.agent._execute_direct_action(message, context, self.project_id)
            
            print(f"Result: {json.dumps(result, indent=2)}")
            
            # Verify the result
            assert result["action_type"] in ["single_action", "multiple_actions"], f"Unexpected action type: {result['action_type']}"
            assert result["tool_calls_made"] > 0, "No tool calls were made"
            
            # Check if memory was actually created
            tool_results = result.get("tool_results", [])
            success_count = len([r for r in tool_results if r.get("success", False)])
            assert success_count > 0, "No successful tool executions"
            
            print("✅ Memory creation test passed")
            return True
            
        except Exception as e:
            print(f"❌ Memory creation test failed: {e}")
            return False
    
    async def test_memory_update(self):
        """Test memory update through direct action."""
        print("\n🧪 Testing Memory Update")
        
        # First create a memory using the tool registry
        create_result = self.agent.tool_registry.execute_tool(
            "create_memory",
            title="Database Choice",
            content="We chose PostgreSQL for our database",
            project_id=self.project_id,
            category="technical_decision"
        )
        
        assert create_result["success"], f"Failed to create test memory: {create_result.get('message', 'Unknown error')}"
        
        # Create test memory object for context
        test_memory = Memory(
            id=create_result["memory_id"],
            project_id=self.project_id,
            title="Database Choice",
            content="We chose PostgreSQL for our database",
            category="technical_decision",
            type="decision",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Create context with the memory
        context = self.create_test_context(memories=[test_memory])
        
        # Test message for memory update
        message = "Update the database choice memory with the new connection string"
        
        try:
            result = await self.agent._execute_direct_action(message, context, self.project_id)
            
            print(f"Result: {json.dumps(result, indent=2)}")
            
            # Verify the result
            assert result["action_type"] in ["single_action", "multiple_actions"], f"Unexpected action type: {result['action_type']}"
            assert result["tool_calls_made"] > 0, "No tool calls were made"
            
            print("✅ Memory update test passed")
            return True
            
        except Exception as e:
            print(f"❌ Memory update test failed: {e}")
            return False
    
    async def test_multiple_actions(self):
        """Test multiple actions in a single message."""
        print("\n🧪 Testing Multiple Actions")
        
        # Create test context
        context = self.create_test_context()
        
        # Test message with multiple actions
        message = "Delete the old authentication task and create a new one for JWT implementation"
        
        try:
            result = await self.agent._execute_direct_action(message, context, self.project_id)
            
            print(f"Result: {json.dumps(result, indent=2)}")
            
            # Verify the result
            assert result["action_type"] in ["multiple_actions"], f"Expected multiple actions, got: {result['action_type']}"
            assert result["tool_calls_made"] > 0, "No tool calls were made"
            
            print("✅ Multiple actions test passed")
            return True
            
        except Exception as e:
            print(f"❌ Multiple actions test failed: {e}")
            return False
    
    async def test_search_before_action(self):
        """Test search before action functionality."""
        print("\n🧪 Testing Search Before Action")
        
        # Create test task
        test_task = Task(
            id="test_task_2",
            project_id=self.project_id,
            title="API Authentication",
            description="Implement API authentication system",
            status="pending",
            priority="high",
            completed=False,
            order=0,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Create context with the task
        context = self.create_test_context(tasks=[test_task])
        
        # Test message that requires search first
        message = "Change the status of the API authentication task to in progress"
        
        try:
            result = await self.agent._execute_direct_action(message, context, self.project_id)
            
            print(f"Result: {json.dumps(result, indent=2)}")
            
            # Verify the result
            assert result["action_type"] in ["single_action", "multiple_actions"], f"Unexpected action type: {result['action_type']}"
            assert result["tool_calls_made"] > 0, "No tool calls were made"
            
            print("✅ Search before action test passed")
            return True
            
        except Exception as e:
            print(f"❌ Search before action test failed: {e}")
            return False
    
    async def test_fallback_detection(self):
        """Test fallback action detection when LLM fails."""
        print("\n🧪 Testing Fallback Detection")
        
        # Create test context
        context = self.create_test_context()
        
        # Test simple completion message
        message = "Mark the login task as done"
        
        try:
            result = await self.agent._execute_direct_action(message, context, self.project_id)
            
            print(f"Result: {json.dumps(result, indent=2)}")
            
            # Verify the result - the LLM-based system should handle this
            assert result["action_type"] in ["single_action", "multiple_actions", "task_completion"], f"Unexpected action type: {result['action_type']}"
            assert result["tool_calls_made"] > 0, "No tool calls were made"
            
            print("✅ Fallback detection test passed")
            return True
            
        except Exception as e:
            print(f"❌ Fallback detection test failed: {e}")
            return False
    
    async def run_all_tests(self):
        """Run all tests and report results."""
        print("🚀 Starting Enhanced Direct Action Tests")
        print("=" * 50)
        
        tests = [
            ("Task Creation", self.test_task_creation),
            ("Task Status Update", self.test_task_status_update),
            ("Memory Creation", self.test_memory_creation),
            ("Memory Update", self.test_memory_update),
            ("Multiple Actions", self.test_multiple_actions),
            ("Search Before Action", self.test_search_before_action),
            ("Fallback Detection", self.test_fallback_detection),
        ]
        
        results = []
        
        for test_name, test_func in tests:
            try:
                success = await test_func()
                results.append((test_name, success))
            except Exception as e:
                print(f"❌ {test_name} test crashed: {e}")
                results.append((test_name, False))
        
        # Report results
        print("\n" + "=" * 50)
        print("📊 Test Results Summary")
        print("=" * 50)
        
        passed = 0
        total = len(results)
        
        for test_name, success in results:
            status = "✅ PASSED" if success else "❌ FAILED"
            print(f"{test_name}: {status}")
            if success:
                passed += 1
        
        print(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! Enhanced direct action execution is working correctly.")
        else:
            print("⚠️  Some tests failed. Please review the implementation.")
        
        return passed == total


async def main():
    """Main test runner."""
    tester = TestEnhancedDirectAction()
    success = await tester.run_all_tests()
    
    if success:
        print("\n✅ Enhanced direct action execution is ready for production!")
        sys.exit(0)
    else:
        print("\n❌ Enhanced direct action execution needs fixes.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main()) 