#!/usr/bin/env python3
"""
Real-world test for enhanced task breakdown functionality.
Tests the new AI-optimized prompt with actual API calls to measure performance.
"""

import asyncio
import json
import sys
import os
from datetime import datetime
import time

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from services.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext
from models import ChatMessage, Task, Memory

class PerformanceTest:
    """Test class for measuring enhanced task breakdown performance."""
    
    def __init__(self):
        self.agent = UnifiedSamuraiAgent()
    
    def create_test_context(self, project_name="Samurai Agent", tech_stack="Python/FastAPI/React"):
        """Create a test conversation context."""
        return ConversationContext(
            session_messages=[
                ChatMessage(
                    id="1",
                    session_id="test-session",
                    project_id="test-project",
                    message="I need help with my AI agent project",
                    response="I'm here to help you with your AI agent project!",
                    created_at=datetime.now()
                )
            ],
            conversation_summary="User is working on an AI agent project and needs help with feature implementation.",
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
                    title="Project Architecture",
                    content="Project uses Python backend with FastAPI and React frontend",
                    category="architecture",
                    type="note",
                    created_at=datetime.now()
                )
            ],
            project_context={
                "name": project_name,
                "tech_stack": tech_stack,
                "description": "An AI-powered development assistant"
            }
        )
    
    async def test_feature_requests(self):
        """Test various feature requests with the enhanced prompt."""
        print("🚀 Testing Enhanced Task Breakdown with Real API Calls")
        print("=" * 70)
        
        test_cases = [
            {
                "name": "Simple UI Component",
                "request": "Add a dark mode toggle button to the header",
                "expected_complexity": "low"
            },
            {
                "name": "API Integration",
                "request": "Create an API endpoint to fetch user preferences and add a settings page to display them",
                "expected_complexity": "medium"
            },
            {
                "name": "Complex Feature",
                "request": "Implement a complete file upload system with drag-and-drop interface, progress tracking, and file validation",
                "expected_complexity": "high"
            },
            {
                "name": "Micro Enhancement",
                "request": "Add loading spinners to all form submit buttons",
                "expected_complexity": "low"
            }
        ]
        
        results = []
        
        for i, test_case in enumerate(test_cases, 1):
            print(f"\n📋 Test Case {i}: {test_case['name']}")
            print(f"Request: {test_case['request']}")
            print(f"Expected Complexity: {test_case['expected_complexity']}")
            
            context = self.create_test_context()
            
            # Measure performance
            start_time = time.time()
            tasks = await self.agent._generate_task_breakdown(test_case['request'], context)
            end_time = time.time()
            
            duration = end_time - start_time
            
            print(f"⏱️  Duration: {duration:.2f} seconds")
            print(f"📊 Tasks Generated: {len(tasks)}")
            
            # Analyze task quality
            task_analysis = self.analyze_tasks(tasks)
            
            result = {
                "name": test_case['name'],
                "request": test_case['request'],
                "expected_complexity": test_case['expected_complexity'],
                "duration": duration,
                "task_count": len(tasks),
                "tasks": tasks,
                "analysis": task_analysis
            }
            
            results.append(result)
            
            # Display task details
            for j, task in enumerate(tasks, 1):
                print(f"\n  Task {j}:")
                print(f"    Title: {task.get('title', 'N/A')}")
                print(f"    Priority: {task.get('priority', 'N/A')}")
                print(f"    Order: {task.get('order', 'N/A')}")
                print(f"    Description Length: {len(task.get('description', ''))} chars")
                
                # Show first 150 chars of description
                desc = task.get('description', '')
                if len(desc) > 150:
                    desc = desc[:150] + "..."
                print(f"    Description: {desc}")
            
            print(f"\n  Quality Score: {task_analysis['quality_score']:.1f}/10")
            
            # Add delay between API calls to be respectful
            if i < len(test_cases):
                print("⏳ Waiting 2 seconds before next test...")
                await asyncio.sleep(2)
        
        return results
    
    def analyze_tasks(self, tasks):
        """Analyze the quality of generated tasks."""
        if not tasks:
            return {"quality_score": 0, "issues": ["No tasks generated"]}
        
        issues = []
        score = 10.0
        
        # Check for required fields
        for i, task in enumerate(tasks):
            if 'title' not in task:
                issues.append(f"Task {i+1} missing title")
                score -= 2
            if 'description' not in task:
                issues.append(f"Task {i+1} missing description")
                score -= 2
            if 'priority' not in task:
                issues.append(f"Task {i+1} missing priority")
                score -= 1
            if 'order' not in task:
                issues.append(f"Task {i+1} missing order")
                score -= 1
        
        # Check title length
        title_lengths = [len(task.get('title', '')) for task in tasks]
        long_titles = [i for i, length in enumerate(title_lengths) if length > 200]
        if long_titles:
            issues.append(f"Tasks with titles > 200 chars: {long_titles}")
            score -= 1
        
        # Check description length
        desc_lengths = [len(task.get('description', '')) for task in tasks]
        long_descs = [i for i, length in enumerate(desc_lengths) if length > 1000]
        if long_descs:
            issues.append(f"Tasks with descriptions > 1000 chars: {long_descs}")
            score -= 1
        
        # Check order sequence
        orders = [task.get('order', -1) for task in tasks]
        if sorted(orders) != orders:
            issues.append("Tasks are not in proper order sequence")
            score -= 1
        
        # Check for Cursor-ready descriptions
        cursor_ready_count = 0
        for task in tasks:
            desc = task.get('description', '')
            if 'PROJECT:' in desc and 'TECH:' in desc and 'TASK:' in desc:
                cursor_ready_count += 1
        
        if cursor_ready_count < len(tasks):
            issues.append(f"Only {cursor_ready_count}/{len(tasks)} tasks have Cursor-ready descriptions")
            score -= 2
        
        # Bonus for good task count
        if len(tasks) == 1 and len(tasks[0].get('description', '')) < 500:
            score += 1  # Bonus for appropriate single task
        elif 2 <= len(tasks) <= 5:
            score += 1  # Bonus for good breakdown
        
        return {
            "quality_score": max(0, score),
            "issues": issues,
            "cursor_ready_count": cursor_ready_count,
            "avg_title_length": sum(title_lengths) / len(title_lengths) if title_lengths else 0,
            "avg_desc_length": sum(desc_lengths) / len(desc_lengths) if desc_lengths else 0
        }
    
    def generate_performance_report(self, results):
        """Generate a comprehensive performance report."""
        print("\n" + "=" * 70)
        print("📊 PERFORMANCE REPORT")
        print("=" * 70)
        
        total_duration = sum(r['duration'] for r in results)
        total_tasks = sum(r['task_count'] for r in results)
        avg_quality = sum(r['analysis']['quality_score'] for r in results) / len(results)
        
        print(f"Total Test Cases: {len(results)}")
        print(f"Total Duration: {total_duration:.2f} seconds")
        print(f"Average Duration per Test: {total_duration/len(results):.2f} seconds")
        print(f"Total Tasks Generated: {total_tasks}")
        print(f"Average Tasks per Test: {total_tasks/len(results):.1f}")
        print(f"Average Quality Score: {avg_quality:.1f}/10")
        
        print(f"\n📈 DETAILED RESULTS:")
        for result in results:
            print(f"\n{result['name']}:")
            print(f"  Duration: {result['duration']:.2f}s")
            print(f"  Tasks: {result['task_count']}")
            print(f"  Quality: {result['analysis']['quality_score']:.1f}/10")
            print(f"  Cursor-Ready: {result['analysis']['cursor_ready_count']}/{result['task_count']}")
            
            if result['analysis']['issues']:
                print(f"  Issues: {', '.join(result['analysis']['issues'])}")
        
        # Success criteria
        print(f"\n✅ SUCCESS CRITERIA:")
        success_criteria = {
            "All tests completed": len(results) == 4,
            "Average quality > 7": avg_quality > 7,
            "All tasks have required fields": all(
                all('title' in task and 'description' in task for task in r['tasks'])
                for r in results
            ),
            "Reasonable task counts": all(1 <= r['task_count'] <= 6 for r in results),
            "Cursor-ready descriptions": all(
                r['analysis']['cursor_ready_count'] == r['task_count'] for r in results
            )
        }
        
        for criterion, passed in success_criteria.items():
            status = "✅ PASS" if passed else "❌ FAIL"
            print(f"  {status}: {criterion}")
        
        overall_success = all(success_criteria.values())
        print(f"\n🎯 OVERALL RESULT: {'✅ SUCCESS' if overall_success else '❌ NEEDS IMPROVEMENT'}")
        
        return overall_success

async def main():
    """Main test execution function."""
    print("🔧 Enhanced Task Breakdown Performance Test")
    print("This test will make real API calls to measure performance.")
    print("Make sure you have proper API credentials configured.")
    
    # Ask for confirmation
    response = input("\nDo you want to proceed with real API calls? (y/N): ")
    if response.lower() != 'y':
        print("Test cancelled.")
        return 0
    
    try:
        tester = PerformanceTest()
        results = await tester.test_feature_requests()
        success = tester.generate_performance_report(results)
        
        if success:
            print("\n🎉 Enhanced task breakdown is performing excellently!")
            return 0
        else:
            print("\n⚠️  Enhanced task breakdown needs some improvements.")
            return 1
            
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code) 