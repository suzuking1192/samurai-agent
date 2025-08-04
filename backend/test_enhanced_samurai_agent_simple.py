"""
Simple test for the enhanced SamuraiAgent with context understanding and tool calling.

This test verifies that the existing SamuraiAgent has been properly enhanced with:
1. Context understanding for "those tasks" references
2. Tool calling when appropriate
3. Action-taking instead of clarification requests
"""

import asyncio
import json
from typing import List, Dict, Any

try:
    from services.ai_agent import SamuraiAgent
    from models import Task, Memory, Project, MemoryCategory, ChatMessage
    from datetime import datetime
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from services.ai_agent import SamuraiAgent
    from models import Task, Memory, Project, MemoryCategory, ChatMessage
    from datetime import datetime


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
        print(f"Mock Gemini called with prompt: {prompt[:100]}...")
        prompt_lower = prompt.lower()
        # Tool detection: match on 'decide if tools should be used'
        if "decide if tools should be used" in prompt_lower:
            print(f"Tool detection branch matched. Prompt: {prompt}")
            if "create those tasks" in prompt or "create tasks" in prompt:
                print("Returning tool detection response for create_tasks")
                return json.dumps(self.tool_detection_responses["create_tasks"])
            else:
                print("Returning no tools response")
                return json.dumps({
                    "requires_tools": False,
                    "tool_calls": [],
                    "confidence": 0.0
                })
            return "Should never reach here"
        # Response generation: match on 'the user asked:' and 'i executed these actions successfully:'
        elif ("the user asked:" in prompt_lower and "i executed these actions successfully:" in prompt_lower):
            print("Response generation branch matched. Returning task creation response.")
            return self.response_responses["task_creation"]
        elif ("context" in prompt_lower and "conversation" in prompt_lower
              and not ("decide if tools should be used" in prompt_lower)):
            print(f"Context extraction branch matched. Prompt: {prompt}")
            if "JSON structure" in prompt or "session ID" in prompt or "start conversation" in prompt:
                print("Returning context response for those_tasks")
                return json.dumps(self.context_responses["those_tasks"])
            else:
                print("Returning empty context response")
                return json.dumps({
                    "referenced_items": [],
                    "user_intent": "unknown",
                    "context_clarity": "low"
                })
        elif "response" in prompt_lower and "actions" in prompt_lower:
            print("Returning task creation response")
            return self.response_responses["task_creation"]
        else:
            print("Returning default mock response")
            return "Mock response"


async def test_enhanced_samurai_agent():
    """Test the enhanced SamuraiAgent with proper mocking"""
    print("🧪 Testing Enhanced SamuraiAgent (Simple)")
    print("=" * 60)
    
    # Create mocks
    mock_file_service = MockFileService()
    mock_gemini_service = MockGeminiService()
    
    # Create enhanced agent with mocks
    agent = SamuraiAgent()
    agent.file_service = mock_file_service
    agent.gemini_service = mock_gemini_service
    
    # Set up test project
    test_project_id = "test-project"
    
    # Add conversation history with numbered tasks
    assistant_message = ChatMessage(
        id="msg1",
        project_id=test_project_id,
        message="",
        response="Next steps could involve: 1. Define the JSON structure 2. Implement session ID generation 3. Wire up start conversation button",
        created_at=datetime.now()
    )
    
    mock_file_service.save_chat_message(test_project_id, assistant_message)
    
    print("✅ Setup complete")
    
    # Test 1: Context extraction
    print("\n=== Test 1: Context Extraction ===")
    conversation_history = agent._get_conversation_history_for_planning(test_project_id, max_messages=10)
    print(f"Conversation history: {conversation_history}")
    
    context_info = await agent.extract_conversation_context(conversation_history)
    print(f"Context extracted: {context_info}")
    
    if context_info['user_intent'] == 'create_tasks' and len(context_info['referenced_items']) == 3:
        print("✅ Context extraction test passed")
    else:
        print("❌ Context extraction test failed")
        return False
    
    # Test 2: Tool detection with context
    print("\n=== Test 2: Tool Detection with Context ===")
    tool_plan = await agent.should_use_tools_enhanced(
        "Can you create those tasks for me?", 
        context_info
    )
    print(f"Tool plan: {tool_plan}")
    
    if tool_plan['requires_tools'] and len(tool_plan['tool_calls']) > 0:
        print("✅ Tool detection test passed")
    else:
        print("❌ Tool detection test failed")
        return False
    
    # Test 3: Full conversation flow
    print("\n=== Test 3: Full Conversation Flow ===")
    result = await agent.process_message(
        message="Can you create those tasks for me?",
        project_id=test_project_id,
        project_context={}
    )
    
    print(f"Agent response: {result['response']}")
    print(f"Tool calls made: {result['tool_calls_made']}")
    print(f"Context used: {result['context_used']}")
    
    if result['tool_calls_made'] > 0 and "created" in result['response'].lower():
        print("✅ Full conversation flow test passed")
    else:
        print("❌ Full conversation flow test failed")
        return False
    
    # Test 4: Verify tasks were created
    print("\n=== Test 4: Verify Tasks Created ===")
    saved_tasks = mock_file_service.load_tasks(test_project_id)
    print(f"Saved tasks: {len(saved_tasks)}")
    
    if len(saved_tasks) >= 3:
        print("✅ Task creation verification passed")
        for i, task in enumerate(saved_tasks[:3], 1):
            print(f"  {i}. {task.title}")
    else:
        print("❌ Task creation verification failed")
        return False
    
    print("\n" + "=" * 60)
    print("🎉 All enhanced agent tests passed!")
    print("✅ SamuraiAgent has been successfully enhanced with:")
    print("   - Context understanding for 'those tasks' references")
    print("   - Tool calling when appropriate")
    print("   - Action-taking instead of clarification requests")
    print("   - Integration with existing functionality")
    
    return True


if __name__ == "__main__":
    # Run enhanced agent tests
    success = asyncio.run(test_enhanced_samurai_agent())
    if not success:
        print("\n⚠️  Some enhanced agent tests failed. Review the issues above.")
        exit(1) 