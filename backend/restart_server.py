#!/usr/bin/env python3
"""
Server Restart Helper Script

This script helps restart the FastAPI server to ensure the new planning-first
architecture is loaded and active.
"""

import subprocess
import sys
import time
import requests
import json

def check_server_health():
    """Check if the server is running and healthy."""
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            return True
    except:
        pass
    return False

def test_planning_first_architecture():
    """Test that the planning-first architecture is active."""
    try:
        # Test with a simple chat request
        test_data = {
            "message": "I want to add user authentication to my app"
        }
        
        response = requests.post(
            "http://localhost:8000/projects/test-project/chat",
            json=test_data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Server responded successfully")
            print(f"   Response type: {result.get('type', 'unknown')}")
            
            # Check if planning-first indicators are present
            if 'planning_first' in result.get('type', '') or 'plan' in str(result).lower():
                print("✅ Planning-first architecture is active!")
                return True
            else:
                print("⚠️  Planning-first indicators not found in response")
                return False
        else:
            print(f"❌ Server responded with status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing planning-first architecture: {e}")
        return False

def main():
    """Main function to restart server and verify planning-first architecture."""
    
    print("🔄 Planning-First Architecture Server Restart")
    print("=" * 50)
    
    # Check if server is currently running
    print("1. Checking current server status...")
    if check_server_health():
        print("✅ Server is currently running")
        print("   Stopping server to reload planning-first architecture...")
        
        # Note: You'll need to manually stop the server (Ctrl+C in the terminal)
        print("   Please stop the current server (Ctrl+C in the terminal where it's running)")
        print("   Then press Enter to continue...")
        input()
    else:
        print("ℹ️  Server is not currently running")
    
    # Start the server
    print("\n2. Starting server with planning-first architecture...")
    print("   Starting: uvicorn main:app --reload --host 0.0.0.0 --port 8000")
    
    try:
        # Start the server in the background
        process = subprocess.Popen([
            sys.executable, "-m", "uvicorn", "main:app", 
            "--reload", "--host", "0.0.0.0", "--port", "8000"
        ])
        
        print("   Server starting...")
        
        # Wait for server to start
        max_wait = 30
        for i in range(max_wait):
            if check_server_health():
                print("✅ Server started successfully!")
                break
            time.sleep(1)
            if i % 5 == 0:
                print(f"   Waiting for server... ({i+1}/{max_wait}s)")
        else:
            print("❌ Server failed to start within 30 seconds")
            return False
        
        # Test planning-first architecture
        print("\n3. Testing planning-first architecture...")
        time.sleep(2)  # Give server a moment to fully initialize
        
        if test_planning_first_architecture():
            print("\n🎉 Success! Planning-first architecture is active and working!")
            print("\nYou can now test the frontend with improved responses.")
            print("The agent will now:")
            print("  - Analyze conversation context comprehensively")
            print("  - Create multi-step execution plans")
            print("  - Maintain conversation continuity")
            print("  - Provide more intelligent and contextual responses")
            
            print(f"\nServer is running at: http://localhost:8000")
            print("Press Ctrl+C to stop the server when done.")
            
            # Keep the server running
            try:
                process.wait()
            except KeyboardInterrupt:
                print("\n🛑 Stopping server...")
                process.terminate()
                process.wait()
                print("✅ Server stopped")
                
        else:
            print("\n❌ Planning-first architecture test failed")
            print("   The server may still be using the old architecture")
            process.terminate()
            return False
            
    except KeyboardInterrupt:
        print("\n🛑 Interrupted by user")
        if 'process' in locals():
            process.terminate()
        return False
    except Exception as e:
        print(f"\n❌ Error starting server: {e}")
        return False

if __name__ == "__main__":
    main() 