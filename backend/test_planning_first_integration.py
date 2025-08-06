"""
Simple integration test to verify planning-first agent is working correctly
"""

import asyncio
import logging
from datetime import datetime

# Import the agents
from services.ai_agent import SamuraiAgent
from services.planning_first_agent import planning_first_agent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_planning_first_integration():
    """Test that the planning-first agent is working correctly."""
    
    print("🧪 Testing Planning-First Integration")
    print("=" * 50)
    
    # Test 1: Verify agents are initialized
    print("1. Testing agent initialization...")
    try:
        samurai_agent = SamuraiAgent()
        print("✅ SamuraiAgent initialized successfully")
        
        print("✅ PlanningFirstAgent singleton available")
        print(f"   - Agent type: {type(planning_first_agent)}")
        print(f"   - Agent class: {planning_first_agent.__class__.__name__}")
        
    except Exception as e:
        print(f"❌ Agent initialization failed: {e}")
        return False
    
    # Test 2: Test simple message processing
    print("\n2. Testing message processing...")
    try:
        # Create test project context
        project_context = {
            "name": "Test Project",
            "description": "A test project for planning-first integration",
            "tech_stack": "React + FastAPI + PostgreSQL"
        }
        
        # Test message
        test_message = "I want to add user authentication to my app"
        
        print(f"   Testing message: '{test_message}'")
        
        # Process with planning-first agent directly
        result = await planning_first_agent.process_user_message(
            message=test_message,
            project_id="test-project",
            project_context=project_context,
            session_id="test-session",
            conversation_history=[]
        )
        
        print(f"✅ Planning-first agent processed message successfully")
        print(f"   - Response type: {result.get('type', 'unknown')}")
        print(f"   - Plan type: {result.get('plan_type', 'unknown')}")
        print(f"   - Steps completed: {result.get('steps_completed', 0)}")
        print(f"   - Confidence: {result.get('confidence_score', 0.0):.2f}")
        
        # Check if response contains planning-first indicators
        response = result.get('response', '')
        if 'planning_first' in result.get('type', '') or result.get('plan_type'):
            print("✅ Planning-first architecture is active")
        else:
            print("⚠️  Planning-first indicators not found in response")
        
    except Exception as e:
        print(f"❌ Message processing failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test 3: Test SamuraiAgent integration
    print("\n3. Testing SamuraiAgent integration...")
    try:
        # Test with SamuraiAgent (which should use planning-first internally)
        result = await samurai_agent.process_message(
            message="Can you help me create a task for implementing authentication?",
            project_id="test-project",
            project_context=project_context,
            session_id="test-session",
            conversation_history=[]
        )
        
        print(f"✅ SamuraiAgent processed message successfully")
        print(f"   - Response type: {result.get('type', 'unknown')}")
        print(f"   - Plan executed: {result.get('plan_executed', 'none')}")
        print(f"   - Total steps: {result.get('total_steps', 0)}")
        
        # Check if planning-first is being used
        if result.get('plan_executed') or result.get('plan_type'):
            print("✅ SamuraiAgent is using planning-first architecture")
        else:
            print("⚠️  SamuraiAgent may not be using planning-first architecture")
        
    except Exception as e:
        print(f"❌ SamuraiAgent processing failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 50)
    print("🎉 Planning-First Integration Test Complete!")
    print("=" * 50)
    
    return True


async def test_conversation_continuity():
    """Test conversation continuity with planning-first agent."""
    
    print("\n🔄 Testing Conversation Continuity")
    print("=" * 50)
    
    try:
        # Create test project context
        project_context = {
            "name": "Test Project",
            "description": "A test project for conversation continuity",
            "tech_stack": "React + FastAPI + PostgreSQL"
        }
        
        # Simulate a conversation
        messages = [
            "I want to build a todo app",
            "I prefer using React for the frontend",
            "Can you create a task for the React setup?"
        ]
        
        conversation_history = []
        
        for i, message in enumerate(messages, 1):
            print(f"\nMessage {i}: {message}")
            
            result = await planning_first_agent.process_user_message(
                message=message,
                project_id="test-project",
                project_context=project_context,
                session_id="test-session",
                conversation_history=conversation_history
            )
            
            print(f"   Response: {result.get('response', '')[:100]}...")
            print(f"   Plan type: {result.get('plan_type', 'unknown')}")
            print(f"   Confidence: {result.get('confidence_score', 0.0):.2f}")
            
            # Add to conversation history
            from models import ChatMessage
            conversation_history.append(ChatMessage(
                id=f"msg_{i}",
                project_id="test-project",
                session_id="test-session",
                message=message,
                response=result.get('response', ''),
                created_at=datetime.now()
            ))
        
        print("\n✅ Conversation continuity test completed")
        
    except Exception as e:
        print(f"❌ Conversation continuity test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("Starting Planning-First Integration Tests...")
    
    # Run the tests
    success = asyncio.run(test_planning_first_integration())
    
    if success:
        # Run conversation continuity test
        asyncio.run(test_conversation_continuity())
    
    print("\n🏁 All tests completed!") 