#!/usr/bin/env python3
"""
Test script for context selection service.
"""

import sys
import os
from datetime import datetime, timedelta

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.context_service import context_service
from models import Memory, Task, Project

def test_context_selection():
    """Test the context selection service."""
    
    print("🧪 Testing Context Selection Service")
    print("=" * 50)
    
    # Create test project
    project = Project(
        id="test-project",
        name="Test Project",
        description="A test project for context selection",
        tech_stack="Python, FastAPI, React",
        created_at=datetime.now()
    )
    
    # Create test memories
    memories = [
        Memory(
            id="memory-1",
            project_id="test-project",
            content="User authentication system using JWT tokens",
            type="decision",
            created_at=datetime.now() - timedelta(days=1)
        ),
        Memory(
            id="memory-2", 
            project_id="test-project",
            content="Database schema design for users table",
            type="decision",
            created_at=datetime.now() - timedelta(days=2)
        ),
        Memory(
            id="memory-3",
            project_id="test-project", 
            content="API endpoint structure for RESTful design",
            type="context",
            created_at=datetime.now() - timedelta(days=5)
        ),
        Memory(
            id="memory-4",
            project_id="test-project",
            content="Frontend component architecture using React hooks",
            type="note",
            created_at=datetime.now() - timedelta(days=10)
        )
    ]
    
    # Create test tasks
    tasks = [
        Task(
            id="task-1",
            project_id="test-project",
            title="Implement user authentication",
            description="Create JWT-based authentication system with login/logout",
            status="in_progress",
            priority="high",
            created_at=datetime.now() - timedelta(days=1)
        ),
        Task(
            id="task-2",
            project_id="test-project", 
            title="Design database schema",
            description="Create users table with proper indexes and constraints",
            status="completed",
            priority="high",
            created_at=datetime.now() - timedelta(days=3)
        ),
        Task(
            id="task-3",
            project_id="test-project",
            title="Build API endpoints",
            description="Implement RESTful API endpoints for user management",
            status="pending",
            priority="medium",
            created_at=datetime.now() - timedelta(days=5)
        )
    ]
    
    # Test queries
    test_queries = [
        "How do I implement user authentication?",
        "What's the database schema for users?",
        "Show me the API endpoints",
        "What tasks are in progress?",
        "Tell me about the frontend architecture"
    ]
    
    for i, query in enumerate(test_queries, 1):
        print(f"\n🔍 Test Query {i}: '{query}'")
        print("-" * 40)
        
        # Get relevant context
        relevant_memories, relevant_tasks = context_service.select_relevant_context(
            user_input=query,
            project_id="test-project",
            memories=memories,
            tasks=tasks,
            max_items=5,
            min_score=0.1
        )
        
        print(f"📝 Relevant Memories ({len(relevant_memories)}):")
        for memory in relevant_memories:
            print(f"  • [{memory.type.upper()}] {memory.content}")
        
        print(f"📋 Relevant Tasks ({len(relevant_tasks)}):")
        for task in relevant_tasks:
            status_emoji = {"pending": "⏳", "in_progress": "🔄", "completed": "✅"}.get(task.status, "📋")
            print(f"  • {status_emoji} {task.title} - {task.description}")
    
    # Test hierarchical context
    print(f"\n🏗️  Testing Hierarchical Context Selection")
    print("-" * 40)
    
    hierarchical_memories, hierarchical_tasks = context_service.get_hierarchical_context(
        user_input="Show me everything about authentication",
        project_id="test-project",
        memories=memories,
        tasks=tasks,
        max_total_items=10
    )
    
    print(f"📝 Hierarchical Memories ({len(hierarchical_memories)}):")
    for memory in hierarchical_memories:
        print(f"  • [{memory.type.upper()}] {memory.content}")
    
    print(f"📋 Hierarchical Tasks ({len(hierarchical_tasks)}):")
    for task in hierarchical_tasks:
        status_emoji = {"pending": "⏳", "in_progress": "🔄", "completed": "✅"}.get(task.status, "📋")
        print(f"  • {status_emoji} {task.title} - {task.description}")
    
    # Test context formatting
    print(f"\n📄 Testing Context Formatting")
    print("-" * 40)
    
    formatted_context = context_service.format_context_for_prompt(
        memories=relevant_memories,
        tasks=relevant_tasks,
        project=project
    )
    
    print("Formatted Context:")
    print(formatted_context)
    
    print(f"\n✅ Context Selection Tests Completed Successfully!")

if __name__ == "__main__":
    test_context_selection() 