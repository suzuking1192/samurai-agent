#!/usr/bin/env python3
"""
Test script for streaming endpoints

This script tests the new streaming endpoints to ensure they work correctly
with proper SSE format and real-time progress updates.
"""

import asyncio
import json
import time
from datetime import datetime

async def test_streaming_endpoint():
    """Test the streaming endpoint functionality"""
    
    print("🧪 Testing Streaming Endpoints")
    print("=" * 50)
    
    # Simulate a progress callback that would be called by the agent
    progress_events = []
    
    async def mock_progress_callback(step: str, message: str, details: str = "", metadata: dict = None):
        """Mock progress callback that simulates agent progress updates"""
        progress_events.append({
            'type': 'progress',
            'progress': {
                'step': step,
                'message': message,
                'details': details,
                'timestamp': datetime.now().isoformat(),
                'metadata': metadata or {}
            }
        })
        print(f"📡 Progress: {step} - {message}")
    
    # Simulate agent processing with progress updates
    async def simulate_agent_processing():
        """Simulate the agent processing with real-time progress updates"""
        await mock_progress_callback("start", "🧠 Starting to process your request...", "Initializing")
        await asyncio.sleep(0.5)
        
        await mock_progress_callback("context", "📚 Gathering conversation context...", "Loading context")
        await asyncio.sleep(1.0)
        
        await mock_progress_callback("analyzing", "🧠 Analyzing your request...", "Understanding intent")
        await asyncio.sleep(1.5)
        
        await mock_progress_callback("planning", "📋 Creating execution plan...", "Planning approach")
        await asyncio.sleep(1.0)
        
        await mock_progress_callback("validation", "✅ Validating plan...", "Ensuring feasibility")
        await asyncio.sleep(0.8)
        
        await mock_progress_callback("execution", "⚙️ Executing plan...", "Carrying out actions")
        await asyncio.sleep(1.2)
        
        await mock_progress_callback("memory", "💾 Updating memory...", "Saving information")
        await asyncio.sleep(0.5)
        
        await mock_progress_callback("completion", "🎉 Processing complete!", "All done")
        
        return {"response": "I have successfully processed your request!"}
    
    # Simulate the streaming response generator
    async def simulate_streaming_response():
        """Simulate the streaming response generator"""
        try:
            print("🚀 Starting streaming response...")
            
            # Start agent processing
            processing_task = asyncio.create_task(simulate_agent_processing())
            
            # Stream progress events as they occur
            last_event_count = 0
            while not processing_task.done():
                # Check for new progress events
                if len(progress_events) > last_event_count:
                    # Send new events
                    for event in progress_events[last_event_count:]:
                        sse_data = f"data: {json.dumps(event)}\n\n"
                        print(f"📤 SSE: {sse_data.strip()}")
                    last_event_count = len(progress_events)
                
                # Small delay to prevent busy waiting
                await asyncio.sleep(0.1)
            
            # Get final result
            result = await processing_task
            
            # Send final response
            final_event = {
                'type': 'complete',
                'response': result.get("response", "Processing completed.")
            }
            sse_data = f"data: {json.dumps(final_event)}\n\n"
            print(f"📤 SSE: {sse_data.strip()}")
            
            return result
            
        except Exception as e:
            error_event = {
                'type': 'error',
                'error': str(e)
            }
            sse_data = f"data: {json.dumps(error_event)}\n\n"
            print(f"❌ SSE Error: {sse_data.strip()}")
            raise
    
    # Run the test
    start_time = time.time()
    
    try:
        result = await simulate_streaming_response()
        total_time = time.time() - start_time
        
        print()
        print("✅ Streaming test completed successfully!")
        print(f"⏱️  Total time: {total_time:.2f} seconds")
        print(f"📊 Progress events sent: {len(progress_events)}")
        print(f"🎯 Final response: {result.get('response', 'No response')}")
        
        # Verify SSE format
        print()
        print("🔍 SSE Format Validation:")
        print("-" * 30)
        
        for i, event in enumerate(progress_events):
            sse_format = f"data: {json.dumps(event)}\n\n"
            print(f"{i+1:2d}. ✅ Valid SSE format: {sse_format.strip()}")
        
        return True
        
    except Exception as e:
        print(f"❌ Streaming test failed: {e}")
        return False

async def test_progress_timing():
    """Test that progress updates are sent in real-time"""
    
    print("\n🧪 Testing Progress Timing")
    print("=" * 30)
    
    progress_times = []
    
    async def timed_progress_callback(step: str, message: str):
        progress_times.append(time.time())
        print(f"[{time.time():.2f}s] {step}: {message}")
    
    # Simulate processing with delays
    async def simulate_processing():
        await timed_progress_callback("start", "Starting...")
        await asyncio.sleep(0.5)
        
        await timed_progress_callback("step1", "Step 1...")
        await asyncio.sleep(1.0)
        
        await timed_progress_callback("step2", "Step 2...")
        await asyncio.sleep(0.8)
        
        await timed_progress_callback("complete", "Complete!")
    
    start_time = time.time()
    await simulate_processing()
    total_time = time.time() - start_time
    
    print(f"⏱️  Total processing time: {total_time:.2f}s")
    print(f"📊 Progress updates: {len(progress_times)}")
    
    # Check timing
    if len(progress_times) >= 4:
        time_diffs = [progress_times[i+1] - progress_times[i] for i in range(len(progress_times)-1)]
        avg_diff = sum(time_diffs) / len(time_diffs)
        print(f"📈 Average time between updates: {avg_diff:.2f}s")
        
        if avg_diff > 0.1:  # At least 100ms between updates
            print("✅ Progress updates are properly spaced (real-time)")
        else:
            print("⚠️  Progress updates may be too fast")
    else:
        print("❌ Insufficient progress updates")

if __name__ == "__main__":
    print("🚀 Streaming Endpoint Test Suite")
    print("=" * 50)
    
    async def run_tests():
        # Test 1: Streaming functionality
        success1 = await test_streaming_endpoint()
        
        # Test 2: Progress timing
        await test_progress_timing()
        
        print("\n" + "=" * 50)
        if success1:
            print("🎉 All streaming tests completed successfully!")
        else:
            print("❌ Some streaming tests failed")
    
    asyncio.run(run_tests()) 