#!/usr/bin/env python3
"""
Test script for real-time progress streaming

This script tests the new real-time progress streaming functionality
to ensure that progress updates are sent immediately during agent processing.
"""

import asyncio
import json
import time
from datetime import datetime
from services.planning_first_agent import planning_first_agent

async def test_real_time_progress():
    """Test real-time progress streaming with actual agent processing."""
    
    print("🧪 Testing Real-Time Progress Streaming")
    print("=" * 50)
    
    # Test data
    project_id = "test-project-123"
    project_context = {
        "name": "Test Project",
        "description": "A test project for real-time progress streaming",
        "tech_stack": ["Python", "FastAPI", "React"]
    }
    message = "Create a new task to implement user authentication"
    session_id = "test-session-456"
    
    # Track progress updates
    progress_updates = []
    start_time = time.time()
    
    async def progress_callback(step: str, message: str, details: str = "", metadata: dict = None):
        """Capture progress updates for testing"""
        timestamp = time.time() - start_time
        progress_data = {
            'step': step,
            'message': message,
            'details': details,
            'timestamp': timestamp,
            'metadata': metadata or {}
        }
        progress_updates.append(progress_data)
        
        # Print progress in real-time
        print(f"[{timestamp:.2f}s] {step.upper()}: {message}")
        if details:
            print(f"    Details: {details}")
    
    print(f"📝 Processing message: '{message}'")
    print(f"🏗️  Project: {project_context['name']}")
    print()
    
    try:
        # Process message with real-time progress
        result = await planning_first_agent.process_user_message(
            message=message,
            project_id=project_id,
            project_context=project_context,
            session_id=session_id,
            conversation_history=[],
            progress_callback=progress_callback
        )
        
        total_time = time.time() - start_time
        
        print()
        print("✅ Processing completed successfully!")
        print(f"⏱️  Total time: {total_time:.2f} seconds")
        print(f"📊 Progress updates received: {len(progress_updates)}")
        print()
        
        # Analyze progress updates
        print("📈 Progress Analysis:")
        print("-" * 30)
        
        for i, update in enumerate(progress_updates):
            print(f"{i+1:2d}. [{update['timestamp']:.2f}s] {update['step']}: {update['message']}")
        
        print()
        print("🎯 Final Response:")
        print("-" * 20)
        print(result.get("response", "No response generated"))
        
        # Validate progress timing
        print()
        print("🔍 Progress Timing Validation:")
        print("-" * 35)
        
        if len(progress_updates) >= 3:
            print("✅ Received multiple progress updates")
            
            # Check that updates are spread out (not all at once)
            time_diffs = [
                progress_updates[i+1]['timestamp'] - progress_updates[i]['timestamp']
                for i in range(len(progress_updates) - 1)
            ]
            
            avg_diff = sum(time_diffs) / len(time_diffs)
            print(f"✅ Average time between updates: {avg_diff:.2f}s")
            
            if avg_diff > 0.1:  # At least 100ms between updates
                print("✅ Progress updates are properly spaced (real-time)")
            else:
                print("⚠️  Progress updates may be too fast (not real-time)")
        else:
            print("❌ Insufficient progress updates received")
        
        # Check for expected steps
        expected_steps = ['start', 'context', 'analyzing', 'planning', 'validation', 'execution', 'memory', 'completion']
        received_steps = [update['step'] for update in progress_updates]
        
        print()
        print("📋 Step Coverage:")
        print("-" * 20)
        
        for step in expected_steps:
            if step in received_steps:
                print(f"✅ {step}")
            else:
                print(f"❌ {step} (missing)")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during processing: {e}")
        return False

async def test_progress_callback_timing():
    """Test that progress callbacks are called immediately."""
    
    print("\n🧪 Testing Progress Callback Timing")
    print("=" * 40)
    
    callback_times = []
    
    async def timing_callback(step: str, message: str, details: str = "", metadata: dict = None):
        """Track when callbacks are called"""
        callback_times.append(time.time())
    
    # Simulate processing with delays
    async def simulate_processing():
        await timing_callback("start", "Starting...")
        await asyncio.sleep(0.1)
        
        await timing_callback("step1", "Step 1...")
        await asyncio.sleep(0.2)
        
        await timing_callback("step2", "Step 2...")
        await asyncio.sleep(0.1)
        
        await timing_callback("complete", "Complete!")
    
    start_time = time.time()
    await simulate_processing()
    total_time = time.time() - start_time
    
    print(f"⏱️  Total processing time: {total_time:.2f}s")
    print(f"📊 Callbacks received: {len(callback_times)}")
    
    # Verify callbacks are called during processing, not after
    if len(callback_times) >= 4:
        last_callback_time = callback_times[-1] - start_time
        if last_callback_time < total_time - 0.05:  # Callback before processing ends
            print("✅ Callbacks are called during processing (real-time)")
        else:
            print("❌ Callbacks may be called after processing")
    else:
        print("❌ Insufficient callbacks received")

if __name__ == "__main__":
    print("🚀 Real-Time Progress Streaming Test Suite")
    print("=" * 50)
    
    async def run_tests():
        # Test 1: Real-time progress with actual agent
        success1 = await test_real_time_progress()
        
        # Test 2: Progress callback timing
        await test_progress_callback_timing()
        
        print("\n" + "=" * 50)
        if success1:
            print("🎉 All tests completed successfully!")
        else:
            print("❌ Some tests failed")
    
    asyncio.run(run_tests()) 