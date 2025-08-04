import asyncio
import sys
import os
import logging

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.agent_planning import (
    AgentPlanningPhase, 
    IntelligentAgent, 
    CommonIssuePatterns, 
    ResponseLengthHandler
)
from services.ai_agent import SamuraiAgent
from models import Task, Memory, Project
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_response_length_detection():
    """Test that response length issues are detected correctly"""
    print("\n🧪 Testing Response Length Detection")
    
    # Test message that should trigger response length detection
    test_message = "The response was very detailed and exceeded our limits. The agent is processing a shorter version for you. this shows up every time, so I want to fix this issue"
    
    # Test pattern detection
    pattern = CommonIssuePatterns.detect_issue_type(test_message)
    print(f"Detected pattern: {pattern}")
    
    assert pattern["type"] == "response_length"
    assert pattern["confidence"] > 0.7
    print("✅ Response length pattern detected correctly")
    
    # Test direct handler
    is_response_length = ResponseLengthHandler.detect_response_length_issue(test_message)
    assert is_response_length
    print("✅ Response length handler detected correctly")
    
    # Test handler response
    response = await ResponseLengthHandler.handle_response_length_issue({
        "message": test_message,
        "history": []
    })
    
    assert "response exceeded limits" in response.lower()
    assert "5000 character limit" in response
    assert "solution" in response.lower()
    print("✅ Response length handler provided helpful solution")


async def test_planning_phase():
    """Test the planning phase with different types of messages"""
    print("\n🧪 Testing Planning Phase")
    
    # Create test data
    project_context = {
        "name": "Test Project",
        "description": "A test project for planning phase",
        "tech_stack": "React + FastAPI"
    }
    
    conversation_history = [
        {"role": "user", "content": "I want to add user authentication"},
        {"role": "assistant", "content": "I'll help you add user authentication. What type of auth do you prefer?"},
        {"role": "user", "content": "JWT tokens with email/password"}
    ]
    
    project_memories = [
        Memory(
            id="1",
            project_id="test",
            title="Authentication Decision",
            content="Decided to use JWT tokens with email/password authentication",
            category="decision",
            type="decision",
            created_at=datetime.now()
        )
    ]
    
    tasks = [
        Task(
            id="1",
            project_id="test",
            title="Setup JWT Authentication",
            description="Implement JWT token generation and validation",
            completed=False,
            order=1,
            created_at=datetime.now()
        )
    ]
    
    # Test planning phase
    planning = AgentPlanningPhase(
        user_message="The login form is done",
        conversation_history=conversation_history,
        project_memories=project_memories,
        tasks=tasks,
        project_context=project_context
    )
    
    plan = await planning.analyze_and_plan()
    print(f"Generated plan: {plan}")
    
    assert plan["response_type"] in ["direct_solution", "guided_help", "clarifying_questions"]
    assert "understanding_statement" in plan
    assert "main_solution" in plan
    print("✅ Planning phase generated valid plan")


async def test_intelligent_agent():
    """Test the intelligent agent with planning phase"""
    print("\n🧪 Testing Intelligent Agent")
    
    # Create test data
    project_context = {
        "name": "Test Project",
        "description": "A test project for intelligent agent",
        "tech_stack": "React + FastAPI"
    }
    
    conversation_history = [
        {"role": "user", "content": "I want to add user authentication"},
        {"role": "assistant", "content": "I'll help you add user authentication. What type of auth do you prefer?"}
    ]
    
    project_memories = []
    tasks = []
    
    # Test intelligent agent
    agent = IntelligentAgent()
    
    # Test with task management message
    response = await agent.process_user_message(
        user_message="The login form is done",
        conversation_history=conversation_history,
        project_memories=project_memories,
        tasks=tasks,
        project_context=project_context
    )
    
    print(f"Intelligent agent response: {response[:200]}...")
    assert len(response) > 0
    assert "understand" in response.lower() or "login" in response.lower()
    print("✅ Intelligent agent provided helpful response")


async def test_samurai_agent_integration():
    """Test the full SamuraiAgent with planning phase integration"""
    print("\n🧪 Testing SamuraiAgent Integration")
    
    # Create test project
    test_project = Project(
        id="test-planning",
        name="Test Planning Project",
        description="A test project for planning phase integration",
        tech_stack="React + FastAPI + PostgreSQL",
        created_at=datetime.now()
    )
    
    project_context = {
        "name": test_project.name,
        "description": test_project.description,
        "tech_stack": test_project.tech_stack
    }
    
    # Test SamuraiAgent
    agent = SamuraiAgent()
    
    # Test with response length issue
    result = await agent.process_message(
        message="The response was very detailed and exceeded our limits. The agent is processing a shorter version for you. this shows up every time, so I want to fix this issue",
        project_id=test_project.id,
        project_context=project_context
    )
    
    print(f"SamuraiAgent result type: {result.get('type')}")
    print(f"SamuraiAgent response: {result.get('response', '')[:200]}...")
    
    assert result["type"] == "direct_solution"
    assert "response exceeded limits" in result["response"].lower()
    print("✅ SamuraiAgent handled response length issue correctly")
    
    # Test with regular feature request
    result = await agent.process_message(
        message="I want to add user authentication with JWT tokens",
        project_id=test_project.id,
        project_context=project_context
    )
    
    print(f"Feature request result type: {result.get('type')}")
    print(f"Feature request response: {result.get('response', '')[:200]}...")
    
    assert result["type"] in ["feature_breakdown", "chat", "guided_help"]
    assert len(result["response"]) > 0
    print("✅ SamuraiAgent handled feature request correctly")


async def test_common_patterns():
    """Test common issue pattern detection"""
    print("\n🧪 Testing Common Pattern Detection")
    
    test_cases = [
        {
            "message": "The response was very detailed and exceeded our limits",
            "expected_type": "response_length",
            "expected_confidence": 0.8
        },
        {
            "message": "I can't see the tasks on the screen",
            "expected_type": "ui_issues", 
            "expected_confidence": 0.8
        },
        {
            "message": "The task management doesn't work",
            "expected_type": "task_problems",
            "expected_confidence": 0.8
        },
        {
            "message": "The memories are not saving",
            "expected_type": "memory_issues",
            "expected_confidence": 0.8
        },
        {
            "message": "Hello, how are you?",
            "expected_type": "general",
            "expected_confidence": 0.3
        }
    ]
    
    for i, test_case in enumerate(test_cases):
        pattern = CommonIssuePatterns.detect_issue_type(test_case["message"])
        print(f"Test {i+1}: {test_case['message'][:50]}... -> {pattern['type']} (confidence: {pattern['confidence']})")
        
        assert pattern["type"] == test_case["expected_type"]
        assert pattern["confidence"] >= test_case["expected_confidence"]
    
    print("✅ All common patterns detected correctly")


async def main():
    """Run all tests"""
    print("🚀 Starting Agent Planning Phase Tests")
    print("=" * 50)
    
    try:
        await test_response_length_detection()
        await test_planning_phase()
        await test_intelligent_agent()
        await test_samurai_agent_integration()
        await test_common_patterns()
        
        print("\n" + "=" * 50)
        print("✅ All tests passed! Agent Planning Phase is working correctly.")
        print("🎯 The agent should now provide better context understanding and specific solutions.")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main()) 