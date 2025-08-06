#!/usr/bin/env python3
"""
Test script to verify the ChatMessage error fix
"""

import asyncio
import aiohttp
import json

async def test_chat_message_fix():
    """Test that the ChatMessage error is fixed."""
    
    print("🧪 Testing ChatMessage Error Fix")
    print("=" * 50)
    
    # Test data
    test_data = {
        "message": "Hello, this is a test message"
    }
    
    url = "http://localhost:8000/projects/test-project/chat-with-progress"
    
    try:
        print("1. Sending test message to chat-with-progress endpoint...")
        print(f"   URL: {url}")
        print(f"   Message: {test_data['message']}")
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=test_data) as response:
                print(f"   Status: {response.status}")
                
                if response.status == 200:
                    print("✅ Request successful!")
                    
                    # Read the streaming response
                    progress_count = 0
                    final_response = None
                    
                    async for line in response.content:
                        line_str = line.decode('utf-8').strip()
                        
                        if line_str.startswith('data: '):
                            try:
                                data = json.loads(line_str[6:])
                                
                                if data.get('type') == 'progress':
                                    progress_count += 1
                                    progress = data.get('progress', {})
                                    print(f"   📊 Progress {progress_count}: {progress.get('message', 'Unknown')}")
                                    
                                elif data.get('type') == 'complete':
                                    final_response = data.get('response', '')
                                    print(f"   ✅ Complete: Response received ({len(final_response)} chars)")
                                    break
                                    
                                elif data.get('type') == 'error':
                                    error = data.get('error', 'Unknown error')
                                    print(f"   ❌ Error: {error}")
                                    return False
                                    
                            except json.JSONDecodeError as e:
                                print(f"   ⚠️  JSON decode error: {e}")
                                continue
                    
                    # Check results
                    print(f"\n2. Results Analysis:")
                    print(f"   Progress updates: {progress_count}")
                    print(f"   Final response length: {len(final_response) if final_response else 0}")
                    
                    if progress_count > 0 and final_response:
                        print("\n🎉 SUCCESS: ChatMessage error is fixed!")
                        print("The chat-with-progress endpoint is working correctly with planning-first architecture.")
                        return True
                    else:
                        print("\n⚠️  No progress updates or final response received")
                        return False
                        
                else:
                    print(f"❌ Request failed with status: {response.status}")
                    try:
                        error_text = await response.text()
                        print(f"   Error: {error_text}")
                    except:
                        pass
                    return False
                    
    except Exception as e:
        print(f"❌ Error testing chat: {e}")
        return False

async def main():
    """Main test function."""
    
    print("🚀 Testing ChatMessage Error Fix")
    print("=" * 50)
    
    success = await test_chat_message_fix()
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 ChatMessage error fix is working correctly!")
        print("The frontend should now work without the 'ChatMessage' object has no attribute 'get' error.")
    else:
        print("❌ ChatMessage error fix test failed")
        print("Please check the server logs for more details")

if __name__ == "__main__":
    asyncio.run(main()) 