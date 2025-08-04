"""
Integration test demonstrating the context understanding and tool calling fixes.

This test shows the enhanced agent correctly handling the problematic conversation scenarios:
1. Understanding "those tasks" references
2. Using tools instead of explaining
3. Taking action instead of asking for clarification
"""

import pytest
import asyncio
import json
from typing import List, Dict, Any

try:
    from services.enhanced_contextual_agent import EnhancedContextualAgent, ContextUnderstandingService
    from services.agent_tools import AgentToolRegistry
    from models import Task, Memory, Project
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from services.enhanced_contextual_agent import EnhancedContextualAgent, ContextUnderstandingService
    from services.agent_tools import AgentToolRegistry
    from models import Task, Memory, Project


class MockToolRegistry:
    """Mock tool registry for testing"""
    
    def __init__(self):
        self.created_tasks = []
        self.created_memories = []
    
    def execute_tool(self, tool_name: str, **kwargs):
        """Mock tool execution"""
        if tool_name == "create_task":
            task_id = f"task_{len(self.created_tasks) + 1}"
            task = {
                "success": True,
                "task_id": task_id,
                "title": kwargs.get("title", "New task"),
                "description": kwargs.get("description", ""),
                "project_id": kwargs.get("project_id", "test-project")
            }
            self.created_tasks.append(task)
            return task
        
        elif tool_name == "create_memory":
            memory_id = f"memory_{len(self.created_memories) + 1}"
            memory = {
                "success": True,
                "memory_id": memory_id,
                "title": kwargs.get("title", "New memory"),
                "content": kwargs.get("content", ""),
                "project_id": kwargs.get("project_id", "test-project")
            }
            self.created_memories.append(memory)
            return memory
        
        else:
            return {
                "success": False,
                "message": f"Tool {tool_name} not implemented in mock"
            }


class MockGeminiService:
    """Mock Gemini service for testing"""
    
    def __init__(self):
        self.context_responses = {
            "those_tasks": {
                "referenced_items": ["Define JSON structure", "Implement session ID generation", "Wire up start conversation button"],
                "user_intent": "create_tasks",
                "context_clarity": "high",
                "action_items": ["Define JSON structure", "Implement session ID generation", "Wire up start conversation button"],
                "confidence": 0.9
            },
            "those_features": {
                "referenced_items": ["User registration", "Login/logout", "Password reset"],
                "user_intent": "create_tasks",
                "context_clarity": "high",
                "action_items": ["User registration", "Login/logout", "Password reset"],
                "confidence": 0.9
            },
            "those_memories": {
                "referenced_items": ["login system", "password reset functionality"],
                "user_intent": "create_memory",
                "context_clarity": "high",
                "action_items": ["login system", "password reset functionality"],
                "confidence": 0.8
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
            },
            "create_memory": {
                "requires_tools": True,
                "tool_calls": [
                    {
                        "tool": "create_memory",
                        "parameters": {},
                        "reasoning": "User wants to create memory for referenced items"
                    }
                ],
                "confidence": 0.8
            }
        }
    
    async def chat_with_system_prompt(self, prompt: str, system_prompt: str) -> str:
        """Mock text generation"""
        if "context" in prompt.lower() and "conversation" in prompt.lower():
            # Context extraction
            if "those tasks" in prompt.lower():
                return json.dumps(self.context_responses["those_tasks"])
            elif "those features" in prompt.lower():
                return json.dumps(self.context_responses["those_features"])
            elif "those" in prompt.lower() and "memory" in prompt.lower():
                return json.dumps(self.context_responses["those_memories"])
            else:
                return json.dumps({
                    "referenced_items": [],
                    "user_intent": "unknown",
                    "context_clarity": "low",
                    "action_items": [],
                    "confidence": 0.0
                })
        
        elif "tool" in prompt.lower() and "detection" in prompt.lower():
            # Tool detection
            if "create those tasks" in prompt.lower() or "create tasks" in prompt.lower():
                return json.dumps(self.tool_detection_responses["create_tasks"])
            elif "add those to memory" in prompt.lower() or "create memory" in prompt.lower():
                return json.dumps(self.tool_detection_responses["create_memory"])
            else:
                return json.dumps({
                    "requires_tools": False,
                    "tool_calls": [],
                    "confidence": 0.0
                })
        
        else:
            return "Mock response"


class TestContextFixesIntegration:
    """Integration tests for context understanding and tool calling fixes"""
    
    def setup_method(self):
        """Set up test environment"""
        self.mock_tool_registry = MockToolRegistry()
        self.mock_gemini_service = MockGeminiService()
        
        # Create enhanced agent with mocks
        self.agent = EnhancedContextualAgent()
        self.agent.tool_registry = self.mock_tool_registry
        self.agent.context_service.gemini_service = self.mock_gemini_service
        self.agent.gemini_service = self.mock_gemini_service
    
    async def test_problematic_conversation_fix(self):
        """
        Test the exact problematic conversation scenario that was failing
        """
        print("=== Testing Problematic Conversation Fix ===")
        
        # The problematic conversation
        conversation = [
            {
                "role": "assistant",
                "content": "Next steps could involve: 1. Define the JSON structure 2. Implement session ID generation 3. Wire up start conversation button"
            },
            {
                "role": "user", 
                "content": "Can you create those tasks for me?"
            }
        ]
        
        # Process with enhanced agent
        result = await self.agent.process_message_with_context(
            user_message="Can you create those tasks for me?",
            conversation_history=conversation,
            project_id="test-project",
            memories=[],
            tasks=[]
        )
        
        print(f"Agent response: {result['response']}")
        print(f"Tool calls made: {result['tool_calls_made']}")
        print(f"Context used: {result['context_used']}")
        
        # Verify the fix works
        assert result['tool_calls_made'] > 0, "Agent should have used tools"
        assert "created" in result['response'].lower(), "Response should indicate task creation"
        assert "JSON structure" in result['response'], "Should mention JSON structure task"
        assert "session ID" in result['response'], "Should mention session ID task"
        assert "start conversation" in result['response'], "Should mention start conversation task"
        
        # Verify tasks were actually created
        assert len(self.mock_tool_registry.created_tasks) == 3, "Should have created 3 tasks"
        
        print("✅ Problematic conversation fix test passed")
    
    async def test_authentication_features_conversation(self):
        """
        Test another conversation scenario with feature references
        """
        print("=== Testing Authentication Features Conversation ===")
        
        conversation = [
            {
                "role": "assistant",
                "content": "For the authentication system, you'll need: 1. User registration 2. Login/logout 3. Password reset"
            },
            {
                "role": "user",
                "content": "Create tasks for those features"
            }
        ]
        
        result = await self.agent.process_message_with_context(
            user_message="Create tasks for those features",
            conversation_history=conversation,
            project_id="test-project",
            memories=[],
            tasks=[]
        )
        
        print(f"Agent response: {result['response']}")
        print(f"Tool calls made: {result['tool_calls_made']}")
        
        # Verify the fix works
        assert result['tool_calls_made'] > 0, "Agent should have used tools"
        assert "created" in result['response'].lower(), "Response should indicate task creation"
        assert "authentication" in result['response'].lower(), "Should reference authentication context"
        
        # Verify tasks were created
        assert len(self.mock_tool_registry.created_tasks) == 3, "Should have created 3 authentication tasks"
        
        print("✅ Authentication features conversation test passed")
    
    async def test_memory_creation_conversation(self):
        """
        Test memory creation from conversation context
        """
        print("=== Testing Memory Creation Conversation ===")
        
        conversation = [
            {
                "role": "assistant",
                "content": "The issue is with the login system and password reset functionality"
            },
            {
                "role": "user",
                "content": "Add those to memory"
            }
        ]
        
        result = await self.agent.process_message_with_context(
            user_message="Add those to memory",
            conversation_history=conversation,
            project_id="test-project",
            memories=[],
            tasks=[]
        )
        
        print(f"Agent response: {result['response']}")
        print(f"Tool calls made: {result['tool_calls_made']}")
        
        # Verify the fix works
        assert result['tool_calls_made'] > 0, "Agent should have used tools"
        assert "created" in result['response'].lower(), "Response should indicate memory creation"
        
        # Verify memory was created
        assert len(self.mock_tool_registry.created_memories) > 0, "Should have created memory"
        
        print("✅ Memory creation conversation test passed")
    
    async def test_unclear_context_handling(self):
        """
        Test handling of unclear context (should ask for clarification)
        """
        print("=== Testing Unclear Context Handling ===")
        
        # Conversation with unclear context
        conversation = [
            {
                "role": "user",
                "content": "Can you create those tasks?"
            }
        ]
        
        result = await self.agent.process_message_with_context(
            user_message="Can you create those tasks?",
            conversation_history=conversation,
            project_id="test-project",
            memories=[],
            tasks=[]
        )
        
        print(f"Agent response: {result['response']}")
        print(f"Tool calls made: {result['tool_calls_made']}")
        
        # Should handle unclear context gracefully
        assert result['tool_calls_made'] == 0, "Should not use tools when context is unclear"
        assert "specific" in result['response'].lower() or "clarify" in result['response'].lower(), "Should ask for clarification"
        
        print("✅ Unclear context handling test passed")
    
    async def test_context_extraction_accuracy(self):
        """
        Test accuracy of context extraction
        """
        print("=== Testing Context Extraction Accuracy ===")
        
        context_service = ContextUnderstandingService()
        context_service.gemini_service = self.mock_gemini_service
        
        # Test context extraction
        conversation = [
            {
                "role": "assistant",
                "content": "Next steps could involve: 1. Define the JSON structure 2. Implement session ID generation 3. Wire up start conversation button"
            },
            {
                "role": "user", 
                "content": "Can you create those tasks for me?"
            }
        ]
        
        context_result = await context_service.extract_conversation_context(conversation)
        
        print(f"Context extracted: {context_result}")
        
        # Verify context extraction
        assert context_result['user_intent'] == 'create_tasks', "Should detect create_tasks intent"
        assert context_result['context_clarity'] == 'high', "Should have high context clarity"
        assert len(context_result['referenced_items']) == 3, "Should extract 3 referenced items"
        assert "JSON structure" in str(context_result['referenced_items']), "Should include JSON structure"
        assert "session ID" in str(context_result['referenced_items']), "Should include session ID"
        assert "start conversation" in str(context_result['referenced_items']), "Should include start conversation"
        
        print("✅ Context extraction accuracy test passed")
    
    async def test_tool_detection_accuracy(self):
        """
        Test accuracy of tool detection
        """
        print("=== Testing Tool Detection Accuracy ===")
        
        context_service = ContextUnderstandingService()
        context_service.gemini_service = self.mock_gemini_service
        
        # Test tool detection with context
        context_info = {
            "referenced_items": ["Define JSON structure", "Implement session ID generation"],
            "user_intent": "create_tasks",
            "context_clarity": "high"
        }
        
        tool_result = await context_service.detect_tool_usage_intent(
            "Can you create those tasks for me?", 
            context_info
        )
        
        print(f"Tool detection result: {tool_result}")
        
        # Verify tool detection
        assert tool_result['requires_tools'] == True, "Should detect need for tools"
        assert len(tool_result['tool_calls']) > 0, "Should have tool calls"
        assert tool_result['tool_calls'][0]['tool'] == 'create_task', "Should detect create_task tool"
        
        print("✅ Tool detection accuracy test passed")


# Main test runner
async def run_integration_tests():
    """
    Run all integration tests
    """
    print("🧪 Running Context Fixes Integration Tests")
    print("=" * 60)
    
    test_instance = TestContextFixesIntegration()
    
    test_methods = [
        test_instance.test_problematic_conversation_fix,
        test_instance.test_authentication_features_conversation,
        test_instance.test_memory_creation_conversation,
        test_instance.test_unclear_context_handling,
        test_instance.test_context_extraction_accuracy,
        test_instance.test_tool_detection_accuracy
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
    print(f"📊 Integration Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All integration tests passed! Context understanding and tool calling fixes are working.")
    else:
        print("⚠️  Some integration tests failed. Review the issues above.")
    
    return passed, failed


if __name__ == "__main__":
    # Run integration tests
    asyncio.run(run_integration_tests()) 