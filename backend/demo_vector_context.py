"""
Demo script for Vector-Enhanced Context Engineering system.

This script demonstrates:
1. Creating sample data with embeddings
2. Vector similarity search
3. Context assembly
4. AI agent integration
"""

import asyncio
import logging
import sys
import os
from typing import List, Dict, Any

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.embedding_service import embedding_service
from services.vector_context_service import vector_context_service
from services.file_service import FileService
from services.ai_agent import SamuraiAgent
from models import Task, Memory, ChatMessage, Project

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class VectorContextDemo:
    """Demo class for vector-enhanced context system."""
    
    def __init__(self):
        self.file_service = FileService()
        self.ai_agent = SamuraiAgent()
        self.demo_project_id = "demo_vector_project"
    
    async def run_demo(self):
        """Run the complete vector context demo."""
        print("🚀 VECTOR-ENHANCED CONTEXT ENGINEERING DEMO")
        print("=" * 60)
        
        # Step 1: Create demo project
        await self._create_demo_project()
        
        # Step 2: Create sample data
        await self._create_sample_data()
        
        # Step 3: Demonstrate vector similarity search
        await self._demonstrate_similarity_search()
        
        # Step 4: Demonstrate context assembly
        await self._demonstrate_context_assembly()
        
        # Step 5: Demonstrate AI agent integration
        await self._demonstrate_ai_agent_integration()
        
        print("\n" + "=" * 60)
        print("🎉 DEMO COMPLETED SUCCESSFULLY!")
        print("=" * 60)
    
    async def _create_demo_project(self):
        """Create a demo project."""
        print("\n📁 STEP 1: Creating Demo Project")
        print("-" * 40)
        
        demo_project = Project(
            name="Vector Context Demo Project",
            description="A demonstration project for vector-enhanced context engineering",
            tech_stack="Python, FastAPI, PostgreSQL, JWT, bcrypt"
        )
        
        self.file_service.save_project(demo_project)
        print(f"✅ Created project: {demo_project.name}")
        print(f"   Project ID: {demo_project.id}")
    
    async def _create_sample_data(self):
        """Create sample tasks and memories with embeddings."""
        print("\n📝 STEP 2: Creating Sample Data")
        print("-" * 40)
        
        # Create sample tasks
        tasks = [
            Task(
                project_id=self.demo_project_id,
                title="Implement User Authentication",
                description="Create login and registration system with JWT tokens and bcrypt password hashing. Include token refresh mechanism.",
                status="in_progress",
                priority="high"
            ),
            Task(
                project_id=self.demo_project_id,
                title="Create Database Schema",
                description="Design user table with email, password_hash, created_at, and updated_at fields. Add proper indexes.",
                status="completed",
                priority="medium"
            ),
            Task(
                project_id=self.demo_project_id,
                title="Build API Endpoints",
                description="Create REST API endpoints for user registration, login, logout, and profile management.",
                status="pending",
                priority="high"
            ),
            Task(
                project_id=self.demo_project_id,
                title="Design User Interface",
                description="Create responsive login and registration forms with proper validation and error handling.",
                status="pending",
                priority="medium"
            ),
            Task(
                project_id=self.demo_project_id,
                title="Implement Password Reset",
                description="Add password reset functionality with email verification and secure token generation.",
                status="pending",
                priority="low"
            )
        ]
        
        # Create sample memories
        memories = [
            Memory(
                project_id=self.demo_project_id,
                title="Authentication Strategy Decision",
                content="Decided to use JWT tokens for authentication with bcrypt for password hashing. Tokens expire after 24 hours with refresh token mechanism. Using FastAPI for backend API.",
                type="decision",
                category="security"
            ),
            Memory(
                project_id=self.demo_project_id,
                title="Database Design Notes",
                content="User table includes id, email, password_hash, created_at, updated_at, and is_active fields. Email must be unique and indexed. Using PostgreSQL with proper constraints.",
                type="spec",
                category="database"
            ),
            Memory(
                project_id=self.demo_project_id,
                title="API Design Patterns",
                content="Using FastAPI with Pydantic models for request/response validation. Implementing proper error handling with HTTP status codes. Rate limiting for security endpoints.",
                type="note",
                category="backend"
            ),
            Memory(
                project_id=self.demo_project_id,
                title="Security Best Practices",
                content="Implementing CORS properly, using HTTPS in production, rate limiting on auth endpoints, input validation, and SQL injection prevention. Regular security audits.",
                type="note",
                category="security"
            )
        ]
        
        # Save tasks and memories (embeddings will be generated automatically)
        self.file_service.save_tasks(self.demo_project_id, tasks)
        self.file_service.save_memories(self.demo_project_id, memories)
        
        print(f"✅ Created {len(tasks)} tasks with embeddings")
        print(f"✅ Created {len(memories)} memories with embeddings")
        
        # Create sample chat messages
        chat_messages = [
            ChatMessage(
                project_id=self.demo_project_id,
                session_id="demo_session",
                message="I need to implement user authentication for my application",
                response="I'll help you create a comprehensive user authentication system. Let's start by discussing your requirements and then break this down into manageable tasks."
            ),
            ChatMessage(
                project_id=self.demo_project_id,
                session_id="demo_session",
                message="What about password security?",
                response="Great question! We should use bcrypt for password hashing. It's the industry standard and provides excellent security. I'll add this to our authentication strategy."
            ),
            ChatMessage(
                project_id=self.demo_project_id,
                session_id="demo_session",
                message="How do I handle token expiration?",
                response="We'll implement a refresh token mechanism. When the access token expires, users can use their refresh token to get a new access token without re-authenticating."
            )
        ]
        
        for message in chat_messages:
            self.file_service.save_chat_message(self.demo_project_id, message)
        
        print(f"✅ Created {len(chat_messages)} chat messages with embeddings")
    
    async def _demonstrate_similarity_search(self):
        """Demonstrate vector similarity search."""
        print("\n🔍 STEP 3: Demonstrating Vector Similarity Search")
        print("-" * 40)
        
        # Load all data
        all_tasks = self.file_service.load_tasks(self.demo_project_id)
        all_memories = self.file_service.load_memories(self.demo_project_id)
        chat_messages = self.file_service.load_chat_messages_by_session(self.demo_project_id, "demo_session")
        
        # Test queries
        test_queries = [
            "How do I handle token expiration?",
            "What's the best way to secure passwords?",
            "I need help with database design",
            "How should I implement the API endpoints?"
        ]
        
        for query in test_queries:
            print(f"\n🔎 Query: '{query}'")
            
            # Generate embedding for query
            query_embedding = embedding_service.generate_embedding(query)
            
            if query_embedding:
                # Find relevant tasks
                relevant_tasks = vector_context_service.find_relevant_tasks(
                    query_embedding, all_tasks, self.demo_project_id
                )
                
                # Find relevant memories
                relevant_memories = vector_context_service.find_relevant_memories(
                    query_embedding, all_memories, self.demo_project_id
                )
                
                print(f"   📋 Relevant Tasks ({len(relevant_tasks)}):")
                for task, similarity in relevant_tasks[:2]:  # Show top 2
                    print(f"      • {task.title} (similarity: {similarity:.3f})")
                
                print(f"   🧠 Relevant Memories ({len(relevant_memories)}):")
                for memory, similarity in relevant_memories[:2]:  # Show top 2
                    print(f"      • {memory.title} (similarity: {similarity:.3f})")
            else:
                print("   ❌ Failed to generate embedding for query")
    
    async def _demonstrate_context_assembly(self):
        """Demonstrate context assembly."""
        print("\n📋 STEP 4: Demonstrating Context Assembly")
        print("-" * 40)
        
        # Load chat messages
        chat_messages = self.file_service.load_chat_messages_by_session(self.demo_project_id, "demo_session")
        
        # Generate conversation embedding
        conversation_embedding = vector_context_service.get_conversation_context_embedding(
            chat_messages, "How do I implement the refresh token mechanism?"
        )
        
        if conversation_embedding:
            # Load all data
            all_tasks = self.file_service.load_tasks(self.demo_project_id)
            all_memories = self.file_service.load_memories(self.demo_project_id)
            
            # Find relevant items
            relevant_tasks = vector_context_service.find_relevant_tasks(
                conversation_embedding, all_tasks, self.demo_project_id
            )
            
            relevant_memories = vector_context_service.find_relevant_memories(
                conversation_embedding, all_memories, self.demo_project_id
            )
            
            # Assemble context
            assembled_context = vector_context_service.assemble_vector_context(
                chat_messages, relevant_tasks, relevant_memories, 
                "How do I implement the refresh token mechanism?"
            )
            
            print("📄 Assembled Context Preview:")
            print("-" * 30)
            # Show first 500 characters
            preview = assembled_context[:500] + "..." if len(assembled_context) > 500 else assembled_context
            print(preview)
            
            # Show summary
            summary = vector_context_service.get_vector_context_summary(
                chat_messages, relevant_tasks, relevant_memories
            )
            
            print(f"\n📊 Context Summary:")
            print(f"   • Session messages: {summary['session_messages_count']}")
            print(f"   • Relevant tasks: {summary['relevant_tasks_count']}")
            print(f"   • Relevant memories: {summary['relevant_memories_count']}")
            print(f"   • Task similarity range: {summary['task_similarity_range']['min']:.3f} - {summary['task_similarity_range']['max']:.3f}")
            print(f"   • Memory similarity range: {summary['memory_similarity_range']['min']:.3f} - {summary['memory_similarity_range']['max']:.3f}")
        else:
            print("❌ Failed to generate conversation embedding")
    
    async def _demonstrate_ai_agent_integration(self):
        """Demonstrate AI agent integration."""
        print("\n🤖 STEP 5: Demonstrating AI Agent Integration")
        print("-" * 40)
        
        # Create project context
        project_context = {
            "name": "Vector Context Demo Project",
            "description": "A demonstration project for vector-enhanced context engineering",
            "tech_stack": "Python, FastAPI, PostgreSQL, JWT, bcrypt"
        }
        
        # Test messages
        test_messages = [
            "How do I handle token expiration in my authentication system?",
            "What's the best way to implement password reset functionality?",
            "Can you help me design the database schema for user management?",
            "How should I structure my API endpoints for user authentication?"
        ]
        
        for message in test_messages:
            print(f"\n💬 User Message: '{message}'")
            
            try:
                # Process with AI agent
                response = await self.ai_agent.process_message(
                    message, 
                    self.demo_project_id, 
                    project_context,
                    session_id="demo_session"
                )
                
                print(f"   🤖 AI Response Type: {response.get('type', 'unknown')}")
                print(f"   📊 Vector Context Summary:")
                
                summary = response.get('vector_context_summary', {})
                if summary:
                    print(f"      • Relevant tasks found: {summary.get('relevant_tasks_count', 0)}")
                    print(f"      • Relevant memories found: {summary.get('relevant_memories_count', 0)}")
                    print(f"      • Embedding model loaded: {summary.get('embedding_model_loaded', False)}")
                
                # Show response preview
                ai_response = response.get('response', '')
                if ai_response:
                    preview = ai_response[:200] + "..." if len(ai_response) > 200 else ai_response
                    print(f"   💭 Response Preview: {preview}")
                
            except Exception as e:
                print(f"   ❌ Error processing message: {e}")


async def main():
    """Main function to run the demo."""
    demo = VectorContextDemo()
    
    try:
        await demo.run_demo()
        return 0
    except Exception as e:
        logger.error(f"Demo failed: {e}")
        print(f"\n❌ Demo failed: {e}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code) 