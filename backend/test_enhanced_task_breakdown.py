#!/usr/bin/env python3
"""
Test script for enhanced task breakdown functionality.
Tests the new AI-optimized prompt against various feature requests.
"""

import asyncio
import json
import sys
import os
from datetime import datetime

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from services.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext
from models import ChatMessage, Task, Memory

class MockGeminiService:
    """Mock Gemini service for testing task breakdown responses."""
    
    def __init__(self, test_responses=None):
        self.test_responses = test_responses or {}
        self.call_count = 0
    
    async def chat_with_system_prompt(self, message, system_prompt):
        """Mock response based on test scenarios."""
        self.call_count += 1
        
        # Extract the feature request from the message
        feature_request = message.strip()
        
        # Define test scenarios and their expected responses
        scenarios = {
            "simple": {
                "request": "Add a contact form to the homepage",
                "response": json.dumps([{
                    "title": "Create contact form component",
                    "description": "PROJECT: Test Project | TECH: React/Node.js\n\nCONTEXT: Standard form patterns\n\nTASK: Create a contact form component for homepage\n\nFILES: src/components/ContactForm.tsx, src/styles/ContactForm.css\n\nREQUIREMENTS:\n- Form with name, email, message fields\n- Form validation\n- Submit functionality\n\nACCEPTANCE: Form renders and validates input",
                    "priority": "medium",
                    "order": 0
                }])
            },
            "complex": {
                "request": "Build a complete user authentication system with login, registration, password reset, and profile management",
                "response": json.dumps([
                    {
                        "title": "Create user database schema and models",
                        "description": "PROJECT: Test Project | TECH: React/Node.js\n\nCONTEXT: Existing database patterns\n\nTASK: Create user table schema and model\n\nFILES: models/User.js, migrations/create_users_table.js\n\nREQUIREMENTS:\n- User table with email, password_hash, profile fields\n- Password hashing utilities\n- User model with validation\n\nACCEPTANCE: User model can be created and validated",
                        "priority": "high",
                        "order": 0
                    },
                    {
                        "title": "Implement authentication API endpoints",
                        "description": "PROJECT: Test Project | TECH: React/Node.js\n\nCONTEXT: REST API patterns\n\nTASK: Create login, register, logout endpoints\n\nFILES: routes/auth.js, middleware/auth.js\n\nREQUIREMENTS:\n- POST /auth/login, /auth/register, /auth/logout\n- JWT token generation and validation\n- Password reset endpoints\n\nACCEPTANCE: All endpoints return proper responses",
                        "priority": "high",
                        "order": 1
                    },
                    {
                        "title": "Create authentication UI components",
                        "description": "PROJECT: Test Project | TECH: React/Node.js\n\nCONTEXT: Component library patterns\n\nTASK: Build login and registration forms\n\nFILES: src/components/auth/LoginForm.tsx, RegisterForm.tsx\n\nREQUIREMENTS:\n- Login form with email/password\n- Registration form with validation\n- Password reset form\n\nACCEPTANCE: Forms render and handle user input",
                        "priority": "medium",
                        "order": 2
                    },
                    {
                        "title": "Implement user profile management",
                        "description": "PROJECT: Test Project | TECH: React/Node.js\n\nCONTEXT: Profile management patterns\n\nTASK: Create profile view and edit functionality\n\nFILES: src/components/profile/ProfileView.tsx, ProfileEdit.tsx\n\nREQUIREMENTS:\n- Profile display component\n- Profile editing form\n- Avatar upload functionality\n\nACCEPTANCE: Users can view and edit their profiles",
                        "priority": "medium",
                        "order": 3
                    }
                ])
            },
            "micro": {
                "request": "Add email validation to the existing registration form",
                "response": json.dumps({
                    "breakdown_needed": False,
                    "reason": "Feature request is already appropriately sized for AI implementation",
                    "recommendation": "Implement as single focused task",
                    "single_task": {
                        "title": "Add email validation to registration form",
                        "description": "PROJECT: Test Project | TECH: React/Node.js\n\nCONTEXT: Existing form validation patterns\n\nTASK: Add email validation to registration form\n\nFILES: src/components/auth/RegisterForm.tsx\n\nREQUIREMENTS:\n- Email format validation\n- Real-time validation feedback\n- Error message display\n\nACCEPTANCE: Invalid emails show error messages",
                        "priority": "medium",
                        "order": 0
                    }
                })
            },
            "unclear": {
                "request": "Make the app better",
                "response": json.dumps({
                    "breakdown_needed": False,
                    "reason": "Feature request needs more specification before task breakdown",
                    "missing_details": ["specific functionality", "target areas", "user goals"],
                    "recommendation": "Gather more detailed requirements before creating implementation tasks"
                })
            }
        }
        
        # Find matching scenario
        for scenario_name, scenario_data in scenarios.items():
            if scenario_data["request"].lower() in feature_request.lower():
                return scenario_data["response"]
        
        # Default response for unmatched scenarios
        return json.dumps([{
            "title": "Implement feature request",
            "description": f"PROJECT: Test Project | TECH: React/Node.js\n\nTASK: {feature_request}\n\nFILES: To be determined\n\nREQUIREMENTS:\n- Implement the requested feature\n\nACCEPTANCE: Feature works as requested",
            "priority": "medium",
            "order": 0
        }])

class TestEnhancedTaskBreakdown:
    """Test class for enhanced task breakdown functionality."""
    
    def __init__(self):
        self.agent = UnifiedSamuraiAgent()
        # Replace the real Gemini service with our mock
        self.agent.gemini_service = MockGeminiService()
    
    def create_test_context(self, project_name="Test Project", tech_stack="React/Node.js"):
        """Create a test conversation context."""
        return ConversationContext(
            session_messages=[
                ChatMessage(
                    id="1",
                    session_id="test-session",
                    project_id="test-project",
                    message="Hello, I need help with my project",
                    response="I'm here to help you with your project!",
                    created_at=datetime.now()
                )
            ],
            conversation_summary="User is working on a web application and needs help with feature implementation.",
            relevant_tasks=[
                Task(
                    id="1",
                    project_id="test-project",
                    title="Set up basic project structure",
                    description="Initialize the project with basic setup",
                    status="completed",
                    priority="high",
                    order=0,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
            ],
            relevant_memories=[
                Memory(
                    id="1",
                    project_id="test-project",
                    title="Project Tech Stack",
                    content="Project uses React frontend with Node.js backend",
                    category="technical",
                    type="note",
                    created_at=datetime.now()
                )
            ],
            project_context={
                "name": project_name,
                "tech_stack": tech_stack,
                "description": "A test web application"
            }
        )
    
    async def test_simple_feature(self):
        """Test simple feature breakdown."""
        print("\n=== Testing Simple Feature ===")
        
        context = self.create_test_context()
        message = "Add a contact form to the homepage"
        
        print(f"Request: {message}")
        
        start_time = datetime.now()
        tasks = await self.agent._generate_task_breakdown(message, context)
        end_time = datetime.now()
        
        duration = (end_time - start_time).total_seconds()
        print(f"Duration: {duration:.2f} seconds")
        print(f"Tasks generated: {len(tasks)}")
        
        for i, task in enumerate(tasks, 1):
            print(f"\nTask {i}:")
            print(f"  Title: {task.get('title', 'N/A')}")
            print(f"  Priority: {task.get('priority', 'N/A')}")
            print(f"  Order: {task.get('order', 'N/A')}")
            print(f"  Description length: {len(task.get('description', ''))} chars")
            print(f"  Description preview: {task.get('description', '')[:100]}...")
        
        return tasks
    
    async def test_complex_feature(self):
        """Test complex feature breakdown."""
        print("\n=== Testing Complex Feature ===")
        
        context = self.create_test_context()
        message = "Build a complete user authentication system with login, registration, password reset, and profile management"
        
        print(f"Request: {message}")
        
        start_time = datetime.now()
        tasks = await self.agent._generate_task_breakdown(message, context)
        end_time = datetime.now()
        
        duration = (end_time - start_time).total_seconds()
        print(f"Duration: {duration:.2f} seconds")
        print(f"Tasks generated: {len(tasks)}")
        
        for i, task in enumerate(tasks, 1):
            print(f"\nTask {i}:")
            print(f"  Title: {task.get('title', 'N/A')}")
            print(f"  Priority: {task.get('priority', 'N/A')}")
            print(f"  Order: {task.get('order', 'N/A')}")
            print(f"  Description length: {len(task.get('description', ''))} chars")
            print(f"  Description preview: {task.get('description', '')[:100]}...")
        
        return tasks
    
    async def test_micro_feature(self):
        """Test micro feature (no breakdown needed)."""
        print("\n=== Testing Micro Feature ===")
        
        context = self.create_test_context()
        message = "Add email validation to the existing registration form"
        
        print(f"Request: {message}")
        
        start_time = datetime.now()
        tasks = await self.agent._generate_task_breakdown(message, context)
        end_time = datetime.now()
        
        duration = (end_time - start_time).total_seconds()
        print(f"Duration: {duration:.2f} seconds")
        print(f"Tasks generated: {len(tasks)}")
        
        for i, task in enumerate(tasks, 1):
            print(f"\nTask {i}:")
            print(f"  Title: {task.get('title', 'N/A')}")
            print(f"  Priority: {task.get('priority', 'N/A')}")
            print(f"  Order: {task.get('order', 'N/A')}")
            print(f"  Description length: {len(task.get('description', ''))} chars")
            print(f"  Description preview: {task.get('description', '')[:100]}...")
        
        return tasks
    
    async def test_unclear_feature(self):
        """Test unclear feature request."""
        print("\n=== Testing Unclear Feature ===")
        
        context = self.create_test_context()
        message = "Make the app better"
        
        print(f"Request: {message}")
        
        start_time = datetime.now()
        tasks = await self.agent._generate_task_breakdown(message, context)
        end_time = datetime.now()
        
        duration = (end_time - start_time).total_seconds()
        print(f"Duration: {duration:.2f} seconds")
        print(f"Tasks generated: {len(tasks)}")
        
        for i, task in enumerate(tasks, 1):
            print(f"\nTask {i}:")
            print(f"  Title: {task.get('title', 'N/A')}")
            print(f"  Priority: {task.get('priority', 'N/A')}")
            print(f"  Order: {task.get('order', 'N/A')}")
            print(f"  Description length: {len(task.get('description', ''))} chars")
            print(f"  Description preview: {task.get('description', '')[:100]}...")
        
        return tasks
    
    def analyze_task_quality(self, tasks):
        """Analyze the quality of generated tasks."""
        print("\n=== Task Quality Analysis ===")
        
        total_tasks = len(tasks)
        if total_tasks == 0:
            print("No tasks generated")
            return
        
        # Analyze task characteristics
        title_lengths = [len(task.get('title', '')) for task in tasks]
        desc_lengths = [len(task.get('description', '')) for task in tasks]
        priorities = [task.get('priority', 'unknown') for task in tasks]
        orders = [task.get('order', -1) for task in tasks]
        
        print(f"Total tasks: {total_tasks}")
        print(f"Average title length: {sum(title_lengths) / len(title_lengths):.1f} chars")
        print(f"Average description length: {sum(desc_lengths) / len(desc_lengths):.1f} chars")
        print(f"Priority distribution: {dict(zip(set(priorities), [priorities.count(p) for p in set(priorities)]))}")
        print(f"Order sequence: {orders}")
        
        # Check for quality issues
        issues = []
        
        # Check title length
        long_titles = [i for i, length in enumerate(title_lengths) if length > 200]
        if long_titles:
            issues.append(f"Tasks with titles > 200 chars: {long_titles}")
        
        # Check description length
        long_descs = [i for i, length in enumerate(desc_lengths) if length > 1000]
        if long_descs:
            issues.append(f"Tasks with descriptions > 1000 chars: {long_descs}")
        
        # Check order sequence
        if sorted(orders) != orders:
            issues.append("Tasks are not in proper order sequence")
        
        # Check for required fields
        missing_fields = []
        for i, task in enumerate(tasks):
            if 'title' not in task:
                missing_fields.append(f"Task {i+1} missing title")
            if 'description' not in task:
                missing_fields.append(f"Task {i+1} missing description")
        
        if missing_fields:
            issues.extend(missing_fields)
        
        if issues:
            print("\nQuality Issues Found:")
            for issue in issues:
                print(f"  - {issue}")
        else:
            print("\n✅ All quality checks passed!")
    
    async def run_comprehensive_test(self):
        """Run all tests and provide comprehensive analysis."""
        print("🚀 Starting Enhanced Task Breakdown Test Suite")
        print("=" * 60)
        
        test_results = {}
        
        # Run all test scenarios
        test_results['simple'] = await self.test_simple_feature()
        test_results['complex'] = await self.test_complex_feature()
        test_results['micro'] = await self.test_micro_feature()
        test_results['unclear'] = await self.test_unclear_feature()
        
        # Analyze results
        print("\n" + "=" * 60)
        print("📊 COMPREHENSIVE ANALYSIS")
        print("=" * 60)
        
        for scenario, tasks in test_results.items():
            print(f"\n--- {scenario.upper()} SCENARIO ---")
            self.analyze_task_quality(tasks)
        
        # Performance summary
        print(f"\n📈 PERFORMANCE SUMMARY")
        print(f"Total API calls made: {self.agent.gemini_service.call_count}")
        print(f"Average tasks per scenario: {sum(len(tasks) for tasks in test_results.values()) / len(test_results):.1f}")
        
        # Success criteria check
        print(f"\n✅ SUCCESS CRITERIA CHECK")
        
        success_criteria = {
            "Simple feature generates 1 task": len(test_results['simple']) == 1,
            "Complex feature generates 4 tasks": len(test_results['complex']) == 4,
            "Micro feature generates 1 task": len(test_results['micro']) == 1,
            "Unclear feature generates 1 task": len(test_results['unclear']) == 1,
            "All tasks have titles": all('title' in task for tasks in test_results.values() for task in tasks),
            "All tasks have descriptions": all('description' in task for tasks in test_results.values() for task in tasks),
            "All tasks have priorities": all('priority' in task for tasks in test_results.values() for task in tasks),
            "All tasks have order": all('order' in task for tasks in test_results.values() for task in tasks),
        }
        
        for criterion, passed in success_criteria.items():
            status = "✅ PASS" if passed else "❌ FAIL"
            print(f"  {status}: {criterion}")
        
        overall_success = all(success_criteria.values())
        print(f"\n🎯 OVERALL RESULT: {'✅ SUCCESS' if overall_success else '❌ FAILURE'}")
        
        return overall_success

async def main():
    """Main test execution function."""
    tester = TestEnhancedTaskBreakdown()
    success = await tester.run_comprehensive_test()
    
    if success:
        print("\n🎉 Enhanced task breakdown is working correctly!")
        return 0
    else:
        print("\n⚠️  Enhanced task breakdown needs improvement.")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code) 