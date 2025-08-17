#!/usr/bin/env python3
"""
Debug script for remaining issues:
1. Code context extraction failure (Scenario 3)
2. Ready for action 500 error (Scenario 5)
"""

import asyncio
import aiohttp
import json
import time

BASE_URL = "http://localhost:8000"

async def test_code_context_extraction_failure():
    """Test Scenario 3: Code context extraction failure"""
    print("🔍 Testing Code Context Extraction Failure")
    print("=" * 60)
    
    # Create project
    project_data = {
        "name": "Debug Code Context Project",
        "description": "Testing code context extraction",
        "tech_stack": "Python, FastAPI, React"
    }
    
    async with aiohttp.ClientSession() as session:
        # Create project
        async with session.post(f"{BASE_URL}/projects", json=project_data) as resp:
            if resp.status != 200:
                print(f"❌ Failed to create project: {resp.status}")
                return
            project = await resp.json()
            project_id = project["id"]
            print(f"✅ Created project: {project_id}")
        
        # Connect codebase
        codebase_data = {"path": "/Users/yutosuzuki/code/samurai-agent", "project_id": project_id}
        async with session.post(f"{BASE_URL}/api/codebase/connect", json=codebase_data) as resp:
            if resp.status != 200:
                print(f"❌ Failed to connect codebase: {resp.status}")
                return
            print("✅ Connected codebase")
        
        # Create session
        async with session.post(f"{BASE_URL}/projects/{project_id}/sessions", json={}) as resp:
            if resp.status != 200:
                print(f"❌ Failed to create session: {resp.status}")
                return
            session_data = await resp.json()
            session_id = session_data["id"]
            print(f"✅ Created session: {session_id}")
        
        # Send message that should extract code context
        message_data = {
            "message": "How is JWT authentication implemented in our codebase?",
            "task_context_id": None
        }
        
        print("💬 Sending message...")
        async with session.post(f"{BASE_URL}/projects/{project_id}/chat", json=message_data) as resp:
            if resp.status != 200:
                print(f"❌ Failed to send message: {resp.status}")
                error_text = await resp.text()
                print(f"Error details: {error_text}")
                return
            
            response = await resp.json()
            print("📊 Response Analysis:")
            print(f"   Status: {resp.status}")
            print(f"   Response keys: {list(response.keys())}")
            
            # Check intent analysis
            intent_analysis = response.get("intent_analysis", {})
            print(f"   Intent Type: {intent_analysis.get('intent_type')}")
            print(f"   New Code Context Necessary: {intent_analysis.get('new_code_context_necessary')}")
            print(f"   Code Context Request: {intent_analysis.get('code_context_request')}")
            print(f"   Reasoning: {intent_analysis.get('reasoning')}")
            
            # Check code context
            code_context = response.get("code_context")
            if code_context:
                print(f"   Code Context: ✅ Present")
                print(f"   Code Context Keys: {list(code_context.keys()) if isinstance(code_context, dict) else 'Not a dict'}")
                if isinstance(code_context, dict) and "relevant_code" in code_context:
                    relevant_code = code_context["relevant_code"]
                    print(f"   Relevant Code Files: {len(relevant_code) if isinstance(relevant_code, list) else 'Not a list'}")
            else:
                print(f"   Code Context: ❌ Missing")
            
            # Check response content
            response_text = response.get("response", "")
            print(f"   Response Length: {len(response_text)} characters")
            print(f"   Response Preview: {response_text[:200]}...")
        
        # Clean up
        async with session.delete(f"{BASE_URL}/projects/{project_id}") as resp:
            if resp.status == 200:
                print(f"🗑️  Deleted project: {project_id}")
            else:
                print(f"⚠️  Failed to delete project: {project_id}")

async def test_ready_for_action_500_error():
    """Test Scenario 5: Ready for action 500 error"""
    print("\n🔍 Testing Ready for Action 500 Error")
    print("=" * 60)
    
    # Create project
    project_data = {
        "name": "Debug Ready for Action Project",
        "description": "Testing ready for action processing",
        "tech_stack": "Python, FastAPI, React"
    }
    
    async with aiohttp.ClientSession() as session:
        # Create project
        async with session.post(f"{BASE_URL}/projects", json=project_data) as resp:
            if resp.status != 200:
                print(f"❌ Failed to create project: {resp.status}")
                return
            project = await resp.json()
            project_id = project["id"]
            print(f"✅ Created project: {project_id}")
        
        # Connect codebase
        codebase_data = {"path": "/Users/yutosuzuki/code/samurai-agent", "project_id": project_id}
        async with session.post(f"{BASE_URL}/api/codebase/connect", json=codebase_data) as resp:
            if resp.status != 200:
                print(f"❌ Failed to connect codebase: {resp.status}")
                return
            print("✅ Connected codebase")
        
        # Create session
        async with session.post(f"{BASE_URL}/projects/{project_id}/sessions", json={}) as resp:
            if resp.status != 200:
                print(f"❌ Failed to create session: {resp.status}")
                return
            session_data = await resp.json()
            session_id = session_data["id"]
            print(f"✅ Created session: {session_id}")
        
        # Send ready for action message
        message_data = {
            "message": "Create tasks for implementing user authentication with JWT tokens and email/password login",
            "task_context_id": None
        }
        
        print("💬 Sending ready for action message...")
        async with session.post(f"{BASE_URL}/projects/{project_id}/chat", json=message_data) as resp:
            print(f"📊 Response Status: {resp.status}")
            
            if resp.status == 500:
                error_text = await resp.text()
                print(f"❌ 500 Error Details:")
                print(f"   Error: {error_text}")
                
                # Try to parse JSON error
                try:
                    error_json = json.loads(error_text)
                    print(f"   Parsed Error: {json.dumps(error_json, indent=2)}")
                except:
                    print(f"   Raw Error Text: {error_text}")
            elif resp.status == 200:
                response = await resp.json()
                print("✅ Success! Response Analysis:")
                print(f"   Response keys: {list(response.keys())}")
                
                # Check intent analysis
                intent_analysis = response.get("intent_analysis", {})
                print(f"   Intent Type: {intent_analysis.get('intent_type')}")
                print(f"   New Code Context Necessary: {intent_analysis.get('new_code_context_necessary')}")
                
                # Check tasks
                tasks = response.get("tasks", [])
                print(f"   Tasks Created: {len(tasks)}")
                if tasks:
                    for i, task in enumerate(tasks[:3]):  # Show first 3 tasks
                        print(f"     Task {i+1}: {task.get('title', 'No title')}")
                
                # Check response content
                response_text = response.get("response", "")
                print(f"   Response Length: {len(response_text)} characters")
                print(f"   Response Preview: {response_text[:200]}...")
            else:
                error_text = await resp.text()
                print(f"❌ Unexpected status {resp.status}: {error_text}")
        
        # Clean up
        async with session.delete(f"{BASE_URL}/projects/{project_id}") as resp:
            if resp.status == 200:
                print(f"🗑️  Deleted project: {project_id}")
            else:
                print(f"⚠️  Failed to delete project: {project_id}")

async def main():
    """Run both debug tests"""
    print("🚀 Starting Debug Tests for Remaining Issues")
    print("=" * 80)
    
    # Wait for server to be ready
    print("⏳ Waiting for server to be ready...")
    await asyncio.sleep(3)
    
    # Test 1: Code context extraction failure
    await test_code_context_extraction_failure()
    
    # Test 2: Ready for action 500 error
    await test_ready_for_action_500_error()
    
    print("\n🏁 Debug tests completed")

if __name__ == "__main__":
    asyncio.run(main())
