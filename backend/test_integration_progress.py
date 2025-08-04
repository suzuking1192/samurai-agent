import asyncio
import json
import requests
from datetime import datetime

# Test the full integration of progress tracking with the API
async def test_integration_progress():
    """Test the full integration of progress tracking with the API"""
    print("🧪 Testing Full Integration with Progress Tracking")
    print("=" * 60)
    
    # Test 1: Check if the new endpoint exists
    print("\n1. Testing API Endpoint Availability")
    try:
        response = requests.get("http://localhost:8000/health")
        if response.status_code == 200:
            print("  ✅ Backend is running")
        else:
            print("  ❌ Backend is not responding")
            return
    except requests.exceptions.ConnectionError:
        print("  ❌ Backend is not running. Please start the server first.")
        return
    
    # Test 2: Create a test project
    print("\n2. Creating Test Project")
    project_data = {
        "name": "Progress Test Project",
        "description": "A test project for progress tracking",
        "tech_stack": "React + FastAPI"
    }
    
    try:
        response = requests.post(
            "http://localhost:8000/projects",
            json=project_data
        )
        
        if response.status_code == 200:
            project = response.json()
            project_id = project["id"]
            print(f"  ✅ Project created: {project['name']} (ID: {project_id})")
        else:
            print(f"  ❌ Failed to create project: {response.status_code}")
            return
    except Exception as e:
        print(f"  ❌ Error creating project: {e}")
        return
    
    # Test 3: Test the streaming chat endpoint
    print("\n3. Testing Streaming Chat with Progress")
    
    chat_data = {
        "message": "I want to add user authentication to my app"
    }
    
    try:
        # Use the new streaming endpoint
        response = requests.post(
            f"http://localhost:8000/projects/{project_id}/chat-with-progress",
            json=chat_data,
            stream=True,
            headers={'Accept': 'text/plain'}
        )
        
        if response.status_code == 200:
            print("  ✅ Streaming endpoint is working")
            
            # Read the streaming response
            progress_updates = []
            final_response = None
            
            for line in response.iter_lines():
                if line:
                    line_str = line.decode('utf-8')
                    if line_str.startswith('data: '):
                        try:
                            data = json.loads(line_str[6:])
                            
                            if data['type'] == 'progress':
                                progress_updates.append(data['progress'])
                                print(f"    📊 Progress: {data['progress']['message']}")
                            elif data['type'] == 'complete':
                                final_response = data['response']
                                print(f"    ✅ Complete: Response received ({len(final_response)} chars)")
                            elif data['type'] == 'error':
                                print(f"    ❌ Error: {data['error']}")
                        except json.JSONDecodeError as e:
                            print(f"    ⚠️ JSON parse error: {e}")
            
            print(f"  📈 Total progress updates: {len(progress_updates)}")
            print(f"  📝 Final response length: {len(final_response) if final_response else 0}")
            
            # Verify progress structure
            if progress_updates:
                first_update = progress_updates[0]
                required_fields = ['step', 'message', 'timestamp']
                missing_fields = [field for field in required_fields if field not in first_update]
                
                if not missing_fields:
                    print("  ✅ Progress data structure is correct")
                else:
                    print(f"  ❌ Missing fields in progress data: {missing_fields}")
            
        else:
            print(f"  ❌ Streaming endpoint failed: {response.status_code}")
            print(f"  Response: {response.text}")
            
    except Exception as e:
        print(f"  ❌ Error testing streaming chat: {e}")
    
    # Test 4: Test regular chat endpoint for comparison
    print("\n4. Testing Regular Chat Endpoint (for comparison)")
    
    try:
        response = requests.post(
            f"http://localhost:8000/projects/{project_id}/chat",
            json=chat_data
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"  ✅ Regular chat working: {len(result.get('response', ''))} chars")
        else:
            print(f"  ❌ Regular chat failed: {response.status_code}")
            
    except Exception as e:
        print(f"  ❌ Error testing regular chat: {e}")
    
    # Test 5: Clean up test project
    print("\n5. Cleaning Up Test Project")
    
    try:
        response = requests.delete(f"http://localhost:8000/projects/{project_id}")
        if response.status_code == 200:
            print("  ✅ Test project cleaned up")
        else:
            print(f"  ⚠️ Failed to clean up project: {response.status_code}")
    except Exception as e:
        print(f"  ⚠️ Error cleaning up project: {e}")
    
    print("\n🎉 Integration test completed!")


if __name__ == "__main__":
    print("🚀 Starting Integration Test for Progress Tracking")
    print("=" * 60)
    
    # Run the integration test
    asyncio.run(test_integration_progress())
    
    print("\n✅ Integration test completed!") 