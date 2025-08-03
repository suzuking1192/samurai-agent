#!/usr/bin/env python3
"""
Simple test to verify API response format and task generation.
"""

import requests
import json

def test_api_response():
    """Test the API response format"""
    
    base_url = "http://localhost:8000"
    
    print("🧪 Testing API Response Format")
    print("=" * 50)
    
    # Create a test project
    project_data = {
        "name": "API Response Test",
        "description": "Testing API response format",
        "tech_stack": "React + FastAPI + PostgreSQL"
    }
    
    print("📝 Creating test project...")
    response = requests.post(f"{base_url}/projects", json=project_data)
    
    if response.status_code != 200:
        print(f"❌ Failed to create project: {response.status_code}")
        return False
    
    project = response.json()
    project_id = project["id"]
    print(f"✅ Created project: {project['name']} (ID: {project_id})")
    
    # Send a chat message that should generate tasks
    chat_data = {"message": "I need to add user authentication"}
    
    print(f"\n📝 Sending chat message...")
    response = requests.post(f"{base_url}/projects/{project_id}/chat", json=chat_data)
    
    if response.status_code != 200:
        print(f"❌ Chat request failed: {response.status_code}")
        print(response.text)
        return False
    
    chat_response = response.json()
    
    print(f"✅ Chat response received")
    print(f"Response type: {chat_response.get('type')}")
    print(f"Response length: {len(chat_response.get('response', ''))} chars")
    
    # Check tasks in response
    tasks = chat_response.get('tasks', [])
    print(f"Tasks in response: {len(tasks)}")
    
    if tasks:
        print("📋 Tasks found in response:")
        for i, task in enumerate(tasks, 1):
            print(f"  {i}. {task.get('title', 'No title')}")
            print(f"     Description: {task.get('description', 'No description')[:50]}...")
            print(f"     Status: {task.get('status', 'Unknown')}")
            print(f"     Priority: {task.get('priority', 'Unknown')}")
            print()
    else:
        print("❌ No tasks in response")
    
    # Check memories in response
    memories = chat_response.get('memories', [])
    print(f"Memories in response: {len(memories)}")
    
    if memories:
        print("🧠 Memories found in response:")
        for i, memory in enumerate(memories, 1):
            print(f"  {i}. [{memory.get('type', 'Unknown')}] {memory.get('title', 'No title')}")
            print(f"     Content: {memory.get('content', 'No content')[:50]}...")
            print()
    
    # Verify response structure
    expected_keys = ['response', 'tasks', 'memories', 'type']
    missing_keys = [key for key in expected_keys if key not in chat_response]
    
    if missing_keys:
        print(f"❌ Missing keys in response: {missing_keys}")
        return False
    else:
        print("✅ Response structure is correct")
    
    # Success criteria
    success = len(tasks) > 0
    print(f"\n{'✅ SUCCESS' if success else '❌ FAILURE'}: API response contains tasks")
    
    return success

if __name__ == "__main__":
    try:
        success = test_api_response()
        exit(0 if success else 1)
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server. Make sure the server is running on http://localhost:8000")
        exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        exit(1) 