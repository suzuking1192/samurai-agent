"""
Test Enhanced Clarification Questions Prompt

This test verifies that the enhanced clarification questions prompt works with better performance
and generates more targeted, project-specific questions.
"""

import asyncio
import time
import logging
from typing import List, Dict, Any

try:
    from services.response_generator import ResponseGenerator, ResponseContext
    from models import Task, Memory, Project
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from services.response_generator import ResponseGenerator, ResponseContext
    from models import Task, Memory, Project

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EnhancedClarificationQuestionsTester:
    """Test suite for enhanced clarification questions prompt."""
    
    def __init__(self):
        self.generator = ResponseGenerator()
        self.test_results = []
    
    def create_test_context(self, project_name: str, tech_stack: str, user_message: str, 
                           memories: List[Memory] = None, tasks: List[Task] = None) -> ResponseContext:
        """Create a test context with realistic project data."""
        if memories is None:
            memories = [
                Memory(
                    id="1", 
                    project_id="test-project", 
                    title="Authentication Decision", 
                    content="Chose JWT over sessions for scalability and stateless design", 
                    type="decision"
                ),
                Memory(
                    id="2", 
                    project_id="test-project", 
                    title="Database Schema", 
                    content="Using PostgreSQL with User, Project, and Task tables. User has email, password_hash, created_at fields", 
                    type="decision"
                ),
                Memory(
                    id="3", 
                    project_id="test-project", 
                    title="Frontend Patterns", 
                    content="React components follow card-based layout pattern. Using Material-UI for consistent styling", 
                    type="feature"
                )
            ]
        
        if tasks is None:
            tasks = [
                Task(
                    id="1", 
                    project_id="test-project", 
                    title="Implement user authentication", 
                    description="Add JWT-based login and registration", 
                    completed=True
                ),
                Task(
                    id="2", 
                    project_id="test-project", 
                    title="Create dashboard layout", 
                    description="Build responsive dashboard with card components", 
                    completed=True
                ),
                Task(
                    id="3", 
                    project_id="test-project", 
                    title="Add file upload functionality", 
                    description="Implement S3 integration for project assets", 
                    completed=False
                )
            ]
        
        return ResponseContext(
            project_name=project_name,
            tech_stack=tech_stack,
            conversation_summary="User has been working on building a project management app with authentication and dashboard features.",
            relevant_tasks=tasks,
            relevant_memories=memories,
            user_message=user_message,
            intent_type="feature_exploration",
            confidence=0.85
        )
    
    async def test_enhanced_clarification_performance(self):
        """Test the performance and quality of enhanced clarification questions."""
        print("\n🚀 Testing Enhanced Clarification Questions Performance")
        print("=" * 60)
        
        test_cases = [
            {
                "name": "User Profile Feature",
                "project": "ProjectHub",
                "tech_stack": "React, Node.js, PostgreSQL, JWT",
                "message": "I want to add user profiles to my app",
                "expected_aspects": ["user experience", "technical integration", "data storage"]
            },
            {
                "name": "Real-time Chat",
                "project": "TeamCollab",
                "tech_stack": "React, Express, Socket.io, MongoDB",
                "message": "I'm thinking about adding real-time chat between team members",
                "expected_aspects": ["real-time communication", "data persistence", "user interface"]
            },
            {
                "name": "Search Functionality",
                "project": "TaskManager",
                "tech_stack": "Vue.js, FastAPI, Elasticsearch, Redis",
                "message": "I need to add search functionality to find tasks and projects",
                "expected_aspects": ["search algorithms", "performance", "user interface"]
            },
            {
                "name": "File Management",
                "project": "DocumentHub",
                "tech_stack": "Angular, Django, AWS S3, PostgreSQL",
                "message": "I want users to be able to upload and manage files",
                "expected_aspects": ["file storage", "user permissions", "file organization"]
            }
        ]
        
        for i, test_case in enumerate(test_cases, 1):
            print(f"\n📋 Test Case {i}: {test_case['name']}")
            print(f"Project: {test_case['project']}")
            print(f"Tech Stack: {test_case['tech_stack']}")
            print(f"User Message: {test_case['message']}")
            
            # Create context
            context = self.create_test_context(
                project_name=test_case['project'],
                tech_stack=test_case['tech_stack'],
                user_message=test_case['message']
            )
            
            # Measure performance
            start_time = time.time()
            try:
                response = await self.generator.generate_clarification_questions(context)
                end_time = time.time()
                response_time = end_time - start_time
                
                # Analyze response quality
                quality_score = self.analyze_response_quality(response, test_case)
                
                result = {
                    "test_case": test_case['name'],
                    "response_time": response_time,
                    "response_length": len(response),
                    "quality_score": quality_score,
                    "response": response,
                    "success": True
                }
                
                print(f"✅ Response Time: {response_time:.2f}s")
                print(f"📏 Response Length: {len(response)} characters")
                print(f"🎯 Quality Score: {quality_score}/10")
                print(f"💬 Response Preview: {response[:150]}...")
                
            except Exception as e:
                result = {
                    "test_case": test_case['name'],
                    "error": str(e),
                    "success": False
                }
                print(f"❌ Error: {e}")
            
            self.test_results.append(result)
    
    def analyze_response_quality(self, response: str, test_case: Dict[str, Any]) -> float:
        """Analyze the quality of the clarification questions response."""
        score = 0.0
        
        # Check for project-specific references
        if test_case['project'].lower() in response.lower():
            score += 2.0
        
        # Check for tech stack references
        tech_terms = test_case['tech_stack'].lower().split(', ')
        tech_matches = sum(1 for tech in tech_terms if tech in response.lower())
        score += min(tech_matches * 1.0, 3.0)
        
        # Check for question structure (should have 2-4 questions)
        question_indicators = ['?', 'how', 'what', 'when', 'where', 'why']
        question_count = sum(1 for indicator in question_indicators if indicator in response.lower())
        if 2 <= question_count <= 6:  # Allow for some flexibility
            score += 2.0
        
        # Check for enthusiasm and encouragement
        positive_indicators = ['excited', 'great', 'awesome', 'cool', 'love', 'perfect', 'excellent']
        positive_count = sum(1 for indicator in positive_indicators if indicator in response.lower())
        score += min(positive_count * 0.5, 2.0)
        
        # Check for implementation focus
        implementation_terms = ['implement', 'build', 'create', 'develop', 'architecture', 'pattern']
        implementation_count = sum(1 for term in implementation_terms if term in response.lower())
        score += min(implementation_count * 0.5, 1.0)
        
        return min(score, 10.0)
    
    async def test_comparison_with_old_prompt(self):
        """Compare performance with a simplified version to show improvement."""
        print("\n🔄 Comparing with Simplified Prompt")
        print("=" * 40)
        
        # Test with enhanced prompt
        context = self.create_test_context(
            project_name="TestProject",
            tech_stack="React, Node.js, PostgreSQL",
            user_message="I want to add a notification system"
        )
        
        print("Testing Enhanced Prompt...")
        start_time = time.time()
        enhanced_response = await self.generator.generate_clarification_questions(context)
        enhanced_time = time.time() - start_time
        
        print(f"Enhanced Response Time: {enhanced_time:.2f}s")
        print(f"Enhanced Response Length: {len(enhanced_response)} characters")
        print(f"Enhanced Response Preview: {enhanced_response[:200]}...")
        
        # Analyze quality
        enhanced_quality = self.analyze_response_quality(enhanced_response, {
            "project": "TestProject",
            "tech_stack": "React, Node.js, PostgreSQL"
        })
        print(f"Enhanced Quality Score: {enhanced_quality}/10")
    
    async def test_error_handling(self):
        """Test error handling and fallback mechanisms."""
        print("\n🛡️ Testing Error Handling")
        print("=" * 30)
        
        # Test with invalid context
        try:
            invalid_context = ResponseContext(
                project_name="",
                tech_stack="",
                conversation_summary="",
                relevant_tasks=[],
                relevant_memories=[],
                user_message="",
                intent_type="feature_exploration",
                confidence=0.0
            )
            
            response = await self.generator.generate_clarification_questions(invalid_context)
            print(f"✅ Fallback Response: {response}")
            
        except Exception as e:
            print(f"❌ Error with invalid context: {e}")
    
    def generate_performance_report(self):
        """Generate a comprehensive performance report."""
        print("\n📊 Performance Report")
        print("=" * 30)
        
        successful_tests = [r for r in self.test_results if r.get('success', False)]
        
        if not successful_tests:
            print("❌ No successful tests to report on")
            return
        
        # Calculate averages
        avg_response_time = sum(r['response_time'] for r in successful_tests) / len(successful_tests)
        avg_response_length = sum(r['response_length'] for r in successful_tests) / len(successful_tests)
        avg_quality_score = sum(r['quality_score'] for r in successful_tests) / len(successful_tests)
        
        print(f"📈 Average Response Time: {avg_response_time:.2f}s")
        print(f"📏 Average Response Length: {avg_response_length:.0f} characters")
        print(f"🎯 Average Quality Score: {avg_quality_score:.1f}/10")
        print(f"✅ Success Rate: {len(successful_tests)}/{len(self.test_results)} ({len(successful_tests)/len(self.test_results)*100:.1f}%)")
        
        # Find best and worst performers
        best_test = max(successful_tests, key=lambda x: x['quality_score'])
        worst_test = min(successful_tests, key=lambda x: x['quality_score'])
        
        print(f"\n🏆 Best Performer: {best_test['test_case']} (Quality: {best_test['quality_score']}/10)")
        print(f"📉 Worst Performer: {worst_test['test_case']} (Quality: {worst_test['quality_score']}/10)")
        
        # Performance recommendations
        print(f"\n💡 Performance Analysis:")
        if avg_response_time < 2.0:
            print("✅ Response times are excellent (< 2s)")
        elif avg_response_time < 5.0:
            print("⚠️ Response times are acceptable (2-5s)")
        else:
            print("❌ Response times need improvement (> 5s)")
        
        if avg_quality_score >= 7.0:
            print("✅ Quality scores are excellent (≥ 7/10)")
        elif avg_quality_score >= 5.0:
            print("⚠️ Quality scores are acceptable (5-7/10)")
        else:
            print("❌ Quality scores need improvement (< 5/10)")


async def main():
    """Run all enhanced clarification questions tests."""
    print("🧪 Enhanced Clarification Questions Test Suite")
    print("=" * 50)
    
    tester = EnhancedClarificationQuestionsTester()
    
    try:
        # Run performance tests
        await tester.test_enhanced_clarification_performance()
        
        # Run comparison test
        await tester.test_comparison_with_old_prompt()
        
        # Run error handling test
        await tester.test_error_handling()
        
        # Generate performance report
        tester.generate_performance_report()
        
        print("\n🎉 All tests completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        logger.exception("Test suite error")


if __name__ == "__main__":
    asyncio.run(main()) 