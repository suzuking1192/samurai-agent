#!/usr/bin/env python3
"""
Focused test to verify that tasks are properly returned in API responses.
This tests the specific issue where tasks might be saved but not returned to frontend.
"""

import asyncio
import sys
import os
from datetime import datetime

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.ai_agent import SamuraiAgent
from services.file_service import FileService
from models import Project, Task, Memory

async def test_task_response():
    """Test that tasks are properly returned in API responses"""
    
    print("🧪 Testing Task Response in API")
    print("=" * 50)
    
    # Initialize services
    agent = SamuraiAgent()
    file_service = FileService()
    
    # Create a test project
    test_project = Project(
        id="test-task-response-project",
        name="Test Task Response Project",
        description="A test project for verifying task response",
        tech_stack="React + FastAPI + PostgreSQL",
        created_at=datetime.now()
    )
    
    # Save the project
    file_service.save_project(test_project)
    print(f"✅ Created test project: {test_project.name}")
    
    # Clear any existing data
    file_service.save_tasks(test_project.id, [])
    file_service.save_memories(test_project.id, [])
    print("✅ Cleared existing data")
    
    project_context = {
        "name": test_project.name,
        "description": test_project.description,
        "tech_stack": test_project.tech_stack
    }
    
    # Test message that should generate tasks
    test_message = "I need to add user authentication to my app"
    
    print(f"\n📝 Testing: '{test_message}'")
    print("-" * 30)
    
    try:
        # Process the message
        result = await agent.process_message(
            message=test_message,
            project_id=test_project.id,
            project_context=project_context
        )
        
        print(f"Response type: {result.get('type', 'unknown')}")
        print(f"Response: {result.get('response', 'No response')[:100]}...")
        
        # Check if tasks were generated in the result
        tasks_in_result = result.get('tasks', [])
        print(f"Tasks in result: {len(tasks_in_result)}")
        
        if tasks_in_result:
            print("✅ Tasks found in result:")
            for i, task in enumerate(tasks_in_result, 1):
                print(f"  {i}. {task.title}")
        else:
            print("❌ No tasks in result")
        
        # Check current state in database
        current_tasks = file_service.load_tasks(test_project.id)
        current_memories = file_service.load_memories(test_project.id)
        
        print(f"📊 Database state: {len(current_tasks)} tasks, {len(current_memories)} memories")
        
        # Verify that tasks in result match tasks in database
        if tasks_in_result and current_tasks:
            print("🔍 Comparing result tasks with database tasks:")
            result_titles = [task.title for task in tasks_in_result]
            db_titles = [task.title for task in current_tasks]
            
            if result_titles == db_titles:
                print("✅ Result tasks match database tasks")
            else:
                print("❌ Result tasks don't match database tasks")
                print(f"Result titles: {result_titles}")
                print(f"DB titles: {db_titles}")
        
        # Check if this would work in the API response format
        api_response_format = {
            "response": result.get("response", ""),
            "tasks": tasks_in_result,
            "memories": current_memories,
            "type": result.get("type", "chat")
        }
        
        print(f"\n📋 API Response Format:")
        print(f"  - Response: {len(api_response_format['response'])} chars")
        print(f"  - Tasks: {len(api_response_format['tasks'])}")
        print(f"  - Memories: {len(api_response_format['memories'])}")
        print(f"  - Type: {api_response_format['type']}")
        
        # Success criteria
        success = len(tasks_in_result) > 0 and len(current_tasks) > 0
        print(f"\n{'✅ SUCCESS' if success else '❌ FAILURE'}: Tasks are {'properly returned' if success else 'not returned'} in API response")
        
        return success
        
    except Exception as e:
        print(f"❌ Error processing message: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_task_response())
    sys.exit(0 if success else 1) 