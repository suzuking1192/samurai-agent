"""
Planning-First Architecture Demo

This demo showcases the new planning-first architecture for the Samurai Agent,
demonstrating how it handles complex multi-step operations, conversation continuity,
and context-aware decision making.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import List

# Import the planning-first agent
from services.planning_first_agent import planning_first_agent, PlanningFirstAgent
from models import Task, Memory, Project, ChatMessage

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class PlanningFirstDemo:
    """Demo class for showcasing the planning-first architecture."""
    
    def __init__(self):
        self.agent = PlanningFirstAgent()
        self.project_id = "demo-planning-first-project"
        self.session_id = "demo-session-1"
        
        # Demo project context
        self.project_context = {
            "name": "Planning-First Demo App",
            "description": "A demonstration application for the new planning-first architecture",
            "tech_stack": "React + FastAPI + PostgreSQL + Redis",
            "created_at": datetime.now()
        }
        
        # Conversation history for demo
        self.conversation_history = []
        
        logger.info("Planning-First Demo initialized")
    
    async def run_comprehensive_demo(self):
        """Run a comprehensive demo of the planning-first architecture."""
        print("🥷 Planning-First Architecture Demo")
        print("=" * 60)
        print(f"Project: {self.project_context['name']}")
        print(f"Tech Stack: {self.project_context['tech_stack']}")
        print("=" * 60)
        
        # Demo 1: Basic conversation with context awareness
        await self.demo_basic_conversation()
        
        # Demo 2: Multi-step task creation
        await self.demo_multi_step_task_creation()
        
        # Demo 3: Conversation continuity
        await self.demo_conversation_continuity()
        
        # Demo 4: Complex workflow with dependencies
        await self.demo_complex_workflow()
        
        # Demo 5: Context-aware decision making
        await self.demo_context_aware_decisions()
        
        # Demo 6: Error handling and fallbacks
        await self.demo_error_handling()
        
        print("\n" + "=" * 60)
        print("🎉 Planning-First Architecture Demo Complete!")
        print("=" * 60)
    
    async def demo_basic_conversation(self):
        """Demo basic conversation with context awareness."""
        print("\n📝 Demo 1: Basic Conversation with Context Awareness")
        print("-" * 50)
        
        # Initial conversation
        messages = [
            "I want to build a todo app",
            "I prefer using React for the frontend",
            "Can you help me set up the project structure?"
        ]
        
        for i, message in enumerate(messages, 1):
            print(f"\n💬 User {i}: {message}")
            
            # Process with planning-first agent
            result = await self.agent.process_user_message(
                message, self.project_id, self.project_context, 
                self.session_id, self.conversation_history
            )
            
            print(f"🤖 Agent: {result['response']}")
            print(f"📊 Plan Type: {result.get('plan_type', 'unknown')}")
            print(f"🎯 Confidence: {result.get('confidence_score', 0.0):.2f}")
            print(f"⏱️  Execution Time: {result.get('execution_time', 0.0):.2f}s")
            
            # Add to conversation history
            self.conversation_history.append(ChatMessage(
                id=f"msg_{len(self.conversation_history)}",
                project_id=self.project_id,
                session_id=self.session_id,
                message=message,
                response=result['response'],
                created_at=datetime.now()
            ))
    
    async def demo_multi_step_task_creation(self):
        """Demo multi-step task creation with planning."""
        print("\n📋 Demo 2: Multi-Step Task Creation")
        print("-" * 50)
        
        message = "I need to implement user authentication with JWT tokens, email verification, and password reset functionality"
        
        print(f"\n💬 User: {message}")
        
        # Process with planning-first agent
        result = await self.agent.process_user_message(
            message, self.project_id, self.project_context,
            self.session_id, self.conversation_history
        )
        
        print(f"🤖 Agent: {result['response']}")
        print(f"📊 Plan Type: {result.get('plan_type', 'unknown')}")
        print(f"🔧 Steps Completed: {result.get('steps_completed', 0)}/{result.get('total_steps', 0)}")
        print(f"🎯 Confidence: {result.get('confidence_score', 0.0):.2f}")
        print(f"⏱️  Execution Time: {result.get('execution_time', 0.0):.2f}s")
        
        # Add to conversation history
        self.conversation_history.append(ChatMessage(
            id=f"msg_{len(self.conversation_history)}",
            project_id=self.project_id,
            session_id=self.session_id,
            message=message,
            response=result['response'],
            created_at=datetime.now()
        ))
    
    async def demo_conversation_continuity(self):
        """Demo conversation continuity across multiple messages."""
        print("\n🔄 Demo 3: Conversation Continuity")
        print("-" * 50)
        
        # Series of related messages that build on each other
        messages = [
            "I want to add real-time notifications",
            "Make them appear as toast messages in the top-right corner",
            "Include sound alerts for important notifications",
            "Also add email notifications for critical events"
        ]
        
        for i, message in enumerate(messages, 1):
            print(f"\n💬 User {i}: {message}")
            
            # Process with planning-first agent
            result = await self.agent.process_user_message(
                message, self.project_id, self.project_context,
                self.session_id, self.conversation_history
            )
            
            print(f"🤖 Agent: {result['response']}")
            print(f"📊 Plan Type: {result.get('plan_type', 'unknown')}")
            print(f"🎯 Confidence: {result.get('confidence_score', 0.0):.2f}")
            print(f"🔄 Continuity: {'Yes' if result.get('confidence_score', 0.0) > 0.7 else 'No'}")
            
            # Add to conversation history
            self.conversation_history.append(ChatMessage(
                id=f"msg_{len(self.conversation_history)}",
                project_id=self.project_id,
                session_id=self.session_id,
                message=message,
                response=result['response'],
                created_at=datetime.now()
            ))
    
    async def demo_complex_workflow(self):
        """Demo complex workflow with dependencies."""
        print("\n🔗 Demo 4: Complex Workflow with Dependencies")
        print("-" * 50)
        
        message = "Update the authentication task to completed, then create a new task for testing the login flow, and finally add a memory about our testing strategy"
        
        print(f"\n💬 User: {message}")
        
        # Process with planning-first agent
        result = await self.agent.process_user_message(
            message, self.project_id, self.project_context,
            self.session_id, self.conversation_history
        )
        
        print(f"🤖 Agent: {result['response']}")
        print(f"📊 Plan Type: {result.get('plan_type', 'unknown')}")
        print(f"🔧 Steps Completed: {result.get('steps_completed', 0)}/{result.get('total_steps', 0)}")
        print(f"🎯 Confidence: {result.get('confidence_score', 0.0):.2f}")
        print(f"⏱️  Execution Time: {result.get('execution_time', 0.0):.2f}s")
        
        # Add to conversation history
        self.conversation_history.append(ChatMessage(
            id=f"msg_{len(self.conversation_history)}",
            project_id=self.project_id,
            session_id=self.session_id,
            message=message,
            response=result['response'],
            created_at=datetime.now()
        ))
    
    async def demo_context_aware_decisions(self):
        """Demo context-aware decision making."""
        print("\n🧠 Demo 5: Context-Aware Decision Making")
        print("-" * 50)
        
        # Test context awareness with references to previous decisions
        messages = [
            "What database should I use for this project?",
            "I think PostgreSQL would be good",
            "Actually, let me change that to MongoDB",
            "Can you update the database configuration task with this decision?"
        ]
        
        for i, message in enumerate(messages, 1):
            print(f"\n💬 User {i}: {message}")
            
            # Process with planning-first agent
            result = await self.agent.process_user_message(
                message, self.project_id, self.project_context,
                self.session_id, self.conversation_history
            )
            
            print(f"🤖 Agent: {result['response']}")
            print(f"📊 Plan Type: {result.get('plan_type', 'unknown')}")
            print(f"🎯 Confidence: {result.get('confidence_score', 0.0):.2f}")
            print(f"🧠 Context Aware: {'Yes' if result.get('confidence_score', 0.0) > 0.6 else 'No'}")
            
            # Add to conversation history
            self.conversation_history.append(ChatMessage(
                id=f"msg_{len(self.conversation_history)}",
                project_id=self.project_id,
                session_id=self.session_id,
                message=message,
                response=result['response'],
                created_at=datetime.now()
            ))
    
    async def demo_error_handling(self):
        """Demo error handling and fallbacks."""
        print("\n⚠️  Demo 6: Error Handling and Fallbacks")
        print("-" * 50)
        
        # Test with ambiguous or problematic requests
        messages = [
            "Create a task for something that doesn't make sense",
            "I want to implement a feature that's impossible with our tech stack",
            "Can you do something that requires tools we don't have?"
        ]
        
        for i, message in enumerate(messages, 1):
            print(f"\n💬 User {i}: {message}")
            
            # Process with planning-first agent
            result = await self.agent.process_user_message(
                message, self.project_id, self.project_context,
                self.session_id, self.conversation_history
            )
            
            print(f"🤖 Agent: {result['response']}")
            print(f"📊 Plan Type: {result.get('plan_type', 'unknown')}")
            print(f"🎯 Confidence: {result.get('confidence_score', 0.0):.2f}")
            print(f"⚠️  Error Handling: {'Good' if 'error' not in result.get('type', '') else 'Error Detected'}")
            
            # Add to conversation history
            self.conversation_history.append(ChatMessage(
                id=f"msg_{len(self.conversation_history)}",
                project_id=self.project_id,
                session_id=self.session_id,
                message=message,
                response=result['response'],
                created_at=datetime.now()
            ))
    
    async def demo_planning_analysis(self):
        """Demo detailed planning analysis."""
        print("\n🔍 Demo 7: Detailed Planning Analysis")
        print("-" * 50)
        
        message = "I want to build a complete e-commerce platform with user authentication, product catalog, shopping cart, payment processing, and order management"
        
        print(f"\n💬 User: {message}")
        
        # Process with planning-first agent
        result = await self.agent.process_user_message(
            message, self.project_id, self.project_context,
            self.session_id, self.conversation_history
        )
        
        print(f"🤖 Agent: {result['response']}")
        print(f"📊 Plan Type: {result.get('plan_type', 'unknown')}")
        print(f"🔧 Steps Completed: {result.get('steps_completed', 0)}/{result.get('total_steps', 0)}")
        print(f"🎯 Confidence: {result.get('confidence_score', 0.0):.2f}")
        print(f"⏱️  Execution Time: {result.get('execution_time', 0.0):.2f}s")
        
        # Show detailed plan information if available
        if result.get('plan_executed'):
            print(f"📋 Plan ID: {result['plan_executed']}")
        
        # Add to conversation history
        self.conversation_history.append(ChatMessage(
            id=f"msg_{len(self.conversation_history)}",
            project_id=self.project_id,
            session_id=self.session_id,
            message=message,
            response=result['response'],
            created_at=datetime.now()
        ))
    
    def print_conversation_summary(self):
        """Print a summary of the conversation."""
        print("\n📊 Conversation Summary")
        print("-" * 50)
        print(f"Total Messages: {len(self.conversation_history)}")
        
        # Analyze conversation patterns
        plan_types = {}
        confidence_scores = []
        
        for msg in self.conversation_history:
            if hasattr(msg, 'plan_type'):
                plan_types[msg.plan_type] = plan_types.get(msg.plan_type, 0) + 1
            if hasattr(msg, 'confidence_score'):
                confidence_scores.append(msg.confidence_score)
        
        print(f"Average Confidence: {sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0:.2f}")
        print(f"Plan Types Used: {list(plan_types.keys())}")
        
        # Show conversation themes
        themes = self._extract_conversation_themes()
        print(f"Conversation Themes: {', '.join(themes)}")
    
    def _extract_conversation_themes(self) -> List[str]:
        """Extract themes from the conversation."""
        themes = set()
        
        for msg in self.conversation_history:
            message_text = msg.message.lower()
            
            if any(word in message_text for word in ['auth', 'login', 'user']):
                themes.add('Authentication')
            if any(word in message_text for word in ['task', 'todo', 'project']):
                themes.add('Task Management')
            if any(word in message_text for word in ['database', 'db', 'postgres', 'mongo']):
                themes.add('Database')
            if any(word in message_text for word in ['notification', 'alert', 'email']):
                themes.add('Notifications')
            if any(word in message_text for word in ['e-commerce', 'payment', 'order']):
                themes.add('E-commerce')
        
        return list(themes)


async def run_interactive_demo():
    """Run an interactive demo where users can input their own messages."""
    print("🎮 Interactive Planning-First Demo")
    print("=" * 60)
    print("Type your messages and see how the planning-first architecture handles them!")
    print("Type 'quit' to exit, 'summary' to see conversation summary")
    print("=" * 60)
    
    demo = PlanningFirstDemo()
    
    while True:
        try:
            user_input = input("\n💬 You: ").strip()
            
            if user_input.lower() == 'quit':
                break
            elif user_input.lower() == 'summary':
                demo.print_conversation_summary()
                continue
            elif not user_input:
                continue
            
            print("\n🤔 Processing with planning-first architecture...")
            
            # Process with planning-first agent
            result = await demo.agent.process_user_message(
                user_input, demo.project_id, demo.project_context,
                demo.session_id, demo.conversation_history
            )
            
            print(f"\n🤖 Agent: {result['response']}")
            print(f"📊 Plan Type: {result.get('plan_type', 'unknown')}")
            print(f"🔧 Steps: {result.get('steps_completed', 0)}/{result.get('total_steps', 0)}")
            print(f"🎯 Confidence: {result.get('confidence_score', 0.0):.2f}")
            print(f"⏱️  Time: {result.get('execution_time', 0.0):.2f}s")
            
            # Add to conversation history
            demo.conversation_history.append(ChatMessage(
                id=f"msg_{len(demo.conversation_history)}",
                project_id=demo.project_id,
                session_id=demo.session_id,
                message=user_input,
                response=result['response'],
                created_at=datetime.now()
            ))
            
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")
    
    # Print final summary
    demo.print_conversation_summary()


async def main():
    """Main function to run the demo."""
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'interactive':
        await run_interactive_demo()
    else:
        # Run comprehensive demo
        demo = PlanningFirstDemo()
        await demo.run_comprehensive_demo()
        
        # Run additional detailed demo
        await demo.demo_planning_analysis()
        
        # Print conversation summary
        demo.print_conversation_summary()


if __name__ == "__main__":
    print("Starting Planning-First Architecture Demo...")
    asyncio.run(main()) 