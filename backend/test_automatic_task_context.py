#!/usr/bin/env python3
"""
Test script for automatic task context setting
Tests that tasks are automatically set as context when opened
"""

import asyncio
import aiohttp
import json
from typing import Dict, Any

BASE_URL = "http://localhost:8000"

class AutomaticTaskContextTest:
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
        print("🔧 Setting up test data...")
        
        try:
            # Get first project
            projects = await self.make_request("GET", "/projects")
            if projects:
                self.project_id = projects[0]["id"]
                print(f"✅ Using project: {projects[0]['name']}")
            else:
                # Create test project
                project_data = {
                    "name": "Automatic Context Test",
                    "description": "Test project for automatic task context",
                    "tech_stack": "React, FastAPI"
                }
                project = await self.make_request("POST", "/projects", project_data)
                self.project_id = project["id"]
                print(f"✅ Created project: {project['name']}")

            # Create test task
            task_data = {
                "title": "Automatic Context Test Task",
                "description": "This task should automatically become context when opened in task details",
                "status": "pending",
                "priority": "high"
            }
            task = await self.make_request("POST", f"/projects/{self.project_id}/tasks", task_data)
            self.task_id = task["id"]
            print(f"✅ Created task: {task['title']}")

            # Get current session
            session = await self.make_request("GET", f"/projects/{self.project_id}/current-session")
            self.session_id = session["id"]
            print(f"✅ Got session: {self.session_id}")

            return True

        except Exception as e:
            print(f"❌ Setup failed: {e}")
            return False

    async def test_initial_context_state(self):
        """Test that initially there's no task context"""
        print("🔍 Testing initial context state...")
        try:
            result = await self.make_request(
                "GET", 
                f"/projects/{self.project_id}/sessions/{self.session_id}/task-context"
            )
            
            if not result["has_context"]:
                print("✅ Initial state: No task context (as expected)")
                return True
            else:
                print(f"❌ Unexpected initial context: {result}")
                return False
        except Exception as e:
            print(f"❌ Failed to check initial context: {e}")
            return False

    async def test_automatic_context_setting(self):
        """Test that setting task context works (simulating frontend automatic setting)"""
        print("🔍 Testing automatic task context setting...")
        try:
            # Simulate what happens when frontend automatically sets context
            data = {
                "task_id": self.task_id,
                "session_id": self.session_id
            }
            result = await self.make_request(
                "POST", 
                f"/projects/{self.project_id}/sessions/{self.session_id}/set-task-context",
                data
            )
            
            if result["success"] and result["task_context"]["id"] == self.task_id:
                print(f"✅ Task automatically set as context: {result['task_context']['title']}")
                return True
            else:
                print(f"❌ Automatic context setting failed: {result}")
                return False
        except Exception as e:
            print(f"❌ Failed to set automatic context: {e}")
            return False

    async def test_context_persistence(self):
        """Test that context persists after being set"""
        print("🔍 Testing context persistence...")
        try:
            result = await self.make_request(
                "GET", 
                f"/projects/{self.project_id}/sessions/{self.session_id}/task-context"
            )
            
            if result["has_context"] and result["task_context"]["id"] == self.task_id:
                print(f"✅ Context persists: {result['task_context']['title']}")
                return True
            else:
                print(f"❌ Context not persisting: {result}")
                return False
        except Exception as e:
            print(f"❌ Failed to check context persistence: {e}")
            return False

    async def test_chat_with_automatic_context(self):
        """Test that chat works with the automatically set context"""
        print("🔍 Testing chat with automatic context...")
        try:
            chat_data = {
                "message": "Help me improve the description of this task for better clarity."
            }
            result = await self.make_request("POST", f"/projects/{self.project_id}/chat", chat_data)
            
            if result["response"] and result.get("task_context"):
                print(f"✅ Chat works with automatic context")
                print(f"   Context task: {result['task_context']['title']}")
                print(f"   Response preview: {result['response'][:100]}...")
                return True
            else:
                print(f"❌ Chat missing automatic context: {result}")
                return False
        except Exception as e:
            print(f"❌ Failed to chat with automatic context: {e}")
            return False

    async def test_context_switching(self):
        """Test switching to different task context"""
        print("🔍 Testing context switching...")
        try:
            # Create another task
            task_data = {
                "title": "Second Test Task",
                "description": "This is the second task for testing context switching",
                "status": "in_progress",
                "priority": "medium"
            }
            new_task = await self.make_request("POST", f"/projects/{self.project_id}/tasks", task_data)
            new_task_id = new_task["id"]
            print(f"✅ Created second task: {new_task['title']}")

            # Switch to new task context
            data = {
                "task_id": new_task_id,
                "session_id": self.session_id
            }
            result = await self.make_request(
                "POST", 
                f"/projects/{self.project_id}/sessions/{self.session_id}/set-task-context",
                data
            )
            
            if result["success"] and result["task_context"]["id"] == new_task_id:
                print(f"✅ Context switched to: {result['task_context']['title']}")
                return True
            else:
                print(f"❌ Context switching failed: {result}")
                return False
        except Exception as e:
            print(f"❌ Failed to test context switching: {e}")
            return False

    async def run_all_tests(self):
        """Run all automatic task context tests"""
        print("🚀 Starting Automatic Task Context Tests\n")
        
        await self.setup_session()
        
        try:
            tests = [
                self.setup_test_data,
                self.test_initial_context_state,
                self.test_automatic_context_setting,
                self.test_context_persistence,
                self.test_chat_with_automatic_context,
                self.test_context_switching
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
                print("🎉 All automatic task context tests passed!")
                print("✨ The automatic context setting feature is working correctly!")
            else:
                print("❌ Some tests failed. Please check the implementation.")
                
        finally:
            await self.cleanup_session()

async def main():
    """Main test function"""
    test = AutomaticTaskContextTest()
    await test.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())
