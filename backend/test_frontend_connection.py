#!/usr/bin/env python3
"""
Test script to simulate the frontend connection and see what's happening with SSE
"""

import asyncio
import aiohttp
import json
import time

async def simulate_frontend_connection():
    """Simulate exactly what the frontend does"""
    
    print("🧪 Simulating Frontend Connection")
    print("=" * 50)
    
    # Test data (same as frontend would use)
    project_id = "0627397a-b5f0-478a-bc3b-0333d7221966"
    message = "Hello, this is a test message"
    
    print(f"📝 Project ID: {project_id}")
    print(f"📝 Message: {message}")
    print()
    
    # Simulate frontend request
    url = f"http://localhost:8000/projects/{project_id}/chat-stream"
    
    try:
        async with aiohttp.ClientSession() as session:
            print(f"🌐 Making request to: {url}")
            
            # Simulate frontend fetch request
            async with session.post(
                url,
                json={"message": message},
                headers={
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream"
                }
            ) as response:
                
                print(f"📡 Response status: {response.status}")
                print(f"📡 Content-Type: {response.headers.get('Content-Type', 'Not set')}")
                print(f"📡 Cache-Control: {response.headers.get('Cache-Control', 'Not set')}")
                print(f"📡 Connection: {response.headers.get('Connection', 'Not set')}")
                print()
                
                if response.status != 200:
                    print(f"❌ Error: {response.status}")
                    error_text = await response.text()
                    print(f"❌ Error details: {error_text}")
                    return False
                
                print("✅ Request successful, reading streaming response...")
                print("🔍 Simulating frontend EventSource behavior...")
                print()
                
                # Simulate frontend EventSource reading
                progress_updates = []
                start_time = time.time()
                line_count = 0
                
                async for line in response.content:
                    line_str = line.decode('utf-8').strip()
                    line_count += 1
                    
                    if not line_str:
                        continue
                    
                    print(f"[Line {line_count}] Raw: {repr(line_str)}")
                    
                    if line_str.startswith('data: '):
                        try:
                            data = json.loads(line_str[6:])  # Remove 'data: ' prefix
                            timestamp = time.time() - start_time
                            
                            print(f"[{timestamp:.2f}s] 📤 Parsed: {data}")
                            
                            if data.get('type') == 'progress':
                                progress_updates.append(data)
                                step = data['progress']['step']
                                message = data['progress']['message']
                                print(f"    🎯 Progress: {step} - {message}")
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
                    else:
                        print(f"    ⚠️  Non-data line: {line_str}")
                
                total_time = time.time() - start_time
                
                print()
                print("✅ Frontend simulation completed!")
                print(f"⏱️  Total time: {total_time:.2f} seconds")
                print(f"📊 Progress updates received: {len(progress_updates)}")
                print(f"📊 Total lines processed: {line_count}")
                
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

async def test_browser_compatibility():
    """Test if the SSE format is compatible with browser EventSource"""
    
    print("🧪 Testing Browser EventSource Compatibility")
    print("=" * 50)
    
    # Test data
    project_id = "0627397a-b5f0-478a-bc3b-0333d7221966"
    message = "Test message"
    
    url = f"http://localhost:8000/projects/{project_id}/chat-stream"
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json={"message": message},
                headers={"Content-Type": "application/json"}
            ) as response:
                
                if response.status != 200:
                    print(f"❌ Error: {response.status}")
                    return False
                
                # Check if response format matches EventSource expectations
                content_type = response.headers.get('Content-Type', '')
                print(f"📡 Content-Type: {content_type}")
                
                if 'text/event-stream' not in content_type:
                    print("❌ Content-Type is not text/event-stream")
                    return False
                
                print("✅ Content-Type is correct for EventSource")
                
                # Check for required headers
                cache_control = response.headers.get('Cache-Control', '')
                connection = response.headers.get('Connection', '')
                
                print(f"📡 Cache-Control: {cache_control}")
                print(f"📡 Connection: {connection}")
                
                if 'no-cache' not in cache_control.lower():
                    print("⚠️  Cache-Control should be 'no-cache' for EventSource")
                
                if 'keep-alive' not in connection.lower():
                    print("⚠️  Connection should be 'keep-alive' for EventSource")
                
                # Test reading a few lines to verify format
                line_count = 0
                async for line in response.content:
                    line_str = line.decode('utf-8').strip()
                    line_count += 1
                    
                    if line_count <= 5:  # Check first 5 lines
                        print(f"Line {line_count}: {repr(line_str)}")
                    
                    if line_str.startswith('data: '):
                        try:
                            data = json.loads(line_str[6:])
                            if data.get('type') == 'progress':
                                print(f"✅ Progress event format is correct")
                                break
                        except json.JSONDecodeError:
                            print(f"❌ Invalid JSON in data line: {line_str}")
                            return False
                    
                    if line_count >= 10:  # Limit to first 10 lines for testing
                        break
                
                print("✅ EventSource compatibility test passed")
                return True
                
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Frontend Connection Test Suite")
    print("=" * 50)
    
    async def run_tests():
        # Test 1: Simulate frontend connection
        print("Test 1: Frontend Connection Simulation")
        print("-" * 40)
        success1 = await simulate_frontend_connection()
        
        print("\n" + "=" * 50)
        
        # Test 2: Browser compatibility
        print("Test 2: Browser EventSource Compatibility")
        print("-" * 40)
        success2 = await test_browser_compatibility()
        
        print("\n" + "=" * 50)
        if success1 and success2:
            print("🎉 All tests passed! Frontend should work correctly.")
        else:
            print("❌ Some tests failed. Check the issues above.")
    
    asyncio.run(run_tests()) 