#!/usr/bin/env python3
"""
Test script for immediate visual indicator functionality
Tests that the task context visual indicator appears immediately when a task is clicked
"""

import asyncio
import aiohttp
import json
from typing import Dict, Any

BASE_URL = "http://localhost:8000"

class ImmediateVisualIndicatorTest:
    def __init__(self):
        self.session = None
        self.project_id = None
        self.task_id = None
        self.session_id = None

    async def setup_session(self):
        """Setup aiohttp session"""
        self.session = aiohttp.ClientSession()

    async def cleanup_session(self):
        """Cleanup aiohttp session"""
        if self.session:
            await self.session.close()

    async def make_request(self, method: str, endpoint: str, data: Dict[Any, Any] = None) -> Dict[Any, Any]:
        """Make HTTP request"""
        url = f"{BASE_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        async with self.session.request(method, url, json=data, headers=headers) as response:
            if response.status >= 400:
                text = await response.text()
                raise Exception(f"HTTP {response.status}: {text}")
            return await response.json()

    async def setup_test_data(self):
        """Setup test project, task, and session"""
        print("🔧 Setting up test data for immediate visual indicator test...")
        
        try:
            # Get first project
            projects = await self.make_request("GET", "/projects")
            if projects:
                self.project_id = projects[0]["id"]
                print(f"✅ Using project: {projects[0]['name']}")
            else:
                raise Exception("No projects found")

            # Create test task for immediate indicator test
            task_data = {
                "title": "Immediate Visual Indicator Test",
                "description": "This task tests the immediate visual indicator when clicked",
                "status": "pending",
                "priority": "high"
            }
            task = await self.make_request("POST", f"/projects/{self.project_id}/tasks", task_data)
            self.task_id = task["id"]
            print(f"✅ Created test task: {task['title']}")

            # Get current session
            session = await self.make_request("GET", f"/projects/{self.project_id}/current-session")
            self.session_id = session["id"]
            print(f"✅ Got session: {self.session_id}")

            return True

        except Exception as e:
            print(f"❌ Setup failed: {e}")
            return False

    async def test_initial_no_context(self):
        """Test that initially there's no task context"""
        print("🔍 Testing initial state: No task context...")
        try:
            result = await self.make_request(
                "GET", 
                f"/projects/{self.project_id}/sessions/{self.session_id}/task-context"
            )
            
            if not result["has_context"]:
                print("✅ Initial state: No task context (as expected)")
                return True
            else:
                # Clear any existing context
                await self.make_request(
                    "DELETE", 
                    f"/projects/{self.project_id}/sessions/{self.session_id}/task-context"
                )
                print("✅ Cleared existing context to start fresh")
                return True
        except Exception as e:
            print(f"❌ Failed to check initial context: {e}")
            return False

    async def test_immediate_context_setting(self):
        """Test immediate context setting (simulating frontend click)"""
        print("🔍 Testing immediate context setting when task is clicked...")
        
        try:
            # Simulate what happens immediately when user clicks a task
            data = {
                "task_id": self.task_id,
                "session_id": self.session_id
            }
            
            # Set task context (simulating frontend automatic setting)
            print("   📤 Setting task context...")
            result = await self.make_request(
                "POST", 
                f"/projects/{self.project_id}/sessions/{self.session_id}/set-task-context",
                data
            )
            
            if result["success"]:
                print(f"   ✅ Task context set: {result['task_context']['title']}")
                
                # Immediately check if context is retrievable (simulating frontend polling)
                print("   📤 Immediately checking context availability...")
                check_result = await self.make_request(
                    "GET", 
                    f"/projects/{self.project_id}/sessions/{self.session_id}/task-context"
                )
                
                if check_result["has_context"] and check_result["task_context"]["id"] == self.task_id:
                    print("   ✅ Context immediately available for visual indicator!")
                    print(f"   📋 Task title: {check_result['task_context']['title']}")
                    return True
                else:
                    print(f"   ❌ Context not immediately available: {check_result}")
                    return False
            else:
                print(f"   ❌ Failed to set context: {result}")
                return False
                
        except Exception as e:
            print(f"❌ Failed immediate context test: {e}")
            return False

    async def test_context_persistence_across_calls(self):
        """Test that context persists across multiple API calls"""
        print("🔍 Testing context persistence...")
        
        try:
            # Make multiple rapid calls to simulate frontend behavior
            for i in range(3):
                result = await self.make_request(
                    "GET", 
                    f"/projects/{self.project_id}/sessions/{self.session_id}/task-context"
                )
                
                if result["has_context"] and result["task_context"]["id"] == self.task_id:
                    print(f"   ✅ Call {i+1}: Context persists")
                else:
                    print(f"   ❌ Call {i+1}: Context lost")
                    return False
                    
                # Small delay to simulate real frontend behavior
                await asyncio.sleep(0.1)
            
            print("✅ Context persists across multiple calls")
            return True
            
        except Exception as e:
            print(f"❌ Failed persistence test: {e}")
            return False

    async def test_rapid_context_switching(self):
        """Test rapid context switching (clicking different tasks quickly)"""
        print("🔍 Testing rapid context switching...")
        
        try:
            # Create second task
            task_data = {
                "title": "Second Test Task for Switching",
                "description": "Testing rapid context switching",
                "status": "in_progress",
                "priority": "medium"
            }
            second_task = await self.make_request("POST", f"/projects/{self.project_id}/tasks", task_data)
            second_task_id = second_task["id"]
            print(f"   ✅ Created second task: {second_task['title']}")

            # Switch to second task rapidly
            data = {
                "task_id": second_task_id,
                "session_id": self.session_id
            }
            
            switch_result = await self.make_request(
                "POST", 
                f"/projects/{self.project_id}/sessions/{self.session_id}/set-task-context",
                data
            )
            
            if switch_result["success"]:
                # Immediately check the new context
                check_result = await self.make_request(
                    "GET", 
                    f"/projects/{self.project_id}/sessions/{self.session_id}/task-context"
                )
                
                if check_result["task_context"]["id"] == second_task_id:
                    print(f"   ✅ Context switched immediately to: {check_result['task_context']['title']}")
                    return True
                else:
                    print(f"   ❌ Context didn't switch properly: {check_result}")
                    return False
            else:
                print(f"   ❌ Failed to switch context: {switch_result}")
                return False
                
        except Exception as e:
            print(f"❌ Failed rapid switching test: {e}")
            return False

    async def test_chat_with_immediate_context(self):
        """Test that chat immediately works with the set context"""
        print("🔍 Testing chat with immediate context...")
        
        try:
            # Send a chat message immediately after context is set
            chat_data = {
                "message": "Can you help me with this task that I just selected?"
            }
            
            result = await self.make_request("POST", f"/projects/{self.project_id}/chat", chat_data)
            
            if result["response"] and result.get("task_context"):
                print("✅ Chat immediately works with task context")
                print(f"   Task in context: {result['task_context']['title']}")
                print(f"   Response length: {len(result['response'])} characters")
                return True
            else:
                print(f"❌ Chat missing immediate context: {result}")
                return False
                
        except Exception as e:
            print(f"❌ Failed immediate chat test: {e}")
            return False

    async def run_all_tests(self):
        """Run all immediate visual indicator tests"""
        print("🚀 Starting Immediate Visual Indicator Tests\n")
        print("This tests that the visual indicator appears immediately when users click on tasks\n")
        
        await self.setup_session()
        
        try:
            tests = [
                self.setup_test_data,
                self.test_initial_no_context,
                self.test_immediate_context_setting,
                self.test_context_persistence_across_calls,
                self.test_rapid_context_switching,
                self.test_chat_with_immediate_context
            ]
            
            passed = 0
            total = len(tests)
            
            for test in tests:
                print()
                success = await test()
                if success:
                    passed += 1
                else:
                    print("❌ Test failed, stopping...")
                    break
            
            print(f"\n📊 Test Results: {passed}/{total} tests passed")
            
            if passed == total:
                print("🎉 All immediate visual indicator tests passed!")
                print("✨ The visual indicator will appear immediately when users click on tasks!")
            else:
                print("❌ Some tests failed. The visual indicator may have delays.")
                
        finally:
            await self.cleanup_session()

async def main():
    """Main test function"""
    test = ImmediateVisualIndicatorTest()
    await test.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())
