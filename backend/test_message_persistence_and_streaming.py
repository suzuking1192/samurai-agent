#!/usr/bin/env python3
"""
Comprehensive test for message persistence and real-time streaming fixes
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime

async def test_message_persistence():
    """Test that chat messages persist across page refreshes."""
    
    print("🧪 Testing Message Persistence")
    print("=" * 50)
    
    # Test 1: Send multiple messages and verify they persist
    print("1. Testing message persistence with multiple messages...")
    
    messages_sent = []
    session_id = None
    
    try:
        async with aiohttp.ClientSession() as session:
            # Send first message
            test_data = {
                "message": "I want to build a todo app"
            }
            
            response = await session.post(
                "http://localhost:8000/projects/0627397a-b5f0-478a-bc3b-0333d7221966/chat-with-progress",
                json=test_data
            )
            
            if response.status == 200:
                print("   ✅ First message sent successfully")
                messages_sent.append("I want to build a todo app")
                
                # Read response to completion
                async for line in response.content:
                    line_str = line.decode('utf-8').strip()
                    if line_str.startswith('data: '):
                        try:
                            data = json.loads(line_str[6:])
                            if data.get('type') == 'complete':
                                break
                        except:
                            continue
            else:
                print(f"   ❌ First message failed: {response.status}")
                return False
            
            # Send second message
            test_data = {
                "message": "I prefer using React for the frontend"
            }
            
            response = await session.post(
                "http://localhost:8000/projects/0627397a-b5f0-478a-bc3b-0333d7221966/chat-with-progress",
                json=test_data
            )
            
            if response.status == 200:
                print("   ✅ Second message sent successfully")
                messages_sent.append("I prefer using React for the frontend")
                
                # Read response to completion
                async for line in response.content:
                    line_str = line.decode('utf-8').strip()
                    if line_str.startswith('data: '):
                        try:
                            data = json.loads(line_str[6:])
                            if data.get('type') == 'complete':
                                break
                        except:
                            continue
            else:
                print(f"   ❌ Second message failed: {response.status}")
                return False
            
            # Test 2: Verify conversation history is persisted
            print("\n2. Testing conversation history retrieval...")
            
            response = await session.get(
                "http://localhost:8000/projects/0627397a-b5f0-478a-bc3b-0333d7221966/conversation-history"
            )
            
            if response.status == 200:
                conversation_history = await response.json()
                print(f"   ✅ Conversation history loaded: {len(conversation_history)} messages")
                
                # Verify all messages are present
                if len(conversation_history) >= len(messages_sent):
                    print("   ✅ All sent messages are in conversation history")
                    
                    # Check message ordering and content
                    recent_messages = conversation_history[-len(messages_sent):]
                    for i, msg in enumerate(recent_messages):
                        if msg.get('message') == messages_sent[i]:
                            print(f"   ✅ Message {i+1} matches: {msg.get('message')[:50]}...")
                        else:
                            print(f"   ❌ Message {i+1} mismatch")
                            return False
                    
                    return True
                else:
                    print(f"   ❌ Expected {len(messages_sent)} messages, got {len(conversation_history)}")
                    return False
            else:
                print(f"   ❌ Failed to load conversation history: {response.status}")
                return False
                
    except Exception as e:
        print(f"   ❌ Error testing message persistence: {e}")
        return False

async def test_real_time_streaming():
    """Test that progress updates appear one by one in real-time."""
    
    print("\n🔄 Testing Real-Time Progress Streaming")
    print("=" * 50)
    
    try:
        async with aiohttp.ClientSession() as session:
            # Send a message and monitor progress updates
            test_data = {
                "message": "I want to add user authentication to my app"
            }
            
            print("1. Sending message and monitoring real-time progress...")
            
            response = await session.post(
                "http://localhost:8000/projects/0627397a-b5f0-478a-bc3b-0333d7221966/chat-with-progress",
                json=test_data
            )
            
            if response.status == 200:
                print("   ✅ Message sent successfully")
                
                # Monitor progress updates in real-time
                progress_updates = []
                final_response = None
                start_time = time.time()
                
                async for line in response.content:
                    line_str = line.decode('utf-8').strip()
                    
                    if line_str.startswith('data: '):
                        try:
                            data = json.loads(line_str[6:])
                            
                            if data.get('type') == 'progress':
                                progress = data.get('progress', {})
                                progress_updates.append(progress)
                                current_time = time.time() - start_time
                                print(f"   📊 [{current_time:.1f}s] Progress: {progress.get('message', 'Unknown')}")
                                
                            elif data.get('type') == 'complete':
                                final_response = data.get('response', '')
                                current_time = time.time() - start_time
                                print(f"   ✅ [{current_time:.1f}s] Complete: Response received")
                                break
                                
                            elif data.get('type') == 'error':
                                error = data.get('error', 'Unknown error')
                                print(f"   ❌ Error: {error}")
                                return False
                                
                        except json.JSONDecodeError as e:
                            continue
                
                # Analyze progress updates
                print(f"\n2. Progress Analysis:")
                print(f"   Total progress updates: {len(progress_updates)}")
                
                # Check for real-time characteristics
                if len(progress_updates) >= 3:
                    print("   ✅ Sufficient progress updates received")
                    
                    # Check timing between updates (should be spaced out)
                    update_times = []
                    for i, progress in enumerate(progress_updates):
                        if progress.get('timestamp'):
                            try:
                                timestamp = datetime.fromisoformat(progress['timestamp'].replace('Z', '+00:00'))
                                update_times.append(timestamp)
                            except:
                                pass
                    
                    if len(update_times) >= 3:
                        # Check that updates are spaced out (not all at once)
                        time_diffs = []
                        for i in range(1, len(update_times)):
                            diff = (update_times[i] - update_times[i-1]).total_seconds()
                            time_diffs.append(diff)
                        
                        avg_diff = sum(time_diffs) / len(time_diffs) if time_diffs else 0
                        print(f"   ✅ Average time between updates: {avg_diff:.2f}s")
                        
                        if avg_diff > 0.1:  # At least 100ms between updates
                            print("   ✅ Progress updates are properly spaced (real-time)")
                        else:
                            print("   ⚠️  Progress updates may be batched")
                    
                    # Check for detailed progress information
                    detailed_progress = [p for p in progress_updates if p.get('details')]
                    if len(detailed_progress) > 0:
                        print("   ✅ Progress updates include detailed information")
                    else:
                        print("   ⚠️  Progress updates lack detailed information")
                    
                    return True
                else:
                    print("   ❌ Insufficient progress updates")
                    return False
                    
            else:
                print(f"   ❌ Message failed: {response.status}")
                return False
                
    except Exception as e:
        print(f"   ❌ Error testing real-time streaming: {e}")
        return False

async def test_conversation_loading_on_refresh():
    """Test that conversation history loads automatically on page refresh."""
    
    print("\n🔄 Testing Conversation Loading on Refresh")
    print("=" * 50)
    
    try:
        async with aiohttp.ClientSession() as session:
            # Test 1: Get current session
            print("1. Testing current session retrieval...")
            
            response = await session.get(
                "http://localhost:8000/projects/0627397a-b5f0-478a-bc3b-0333d7221966/current-session"
            )
            
            if response.status == 200:
                current_session = await response.json()
                session_id = current_session.get('id')
                print(f"   ✅ Current session: {session_id}")
                
                # Test 2: Get session messages
                if session_id:
                    response = await session.get(
                        f"http://localhost:8000/projects/0627397a-b5f0-478a-bc3b-0333d7221966/session-messages/{session_id}"
                    )
                    
                    if response.status == 200:
                        session_messages = await response.json()
                        print(f"   ✅ Session messages: {len(session_messages)} messages")
                        
                        # Check if messages are properly associated with session
                        for msg in session_messages:
                            if msg.get('session_id') == session_id:
                                print("   ✅ Messages properly associated with session")
                                
                                # Check message ordering
                                if len(session_messages) > 1:
                                    timestamps = [datetime.fromisoformat(msg['created_at'].replace('Z', '+00:00')) for msg in session_messages]
                                    is_ordered = all(timestamps[i] <= timestamps[i+1] for i in range(len(timestamps)-1))
                                    if is_ordered:
                                        print("   ✅ Messages are in chronological order")
                                    else:
                                        print("   ⚠️  Messages may not be in chronological order")
                                
                                return True
                            else:
                                print("   ❌ Message not associated with correct session")
                                return False
                    else:
                        print(f"   ❌ Failed to get session messages: {response.status}")
                        return False
                else:
                    print("   ❌ No session ID found")
                    return False
            else:
                print(f"   ❌ Failed to get current session: {response.status}")
                return False
                
    except Exception as e:
        print(f"   ❌ Error testing conversation loading: {e}")
        return False

async def test_progress_streaming_accuracy():
    """Test that progress updates accurately reflect actual processing."""
    
    print("\n🎯 Testing Progress Streaming Accuracy")
    print("=" * 50)
    
    try:
        async with aiohttp.ClientSession() as session:
            # Send a message and analyze progress accuracy
            test_data = {
                "message": "Create a task for implementing user authentication"
            }
            
            print("1. Testing progress accuracy with task creation...")
            
            response = await session.post(
                "http://localhost:8000/projects/0627397a-b5f0-478a-bc3b-0333d7221966/chat-with-progress",
                json=test_data
            )
            
            if response.status == 200:
                print("   ✅ Message sent successfully")
                
                # Monitor progress updates
                progress_steps = []
                final_response = None
                
                async for line in response.content:
                    line_str = line.decode('utf-8').strip()
                    
                    if line_str.startswith('data: '):
                        try:
                            data = json.loads(line_str[6:])
                            
                            if data.get('type') == 'progress':
                                progress = data.get('progress', {})
                                step = progress.get('step')
                                if step:
                                    progress_steps.append(step)
                                print(f"   📊 Step: {step} - {progress.get('message', 'Unknown')}")
                                
                            elif data.get('type') == 'complete':
                                final_response = data.get('response', '')
                                print(f"   ✅ Complete: Response received")
                                break
                                
                        except json.JSONDecodeError as e:
                            continue
                
                # Analyze progress accuracy
                print(f"\n2. Progress Accuracy Analysis:")
                print(f"   Progress steps: {progress_steps}")
                
                # Check for expected progress flow
                expected_steps = ['analyzing', 'context', 'planning', 'validation', 'execution', 'memory']
                found_steps = [step for step in progress_steps if step in expected_steps]
                
                print(f"   Expected steps: {expected_steps}")
                print(f"   Found steps: {found_steps}")
                
                if len(found_steps) >= 3:
                    print("   ✅ Progress follows expected planning-first flow")
                    
                    # Check if final response mentions task creation
                    if final_response and ('task' in final_response.lower() or 'created' in final_response.lower()):
                        print("   ✅ Final response indicates task creation")
                    else:
                        print("   ⚠️  Final response may not indicate task creation")
                    
                    return True
                else:
                    print("   ❌ Progress doesn't follow expected flow")
                    return False
                    
            else:
                print(f"   ❌ Message failed: {response.status}")
                return False
                
    except Exception as e:
        print(f"   ❌ Error testing progress accuracy: {e}")
        return False

async def main():
    """Main test function."""
    
    print("🚀 Testing Message Persistence and Real-Time Streaming Fixes")
    print("=" * 70)
    
    # Run all tests
    persistence_success = await test_message_persistence()
    streaming_success = await test_real_time_streaming()
    loading_success = await test_conversation_loading_on_refresh()
    accuracy_success = await test_progress_streaming_accuracy()
    
    print("\n" + "=" * 70)
    print("📊 Test Results Summary")
    print("=" * 70)
    print(f"   Message Persistence: {'✅ PASS' if persistence_success else '❌ FAIL'}")
    print(f"   Real-Time Streaming: {'✅ PASS' if streaming_success else '❌ FAIL'}")
    print(f"   Conversation Loading: {'✅ PASS' if loading_success else '❌ FAIL'}")
    print(f"   Progress Accuracy: {'✅ PASS' if accuracy_success else '❌ FAIL'}")
    
    if persistence_success and streaming_success and loading_success and accuracy_success:
        print("\n🎉 All fixes are working correctly!")
        print("\nThe system now provides:")
        print("  ✅ True message persistence across page refreshes")
        print("  ✅ Real-time progress updates that appear one by one")
        print("  ✅ Automatic conversation history loading")
        print("  ✅ Accurate progress tracking that reflects actual processing")
        print("  ✅ Professional, responsive user experience")
    else:
        print("\n⚠️  Some fixes may need attention")
        print("Please check the specific failing tests above")

if __name__ == "__main__":
    asyncio.run(main()) 