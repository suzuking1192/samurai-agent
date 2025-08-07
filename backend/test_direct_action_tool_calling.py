#!/usr/bin/env python3
"""
Test file for direct action tool calling functionality.
Tests the updated handle_direct_action method with actual tool execution.
"""

import asyncio
import json
import sys
import os
from unittest.mock import Mock, AsyncMock, patch
from typing import List, Dict, Any

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext, ChatMessage
from services.agent_tools import AgentToolRegistry
from models import Task, Memory

class MockToolRegistry:
    """Mock tool registry for testing."""
    
    def __init__(self):
        self.created_tasks = []
        self.updated_tasks = []
        self.deleted_tasks = []
        self.created_memories = []
        self.updated_memories = []
        self.deleted_memories = []
        self.search_results = []
        
    def get_available_tools(self) -> List[str]:
        return [
            "create_task", "update_task", "change_task_status", "search_tasks", "delete_task",
            "create_memory", "update_memory", "search_memories", "delete_memory"
        ]
    
    def execute_tool(self, tool_name: str, **kwargs) -> Dict[str, Any]:
        """Mock tool execution."""
        project_id = kwargs.get("project_id", "test_project")
        
        if tool_name == "create_task":
            task = {
                "id": f"task_{len(self.created_tasks) + 1}",
                "title": kwargs.get("title", "Test Task"),
                "description": kwargs.get("description", "Test Description"),
                "status": kwargs.get("status", "pending"),
                "project_id": project_id
            }
            self.created_tasks.append(task)
            return {
                "success": True,
                "message": f"✅ Created task: {task['title']}",
                "task": task
            }
            
        elif tool_name == "update_task":
            task_id = kwargs.get("task_identifier", "task_1")
            task = {
                "id": task_id,
                "title": kwargs.get("title", "Updated Task"),
                "description": kwargs.get("description", "Updated Description"),
                "status": kwargs.get("status", "in_progress"),
                "project_id": project_id
            }
            self.updated_tasks.append(task)
            return {
                "success": True,
                "message": f"✅ Updated task: {task['title']}",
                "task": task
            }
            
        elif tool_name == "delete_task":
            task_id = kwargs.get("task_identifier", "task_1")
            self.deleted_tasks.append(task_id)
            return {
                "success": True,
                "message": f"✅ Deleted task: {task_id}"
            }
            
        elif tool_name == "create_memory":
            memory = {
                "id": f"memory_{len(self.created_memories) + 1}",
                "title": kwargs.get("title", "Test Memory"),
                "content": kwargs.get("content", "Test Content"),
                "category": kwargs.get("category", "note"),
                "project_id": project_id
            }
            self.created_memories.append(memory)
            return {
                "success": True,
                "message": f"✅ Created memory: {memory['title']}",
                "memory": memory
            }
            
        elif tool_name == "update_memory":
            memory_id = kwargs.get("memory_identifier", "memory_1")
            memory = {
                "id": memory_id,
                "title": kwargs.get("title", "Updated Memory"),
                "content": kwargs.get("content", "Updated Content"),
                "category": kwargs.get("category", "note"),
                "project_id": project_id
            }
            self.updated_memories.append(memory)
            return {
                "success": True,
                "message": f"✅ Updated memory: {memory['title']}",
                "memory": memory
            }
            
        elif tool_name == "search_tasks":
            query = kwargs.get("query", "")
            # Return mock search results
            results = [
                {"id": "task_1", "title": "Login Task", "description": "Implement user login"},
                {"id": "task_2", "title": "Dashboard Task", "description": "Create dashboard"}
            ]
            return {
                "success": True,
                "tasks": results,
                "message": f"Found {len(results)} tasks matching '{query}'"
            }
            
        elif tool_name == "search_memories":
            query = kwargs.get("query", "")
            # Return mock search results
            results = [
                {"id": "memory_1", "title": "JWT Decision", "content": "Use JWT for authentication"},
                {"id": "memory_2", "title": "Database Choice", "content": "Use PostgreSQL"}
            ]
            return {
                "success": True,
                "memories": results,
                "message": f"Found {len(results)} memories matching '{query}'"
            }
            
        else:
            return {
                "success": False,
                "message": f"❌ Unknown tool: {tool_name}"
            }

class TestDirectActionToolCalling:
    """Test class for direct action tool calling functionality."""
    
    def __init__(self):
        """Initialize test environment."""
        self.agent = UnifiedSamuraiAgent()
        self.mock_tool_registry = MockToolRegistry()
        self.agent.tool_registry = self.mock_tool_registry
        
        # Mock the Gemini service
        self.agent.gemini_service = Mock()
        self.agent.gemini_service.chat_with_system_prompt = AsyncMock()
        
        # Create mock context
        self.context = ConversationContext(
            session_messages=[],
            conversation_summary="Test conversation",
            relevant_tasks=[],
            relevant_memories=[],
            project_context={"name": "Test Project", "tech_stack": "Python"}
        )
        
        self.project_id = "test_project_123"
    
    async def test_task_creation_and_update_simultaneously(self):
        """Test 1: User asks for task creation and task update at the same time."""
        print("\n🧪 Test 1: Task Creation and Update Simultaneously")
        
        # Reset mock registry for this test
        self.mock_tool_registry.created_tasks = []
        self.mock_tool_registry.updated_tasks = []
        self.mock_tool_registry.deleted_tasks = []
        self.mock_tool_registry.created_memories = []
        self.mock_tool_registry.updated_memories = []
        self.mock_tool_registry.deleted_memories = []
        
        # Mock LLM response for task creation and update
        mock_response = {
            "actions_detected": True,
            "action_count": 2,
            "confidence": 0.9,
            "reasoning": "User wants to create a new task and update an existing one",
            "actions": [
                {
                    "tool_name": "create_task",
                    "parameters": {
                        "title": "New Authentication Task",
                        "description": "Implement OAuth2 authentication",
                        "status": "pending",
                        "project_id": self.project_id
                    },
                    "description": "Create new authentication task"
                },
                {
                    "tool_name": "update_task",
                    "parameters": {
                        "task_identifier": "task_1",
                        "title": "Updated Login Task",
                        "description": "Enhanced login with 2FA",
                        "status": "in_progress",
                        "project_id": self.project_id
                    },
                    "description": "Update existing login task"
                }
            ]
        }
        
        self.agent.gemini_service.chat_with_system_prompt.return_value = json.dumps(mock_response)
        
        # Test the direct action
        message = "Create a new authentication task and update the login task to include 2FA"
        result = await self.agent._handle_direct_action(message, self.context, self.project_id)
        
        # Verify results
        print(f"Response: {result['response']}")
        print(f"Tool calls made: {result['tool_calls_made']}")
        print(f"Tool results: {len(result['tool_results'])}")
        
        # Assertions
        assert result['type'] == 'direct_action_response'
        assert result['tool_calls_made'] == 2
        assert len(result['tool_results']) == 2
        assert len(self.mock_tool_registry.created_tasks) == 1
        assert len(self.mock_tool_registry.updated_tasks) == 1
        
        # Check created task
        created_task = self.mock_tool_registry.created_tasks[0]
        assert created_task['title'] == "New Authentication Task"
        assert created_task['description'] == "Implement OAuth2 authentication"
        
        # Check updated task
        updated_task = self.mock_tool_registry.updated_tasks[0]
        assert updated_task['title'] == "Updated Login Task"
        assert updated_task['description'] == "Enhanced login with 2FA"
        
        print("✅ Test 1 PASSED: Task creation and update worked simultaneously")
    
    async def test_task_deletion_and_memory_update(self):
        """Test 2: User asks for task deletion and memory update."""
        print("\n🧪 Test 2: Task Deletion and Memory Update")
        
        # Reset mock registry for this test
        self.mock_tool_registry.created_tasks = []
        self.mock_tool_registry.updated_tasks = []
        self.mock_tool_registry.deleted_tasks = []
        self.mock_tool_registry.created_memories = []
        self.mock_tool_registry.updated_memories = []
        self.mock_tool_registry.deleted_memories = []
        
        # Mock LLM response for task deletion and memory update
        mock_response = {
            "actions_detected": True,
            "action_count": 2,
            "confidence": 0.85,
            "reasoning": "User wants to delete an old task and create a memory about the decision",
            "actions": [
                {
                    "tool_name": "delete_task",
                    "parameters": {
                        "task_identifier": "task_1",
                        "project_id": self.project_id
                    },
                    "description": "Delete old authentication task"
                },
                {
                    "tool_name": "create_memory",
                    "parameters": {
                        "title": "Authentication Decision",
                        "content": "Decided to remove old authentication approach in favor of OAuth2",
                        "category": "decision",
                        "project_id": self.project_id
                    },
                    "description": "Create memory about authentication decision"
                }
            ]
        }
        
        self.agent.gemini_service.chat_with_system_prompt.return_value = json.dumps(mock_response)
        
        # Test the direct action
        message = "Delete the old authentication task and create a memory about our decision to use OAuth2"
        result = await self.agent._handle_direct_action(message, self.context, self.project_id)
        
        # Verify results
        print(f"Response: {result['response']}")
        print(f"Tool calls made: {result['tool_calls_made']}")
        print(f"Tool results: {len(result['tool_results'])}")
        
        # Assertions
        assert result['type'] == 'direct_action_response'
        assert result['tool_calls_made'] == 2
        assert len(result['tool_results']) == 2
        assert len(self.mock_tool_registry.deleted_tasks) == 1
        assert len(self.mock_tool_registry.created_memories) == 1
        
        # Check deleted task
        deleted_task_id = self.mock_tool_registry.deleted_tasks[0]
        assert deleted_task_id == "task_1"
        
        # Check created memory
        created_memory = self.mock_tool_registry.created_memories[0]
        assert created_memory['title'] == "Authentication Decision"
        assert created_memory['content'] == "Decided to remove old authentication approach in favor of OAuth2"
        assert created_memory['category'] == "decision"
        
        print("✅ Test 2 PASSED: Task deletion and memory update worked")
    
    async def test_multiple_task_updates(self):
        """Test 3: User asks to update multiple tasks."""
        print("\n🧪 Test 3: Multiple Task Updates")
        
        # Reset mock registry for this test
        self.mock_tool_registry.created_tasks = []
        self.mock_tool_registry.updated_tasks = []
        self.mock_tool_registry.deleted_tasks = []
        self.mock_tool_registry.created_memories = []
        self.mock_tool_registry.updated_memories = []
        self.mock_tool_registry.deleted_memories = []
        
        # Mock LLM response for multiple task updates
        mock_response = {
            "actions_detected": True,
            "action_count": 3,
            "confidence": 0.9,
            "reasoning": "User wants to update multiple tasks with new statuses",
            "actions": [
                {
                    "tool_name": "update_task",
                    "parameters": {
                        "task_identifier": "task_1",
                        "title": "Login Task",
                        "description": "User login implementation",
                        "status": "completed",
                        "project_id": self.project_id
                    },
                    "description": "Mark login task as completed"
                },
                {
                    "tool_name": "update_task",
                    "parameters": {
                        "task_identifier": "task_2",
                        "title": "Dashboard Task",
                        "description": "Admin dashboard",
                        "status": "in_progress",
                        "project_id": self.project_id
                    },
                    "description": "Update dashboard task status"
                },
                {
                    "tool_name": "update_task",
                    "parameters": {
                        "task_identifier": "task_3",
                        "title": "API Task",
                        "description": "REST API endpoints",
                        "status": "blocked",
                        "project_id": self.project_id
                    },
                    "description": "Mark API task as blocked"
                }
            ]
        }
        
        self.agent.gemini_service.chat_with_system_prompt.return_value = json.dumps(mock_response)
        
        # Test the direct action
        message = "Mark the login task as completed, set dashboard to in progress, and block the API task"
        result = await self.agent._handle_direct_action(message, self.context, self.project_id)
        
        # Verify results
        print(f"Response: {result['response']}")
        print(f"Tool calls made: {result['tool_calls_made']}")
        print(f"Tool results: {len(result['tool_results'])}")
        
        # Assertions
        assert result['type'] == 'direct_action_response'
        assert result['tool_calls_made'] == 3
        assert len(result['tool_results']) == 3
        assert len(self.mock_tool_registry.updated_tasks) == 3
        
        # Check all updated tasks
        updated_tasks = self.mock_tool_registry.updated_tasks
        assert len(updated_tasks) == 3
        
        # Verify task statuses
        task_statuses = {task['id']: task['status'] for task in updated_tasks}
        assert task_statuses.get('task_1') == 'completed'
        assert task_statuses.get('task_2') == 'in_progress'
        assert task_statuses.get('task_3') == 'blocked'
        
        print("✅ Test 3 PASSED: Multiple task updates worked")
    
    async def test_search_before_action(self):
        """Test 4: Test search functionality before action execution."""
        print("\n🧪 Test 4: Search Before Action")
        
        # Reset mock registry for this test
        self.mock_tool_registry.created_tasks = []
        self.mock_tool_registry.updated_tasks = []
        self.mock_tool_registry.deleted_tasks = []
        self.mock_tool_registry.created_memories = []
        self.mock_tool_registry.updated_memories = []
        self.mock_tool_registry.deleted_memories = []
        
        # Mock LLM response with search requirement
        mock_response = {
            "actions_detected": True,
            "action_count": 1,
            "confidence": 0.8,
            "reasoning": "User wants to update a task but needs to search for it first",
            "actions": [
                {
                    "tool_name": "update_task",
                    "parameters": {
                        "project_id": self.project_id
                    },
                    "requires_search_first": True,
                    "search_tool": "search_tasks",
                    "search_query": "login authentication",
                    "description": "Update login task after finding it"
                }
            ]
        }
        
        self.agent.gemini_service.chat_with_system_prompt.return_value = json.dumps(mock_response)
        
        # Test the direct action
        message = "Update the login task to include 2FA"
        result = await self.agent._handle_direct_action(message, self.context, self.project_id)
        
        # Verify results
        print(f"Response: {result['response']}")
        print(f"Tool calls made: {result['tool_calls_made']}")
        
        # Assertions
        assert result['type'] == 'direct_action_response'
        assert result['tool_calls_made'] >= 1  # At least search + update
        
        print("✅ Test 4 PASSED: Search before action worked")
    
    async def test_no_actions_detected(self):
        """Test 5: Test when no actions are detected."""
        print("\n🧪 Test 5: No Actions Detected")
        
        # Reset mock registry for this test
        self.mock_tool_registry.created_tasks = []
        self.mock_tool_registry.updated_tasks = []
        self.mock_tool_registry.deleted_tasks = []
        self.mock_tool_registry.created_memories = []
        self.mock_tool_registry.updated_memories = []
        self.mock_tool_registry.deleted_memories = []
        
        # Mock LLM response with no actions
        mock_response = {
            "actions_detected": False,
            "action_count": 0,
            "confidence": 0.1,
            "reasoning": "No clear action detected in the request",
            "actions": []
        }
        
        self.agent.gemini_service.chat_with_system_prompt.return_value = json.dumps(mock_response)
        
        # Test the direct action
        message = "Hello, how are you today?"
        result = await self.agent._handle_direct_action(message, self.context, self.project_id)
        
        # Verify results
        print(f"Response: {result['response']}")
        print(f"Tool calls made: {result['tool_calls_made']}")
        
        # Assertions
        assert result['type'] == 'direct_action_response'
        assert result['tool_calls_made'] == 0
        assert "not sure what specific action" in result['response'].lower()
        
        print("✅ Test 5 PASSED: No actions detected handled correctly")

async def run_all_tests():
    """Run all direct action tests."""
    print("🚀 Starting Direct Action Tool Calling Tests")
    print("=" * 60)
    
    # Create test instance and run each test
    test_instance = TestDirectActionToolCalling()
    
    # Run all tests
    await test_instance.test_task_creation_and_update_simultaneously()
    await test_instance.test_task_deletion_and_memory_update()
    await test_instance.test_multiple_task_updates()
    await test_instance.test_search_before_action()
    await test_instance.test_no_actions_detected()
    
    print("\n" + "=" * 60)
    print("🎉 All Direct Action Tool Calling Tests Completed Successfully!")
    print("✅ The handle_direct_action method now properly executes tool calls")

if __name__ == "__main__":
    asyncio.run(run_all_tests())
