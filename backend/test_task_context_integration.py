#!/usr/bin/env python3
"""
Test script for task context integration
Tests the new FastAPI endpoints and agent functionality
"""

import asyncio
import aiohttp
import json
from typing import Dict, Any

BASE_URL = "http://localhost:8000"

class TaskContextIntegrationTest:
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

    async def test_health_check(self):
        """Test that the server is running"""
        print("🔍 Testing health check...")
        try:
            result = await self.make_request("GET", "/health")
            print(f"✅ Health check passed: {result['status']}")
            return True
        except Exception as e:
            print(f"❌ Health check failed: {e}")
            return False

    async def get_or_create_project(self):
        """Get first project or create a test project"""
        print("🔍 Getting or creating test project...")
        try:
            # Try to get existing projects
            projects = await self.make_request("GET", "/projects")
            if projects:
                self.project_id = projects[0]["id"]
                print(f"✅ Using existing project: {projects[0]['name']} ({self.project_id})")
                return True
            else:
                # Create a test project
                project_data = {
                    "name": "Task Context Test Project",
                    "description": "Test project for task context integration",
                    "tech_stack": "Python, FastAPI, React"
                }
                project = await self.make_request("POST", "/projects", project_data)
                self.project_id = project["id"]
                print(f"✅ Created test project: {project['name']} ({self.project_id})")
                return True
        except Exception as e:
            print(f"❌ Failed to get/create project: {e}")
            return False

    async def get_or_create_task(self):
        """Get first task or create a test task"""
        print("🔍 Getting or creating test task...")
        try:
            # Try to get existing tasks
            tasks = await self.make_request("GET", f"/projects/{self.project_id}/tasks")
            if tasks:
                self.task_id = tasks[0]["id"]
                print(f"✅ Using existing task: {tasks[0]['title']} ({self.task_id})")
                return True
            else:
                # Create a test task
                task_data = {
                    "title": "Test Task Context Feature",
                    "description": "This is a test task for validating the task context integration feature. The agent should help refine this description when this task is set as context.",
                    "status": "pending",
                    "priority": "medium"
                }
                task = await self.make_request("POST", f"/projects/{self.project_id}/tasks", task_data)
                self.task_id = task["id"]
                print(f"✅ Created test task: {task['title']} ({self.task_id})")
                return True
        except Exception as e:
            print(f"❌ Failed to get/create task: {e}")
            return False

    async def get_current_session(self):
        """Get current session"""
        print("🔍 Getting current session...")
        try:
            session = await self.make_request("GET", f"/projects/{self.project_id}/current-session")
            self.session_id = session["id"]
            print(f"✅ Got current session: {self.session_id}")
            return True
        except Exception as e:
            print(f"❌ Failed to get current session: {e}")
            return False

    async def test_set_task_context(self):
        """Test setting task context"""
        print("🔍 Testing set task context endpoint...")
        try:
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
                print(f"✅ Task context set successfully: {result['task_context']['title']}")
                return True
            else:
                print(f"❌ Task context response invalid: {result}")
                return False
        except Exception as e:
            print(f"❌ Failed to set task context: {e}")
            return False

    async def test_get_task_context(self):
        """Test getting task context"""
        print("🔍 Testing get task context endpoint...")
        try:
            result = await self.make_request(
                "GET", 
                f"/projects/{self.project_id}/sessions/{self.session_id}/task-context"
            )
            
            if result["has_context"] and result["task_context"]["id"] == self.task_id:
                print(f"✅ Task context retrieved successfully: {result['task_context']['title']}")
                return True
            else:
                print(f"❌ Task context not found: {result}")
                return False
        except Exception as e:
            print(f"❌ Failed to get task context: {e}")
            return False

    async def test_chat_with_task_context(self):
        """Test chat with task context"""
        print("🔍 Testing chat with task context...")
        try:
            chat_data = {
                "message": "Can you help me improve this task description?",
                "task_context_id": self.task_id
            }
            result = await self.make_request("POST", f"/projects/{self.project_id}/chat", chat_data)
            
            if result["response"] and result.get("task_context"):
                print(f"✅ Chat with task context working: Response includes task context")
                print(f"   Task in context: {result['task_context']['title']}")
                print(f"   Response length: {len(result['response'])} characters")
                return True
            else:
                print(f"❌ Chat response missing task context: {result}")
                return False
        except Exception as e:
            print(f"❌ Failed to chat with task context: {e}")
            return False

    async def test_clear_task_context(self):
        """Test clearing task context"""
        print("🔍 Testing clear task context endpoint...")
        try:
            result = await self.make_request(
                "DELETE", 
                f"/projects/{self.project_id}/sessions/{self.session_id}/task-context"
            )
            
            if result["message"] and "cleared" in result["message"].lower():
                print(f"✅ Task context cleared successfully")
                
                # Verify it's actually cleared
                check_result = await self.make_request(
                    "GET", 
                    f"/projects/{self.project_id}/sessions/{self.session_id}/task-context"
                )
                
                if not check_result["has_context"]:
                    print(f"✅ Task context confirmed cleared")
                    return True
                else:
                    print(f"❌ Task context not actually cleared")
                    return False
            else:
                print(f"❌ Clear task context failed: {result}")
                return False
        except Exception as e:
            print(f"❌ Failed to clear task context: {e}")
            return False

    async def run_all_tests(self):
        """Run all integration tests"""
        print("🚀 Starting Task Context Integration Tests\n")
        
        await self.setup_session()
        
        try:
            tests = [
                self.test_health_check,
                self.get_or_create_project,
                self.get_or_create_task,
                self.get_current_session,
                self.test_set_task_context,
                self.test_get_task_context,
                self.test_chat_with_task_context,
                self.test_clear_task_context
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
                print("🎉 All integration tests passed! Task context feature is working correctly.")
            else:
                print("❌ Some tests failed. Please check the implementation.")
                
        finally:
            await self.cleanup_session()

async def main():
    """Main test function"""
    test = TaskContextIntegrationTest()
    await test.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())
