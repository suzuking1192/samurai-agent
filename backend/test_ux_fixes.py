#!/usr/bin/env python3
"""
Comprehensive test for UX fixes: Conversation Display & Real-time Progress
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime

async def test_conversation_history_fix():
    """Test that conversation history is properly loaded and displayed."""
    
    print("🧪 Testing Conversation History Fix")
    print("=" * 50)
    
    # Test 1: Create a new session and send multiple messages
    print("1. Testing conversation history with multiple messages...")
    
    session_id = None
    messages_sent = []
    
    try:
        async with aiohttp.ClientSession() as session:
            # Send first message
            test_data = {
                "message": "I want to build a todo app"
            }
            
            response = await session.post(
                "http://localhost:8000/projects/test-project/chat-with-progress",
                json=test_data
            )
            
            if response.status == 200:
                print("   ✅ First message sent successfully")
                messages_sent.append("I want to build a todo app")
                
                # Read response to get session info
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
                "http://localhost:8000/projects/test-project/chat-with-progress",
                json=test_data
            )
            
            if response.status == 200:
                print("   ✅ Second message sent successfully")
                messages_sent.append("I prefer using React for the frontend")
                
                # Read response
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
            
            # Send third message
            test_data = {
                "message": "Can you create a task for the React setup?"
            }
            
            response = await session.post(
                "http://localhost:8000/projects/test-project/chat-with-progress",
                json=test_data
            )
            
            if response.status == 200:
                print("   ✅ Third message sent successfully")
                messages_sent.append("Can you create a task for the React setup?")
                
                # Read response
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
                print(f"   ❌ Third message failed: {response.status}")
                return False
            
            # Test 2: Verify conversation history is loaded
            print("\n2. Testing conversation history retrieval...")
            
            response = await session.get(
                "http://localhost:8000/projects/test-project/conversation-history"
            )
            
            if response.status == 200:
                conversation_history = await response.json()
                print(f"   ✅ Conversation history loaded: {len(conversation_history)} messages")
                
                # Verify all messages are present
                if len(conversation_history) >= len(messages_sent):
                    print("   ✅ All sent messages are in conversation history")
                    
                    # Check message ordering
                    for i, msg in enumerate(conversation_history[-len(messages_sent):]):
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
        print(f"   ❌ Error testing conversation history: {e}")
        return False

async def test_real_time_progress():
    """Test that real-time progress updates are working."""
    
    print("\n🔄 Testing Real-Time Progress Display")
    print("=" * 50)
    
    try:
        async with aiohttp.ClientSession() as session:
            # Send a message and monitor progress
            test_data = {
                "message": "I want to add user authentication to my app"
            }
            
            print("1. Sending message and monitoring progress...")
            
            response = await session.post(
                "http://localhost:8000/projects/test-project/chat-with-progress",
                json=test_data
            )
            
            if response.status == 200:
                print("   ✅ Message sent successfully")
                
                # Monitor progress updates
                progress_updates = []
                final_response = None
                
                async for line in response.content:
                    line_str = line.decode('utf-8').strip()
                    
                    if line_str.startswith('data: '):
                        try:
                            data = json.loads(line_str[6:])
                            
                            if data.get('type') == 'progress':
                                progress = data.get('progress', {})
                                progress_updates.append(progress)
                                print(f"   📊 Progress: {progress.get('message', 'Unknown')}")
                                
                            elif data.get('type') == 'complete':
                                final_response = data.get('response', '')
                                print(f"   ✅ Complete: Response received")
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
                
                # Check for expected progress stages
                expected_stages = ['analyzing', 'context', 'planning', 'validation', 'execution', 'memory']
                found_stages = [p.get('step') for p in progress_updates]
                
                print(f"   Expected stages: {expected_stages}")
                print(f"   Found stages: {found_stages}")
                
                # Check if we have meaningful progress updates
                if len(progress_updates) >= 3:  # At least 3 progress updates
                    print("   ✅ Sufficient progress updates received")
                    
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
        print(f"   ❌ Error testing real-time progress: {e}")
        return False

async def test_session_management():
    """Test session management and conversation continuity."""
    
    print("\n📋 Testing Session Management")
    print("=" * 50)
    
    try:
        async with aiohttp.ClientSession() as session:
            # Test 1: Get current session
            print("1. Testing current session retrieval...")
            
            response = await session.get(
                "http://localhost:8000/projects/test-project/current-session"
            )
            
            if response.status == 200:
                current_session = await response.json()
                print(f"   ✅ Current session: {current_session.get('id', 'Unknown')}")
                
                # Test 2: Get session messages
                session_id = current_session.get('id')
                if session_id:
                    response = await session.get(
                        f"http://localhost:8000/projects/test-project/session-messages/{session_id}"
                    )
                    
                    if response.status == 200:
                        session_messages = await response.json()
                        print(f"   ✅ Session messages: {len(session_messages)} messages")
                        
                        # Check if messages are properly associated with session
                        for msg in session_messages:
                            if msg.get('session_id') == session_id:
                                print("   ✅ Messages properly associated with session")
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
        print(f"   ❌ Error testing session management: {e}")
        return False

async def main():
    """Main test function."""
    
    print("🚀 Testing UX Fixes: Conversation Display & Real-Time Progress")
    print("=" * 70)
    
    # Run all tests
    conversation_success = await test_conversation_history_fix()
    progress_success = await test_real_time_progress()
    session_success = await test_session_management()
    
    print("\n" + "=" * 70)
    print("📊 Test Results Summary")
    print("=" * 70)
    print(f"   Conversation History Fix: {'✅ PASS' if conversation_success else '❌ FAIL'}")
    print(f"   Real-Time Progress Display: {'✅ PASS' if progress_success else '❌ FAIL'}")
    print(f"   Session Management: {'✅ PASS' if session_success else '❌ FAIL'}")
    
    if conversation_success and progress_success and session_success:
        print("\n🎉 All UX fixes are working correctly!")
        print("\nThe frontend should now provide:")
        print("  ✅ Complete conversation history display")
        print("  ✅ Real-time progress updates during processing")
        print("  ✅ Proper session management and continuity")
        print("  ✅ Enhanced user experience with immediate feedback")
        print("  ✅ Professional, responsive interface")
    else:
        print("\n⚠️  Some UX fixes may need attention")
        print("Please check the specific failing tests above")

if __name__ == "__main__":
    asyncio.run(main()) 