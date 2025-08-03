#!/usr/bin/env python3
"""
Test script for prompt generation functionality
"""

import asyncio
import sys
import os

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.ai_agent import SamuraiAgent
from services.file_service import FileService
from models import Task, Memory, Project
from datetime import datetime

async def test_prompt_generation():
    """Test the prompt generation functionality"""
    print("🧪 Testing Prompt Generation Functionality")
    print("=" * 50)
    
    # Initialize services
    agent = SamuraiAgent()
    file_service = FileService()
    
    # Create a test project
    test_project = Project(
        id="test-prompt-project",
        name="Test Prompt Project",
        description="A test project for prompt generation",
        tech_stack="React + FastAPI + PostgreSQL",
        created_at=datetime.now()
    )
    
    # Save the project
    file_service.save_project(test_project)
    print(f"✅ Created test project: {test_project.name}")
    
    # Create some test memories
    memories = [
        Memory(
            id="mem-1",
            project_id=test_project.id,
            title="Authentication System",
            content="We decided to use JWT tokens for authentication. The system should handle user login, logout, and token refresh. Store tokens in httpOnly cookies for security.",
            type="decision",
            created_at=datetime.now()
        ),
        Memory(
            id="mem-2", 
            project_id=test_project.id,
            title="Database Schema",
            content="Users table: id, email, password_hash, created_at. Sessions table: id, user_id, token, expires_at. Use PostgreSQL with proper indexing.",
            type="spec",
            created_at=datetime.now()
        ),
        Memory(
            id="mem-3",
            project_id=test_project.id, 
            title="API Structure",
            content="RESTful API with FastAPI. Endpoints: /auth/login, /auth/logout, /auth/refresh, /users/profile. Use Pydantic for validation.",
            type="note",
            created_at=datetime.now()
        )
    ]
    
    # Save memories
    for memory in memories:
        file_service.save_memory(test_project.id, memory)
    print(f"✅ Created {len(memories)} test memories")
    
    # Create a test task
    test_task = Task(
        id="task-1",
        project_id=test_project.id,
        title="Implement User Registration",
        description="Create a user registration endpoint that validates email, hashes passwords, and creates user records. Include proper error handling and validation.",
        status="pending",
        priority="high",
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    # Save the task
    file_service.save_task(test_project.id, test_task)
    print(f"✅ Created test task: {test_task.title}")
    
    # Test prompt generation
    print("\n🤖 Generating intelligent prompt...")
    related_memories = await agent.get_related_memories_for_task(test_task.id, limit=3)
    print(f"✅ Found {len(related_memories)} related memories")
    
    # Generate the prompt
    project_dict = {
        "name": test_project.name,
        "description": test_project.description,
        "tech_stack": test_project.tech_stack
    }
    
    prompt = agent.generate_intelligent_prompt(test_task, project_dict, related_memories)
    
    print("\n📝 Generated Prompt:")
    print("=" * 50)
    print(prompt)
    print("=" * 50)
    
    # Test the API endpoint
    print("\n🌐 Testing API endpoint...")
    try:
        import requests
        response = requests.post(
            f"http://localhost:8000/api/tasks/{test_task.id}/generate-prompt",
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ API test successful!")
            print(f"   Prompt length: {data['prompt_length']} characters")
            print(f"   Related memories: {data['related_memories_count']}")
            print(f"   Generated at: {data['generated_at']}")
        else:
            print(f"❌ API test failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ API test failed: {e}")
    
    # Cleanup
    print("\n🧹 Cleaning up test data...")
    file_service.delete_project(test_project.id)
    print("✅ Cleanup complete")
    
    print("\n🎉 Prompt generation test completed!")

if __name__ == "__main__":
    asyncio.run(test_prompt_generation()) 