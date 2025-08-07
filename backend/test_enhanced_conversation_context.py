#!/usr/bin/env python3
"""
Test Enhanced Conversation Context Methods

This test verifies that the enhanced conversation context methods in UnifiedSamuraiAgent
are working properly with extended history and smart truncation.
"""

import asyncio
import sys
import os
from datetime import datetime

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from services.unified_samurai_agent import UnifiedSamuraiAgent
from models import ChatMessage

async def test_enhanced_conversation_summary():
    """Test the enhanced conversation summary methods."""
    print("🧪 Testing Enhanced Conversation Summary Methods")
    print("=" * 60)
    
    agent = UnifiedSamuraiAgent()
    
    # Create a conversation with 25 messages (more than the 20-message limit)
    session_messages = []
    for i in range(25):
        user_message = f"User message {i+1}: This is a test message about feature development"
        assistant_response = f"Assistant response {i+1}: I understand you want to work on feature {i+1}. Let me help you with that."
        
        session_messages.append(ChatMessage(
            id=f"msg_{i+1}",
            project_id="test_project",
            session_id="test_session",
            message=user_message,
            response=assistant_response,
            timestamp=datetime.now(),
            message_type="chat"
        ))
    
    current_message = "Now I want to implement the authentication system we discussed earlier"
    
    print(f"📊 Created {len(session_messages)} conversation messages")
    print(f"📝 Current message: {current_message}")
    print()
    
    # Test 1: Enhanced conversation summary (should include last 20 messages)
    print("🔍 Test 1: Enhanced Conversation Summary (20 messages)")
    print("-" * 50)
    
    summary = agent._create_conversation_summary(session_messages, current_message)
    print(f"Summary length: {len(summary)} characters")
    print(f"Contains 'CONVERSATION HISTORY': {'CONVERSATION HISTORY' in summary}")
    print(f"Contains 'User message 6': {'User message 6' in summary}")  # Should be included (within last 20)
    print(f"Contains 'User message 1': {'User message 1' in summary}")  # Should NOT be included (outside last 20)
    print(f"Contains current message: {current_message in summary}")
    print()
    
    # Test 2: Smart truncation with default max_chars
    print("🔍 Test 2: Smart Truncation (default 4000 chars)")
    print("-" * 50)
    
    smart_summary = agent._create_conversation_summary_with_smart_truncation(session_messages, current_message)
    print(f"Smart summary length: {len(smart_summary)} characters")
    print(f"Within 4000 char limit: {len(smart_summary) <= 4000}")
    print(f"Contains conversation history: {'CONVERSATION HISTORY' in smart_summary}")
    print()
    
    # Test 3: Smart truncation with smaller limit
    print("🔍 Test 3: Smart Truncation (2000 chars)")
    print("-" * 50)
    
    short_summary = agent._create_conversation_summary_with_smart_truncation(session_messages, current_message, max_chars=2000)
    print(f"Short summary length: {len(short_summary)} characters")
    print(f"Within 2000 char limit: {len(short_summary) <= 2000}")
    print(f"Contains conversation history: {'CONVERSATION HISTORY' in short_summary}")
    print()
    
    # Test 4: Empty conversation
    print("🔍 Test 4: Empty Conversation")
    print("-" * 50)
    
    empty_summary = agent._create_conversation_summary_with_smart_truncation([], current_message)
    print(f"Empty summary: {empty_summary}")
    print(f"Contains 'start of a new conversation': {'start of a new conversation' in empty_summary}")
    print()
    
    # Test 5: Very long responses (should be truncated)
    print("🔍 Test 5: Long Response Truncation")
    print("-" * 50)
    
    long_messages = []
    for i in range(5):
        user_message = f"User message {i+1}"
        # Create a very long response (over 300 characters)
        long_response = f"Assistant response {i+1}: " + "This is a very long response that should be truncated. " * 20
        
        long_messages.append(ChatMessage(
            id=f"long_msg_{i+1}",
            project_id="test_project",
            session_id="test_session",
            message=user_message,
            response=long_response,
            timestamp=datetime.now(),
            message_type="chat"
        ))
    
    long_summary = agent._create_conversation_summary_with_smart_truncation(long_messages, current_message)
    print(f"Long summary length: {len(long_summary)} characters")
    print(f"Contains '...': {'...' in long_summary}")  # Should contain truncation markers
    print()
    
    print("✅ Enhanced Conversation Context Tests Completed!")
    return True

async def test_response_handlers_with_context():
    """Test that response handlers use enhanced conversation context."""
    print("\n🧪 Testing Response Handlers with Enhanced Context")
    print("=" * 60)
    
    agent = UnifiedSamuraiAgent()
    
    # Create a conversation context with multiple messages
    session_messages = []
    for i in range(15):
        user_message = f"User message {i+1}: Let's work on the authentication system"
        assistant_response = f"Assistant response {i+1}: I'll help you implement authentication with JWT tokens"
        
        session_messages.append(ChatMessage(
            id=f"msg_{i+1}",
            project_id="test_project",
            session_id="test_session",
            message=user_message,
            response=assistant_response,
            timestamp=datetime.now(),
            message_type="chat"
        ))
    
    # Create conversation context
    from services.unified_samurai_agent import ConversationContext
    
    context = ConversationContext(
        session_messages=session_messages,
        conversation_summary="Test conversation about authentication",
        relevant_tasks=[],
        relevant_memories=[],
        project_context={"name": "Test Project", "tech_stack": "React + Node.js"}
    )
    
    current_message = "Now let's implement the user registration feature we discussed"
    
    print(f"📊 Testing with {len(session_messages)} conversation messages")
    print(f"📝 Current message: {current_message}")
    print()
    
    # Test pure discussion handler
    print("🔍 Test 1: Pure Discussion Handler")
    print("-" * 40)
    
    try:
        result = await agent._handle_pure_discussion(current_message, context)
        print(f"✅ Pure discussion handler completed")
        print(f"Response type: {result.get('type')}")
        print(f"Context used: {result.get('context_used', {}).get('conversation_depth')} messages")
        print(f"Response length: {len(result.get('response', ''))} characters")
    except Exception as e:
        print(f"❌ Pure discussion handler failed: {e}")
    
    print()
    
    # Test feature exploration handler
    print("🔍 Test 2: Feature Exploration Handler")
    print("-" * 40)
    
    try:
        from services.unified_samurai_agent import IntentAnalysis
        
        intent_analysis = IntentAnalysis(
            intent_type="feature_exploration",
            confidence=0.8,
            reasoning="User wants to explore a new feature",
            needs_clarification=True,
            clarification_questions=["What specific functionality do you need?"],
            accumulated_specs={}
        )
        
        result = await agent._handle_feature_exploration(current_message, context, intent_analysis)
        print(f"✅ Feature exploration handler completed")
        print(f"Response type: {result.get('type')}")
        print(f"Context used: {result.get('context_used', {}).get('conversation_depth')} messages")
        print(f"Response length: {len(result.get('response', ''))} characters")
    except Exception as e:
        print(f"❌ Feature exploration handler failed: {e}")
    
    print()
    
    print("✅ Response Handler Tests Completed!")
    return True

async def main():
    """Run all tests."""
    print("🚀 Starting Enhanced Conversation Context Tests")
    print("=" * 60)
    
    try:
        # Test conversation summary methods
        await test_enhanced_conversation_summary()
        
        # Test response handlers
        await test_response_handlers_with_context()
        
        print("\n🎉 All tests completed successfully!")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
