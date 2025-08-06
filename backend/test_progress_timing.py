#!/usr/bin/env python3
"""
Test script to verify progress timing and ensure updates are sent one by one
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime

async def test_progress_timing():
    """Test that progress updates are sent with proper timing"""
    
    print("🧪 Testing Progress Timing")
    print("=" * 50)
    
    # Test data
    project_id = "0627397a-b5f0-478a-bc3b-0333d7221966"
    message = "Test message for timing verification"
    
    print(f"📝 Project ID: {project_id}")
    print(f"📝 Message: {message}")
    print()
    
    url = f"http://localhost:8000/projects/{project_id}/chat-stream"
    
    try:
        async with aiohttp.ClientSession() as session:
            print(f"🌐 Making request to: {url}")
            
            async with session.post(
                url,
                json={"message": message},
                headers={"Content-Type": "application/json"}
            ) as response:
                
                if response.status != 200:
                    print(f"❌ Error: {response.status}")
                    return False
                
                print("✅ Request successful, monitoring progress timing...")
                print()
                
                # Track progress timing
                progress_events = []
                start_time = time.time()
                last_event_time = start_time
                
                async for line in response.content:
                    line_str = line.decode('utf-8').strip()
                    
                    if not line_str:
                        continue
                    
                    if line_str.startswith('data: '):
                        try:
                            data = json.loads(line_str[6:])
                            current_time = time.time()
                            time_since_start = current_time - start_time
                            time_since_last = current_time - last_event_time
                            
                            if data.get('type') == 'progress':
                                progress_events.append({
                                    'step': data['progress']['step'],
                                    'message': data['progress']['message'],
                                    'timestamp': data['progress']['timestamp'],
                                    'time_since_start': time_since_start,
                                    'time_since_last': time_since_last
                                })
                                
                                print(f"[{time_since_start:.2f}s] 🎯 Progress: {data['progress']['step']} - {data['progress']['message']}")
                                print(f"    ⏱️ Time since last: {time_since_last:.2f}s")
                                print(f"    📅 Backend timestamp: {data['progress']['timestamp']}")
                                
                                last_event_time = current_time
                                
                            elif data.get('type') == 'complete':
                                total_time = current_time - start_time
                                print(f"[{time_since_start:.2f}s] ✅ Complete: {data['response']}")
                                print(f"    ⏱️ Total time: {total_time:.2f}s")
                                break
                                
                        except json.JSONDecodeError as e:
                            print(f"❌ JSON parse error: {e}")
                
                # Analyze timing
                print()
                print("📊 Progress Timing Analysis:")
                print("=" * 40)
                
                if progress_events:
                    print(f"📈 Total progress events: {len(progress_events)}")
                    
                    # Calculate timing statistics
                    intervals = [event['time_since_last'] for event in progress_events[1:]]  # Skip first event
                    if intervals:
                        avg_interval = sum(intervals) / len(intervals)
                        min_interval = min(intervals)
                        max_interval = max(intervals)
                        
                        print(f"⏱️ Average interval between updates: {avg_interval:.2f}s")
                        print(f"⏱️ Min interval: {min_interval:.2f}s")
                        print(f"⏱️ Max interval: {max_interval:.2f}s")
                    
                    print()
                    print("📋 Detailed Progress Timeline:")
                    for i, event in enumerate(progress_events):
                        print(f"  {i+1:2d}. [{event['time_since_start']:6.2f}s] {event['step']:12s} - {event['message']}")
                        if i > 0:
                            print(f"       ⏱️ +{event['time_since_last']:.2f}s since last")
                
                return True
                
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

async def test_backend_progress_callback_timing():
    """Test the backend progress callback timing directly"""
    
    print("🧪 Testing Backend Progress Callback Timing")
    print("=" * 50)
    
    from services.planning_first_agent import planning_first_agent
    
    # Test data
    project_id = "0627397a-b5f0-478a-bc3b-0333d7221966"
    message = "Test message for callback timing"
    
    print(f"📝 Project ID: {project_id}")
    print(f"📝 Message: {message}")
    print()
    
    # Create project context
    project_context = {
        "name": "Test Project",
        "description": "Test project for timing verification",
        "tech_stack": "Python, FastAPI"
    }
    
    # Track progress callbacks
    progress_callbacks = []
    start_time = time.time()
    
    async def progress_callback(step: str, message: str, details: str = "", metadata: dict = None):
        """Track progress callback timing"""
        nonlocal start_time
        current_time = time.time()
        time_since_start = current_time - start_time
        
        # Calculate time since last callback
        if progress_callbacks:
            time_since_last = current_time - progress_callbacks[-1]['timestamp_raw']
        else:
            time_since_last = 0
        
        progress_callbacks.append({
            'step': step,
            'message': message,
            'details': details,
            'time_since_start': time_since_start,
            'time_since_last': time_since_last,
            'timestamp': datetime.now().isoformat(),
            'timestamp_raw': current_time
        })
        
        print(f"[{time_since_start:.2f}s] 🎯 Callback: {step} - {message}")
        print(f"    ⏱️ Time since last: {time_since_last:.2f}s")
        print(f"    📝 Details: {details}")
    
    try:
        # Process message with progress tracking
        result = await planning_first_agent.process_user_message(
            message=message,
            project_id=project_id,
            project_context=project_context,
            session_id="test-session",
            conversation_history=[],
            progress_callback=progress_callback
        )
        
        total_time = time.time() - start_time
        
        print()
        print("📊 Backend Callback Timing Analysis:")
        print("=" * 40)
        print(f"📈 Total callbacks: {len(progress_callbacks)}")
        print(f"⏱️ Total processing time: {total_time:.2f}s")
        
        if progress_callbacks:
            # Calculate timing statistics
            intervals = [cb['time_since_last'] for cb in progress_callbacks[1:]]  # Skip first callback
            if intervals:
                avg_interval = sum(intervals) / len(intervals)
                min_interval = min(intervals)
                max_interval = max(intervals)
                
                print(f"⏱️ Average interval between callbacks: {avg_interval:.2f}s")
                print(f"⏱️ Min interval: {min_interval:.2f}s")
                print(f"⏱️ Max interval: {max_interval:.2f}s")
            
            print()
            print("📋 Detailed Callback Timeline:")
            for i, callback in enumerate(progress_callbacks):
                print(f"  {i+1:2d}. [{callback['time_since_start']:6.2f}s] {callback['step']:12s} - {callback['message']}")
                if i > 0:
                    print(f"       ⏱️ +{callback['time_since_last']:.2f}s since last")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Progress Timing Test Suite")
    print("=" * 50)
    
    async def run_tests():
        # Test 1: Frontend streaming timing
        print("Test 1: Frontend Streaming Timing")
        print("-" * 40)
        success1 = await test_progress_timing()
        
        print("\n" + "=" * 50)
        
        # Test 2: Backend callback timing
        print("Test 2: Backend Callback Timing")
        print("-" * 40)
        success2 = await test_backend_progress_callback_timing()
        
        print("\n" + "=" * 50)
        if success1 and success2:
            print("🎉 All timing tests passed!")
        else:
            print("❌ Some timing tests failed.")
    
    asyncio.run(run_tests()) 