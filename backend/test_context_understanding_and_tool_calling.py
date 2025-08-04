"""
Test suite for agent context understanding and tool calling functionality.

This test suite addresses critical issues:
1. Missing Context Understanding: Agent doesn't understand references like "those tasks" from previous conversation
2. Broken Tool Calling: Agent explains instead of using create_task tool when explicitly asked
3. Generic Responses: Agent gives explanatory text instead of taking action
"""

import pytest
import json
import asyncio
import time
from typing import List, Dict, Any, Optional
from datetime import datetime

# Import services
try:
    from services.ai_agent import SamuraiAgent
    from services.tool_calling_agent import EnhancedSamuraiAgent, ToolCallingSamuraiAgent
    from services.context_service import ContextSelectionService
    from services.agent_tools import AgentToolRegistry
    from services.gemini_service import GeminiService
    from models import Task, Memory, Project
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from services.ai_agent import SamuraiAgent
    from services.tool_calling_agent import EnhancedSamuraiAgent, ToolCallingSamuraiAgent
    from services.context_service import ContextSelectionService
    from services.agent_tools import AgentToolRegistry
    from services.gemini_service import GeminiService
    from models import Task, Memory, Project


class ContextUnderstandingTester:
    """Test class for context understanding functionality"""
    
    def __init__(self):
        self.gemini_service = GeminiService()
        self.context_service = ContextSelectionService()
    
    async def extract_conversation_context(self, conversation_history: List[Dict]) -> Dict:
        """
        Extract actionable context from recent conversation
        """
        if not conversation_history:
            return {"referenced_items": [], "user_intent": "unknown", "context_clarity": "low"}
        
        # Get last few messages for context
        recent_messages = conversation_history[-5:]
        conversation_text = "\n".join([
            f"{msg.get('role', 'unknown')}: {msg.get('content', '')}" 
            for msg in recent_messages
        ])
        
        context_prompt = f"""
        Analyze this conversation to understand references and context:
        
        CONVERSATION:
        {conversation_text}
        
        Focus on:
        1. What specific items were mentioned that user might reference?
        2. What does the user want to do with these items?
        3. Are there clear action items or tasks mentioned?
        
        When user says "those", "these", "them", what are they referring to?
        
        Return JSON:
        {{
            "referenced_items": ["specific item 1", "specific item 2"],
            "user_intent": "create_tasks|update_tasks|general_question|clarification_needed",
            "context_clarity": "high|medium|low",
            "action_items": ["actionable item 1", "actionable item 2"]
        }}
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(context_prompt, "You are a context analysis assistant. Return only valid JSON.")
            return json.loads(response)
        except Exception as e:
            print(f"Context extraction error: {e}")
            return {"referenced_items": [], "user_intent": "unknown", "context_clarity": "low"}
    
    async def detect_tool_usage_intent(self, user_message: str) -> Dict:
        """
        Test the tool detection logic
        """
        available_tools = [
            "create_task - Create new tasks",
            "update_task - Modify existing tasks", 
            "change_task_status - Update task status",
            "create_memory - Store new memories",
            "search_tasks - Find specific tasks"
        ]
        
        detection_prompt = f"""
        Analyze this user message and determine if it requires using tools:
        
        USER MESSAGE: "{user_message}"
        
        AVAILABLE TOOLS:
        {chr(10).join(available_tools)}
        
        Examples that need tools:
        - "Create a task to implement authentication" → create_task
        - "Mark the login task as completed" → change_task_status
        - "Add a memory about database choice" → create_memory
        
        Examples that don't need tools:
        - "How do I implement authentication?" → No tools needed
        - "What's the best database?" → No tools needed
        
        Return JSON:
        {{
            "requires_tools": true/false,
            "tool_calls": [
                {{
                    "tool": "tool_name",
                    "reasoning": "why this tool is needed"
                }}
            ],
            "confidence": 0.8
        }}
        """
        
        try:
            response = await self.gemini_service.chat_with_system_prompt(detection_prompt, "You are a tool detection assistant. Return only valid JSON.")
            return json.loads(response)
        except Exception as e:
            print(f"Tool detection error: {e}")
            return {"requires_tools": False, "tool_calls": [], "confidence": 0.0}


class EnhancedContextualAgent:
    """
    Agent with improved context understanding and tool calling
    """
    
    def __init__(self):
        self.tool_registry = AgentToolRegistry()
        self.context_tester = ContextUnderstandingTester()
        self.gemini_service = GeminiService()
    
    async def process_message_with_context(self, user_message: str, conversation_history: List[Dict], 
                                         project_id: str, memories: List[Dict], tasks: List[Dict]) -> Dict:
        """
        Process message with enhanced context understanding
        """
        try:
            # Step 1: Extract context from recent conversation
            context_info = await self.context_tester.extract_conversation_context(conversation_history)
            
            # Step 2: Create enhanced prompt with context
            enhanced_prompt = self.create_context_aware_prompt(user_message, context_info, memories, tasks)
            
            # Step 3: Detect tool usage with context
            tool_plan = await self.context_tester.detect_tool_usage_intent(enhanced_prompt)
            
            # Step 4: Execute tools if needed
            tool_results = []
            if tool_plan.get("requires_tools", False):
                tool_results = await self.execute_tools_with_context(
                    tool_plan['tool_calls'], context_info, project_id
                )
            
            # Step 5: Generate contextual response
            response = await self.generate_contextual_response(
                user_message, context_info, tool_results
            )
            
            return {
                "response": response,
                "tool_results": tool_results,
                "context_used": context_info
            }
            
        except Exception as e:
            print(f"Context processing error: {e}")
            return {
                "response": f"I encountered an error processing your request: {str(e)}",
                "tool_results": [],
                "context_used": {}
            }
    
    def create_context_aware_prompt(self, user_message: str, context_info: Dict, 
                                   memories: List[Dict], tasks: List[Dict]) -> str:
        """
        Create enhanced prompt with context information
        """
        context_section = ""
        if context_info.get("referenced_items"):
            context_section = f"""
CONVERSATION CONTEXT:
The user is referring to these items from our recent conversation:
{chr(10).join(f"- {item}" for item in context_info['referenced_items'])}

User intent appears to be: {context_info.get('user_intent', 'unknown')}
"""
        
        enhanced_prompt = f"""
USER MESSAGE: {user_message}

{context_section}

CURRENT PROJECT STATE:
- Active tasks: {len(tasks)}
- Stored memories: {len(memories)}

If the user is asking to create tasks and referenced specific items, use the create_task tool for each item.
If the user wants to update existing tasks, use appropriate task management tools.
Always take action when possible rather than asking for clarification.
"""
        
        return enhanced_prompt
    
    async def execute_tools_with_context(self, tool_calls: List[Dict], context_info: Dict, project_id: str) -> List[Dict]:
        """
        Execute tools based on context information
        """
        tool_results = []
        
        for tool_call in tool_calls:
            tool_name = tool_call.get("tool")
            
            if tool_name == "create_task" and context_info.get("referenced_items"):
                # Create tasks for each referenced item
                for item in context_info["referenced_items"]:
                    result = await self.execute_create_task_tool(
                        title=item,
                        description=f"Task created from conversation context: {item}",
                        project_id=project_id
                    )
                    tool_results.append(result)
            else:
                # Execute other tools as needed
                result = {
                    "success": False,
                    "message": f"Tool {tool_name} not implemented in test version"
                }
                tool_results.append(result)
        
        return tool_results
    
    async def execute_create_task_tool(self, title: str, description: str, project_id: str) -> Dict:
        """
        Test version of create task tool
        """
        # Simulate tool execution
        task_id = f"task_{int(time.time())}"
        
        return {
            "success": True,
            "task_id": task_id,
            "title": title,
            "message": f"✅ Created task: {title}"
        }
    
    async def generate_contextual_response(self, user_message: str, context_info: Dict, tool_results: List[Dict]) -> str:
        """
        Generate response incorporating tool results
        """
        if not tool_results:
            return "I couldn't determine what action to take. Could you be more specific?"
        
        successful_tasks = [r for r in tool_results if r.get("success")]
        
        if successful_tasks:
            response_parts = [
                f"✅ I've created {len(successful_tasks)} tasks for you:",
                ""
            ]
            
            for i, result in enumerate(successful_tasks, 1):
                response_parts.append(f"{i}. {result['title']}")
            
            response_parts.extend([
                "",
                "These tasks are now available in your task panel."
            ])
            
            return "\n".join(response_parts)
        
        return "I attempted to take action but encountered some issues. Please try again."


# Test Functions

async def test_context_understanding():
    """
    Test if agent remembers recent conversation context
    """
    print("=== Testing Context Understanding ===")
    
    # Simulate conversation history
    conversation_history = [
        {
            "role": "assistant",
            "content": "Next steps could involve: 1. Define the JSON structure 2. Implement session ID generation 3. Wire up start conversation button",
            "timestamp": "2025-01-01T10:00:00"
        },
        {
            "role": "user", 
            "content": "Can you create those tasks for me?",
            "timestamp": "2025-01-01T10:01:00"
        }
    ]
    
    # Test context extraction
    context_tester = ContextUnderstandingTester()
    context_result = await context_tester.extract_conversation_context(conversation_history)
    
    print(f"Context extracted: {context_result}")
    
    # Test if agent understands "those tasks"
    should_understand = {
        "referenced_items": ["Define JSON structure", "Implement session ID generation", "Wire up start conversation button"],
        "user_intent": "create_tasks",
        "context_clarity": "high"
    }
    
    assert "JSON structure" in str(context_result), "Failed to identify JSON structure task"
    assert "session ID" in str(context_result), "Failed to identify session ID task"
    assert "start conversation" in str(context_result), "Failed to identify start conversation task"
    
    print("✅ Context understanding test passed")


async def test_tool_calling_functionality():
    """
    Test if agent properly uses tools when appropriate
    """
    print("=== Testing Tool Calling ===")
    
    # Test cases where tools should be used
    test_cases = [
        {
            "input": "Create a task for implementing user authentication",
            "expected_tool": "create_task",
            "expected_params": {"title": "Implement user authentication"}
        },
        {
            "input": "Mark the login task as completed", 
            "expected_tool": "change_task_status",
            "expected_params": {"new_status": "completed"}
        },
        {
            "input": "Add a memory about choosing PostgreSQL for database",
            "expected_tool": "create_memory", 
            "expected_params": {"title": "Database choice: PostgreSQL"}
        }
    ]
    
    context_tester = ContextUnderstandingTester()
    
    for test_case in test_cases:
        print(f"\nTesting: {test_case['input']}")
        
        # Test tool detection
        should_use_tools = await context_tester.detect_tool_usage_intent(test_case['input'])
        
        assert should_use_tools["requires_tools"] == True, f"Failed to detect tool usage for: {test_case['input']}"
        assert test_case['expected_tool'] in str(should_use_tools), f"Wrong tool detected for: {test_case['input']}"
        
        print(f"✅ Correctly detected need for {test_case['expected_tool']}")
    
    print("✅ Tool calling detection test passed")


async def test_full_conversation_flow():
    """
    Test complete conversation flow with context and tools
    """
    print("=== Testing Full Conversation Flow ===")
    
    # Simulate the problematic conversation
    conversation = [
        {
            "role": "assistant",
            "content": "Next steps could involve: 1. Define the JSON structure for chat history 2. Implement session ID generation 3. Wire up start conversation button"
        },
        {
            "role": "user", 
            "content": "Can you create those tasks for me?"
        }
    ]
    
    # Test agent response
    agent = EnhancedContextualAgent()
    agent_response = await agent.process_message_with_context(
        user_message="Can you create those tasks for me?",
        conversation_history=conversation,
        project_id="test-project",
        memories=[],
        tasks=[]
    )
    
    # Verify response
    assert "created" in agent_response['response'].lower(), "Agent didn't create tasks"
    assert "JSON structure" in agent_response['response'], "Missing JSON structure task"
    assert "session ID" in agent_response['response'], "Missing session ID task" 
    assert "start conversation" in agent_response['response'], "Missing start conversation task"
    
    print("✅ Full conversation flow test passed")


async def test_context_extraction_quality():
    """
    Test the quality of context extraction for various conversation patterns
    """
    print("=== Testing Context Extraction Quality ===")
    
    test_conversations = [
        {
            "name": "Task creation reference",
            "conversation": [
                {"role": "assistant", "content": "You need to: 1. Create user model 2. Add authentication 3. Setup database"},
                {"role": "user", "content": "Can you create those tasks?"}
            ],
            "expected_items": ["Create user model", "Add authentication", "Setup database"]
        },
        {
            "name": "Memory reference",
            "conversation": [
                {"role": "assistant", "content": "The issue is with the login system and password reset functionality"},
                {"role": "user", "content": "Add those to memory"}
            ],
            "expected_items": ["login system", "password reset"]
        },
        {
            "name": "Feature reference",
            "conversation": [
                {"role": "assistant", "content": "We should implement: real-time notifications, user dashboard, and analytics"},
                {"role": "user", "content": "Let's start with those features"}
            ],
            "expected_items": ["real-time notifications", "user dashboard", "analytics"]
        }
    ]
    
    context_tester = ContextUnderstandingTester()
    
    for test_case in test_conversations:
        print(f"\nTesting: {test_case['name']}")
        
        context_result = await context_tester.extract_conversation_context(test_case['conversation'])
        
        # Check if expected items are found
        found_items = 0
        for expected_item in test_case['expected_items']:
            if any(expected_item.lower() in str(context_result).lower()):
                found_items += 1
        
        # Should find at least 2/3 of expected items
        success_rate = found_items / len(test_case['expected_items'])
        assert success_rate >= 0.67, f"Context extraction quality too low: {success_rate:.2f}"
        
        print(f"✅ Context extraction quality: {success_rate:.2f}")
    
    print("✅ Context extraction quality test passed")


async def test_tool_calling_integration():
    """
    Test integration between context understanding and tool calling
    """
    print("=== Testing Tool Calling Integration ===")
    
    # Test the complete flow
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
    
    agent = EnhancedContextualAgent()
    result = await agent.process_message_with_context(
        user_message="Create tasks for those features",
        conversation_history=conversation,
        project_id="test-project",
        memories=[],
        tasks=[]
    )
    
    # Verify tool execution
    assert len(result['tool_results']) > 0, "No tools were executed"
    assert result['context_used']['user_intent'] == 'create_tasks', "Wrong intent detected"
    
    # Verify response quality
    response = result['response']
    assert "created" in response.lower(), "Response doesn't indicate task creation"
    assert "authentication" in response.lower(), "Response doesn't reference original context"
    
    print("✅ Tool calling integration test passed")


async def test_fallback_behavior():
    """
    Test fallback behavior when context is unclear
    """
    print("=== Testing Fallback Behavior ===")
    
    # Test with unclear context
    unclear_conversation = [
        {
            "role": "user",
            "content": "Can you create those tasks?"
        }
    ]
    
    agent = EnhancedContextualAgent()
    result = await agent.process_message_with_context(
        user_message="Can you create those tasks?",
        conversation_history=unclear_conversation,
        project_id="test-project",
        memories=[],
        tasks=[]
    )
    
    # Should handle unclear context gracefully
    assert "specific" in result['response'].lower() or "clarify" in result['response'].lower(), "Should ask for clarification when context is unclear"
    
    print("✅ Fallback behavior test passed")


# Main test runner
async def run_all_tests():
    """
    Run all context understanding and tool calling tests
    """
    print("🧪 Running Context Understanding and Tool Calling Tests")
    print("=" * 60)
    
    test_functions = [
        test_context_understanding,
        test_tool_calling_functionality,
        test_full_conversation_flow,
        test_context_extraction_quality,
        test_tool_calling_integration,
        test_fallback_behavior
    ]
    
    passed = 0
    failed = 0
    
    for test_func in test_functions:
        try:
            await test_func()
            passed += 1
        except Exception as e:
            print(f"❌ {test_func.__name__} failed: {e}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed! Context understanding and tool calling are working correctly.")
    else:
        print("⚠️  Some tests failed. Review the issues above.")
    
    return passed, failed


if __name__ == "__main__":
    # Run tests
    asyncio.run(run_all_tests()) 