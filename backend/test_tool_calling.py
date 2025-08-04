import asyncio
import sys
import os
import logging

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.agent_tools import AgentToolRegistry, CreateTaskTool, ChangeTaskStatusTool, CreateMemoryTool
from services.tool_calling_agent import ToolCallingSamuraiAgent, EnhancedSamuraiAgent
from models import Task, Memory, Project
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_tool_registry():
    """Test the tool registry functionality"""
    print("\n🧪 Testing Tool Registry")
    
    registry = AgentToolRegistry()
    
    # Test available tools
    available_tools = registry.get_available_tools()
    print(f"Available tools: {available_tools}")
    
    assert "create_task" in available_tools
    assert "change_task_status" in available_tools
    assert "create_memory" in available_tools
    print("✅ Tool registry has expected tools")
    
    # Test tool descriptions
    descriptions = registry.get_tool_descriptions()
    print(f"Tool descriptions: {descriptions[:200]}...")
    
    assert "create_task" in descriptions
    assert "create_memory" in descriptions
    print("✅ Tool descriptions generated correctly")


async def test_create_task_tool():
    """Test the create task tool"""
    print("\n🧪 Testing Create Task Tool")
    
    tool = CreateTaskTool()
    
    # Test task creation
    result = tool.execute(
        title="Test Authentication Task",
        description="Implement user authentication with JWT tokens",
        priority="high",
        project_id="test-project"
    )
    
    print(f"Create task result: {result}")
    
    assert result["success"] == True
    assert "Test Authentication Task" in result["message"]
    assert "task_id" in result
    print("✅ Create task tool works correctly")


async def test_change_task_status_tool():
    """Test the change task status tool"""
    print("\n🧪 Testing Change Task Status Tool")
    
    tool = ChangeTaskStatusTool()
    
    # Test status change
    result = tool.execute(
        task_identifier="Test Authentication Task",
        new_status="completed",
        project_id="test-project"
    )
    
    print(f"Change status result: {result}")
    
    # Should find the task we created earlier
    assert result["success"] == True
    assert "completed" in result["message"]
    print("✅ Change task status tool works correctly")


async def test_create_memory_tool():
    """Test the create memory tool"""
    print("\n🧪 Testing Create Memory Tool")
    
    tool = CreateMemoryTool()
    
    # Test memory creation
    result = tool.execute(
        title="Database Decision",
        content="Decided to use PostgreSQL for the database due to its reliability and JSON support",
        project_id="test-project",
        category="decision"
    )
    
    print(f"Create memory result: {result}")
    
    assert result["success"] == True
    assert "Database Decision" in result["message"]
    assert "memory_id" in result
    print("✅ Create memory tool works correctly")


async def test_tool_calling_agent():
    """Test the tool calling agent"""
    print("\n🧪 Testing Tool Calling Agent")
    
    agent = ToolCallingSamuraiAgent()
    
    # Test with a task creation request
    result = await agent.process_user_message(
        user_message="Create a task to implement user authentication with high priority",
        project_id="test-project",
        conversation_history=[],
        project_memories=[],
        tasks=[],
        project_context={
            "name": "Test Project",
            "description": "A test project for tool calling",
            "tech_stack": "React + FastAPI"
        }
    )
    
    print(f"Tool calling agent result: {result}")
    
    assert "response" in result
    assert "tool_calls_made" in result
    assert "tool_results" in result
    assert result["tool_calls_made"] > 0
    print("✅ Tool calling agent processes requests correctly")


async def test_enhanced_samurai_agent():
    """Test the enhanced SamuraiAgent with tool calling"""
    print("\n🧪 Testing Enhanced SamuraiAgent")
    
    agent = EnhancedSamuraiAgent()
    
    # Test with a task creation request
    result = await agent.process_message(
        message="Create a task to implement user authentication with high priority",
        project_id="test-project",
        project_context={
            "name": "Test Project",
            "description": "A test project for enhanced agent",
            "tech_stack": "React + FastAPI"
        }
    )
    
    print(f"Enhanced agent result: {result}")
    
    assert "response" in result
    assert "type" in result
    assert "tool_calls_made" in result
    print("✅ Enhanced SamuraiAgent works correctly")


async def test_task_management_workflow():
    """Test a complete task management workflow"""
    print("\n🧪 Testing Task Management Workflow")
    
    agent = EnhancedSamuraiAgent()
    
    # Step 1: Create a task
    result1 = await agent.process_message(
        message="Create a task to implement user authentication",
        project_id="test-workflow",
        project_context={
            "name": "Workflow Test Project",
            "description": "Testing task management workflow",
            "tech_stack": "React + FastAPI"
        }
    )
    
    print(f"Step 1 - Create task: {result1['response'][:100]}...")
    assert result1["tool_calls_made"] > 0
    print("✅ Task creation successful")
    
    # Step 2: Mark task as completed
    result2 = await agent.process_message(
        message="Mark the authentication task as completed",
        project_id="test-workflow",
        project_context={
            "name": "Workflow Test Project",
            "description": "Testing task management workflow",
            "tech_stack": "React + FastAPI"
        }
    )
    
    print(f"Step 2 - Complete task: {result2['response'][:100]}...")
    assert result2["tool_calls_made"] > 0
    print("✅ Task completion successful")
    
    # Step 3: Add a memory
    result3 = await agent.process_message(
        message="Add a memory about choosing JWT for authentication",
        project_id="test-workflow",
        project_context={
            "name": "Workflow Test Project",
            "description": "Testing task management workflow",
            "tech_stack": "React + FastAPI"
        }
    )
    
    print(f"Step 3 - Add memory: {result3['response'][:100]}...")
    assert result3["tool_calls_made"] > 0
    print("✅ Memory creation successful")


async def test_non_tool_requests():
    """Test that non-tool requests are handled correctly"""
    print("\n🧪 Testing Non-Tool Requests")
    
    agent = EnhancedSamuraiAgent()
    
    # Test with a question that doesn't need tools
    result = await agent.process_message(
        message="How do I implement authentication in React?",
        project_id="test-non-tool",
        project_context={
            "name": "Non-Tool Test Project",
            "description": "Testing non-tool requests",
            "tech_stack": "React + FastAPI"
        }
    )
    
    print(f"Non-tool request result: {result['response'][:100]}...")
    
    assert "response" in result
    assert result["tool_calls_made"] == 0
    assert "authentication" in result["response"].lower() or "react" in result["response"].lower()
    print("✅ Non-tool requests handled correctly")


async def main():
    """Run all tool calling tests"""
    print("🚀 Starting Tool Calling Tests")
    print("=" * 50)
    
    try:
        await test_tool_registry()
        await test_create_task_tool()
        await test_change_task_status_tool()
        await test_create_memory_tool()
        await test_tool_calling_agent()
        await test_enhanced_samurai_agent()
        await test_task_management_workflow()
        await test_non_tool_requests()
        
        print("\n" + "=" * 50)
        print("✅ All tool calling tests passed!")
        print("🎯 The agent can now actively manipulate tasks and memories!")
        print("🔧 Tool calling functionality is working correctly.")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main()) 