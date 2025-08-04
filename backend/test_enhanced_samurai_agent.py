"""
Test the enhanced SamuraiAgent with context understanding and tool calling capabilities.

This test verifies that the existing SamuraiAgent has been properly enhanced with:
1. Context understanding for "those tasks" references
2. Tool calling when appropriate
3. Action-taking instead of clarification requests
"""

import pytest
import asyncio
import json
from typing import List, Dict, Any

try:
    from services.ai_agent import SamuraiAgent
    from models import Task, Memory, Project, MemoryCategory
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from services.ai_agent import SamuraiAgent
    from models import Task, Memory, Project, MemoryCategory


class MockFileService:
    """Mock file service for testing"""
    
    def __init__(self):
        self.chat_history = {}
        self.tasks = {}
        self.memories = {}
    
    def load_chat_history(self, project_id: str):
        """Mock chat history loading"""
        return self.chat_history.get(project_id, [])
    
    def save_chat_message(self, project_id: str, message):
        """Mock chat message saving"""
        if project_id not in self.chat_history:
            self.chat_history[project_id] = []
        self.chat_history[project_id].append(message)
    
    def load_tasks(self, project_id: str):
        """Mock tasks loading"""
        return self.tasks.get(project_id, [])
    
    def save_tasks(self, project_id: str, tasks):
        """Mock tasks saving"""
        self.tasks[project_id] = tasks
    
    def load_memories(self, project_id: str):
        """Mock memories loading"""
        return self.memories.get(project_id, [])
    
    def save_memories(self, project_id: str, memories):
        """Mock memories saving"""
        self.memories[project_id] = memories


class MockGeminiService:
    """Mock Gemini service for testing"""
    
    def __init__(self):
        self.context_responses = {
            "those_tasks": {
                "referenced_items": ["Define JSON structure", "Implement session ID generation", "Wire up start conversation button"],
                "user_intent": "create_tasks",
                "context_clarity": "high"
            },
            "those_features": {
                "referenced_items": ["User registration", "Login/logout", "Password reset"],
                "user_intent": "create_tasks",
                "context_clarity": "high"
            }
        }
        
        self.tool_detection_responses = {
            "create_tasks": {
                "requires_tools": True,
                "tool_calls": [
                    {
                        "tool": "create_task",
                        "parameters": {},
                        "reasoning": "User wants to create tasks for referenced items"
                    }
                ],
                "confidence": 0.9
            }
        }
        
        self.response_responses = {
            "task_creation": "✅ I've created 3 tasks for you:\n\n1. Define JSON structure\n2. Implement session ID generation\n3. Wire up start conversation button\n\nThese tasks are now available in your task panel."
        }
    
    async def chat_with_system_prompt(self, prompt: str, system_prompt: str) -> str:
        """Mock chat with system prompt"""
        if "context" in prompt.lower() and "conversation" in prompt.lower():
            # Context extraction
            if "JSON structure" in prompt.lower() or "session ID" in prompt.lower():
                return json.dumps(self.context_responses["those_tasks"])
            elif "User registration" in prompt.lower() or "Login/logout" in prompt.lower():
                return json.dumps(self.context_responses["those_features"])
            else:
                return json.dumps({
                    "referenced_items": [],
                    "user_intent": "unknown",
                    "context_clarity": "low"
                })
        
        elif "tool" in prompt.lower() and "detection" in prompt.lower():
            # Tool detection
            if "create those tasks" in prompt.lower() or "create tasks" in prompt.lower():
                return json.dumps(self.tool_detection_responses["create_tasks"])
            elif "create those features" in prompt.lower():
                return json.dumps(self.tool_detection_responses["create_tasks"])
            elif "JSON structure" in prompt.lower() or "session ID" in prompt.lower():
                return json.dumps(self.tool_detection_responses["create_tasks"])
            else:
                return json.dumps({
                    "requires_tools": False,
                    "tool_calls": [],
                    "confidence": 0.0
                })
        
        elif "response" in prompt.lower() and "actions" in prompt.lower():
            # Response generation
            return self.response_responses["task_creation"]
        
        else:
            return "Mock response"


class TestEnhancedSamuraiAgent:
    """Test the enhanced SamuraiAgent"""
    
    def setup_method(self):
        """Set up test environment"""
        self.mock_file_service = MockFileService()
        self.mock_gemini_service = MockGeminiService()
        
        # Create enhanced agent with mocks
        self.agent = SamuraiAgent()
        self.agent.file_service = self.mock_file_service
        self.agent.gemini_service = self.mock_gemini_service
        # Also mock the enhanced agent's gemini service
        self.agent.enhanced_agent.gemini_service = self.mock_gemini_service
        
        # Set up test project
        self.test_project_id = "test-project"
        
        # Add some conversation history
        from models import ChatMessage
        from datetime import datetime
        
        # Add assistant message with numbered tasks
        assistant_message = ChatMessage(
            id="msg1",
            project_id=self.test_project_id,
            message="",
            response="Next steps could involve: 1. Define the JSON structure 2. Implement session ID generation 3. Wire up start conversation button",
            created_at=datetime.now()
        )
        
        self.mock_file_service.save_chat_message(self.test_project_id, assistant_message)
    
    async def test_context_extraction(self):
        """Test context extraction from conversation history"""
        print("=== Testing Context Extraction ===")
        
        # Get conversation history
        conversation_history = self.agent._get_conversation_history_for_planning(self.test_project_id, max_messages=10)
        
        # Extract context
        context_info = await self.agent.extract_conversation_context(conversation_history)
        
        print(f"Context extracted: {context_info}")
        
        # Verify context extraction
        assert context_info['user_intent'] == 'create_tasks', "Should detect create_tasks intent"
        assert len(context_info['referenced_items']) == 3, "Should extract 3 referenced items"
        assert "JSON structure" in str(context_info['referenced_items']), "Should include JSON structure"
        assert "session ID" in str(context_info['referenced_items']), "Should include session ID"
        assert "start conversation" in str(context_info['referenced_items']), "Should include start conversation"
        
        print("✅ Context extraction test passed")
    
    async def test_tool_detection_with_context(self):
        """Test tool detection with context"""
        print("=== Testing Tool Detection with Context ===")
        
        # Create context info
        context_info = {
            "referenced_items": ["Define JSON structure", "Implement session ID generation", "Wire up start conversation button"],
            "user_intent": "create_tasks",
            "context_clarity": "high"
        }
        
        # Test tool detection
        tool_plan = await self.agent.should_use_tools_enhanced(
            "Can you create those tasks for me?", 
            context_info
        )
        
        print(f"Tool plan: {tool_plan}")
        
        # Verify tool detection
        assert tool_plan['requires_tools'] == True, "Should detect need for tools"
        assert len(tool_plan['tool_calls']) > 0, "Should have tool calls"
        assert tool_plan['tool_calls'][0]['tool'] == 'create_task', "Should detect create_task tool"
        
        print("✅ Tool detection test passed")
    
    async def test_task_creation_tool(self):
        """Test task creation tool execution"""
        print("=== Testing Task Creation Tool ===")
        
        # Test task creation
        result = await self.agent.create_task_tool(
            title="Test Task",
            description="Test task description",
            project_id=self.test_project_id
        )
        
        print(f"Task creation result: {result}")
        
        # Verify task creation
        assert result['success'] == True, "Task creation should succeed"
        assert result['tool'] == 'create_task', "Should be create_task tool"
        assert result['title'] == 'Test Task', "Should have correct title"
        
        # Verify task was saved
        saved_tasks = self.mock_file_service.load_tasks(self.test_project_id)
        assert len(saved_tasks) == 1, "Should have saved 1 task"
        assert saved_tasks[0].title == 'Test Task', "Saved task should have correct title"
        
        print("✅ Task creation tool test passed")
    
    async def test_memory_creation_tool(self):
        """Test memory creation tool execution"""
        print("=== Testing Memory Creation Tool ===")
        
        # Test memory creation
        result = await self.agent.create_memory_tool(
            title="Test Memory",
            content="Test memory content",
            project_id=self.test_project_id
        )
        
        print(f"Memory creation result: {result}")
        
        # Verify memory creation
        assert result['success'] == True, "Memory creation should succeed"
        assert result['tool'] == 'create_memory', "Should be create_memory tool"
        assert result['title'] == 'Test Memory', "Should have correct title"
        
        # Verify memory was saved
        saved_memories = self.mock_file_service.load_memories(self.test_project_id)
        assert len(saved_memories) == 1, "Should have saved 1 memory"
        assert saved_memories[0].title == 'Test Memory', "Saved memory should have correct title"
        
        print("✅ Memory creation tool test passed")
    
    async def test_full_conversation_flow(self):
        """Test the complete conversation flow with context and tools"""
        print("=== Testing Full Conversation Flow ===")
        
        # Process message with context
        result = await self.agent.process_message(
            message="Can you create those tasks for me?",
            project_id=self.test_project_id,
            project_context={}
        )
        
        print(f"Agent response: {result['response']}")
        print(f"Tool calls made: {result['tool_calls_made']}")
        print(f"Context used: {result['context_used']}")
        
        # Verify the complete flow works
        assert result['tool_calls_made'] > 0, "Agent should have used tools"
        assert "created" in result['response'].lower(), "Response should indicate task creation"
        assert "JSON structure" in result['response'], "Should mention JSON structure task"
        assert "session ID" in result['response'], "Should mention session ID task"
        assert "start conversation" in result['response'], "Should mention start conversation task"
        
        # Verify tasks were actually created
        saved_tasks = self.mock_file_service.load_tasks(self.test_project_id)
        assert len(saved_tasks) == 3, "Should have created 3 tasks"
        
        print("✅ Full conversation flow test passed")
    
    async def test_enhanced_message_processing(self):
        """Test enhanced message processing with context"""
        print("=== Testing Enhanced Message Processing ===")
        
        # Test with context-aware request
        result = await self.agent.process_message(
            message="Create tasks for those features",
            project_id=self.test_project_id,
            project_context={}
        )
        
        print(f"Enhanced processing result: {result}")
        
        # Verify enhanced processing
        assert result['type'] == 'tool_response', "Should be tool response type"
        assert result['tool_calls_made'] > 0, "Should have made tool calls"
        assert 'context_used' in result, "Should include context information"
        
        print("✅ Enhanced message processing test passed")


async def run_enhanced_agent_tests():
    """Run all enhanced agent tests"""
    print("🧪 Testing Enhanced SamuraiAgent")
    print("=" * 60)
    
    test_instance = TestEnhancedSamuraiAgent()
    
    test_methods = [
        test_instance.test_context_extraction,
        test_instance.test_tool_detection_with_context,
        test_instance.test_task_creation_tool,
        test_instance.test_memory_creation_tool,
        test_instance.test_full_conversation_flow,
        test_instance.test_enhanced_message_processing
    ]
    
    passed = 0
    failed = 0
    
    for test_method in test_methods:
        try:
            test_instance.setup_method()
            await test_method()
            passed += 1
        except Exception as e:
            print(f"❌ {test_method.__name__} failed: {e}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"📊 Enhanced Agent Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All enhanced agent tests passed!")
        print("✅ SamuraiAgent has been successfully enhanced with:")
        print("   - Context understanding for 'those tasks' references")
        print("   - Tool calling when appropriate")
        print("   - Action-taking instead of clarification requests")
        print("   - Integration with existing functionality")
    else:
        print("⚠️  Some enhanced agent tests failed. Review the issues above.")
    
    return passed, failed


if __name__ == "__main__":
    # Run enhanced agent tests
    asyncio.run(run_enhanced_agent_tests()) 