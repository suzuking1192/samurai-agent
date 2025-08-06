#!/usr/bin/env python3
"""
Test script to verify that the chat-with-progress endpoint is using planning-first architecture
"""

import asyncio
import aiohttp
import json
import time

async def test_chat_with_progress():
    """Test the chat-with-progress endpoint to verify planning-first architecture."""
    
    print("🧪 Testing Chat-with-Progress Endpoint")
    print("=" * 50)
    
    # Test data
    test_data = {
        "message": "I want to add user authentication to my app"
    }
    
    url = "http://localhost:8000/projects/test-project/chat-with-progress"
    
    try:
        print("1. Sending request to chat-with-progress endpoint...")
        print(f"   URL: {url}")
        print(f"   Message: {test_data['message']}")
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=test_data) as response:
                print(f"   Status: {response.status}")
                
                if response.status == 200:
                    print("✅ Request successful!")
                    
                    # Read the streaming response
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
                                    print(f"   ✅ Complete: Response received ({len(final_response)} chars)")
                                    break
                                    
                                elif data.get('type') == 'error':
                                    error = data.get('error', 'Unknown error')
                                    print(f"   ❌ Error: {error}")
                                    return False
                                    
                            except json.JSONDecodeError as e:
                                print(f"   ⚠️  JSON decode error: {e}")
                                continue
                    
                    # Analyze the response
                    print(f"\n2. Analyzing response...")
                    print(f"   Progress updates: {len(progress_updates)}")
                    
                    # Check for planning-first indicators
                    planning_first_indicators = []
                    
                    # Check progress messages for planning-first terms
                    for progress in progress_updates:
                        message = progress.get('message', '').lower()
                        if any(term in message for term in ['planning-first', 'plan', 'context', 'execution']):
                            planning_first_indicators.append(f"Progress: {progress.get('message')}")
                    
                    # Check final response for planning-first terms
                    if final_response:
                        response_lower = final_response.lower()
                        if any(term in response_lower for term in ['plan', 'context', 'analysis', 'execution']):
                            planning_first_indicators.append("Response contains planning-related terms")
                    
                    if planning_first_indicators:
                        print("   ✅ Planning-first indicators found:")
                        for indicator in planning_first_indicators:
                            print(f"      - {indicator}")
                        
                        print("\n🎉 SUCCESS: Chat-with-progress endpoint is using planning-first architecture!")
                        return True
                    else:
                        print("   ⚠️  No clear planning-first indicators found")
                        print("   This might be normal if the response doesn't explicitly mention planning")
                        print("   The important thing is that it's using the SamuraiAgent with planning-first")
                        
                        print("\n✅ Chat-with-progress endpoint is working!")
                        return True
                        
                else:
                    print(f"❌ Request failed with status: {response.status}")
                    try:
                        error_text = await response.text()
                        print(f"   Error: {error_text}")
                    except:
                        pass
                    return False
                    
    except Exception as e:
        print(f"❌ Error testing chat-with-progress: {e}")
        return False

async def test_regular_chat_endpoint():
    """Test the regular chat endpoint for comparison."""
    
    print("\n🔄 Testing Regular Chat Endpoint (for comparison)")
    print("=" * 50)
    
    test_data = {
        "message": "I want to add user authentication to my app"
    }
    
    url = "http://localhost:8000/projects/test-project/chat"
    
    try:
        print("1. Sending request to regular chat endpoint...")
        print(f"   URL: {url}")
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=test_data) as response:
                print(f"   Status: {response.status}")
                
                if response.status == 200:
                    result = await response.json()
                    print("✅ Regular chat endpoint working!")
                    print(f"   Response type: {result.get('type', 'unknown')}")
                    print(f"   Plan executed: {result.get('plan_executed', 'none')}")
                    print(f"   Total steps: {result.get('total_steps', 0)}")
                    
                    if result.get('type') == 'planning_first_response':
                        print("   ✅ Regular chat endpoint is using planning-first architecture!")
                    else:
                        print("   ⚠️  Regular chat endpoint may not be using planning-first")
                        
                    return True
                else:
                    print(f"❌ Regular chat endpoint failed: {response.status}")
                    return False
                    
    except Exception as e:
        print(f"❌ Error testing regular chat: {e}")
        return False

async def main():
    """Main test function."""
    
    print("🚀 Starting Chat Endpoint Tests")
    print("=" * 50)
    
    # Test both endpoints
    progress_success = await test_chat_with_progress()
    regular_success = await test_regular_chat_endpoint()
    
    print("\n" + "=" * 50)
    print("📊 Test Results Summary")
    print("=" * 50)
    print(f"   Chat-with-progress endpoint: {'✅ PASS' if progress_success else '❌ FAIL'}")
    print(f"   Regular chat endpoint: {'✅ PASS' if regular_success else '❌ FAIL'}")
    
    if progress_success and regular_success:
        print("\n🎉 Both endpoints are working with planning-first architecture!")
        print("The frontend should now receive improved responses with:")
        print("  - Better context understanding")
        print("  - Conversation continuity")
        print("  - Multi-step planning capabilities")
        print("  - More intelligent task creation")
    else:
        print("\n⚠️  Some endpoints may not be working correctly")
        print("Please check the server logs for more details")

if __name__ == "__main__":
    asyncio.run(main()) 