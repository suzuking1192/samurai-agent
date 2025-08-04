import asyncio
import sys
import os
import logging

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.ai_agent import SamuraiAgent
from models import Project
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_response_length_fix():
    """Test that the response length issue is properly handled"""
    print("\n🧪 Testing Response Length Fix")
    
    # Create test project
    test_project = Project(
        id="test-response-length",
        name="Test Response Length Project",
        description="A test project for response length handling",
        tech_stack="React + FastAPI",
        created_at=datetime.now()
    )
    
    project_context = {
        "name": test_project.name,
        "description": test_project.description,
        "tech_stack": test_project.tech_stack
    }
    
    # Test the exact message from the user's example
    test_message = "The response was very detailed and exceeded our limits. The agent is processing a shorter version for you. this shows up every time, so I want to fix this issue"
    
    # Test SamuraiAgent
    agent = SamuraiAgent()
    
    result = await agent.process_message(
        message=test_message,
        project_id=test_project.id,
        project_context=project_context
    )
    
    print(f"Response type: {result.get('type')}")
    print(f"Response: {result.get('response', '')[:300]}...")
    
    # Verify the response is helpful and specific
    response = result.get("response", "")
    
    # Check that it's not a generic "could you be more specific" response
    assert "could you be more specific" not in response.lower()
    assert "couldn't understand" not in response.lower()
    
    # Check that it addresses the specific issue
    assert "response exceeded limits" in response.lower() or "5000 character limit" in response
    assert "solution" in response.lower() or "fix" in response.lower()
    
    print("✅ Response length issue handled correctly - no generic response!")
    print("✅ Agent provided specific solution for the response length problem")


async def test_other_common_issues():
    """Test other common issues are handled properly"""
    print("\n🧪 Testing Other Common Issues")
    
    # Create test project
    test_project = Project(
        id="test-common-issues",
        name="Test Common Issues Project",
        description="A test project for common issue handling",
        tech_stack="React + FastAPI",
        created_at=datetime.now()
    )
    
    project_context = {
        "name": test_project.name,
        "description": test_project.description,
        "tech_stack": test_project.tech_stack
    }
    
    agent = SamuraiAgent()
    
    # Test UI issues
    ui_message = "I can't see the tasks on the screen, there's white space everywhere"
    result = await agent.process_message(
        message=ui_message,
        project_id=test_project.id,
        project_context=project_context
    )
    
    print(f"UI issue response: {result.get('response', '')[:200]}...")
    assert len(result.get("response", "")) > 0
    print("✅ UI issue handled")
    
    # Test task management issues
    task_message = "The task management doesn't work, I can't complete tasks"
    result = await agent.process_message(
        message=task_message,
        project_id=test_project.id,
        project_context=project_context
    )
    
    print(f"Task issue response: {result.get('response', '')[:200]}...")
    assert len(result.get("response", "")) > 0
    print("✅ Task management issue handled")
    
    # Test memory issues
    memory_message = "The memories are not saving, I can't remember anything"
    result = await agent.process_message(
        message=memory_message,
        project_id=test_project.id,
        project_context=project_context
    )
    
    print(f"Memory issue response: {result.get('response', '')[:200]}...")
    assert len(result.get("response", "")) > 0
    print("✅ Memory issue handled")


async def main():
    """Run the response length fix tests"""
    print("🚀 Testing Response Length Fix Implementation")
    print("=" * 50)
    
    try:
        await test_response_length_fix()
        await test_other_common_issues()
        
        print("\n" + "=" * 50)
        print("✅ All response length fix tests passed!")
        print("🎯 The agent now provides specific solutions instead of generic responses.")
        print("🔧 Response length issues are properly detected and handled.")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main()) 