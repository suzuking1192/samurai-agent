#!/usr/bin/env python3
"""
Test script to verify the API chat endpoint generates tasks and memories correctly.
"""

import requests
import json
import time
from datetime import datetime

def test_api_chat():
    """Test the API chat endpoint"""
    
    base_url = "http://localhost:8000"
    
    print("🧪 Testing API Chat Endpoint")
    print("=" * 50)
    
    # First, create a test project
    project_data = {
        "name": "API Test Project",
        "description": "A test project for API testing",
        "tech_stack": "React + FastAPI + PostgreSQL"
    }
    
    print("📝 Creating test project...")
    response = requests.post(f"{base_url}/projects", json=project_data)
    
    if response.status_code != 200:
        print(f"❌ Failed to create project: {response.status_code}")
        print(response.text)
        return False
    
    project = response.json()
    project_id = project["id"]
    print(f"✅ Created project: {project['name']} (ID: {project_id})")
    
    # Test messages that should generate tasks
    test_messages = [
        "I need to add user authentication to my app",
        "I should implement a shopping cart feature"
    ]
    
    for i, message in enumerate(test_messages, 1):
        print(f"\n📝 Test {i}: '{message}'")
        print("-" * 30)
        
        # Send chat message
        chat_data = {"message": message}
        response = requests.post(f"{base_url}/projects/{project_id}/chat", json=chat_data)
        
        if response.status_code != 200:
            print(f"❌ Chat request failed: {response.status_code}")
            print(response.text)
            continue
        
        chat_response = response.json()
        print(f"Response type: {chat_response.get('type', 'unknown')}")
        print(f"Response: {chat_response.get('response', 'No response')[:100]}...")
        
        # Check if tasks were generated
        tasks = chat_response.get('tasks', [])
        if tasks:
            print(f"✅ Generated {len(tasks)} tasks:")
            for j, task in enumerate(tasks, 1):
                print(f"  {j}. {task['title']}")
        else:
            print("❌ No tasks generated")
        
        # Check memories
        memories = chat_response.get('memories', [])
        print(f"📊 Memories in response: {len(memories)}")
        
        # Wait a bit between requests
        time.sleep(1)
    
    # Check final state
    print(f"\n📋 Checking final state...")
    
    # Get tasks
    response = requests.get(f"{base_url}/projects/{project_id}/tasks")
    if response.status_code == 200:
        tasks = response.json()
        print(f"Total tasks in database: {len(tasks)}")
        if tasks:
            print("Recent tasks:")
            for task in tasks[-3:]:  # Show last 3 tasks
                print(f"  • {task['title']}")
    else:
        print(f"❌ Failed to get tasks: {response.status_code}")
    
    # Get memories
    response = requests.get(f"{base_url}/projects/{project_id}/memories")
    if response.status_code == 200:
        memories = response.json()
        print(f"Total memories in database: {len(memories)}")
        if memories:
            print("Recent memories:")
            for memory in memories[-2:]:  # Show last 2 memories
                print(f"  • [{memory['type']}] {memory['title']}: {memory['content'][:50]}...")
    else:
        print(f"❌ Failed to get memories: {response.status_code}")
    
    # Success criteria
    success = True
    if response.status_code == 200:
        tasks = response.json()
        memories = requests.get(f"{base_url}/projects/{project_id}/memories").json()
        success = len(tasks) > 0 and len(memories) > 0
    
    print(f"\n{'✅ SUCCESS' if success else '❌ FAILURE'}: API chat endpoint is {'working' if success else 'broken'}")
    
    return success

if __name__ == "__main__":
    try:
        success = test_api_chat()
        exit(0 if success else 1)
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server. Make sure the server is running on http://localhost:8000")
        exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        exit(1) 