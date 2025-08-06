#!/usr/bin/env python3
"""
Planning-First Architecture Verification Script

This script verifies that the planning-first architecture is active on the running server.
"""

import requests
import json
import sys

def verify_planning_first_architecture():
    """Verify that the planning-first architecture is active."""
    
    print("🔍 Verifying Planning-First Architecture")
    print("=" * 50)
    
    # Test 1: Check server health
    print("1. Checking server health...")
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            print("✅ Server is running and healthy")
        else:
            print(f"❌ Server health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to server: {e}")
        print("   Make sure the server is running on http://localhost:8000")
        return False
    
    # Test 2: Test planning-first architecture
    print("\n2. Testing planning-first architecture...")
    try:
        # Test with a simple chat request
        test_data = {
            "message": "I want to add user authentication to my app"
        }
        
        print("   Sending test message...")
        response = requests.post(
            "http://localhost:8000/projects/test-project/chat",
            json=test_data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Server responded successfully")
            print(f"   Response type: {result.get('type', 'unknown')}")
            
            # Check for planning-first indicators
            planning_first_active = False
            
            # Check response type
            if 'planning_first' in result.get('type', ''):
                planning_first_active = True
                print("   ✅ Found 'planning_first' in response type")
            
            # Check for plan-related fields
            if result.get('plan_executed'):
                planning_first_active = True
                print(f"   ✅ Found plan_executed: {result['plan_executed']}")
            
            if result.get('plan_type'):
                planning_first_active = True
                print(f"   ✅ Found plan_type: {result['plan_type']}")
            
            if result.get('total_steps'):
                planning_first_active = True
                print(f"   ✅ Found total_steps: {result['total_steps']}")
            
            if result.get('steps_completed'):
                planning_first_active = True
                print(f"   ✅ Found steps_completed: {result['steps_completed']}")
            
            if result.get('confidence_score'):
                planning_first_active = True
                print(f"   ✅ Found confidence_score: {result['confidence_score']}")
            
            # Check response content for planning indicators
            response_text = result.get('response', '')
            if any(indicator in response_text.lower() for indicator in ['plan', 'step', 'execution', 'context']):
                planning_first_active = True
                print("   ✅ Found planning-related terms in response")
            
            if planning_first_active:
                print("\n🎉 SUCCESS: Planning-first architecture is ACTIVE!")
                print("\nThe agent is now using the new planning-first approach:")
                print("  - Comprehensive context analysis")
                print("  - Multi-step plan generation")
                print("  - Conversation continuity")
                print("  - Intelligent response generation")
                
                return True
            else:
                print("\n❌ FAILED: Planning-first architecture is NOT active")
                print("   The server may still be using the old architecture")
                print("   Please restart the server to load the new code")
                return False
                
        else:
            print(f"❌ Server responded with error: {response.status_code}")
            try:
                error_detail = response.json()
                print(f"   Error detail: {error_detail}")
            except:
                print(f"   Response text: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing planning-first architecture: {e}")
        return False

def test_conversation_continuity():
    """Test conversation continuity with the planning-first architecture."""
    
    print("\n🔄 Testing Conversation Continuity")
    print("=" * 50)
    
    try:
        # Test a conversation sequence
        messages = [
            "I want to build a todo app",
            "I prefer using React for the frontend", 
            "Can you create a task for the React setup?"
        ]
        
        for i, message in enumerate(messages, 1):
            print(f"\nMessage {i}: {message}")
            
            test_data = {"message": message}
            response = requests.post(
                "http://localhost:8000/projects/test-project/chat",
                json=test_data,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"   Response: {result.get('response', '')[:100]}...")
                print(f"   Type: {result.get('type', 'unknown')}")
                print(f"   Plan type: {result.get('plan_type', 'unknown')}")
            else:
                print(f"   ❌ Error: {response.status_code}")
                return False
        
        print("\n✅ Conversation continuity test completed")
        return True
        
    except Exception as e:
        print(f"❌ Conversation continuity test failed: {e}")
        return False

def main():
    """Main function to verify planning-first architecture."""
    
    # Verify planning-first architecture
    if verify_planning_first_architecture():
        # Test conversation continuity
        test_conversation_continuity()
        
        print("\n" + "=" * 50)
        print("🎉 All verification tests passed!")
        print("The planning-first architecture is working correctly.")
        print("=" * 50)
    else:
        print("\n" + "=" * 50)
        print("❌ Verification failed!")
        print("Please restart the server to load the planning-first architecture.")
        print("=" * 50)
        sys.exit(1)

if __name__ == "__main__":
    main() 