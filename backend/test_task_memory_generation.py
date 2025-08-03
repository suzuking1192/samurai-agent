#!/usr/bin/env python3
"""
Test script to verify task and memory generation from chat messages.
This tests the core functionality that was reported as broken.
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

async def test_task_memory_generation():
    """Test that tasks and memories are generated from chat messages"""
    
    print("🧪 Testing Task and Memory Generation from Chat")
    print("=" * 50)
    
    # Initialize services
    agent = SamuraiAgent()
    file_service = FileService()
    
    # Create a test project
    test_project = Project(
        id="test-task-memory-project",
        name="Test Task Memory Project",
        description="A test project for verifying task and memory generation",
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
    
    # Test messages that should generate tasks
    test_messages = [
        "I need to add user authentication to my app",
        "I should implement a shopping cart feature",
        "TODO: Fix the login bug and add password reset",
        "Can you help me create tasks for building a REST API?"
    ]
    
    project_context = {
        "name": test_project.name,
        "description": test_project.description,
        "tech_stack": test_project.tech_stack
    }
    
    for i, message in enumerate(test_messages, 1):
        print(f"\n📝 Test {i}: '{message}'")
        print("-" * 30)
        
        try:
            # Process the message
            result = await agent.process_message(
                message=message,
                project_id=test_project.id,
                project_context=project_context
            )
            
            print(f"Response type: {result.get('type', 'unknown')}")
            print(f"Response: {result.get('response', 'No response')[:100]}...")
            
            # Check if tasks were generated
            tasks = result.get('tasks', [])
            if tasks:
                print(f"✅ Generated {len(tasks)} tasks:")
                for j, task in enumerate(tasks, 1):
                    print(f"  {j}. {task.title}")
            else:
                print("❌ No tasks generated")
            
            # Check current state
            current_tasks = file_service.load_tasks(test_project.id)
            current_memories = file_service.load_memories(test_project.id)
            
            print(f"📊 Current state: {len(current_tasks)} tasks, {len(current_memories)} memories")
            
            if current_memories:
                print("🧠 Recent memories:")
                for memory in current_memories[-2:]:  # Show last 2 memories
                    print(f"  • [{memory.type}] {memory.title}: {memory.content[:50]}...")
            
        except Exception as e:
            print(f"❌ Error processing message: {e}")
            import traceback
            traceback.print_exc()
    
    # Final summary
    print("\n" + "=" * 50)
    print("📋 FINAL SUMMARY")
    print("=" * 50)
    
    final_tasks = file_service.load_tasks(test_project.id)
    final_memories = file_service.load_memories(test_project.id)
    
    print(f"Total tasks created: {len(final_tasks)}")
    print(f"Total memories created: {len(final_memories)}")
    
    if final_tasks:
        print("\n📋 All Tasks:")
        for i, task in enumerate(final_tasks, 1):
            status = "✅" if task.completed else "⏸️"
            print(f"  {status} {i}. {task.title}")
    
    if final_memories:
        print("\n🧠 All Memories:")
        for i, memory in enumerate(final_memories, 1):
            print(f"  {i}. [{memory.type}] {memory.title}: {memory.content[:100]}...")
    
    # Success criteria
    success = len(final_tasks) > 0 and len(final_memories) > 0
    print(f"\n{'✅ SUCCESS' if success else '❌ FAILURE'}: Task and memory generation is {'working' if success else 'broken'}")
    
    return success

if __name__ == "__main__":
    success = asyncio.run(test_task_memory_generation())
    sys.exit(0 if success else 1) 