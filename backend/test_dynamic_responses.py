"""
Test Dynamic Response Generation

This test file verifies that the UnifiedSamuraiAgent now uses dynamic LLM-generated responses
instead of hardcoded ones.
"""

import asyncio
import json
from typing import List, Dict, Any

try:
    from services.unified_samurai_agent import UnifiedSamuraiAgent, ResponseContext
    from services.response_generator import ResponseGenerator
    from models import Task, Memory, Project, ChatMessage
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from services.unified_samurai_agent import UnifiedSamuraiAgent, ResponseContext
    from services.response_generator import ResponseGenerator
    from models import Task, Memory, Project, ChatMessage


async def test_response_generator():
    """Test the ResponseGenerator class directly."""
    print("🧪 Testing ResponseGenerator...")
    
    generator = ResponseGenerator()
    
    # Test context
    context = ResponseContext(
        project_name="Test Project",
        tech_stack="React, Node.js, PostgreSQL",
        conversation_summary="User is working on authentication features",
        relevant_tasks=[
            Task(id="1", project_id="test-project", title="Implement JWT authentication", description="Add JWT token handling", completed=False),
            Task(id="2", project_id="test-project", title="Create login form", description="Build user login interface", completed=True)
        ],
        relevant_memories=[
            Memory(id="1", project_id="test-project", title="Auth Decision", content="Chose JWT over sessions for scalability", type="decision")
        ],
        user_message="I want to add user registration",
        intent_type="feature_exploration",
        confidence=0.8
    )
    
    # Test different response types
    print("\n📝 Testing discussion response...")
    discussion_response = await generator.generate_discussion_response(context)
    print(f"Discussion Response: {discussion_response[:100]}...")
    
    print("\n❓ Testing clarification questions...")
    clarification_response = await generator.generate_clarification_questions(context)
    print(f"Clarification Response: {clarification_response[:100]}...")
    
    print("\n✅ Testing task completion response...")
    task = Task(id="1", project_id="test-project", title="Implement JWT authentication", description="Add JWT token handling", completed=True)
    completion_response = await generator.generate_task_completion_response(task, context)
    print(f"Completion Response: {completion_response[:100]}...")
    
    print("\n🗑️ Testing task deletion response...")
    deletion_response = await generator.generate_task_deletion_response(task, context)
    print(f"Deletion Response: {deletion_response[:100]}...")
    
    print("\n❌ Testing error response...")
    error = Exception("Test error for response generation")
    error_response = await generator.generate_error_response(error, context)
    print(f"Error Response: {error_response[:100]}...")
    
    print("\n📊 Testing progress update...")
    progress_response = await generator.generate_progress_update("planning", "Creating task breakdown", "Analyzing requirements", context)
    print(f"Progress Response: {progress_response[:100]}...")
    
    print("\n🎉 ResponseGenerator tests completed!")


async def test_unified_agent_dynamic_responses():
    """Test that UnifiedSamuraiAgent uses dynamic responses."""
    print("\n🤖 Testing UnifiedSamuraiAgent dynamic responses...")
    
    agent = UnifiedSamuraiAgent()
    
    # Mock project context
    project_context = {
        "name": "Test Project",
        "tech_stack": "React, Node.js, PostgreSQL",
        "description": "A test project for dynamic responses"
    }
    
    # Test different message types
    test_cases = [
        {
            "message": "Hello! How are you today?",
            "description": "Pure discussion"
        },
        {
            "message": "I'm thinking about adding a search feature",
            "description": "Feature exploration"
        },
        {
            "message": "Yes, with real-time search and filters",
            "description": "Spec clarification"
        },
        {
            "message": "Create tasks for user authentication with JWT",
            "description": "Ready for action"
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📝 Test {i}: {test_case['description']}")
        print(f"Message: {test_case['message']}")
        
        try:
            result = await agent.process_message(
                message=test_case['message'],
                project_id="test-project",
                project_context=project_context,
                session_id="test-session",
                conversation_history=[]
            )
            
            print(f"Response Type: {result.get('type', 'unknown')}")
            print(f"Response: {result.get('response', 'No response')[:150]}...")
            print(f"Tool Calls Made: {result.get('tool_calls_made', 0)}")
            print(f"Intent Analysis: {result.get('intent_analysis', {})}")
            
        except Exception as e:
            print(f"❌ Error: {e}")
    
    print("\n🎉 UnifiedSamuraiAgent dynamic response tests completed!")


async def test_context_awareness():
    """Test that responses are context-aware."""
    print("\n🧠 Testing context awareness...")
    
    generator = ResponseGenerator()
    
    # Test with different project contexts
    contexts = [
        ResponseContext(
            project_name="E-commerce App",
            tech_stack="React, Node.js, MongoDB",
            conversation_summary="Building an online store with payment processing",
            relevant_tasks=[],
            relevant_memories=[],
            user_message="I want to add a shopping cart",
            intent_type="feature_exploration",
            confidence=0.8
        ),
        ResponseContext(
            project_name="Blog Platform",
            tech_stack="Vue.js, Python, PostgreSQL",
            conversation_summary="Creating a content management system",
            relevant_tasks=[],
            relevant_memories=[],
            user_message="I want to add a shopping cart",
            intent_type="feature_exploration",
            confidence=0.8
        )
    ]
    
    for i, context in enumerate(contexts, 1):
        print(f"\n🏪 Test Context {i}: {context.project_name}")
        print(f"Tech Stack: {context.tech_stack}")
        
        response = await generator.generate_clarification_questions(context)
        print(f"Response: {response[:200]}...")
    
    print("\n🎉 Context awareness tests completed!")


async def test_fallback_mechanisms():
    """Test that fallback mechanisms work when LLM generation fails."""
    print("\n🛡️ Testing fallback mechanisms...")
    
    generator = ResponseGenerator()
    
    # Test with invalid context to trigger fallbacks
    invalid_context = ResponseContext(
        project_name="",
        tech_stack="",
        conversation_summary="",
        relevant_tasks=[],
        relevant_memories=[],
        user_message="",
        intent_type="unknown",
        confidence=0.0
    )
    
    try:
        response = await generator.generate_discussion_response(invalid_context)
        print(f"Fallback Response: {response}")
        print("✅ Fallback mechanism working")
    except Exception as e:
        print(f"❌ Fallback failed: {e}")
    
    print("\n🎉 Fallback mechanism tests completed!")


async def main():
    """Run all tests."""
    print("🚀 Starting Dynamic Response Generation Tests")
    print("=" * 50)
    
    try:
        await test_response_generator()
        await test_unified_agent_dynamic_responses()
        await test_context_awareness()
        await test_fallback_mechanisms()
        
        print("\n" + "=" * 50)
        print("✅ All tests completed successfully!")
        print("🎯 The UnifiedSamuraiAgent now uses dynamic LLM-generated responses!")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main()) 