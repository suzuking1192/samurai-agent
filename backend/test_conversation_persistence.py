#!/usr/bin/env python3
"""
Test script to verify conversation history persistence and task creation with context.
This test simulates the exact scenario that was failing:
1. User: "I want to delete generate prompt button"
2. Page refresh (simulated by clearing in-memory state)
3. User: "can you add this as a task?"
4. Expected: Task created with "delete generate prompt button" title
"""

import asyncio
import sys
import os
from datetime import datetime
import uuid

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.ai_agent import SamuraiAgent
from services.file_service import file_service
from models import Project, ChatMessage, Session

async def test_conversation_persistence():
    """Test conversation history persistence and task creation with context."""
    
    print("🧪 Testing Conversation History Persistence")
    print("=" * 50)
    
    # Create a test project
    project_id = "test-conversation-persistence"
    project = Project(
        id=project_id,
        name="Test Conversation Persistence",
        description="Testing conversation history persistence",
        tech_stack="Python, FastAPI, React",
        created_at=datetime.now()
    )
    
    # Save project
    file_service.save_project(project)
    print(f"✅ Created test project: {project.name}")
    
    # Create a test session
    session = file_service.create_session(project_id, "Test Session")
    print(f"✅ Created test session: {session.id}")
    
    # Step 1: User says "I want to delete generate prompt button"
    print("\n📝 Step 1: User says 'I want to delete generate prompt button'")
    user_message_1 = "I want to delete generate prompt button"
    
    # Create and save the first chat message
    chat_message_1 = ChatMessage(
        id=str(uuid.uuid4()),
        project_id=project_id,
        session_id=session.id,
        message=user_message_1,
        response="I understand you want to delete the generate prompt button. This would involve removing the button from the UI and potentially cleaning up any related functionality.",
        created_at=datetime.now()
    )
    
    file_service.save_chat_message(project_id, chat_message_1)
    print(f"✅ Saved first message: {user_message_1}")
    
    # Step 2: Simulate page refresh by creating a new agent instance
    print("\n🔄 Step 2: Simulating page refresh (new agent instance)")
    agent = SamuraiAgent()
    
    # Step 3: User says "can you add this as a task?"
    print("\n📝 Step 3: User says 'can you add this as a task?'")
    user_message_2 = "can you add this as a task?"
    
    # Process the message with conversation history
    project_context = {
        "name": project.name,
        "description": project.description,
        "tech_stack": project.tech_stack
    }
    
    # Load conversation history
    conversation_history = file_service.load_chat_messages_by_session(project_id, session.id)
    print(f"📚 Loaded {len(conversation_history)} conversation messages")
    
    # Process the task creation request
    result = await agent.process_message(
        message=user_message_2,
        project_id=project_id,
        project_context=project_context,
        session_id=session.id,
        conversation_history=conversation_history
    )
    
    print(f"🤖 Agent response type: {result.get('type', 'unknown')}")
    print(f"🤖 Agent response: {result.get('response', 'No response')[:200]}...")
    
    # Step 4: Confirm the task creation (simulate user confirmation)
    print("\n📝 Step 4: User confirms task creation")
    confirmation_message = "yes, create that task"
    
    # Add the confirmation message to conversation history
    confirmation_chat_message = ChatMessage(
        id=str(uuid.uuid4()),
        project_id=project_id,
        session_id=session.id,
        message=confirmation_message,
        response="",
        created_at=datetime.now()
    )
    file_service.save_chat_message(project_id, confirmation_chat_message)
    
    # Update conversation history
    conversation_history = file_service.load_chat_messages_by_session(project_id, session.id)
    print(f"📚 Updated conversation history: {len(conversation_history)} messages")
    
    # Process the confirmation
    confirmation_result = await agent.process_message(
        message=confirmation_message,
        project_id=project_id,
        project_context=project_context,
        session_id=session.id,
        conversation_history=conversation_history
    )
    
    print(f"🤖 Confirmation response type: {confirmation_result.get('type', 'unknown')}")
    print(f"🤖 Confirmation response: {confirmation_result.get('response', 'No response')[:200]}...")
    
    # Step 5: Check if a task was created
    print("\n🔍 Step 5: Checking if task was created")
    tasks = file_service.load_tasks(project_id)
    print(f"📋 Found {len(tasks)} tasks")
    
    # Look for a task related to deleting the generate prompt button
    relevant_tasks = []
    for task in tasks:
        if "delete" in task.title.lower() and "generate prompt" in task.title.lower():
            relevant_tasks.append(task)
        elif "generate prompt button" in task.title.lower():
            relevant_tasks.append(task)
    
    if relevant_tasks:
        print("✅ SUCCESS: Task created with correct context!")
        for task in relevant_tasks:
            print(f"   📝 Task: {task.title}")
            print(f"   📄 Description: {task.description}")
    else:
        print("❌ FAILURE: No relevant task found")
        print("   Available tasks:")
        for task in tasks:
            print(f"   - {task.title}")
    
    # Clean up test data
    print("\n🧹 Cleaning up test data...")
    file_service.delete_project(project_id)
    print("✅ Test cleanup completed")
    
    return len(relevant_tasks) > 0

async def test_multiple_conversations():
    """Test multiple conversations to ensure session isolation."""
    
    print("\n🧪 Testing Multiple Conversations")
    print("=" * 50)
    
    project_id = "test-multiple-conversations"
    project = Project(
        id=project_id,
        name="Test Multiple Conversations",
        description="Testing session isolation",
        tech_stack="Python, FastAPI, React",
        created_at=datetime.now()
    )
    
    file_service.save_project(project)
    
    # Create two sessions
    session1 = file_service.create_session(project_id, "Session 1")
    session2 = file_service.create_session(project_id, "Session 2")
    
    # Add messages to session 1
    msg1 = ChatMessage(
        id=str(uuid.uuid4()),
        project_id=project_id,
        session_id=session1.id,
        message="I want to add user authentication",
        response="I'll help you add user authentication.",
        created_at=datetime.now()
    )
    file_service.save_chat_message(project_id, msg1)
    
    # Add messages to session 2
    msg2 = ChatMessage(
        id=str(uuid.uuid4()),
        project_id=project_id,
        session_id=session2.id,
        message="I want to add a search feature",
        response="I'll help you add a search feature.",
        created_at=datetime.now()
    )
    file_service.save_chat_message(project_id, msg2)
    
    # Load messages for each session
    session1_messages = file_service.load_chat_messages_by_session(project_id, session1.id)
    session2_messages = file_service.load_chat_messages_by_session(project_id, session2.id)
    
    print(f"📚 Session 1 has {len(session1_messages)} messages")
    print(f"📚 Session 2 has {len(session2_messages)} messages")
    
    # Verify session isolation
    if len(session1_messages) == 1 and len(session2_messages) == 1:
        print("✅ SUCCESS: Session isolation working correctly")
    else:
        print("❌ FAILURE: Session isolation not working")
    
    # Clean up
    file_service.delete_project(project_id)
    
    return len(session1_messages) == 1 and len(session2_messages) == 1

async def main():
    """Run all tests."""
    print("🚀 Starting Conversation Persistence Tests")
    print("=" * 60)
    
    try:
        # Test 1: Basic conversation persistence
        test1_passed = await test_conversation_persistence()
        
        # Test 2: Multiple conversations
        test2_passed = await test_multiple_conversations()
        
        # Summary
        print("\n📊 Test Results Summary")
        print("=" * 30)
        print(f"✅ Conversation Persistence Test: {'PASSED' if test1_passed else 'FAILED'}")
        print(f"✅ Multiple Conversations Test: {'PASSED' if test2_passed else 'FAILED'}")
        
        if test1_passed and test2_passed:
            print("\n🎉 ALL TESTS PASSED! Conversation persistence is working correctly.")
        else:
            print("\n❌ Some tests failed. Please check the implementation.")
            
    except Exception as e:
        print(f"\n💥 Test failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main()) 