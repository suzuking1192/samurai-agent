#!/usr/bin/env python3
"""
Test script to verify the streaming endpoint is working by making a direct HTTP request
"""

import asyncio
import aiohttp
import json
import time

async def test_streaming_endpoint_directly():
    """Test the streaming endpoint by making a direct HTTP request"""
    
    print("🧪 Testing Streaming Endpoint Directly")
    print("=" * 50)
    
    # Test data
    project_id = "0627397a-b5f0-478a-bc3b-0333d7221966"  # Use the exact project ID from the list
    message = "Hello, this is a test message"
    
    print(f"📝 Project ID: {project_id}")
    print(f"📝 Message: {message}")
    print()
    
    # Make direct HTTP request to the streaming endpoint
    url = f"http://localhost:8000/projects/{project_id}/chat-stream"
    
    try:
        async with aiohttp.ClientSession() as session:
            print(f"🌐 Making request to: {url}")
            
            # Make POST request
            async with session.post(
                url,
                json={"message": message},
                headers={"Content-Type": "application/json"}
            ) as response:
                
                print(f"📡 Response status: {response.status}")
                print(f"📡 Response headers: {dict(response.headers)}")
                
                if response.status != 200:
                    print(f"❌ Error: {response.status}")
                    error_text = await response.text()
                    print(f"❌ Error details: {error_text}")
                    return False
                
                print("✅ Request successful, reading streaming response...")
                print()
                
                # Read streaming response
                progress_updates = []
                start_time = time.time()
                
                async for line in response.content:
                    line_str = line.decode('utf-8').strip()
                    
                    if not line_str:
                        continue
                    
                    if line_str.startswith('data: '):
                        try:
                            data = json.loads(line_str[6:])  # Remove 'data: ' prefix
                            timestamp = time.time() - start_time
                            
                            print(f"[{timestamp:.2f}s] 📤 Received: {data}")
                            
                            if data.get('type') == 'progress':
                                progress_updates.append(data)
                                print(f"    🎯 Progress: {data['progress']['step']} - {data['progress']['message']}")
                            elif data.get('type') == 'complete':
                                print(f"    🎯 Complete: {data['response']}")
                                break
                            elif data.get('type') == 'error':
                                print(f"    ❌ Error: {data['error']}")
                                return False
                            elif data.get('type') == 'heartbeat':
                                print(f"    💓 Heartbeat")
                            
                        except json.JSONDecodeError as e:
                            print(f"❌ JSON parse error: {e}")
                            print(f"❌ Raw line: {line_str}")
                
                total_time = time.time() - start_time
                
                print()
                print("✅ Streaming test completed!")
                print(f"⏱️  Total time: {total_time:.2f} seconds")
                print(f"📊 Progress updates received: {len(progress_updates)}")
                
                if progress_updates:
                    print()
                    print("📈 Progress Summary:")
                    for i, update in enumerate(progress_updates):
                        step = update['progress']['step']
                        message = update['progress']['message']
                        print(f"  {i+1}. {step}: {message}")
                
                return True
                
    except aiohttp.ClientConnectorError as e:
        print(f"❌ Connection error: {e}")
        print("💡 Make sure the backend server is running on http://localhost:8000")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

async def test_backend_server_running():
    """Test if the backend server is running"""
    
    print("🧪 Testing Backend Server")
    print("=" * 30)
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:8000/health") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Backend server is running: {data}")
                    return True
                else:
                    print(f"❌ Backend server responded with status: {response.status}")
                    return False
    except aiohttp.ClientConnectorError:
        print("❌ Backend server is not running")
        print("💡 Start the server with: uvicorn main:app --reload --host 0.0.0.0 --port 8000")
        return False
    except Exception as e:
        print(f"❌ Error testing backend: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Direct Endpoint Test Suite")
    print("=" * 50)
    
    async def run_tests():
        # Test 1: Check if backend is running
        server_running = await test_backend_server_running()
        
        if server_running:
            print()
            # Test 2: Test streaming endpoint
            success = await test_streaming_endpoint_directly()
            
            print("\n" + "=" * 50)
            if success:
                print("🎉 Streaming endpoint is working correctly!")
            else:
                print("❌ Streaming endpoint has issues")
        else:
            print("\n❌ Cannot test streaming endpoint - backend server not running")
    
    asyncio.run(run_tests()) 