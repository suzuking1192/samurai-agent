"""
Test Unified Samurai Agent

This module tests the unified samurai agent implementation to ensure
all functionality works correctly with smart memory management.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import List, Dict, Any

# Import the unified agent
from services.unified_samurai_agent import unified_samurai_agent, IntentAnalysis, ConversationContext
from models import Task, Memory, Project, ChatMessage

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class UnifiedAgentTester:
    """Test suite for the Unified Samurai Agent."""
    
    def __init__(self):
        self.test_project_id = "test-unified-agent"
        self.test_session_id = "test-session-1"
        
        # Test project context
        self.project_context = {
            "name": "Test Todo App",
            "description": "A test todo application for unified agent testing",
            "tech_stack": "React + FastAPI + PostgreSQL"
        }
        
        # Test conversation history
        self.conversation_history = [
            ChatMessage(
                id="msg-1",
                project_id=self.test_project_id,
                session_id=self.test_session_id,
                message="I want to add user authentication",
                response="That's a great idea! What type of authentication would you like to implement?",
                created_at=datetime.now()
            ),
            ChatMessage(
                id="msg-2", 
                project_id=self.test_project_id,
                session_id=self.test_session_id,
                message="I want JWT with email/password",
                response="Perfect! I'll create tasks for JWT authentication with email/password.",
                created_at=datetime.now()
            )
        ]
    
    async def test_intent_analysis(self):
        """Test intent analysis functionality."""
        logger.info("Testing intent analysis...")
        
        # Test pure discussion
        context = ConversationContext(
            session_messages=self.conversation_history,
            conversation_summary="User discussing authentication",
            relevant_tasks=[],
            relevant_memories=[],
            project_context=self.project_context
        )
        
        intent = await unified_samurai_agent._analyze_user_intent(
            "What is JWT?", context
        )
        
        assert intent.intent_type in ["pure_discussion", "question"], f"Expected pure_discussion, got {intent.intent_type}"
        logger.info(f"✅ Pure discussion intent: {intent.intent_type}")
        
        # Test feature exploration
        intent = await unified_samurai_agent._analyze_user_intent(
            "I'm thinking about adding a search feature", context
        )
        
        assert intent.intent_type == "feature_exploration", f"Expected feature_exploration, got {intent.intent_type}"
        logger.info(f"✅ Feature exploration intent: {intent.intent_type}")
        
        # Test ready for action
        intent = await unified_samurai_agent._analyze_user_intent(
            "Create tasks for JWT authentication with email/password", context
        )
        
        assert intent.intent_type == "ready_for_action", f"Expected ready_for_action, got {intent.intent_type}"
        logger.info(f"✅ Ready for action intent: {intent.intent_type}")
        
        # Test direct action
        intent = await unified_samurai_agent._analyze_user_intent(
            "Mark the login task as completed", context
        )
        
        assert intent.intent_type == "direct_action", f"Expected direct_action, got {intent.intent_type}"
        logger.info(f"✅ Direct action intent: {intent.intent_type}")
    
    async def test_memory_request_detection(self):
        """Test explicit memory request detection."""
        logger.info("Testing memory request detection...")
        
        # Test explicit memory requests
        explicit_requests = [
            "Remember this decision",
            "Save this information",
            "Update memory with this",
            "Don't forget about JWT",
            "Store this decision for later",
            "Keep this in mind"
        ]
        
        for request in explicit_requests:
            is_memory_request = unified_samurai_agent._is_explicit_memory_request(request)
            assert is_memory_request, f"Expected memory request for: {request}"
            logger.info(f"✅ Memory request detected: {request}")
        
        # Test non-memory requests
        non_memory_requests = [
            "What is JWT?",
            "Create a task",
            "How does authentication work?",
            "I want to add a feature"
        ]
        
        for request in non_memory_requests:
            is_memory_request = unified_samurai_agent._is_explicit_memory_request(request)
            assert not is_memory_request, f"Expected no memory request for: {request}"
            logger.info(f"✅ Non-memory request correctly identified: {request}")
    
    async def test_context_loading(self):
        """Test comprehensive context loading."""
        logger.info("Testing context loading...")
        
        context = await unified_samurai_agent._load_comprehensive_context(
            message="I want to add authentication",
            project_id=self.test_project_id,
            session_id=self.test_session_id,
            conversation_history=self.conversation_history,
            project_context=self.project_context
        )
        
        assert isinstance(context, ConversationContext), "Expected ConversationContext"
        assert context.session_messages == self.conversation_history, "Session messages should match"
        assert context.project_context == self.project_context, "Project context should match"
        assert len(context.conversation_summary) > 0, "Conversation summary should not be empty"
        
        logger.info(f"✅ Context loaded successfully: {len(context.session_messages)} messages")
    
    async def test_response_path_selection(self):
        """Test response path selection based on intent."""
        logger.info("Testing response path selection...")
        
        context = ConversationContext(
            session_messages=self.conversation_history,
            conversation_summary="User discussing authentication",
            relevant_tasks=[],
            relevant_memories=[],
            project_context=self.project_context
        )
        
        # Test pure discussion path
        intent = IntentAnalysis(
            intent_type="pure_discussion",
            confidence=0.9,
            reasoning="User asking a question",
            needs_clarification=False,
            clarification_questions=[],
            accumulated_specs={}
        )
        
        result = await unified_samurai_agent._select_and_execute_response_path(
            "What is JWT?", intent, context, self.test_project_id
        )
        
        assert result["type"] == "discussion_response", f"Expected discussion_response, got {result['type']}"
        assert len(result["response"]) > 0, "Response should not be empty"
        logger.info(f"✅ Pure discussion path: {result['type']}")
        
        # Test feature exploration path
        intent.intent_type = "feature_exploration"
        result = await unified_samurai_agent._select_and_execute_response_path(
            "I'm thinking about adding search", intent, context, self.test_project_id
        )
        
        assert result["type"] == "clarification_request", f"Expected clarification_request, got {result['type']}"
        assert len(result["response"]) > 0, "Response should not be empty"
        logger.info(f"✅ Feature exploration path: {result['type']}")
    
    async def test_task_breakdown_generation(self):
        """Test task breakdown generation."""
        logger.info("Testing task breakdown generation...")
        
        context = ConversationContext(
            session_messages=self.conversation_history,
            conversation_summary="User discussing authentication",
            relevant_tasks=[],
            relevant_memories=[],
            project_context=self.project_context
        )
        
        task_breakdown = await unified_samurai_agent._generate_task_breakdown(
            "Add JWT authentication with email/password", context
        )
        
        assert isinstance(task_breakdown, list), "Expected list of tasks"
        assert len(task_breakdown) > 0, "Should generate at least one task"
        
        for task in task_breakdown:
            assert "title" in task, "Task should have title"
            assert "description" in task, "Task should have description"
            assert len(task["title"]) > 0, "Task title should not be empty"
        
        logger.info(f"✅ Task breakdown generated: {len(task_breakdown)} tasks")
    
    async def test_session_completion(self):
        """Test session completion and memory analysis."""
        logger.info("Testing session completion...")
        
        # Create a more comprehensive conversation for testing
        comprehensive_history = [
            ChatMessage(
                id="msg-1",
                project_id=self.test_project_id,
                session_id=self.test_session_id,
                message="I want to add user authentication",
                response="That's a great idea! What type of authentication would you like to implement?",
                created_at=datetime.now()
            ),
            ChatMessage(
                id="msg-2",
                project_id=self.test_project_id,
                session_id=self.test_session_id,
                message="I want JWT with email/password",
                response="Perfect! I'll create tasks for JWT authentication with email/password.",
                created_at=datetime.now()
            ),
            ChatMessage(
                id="msg-3",
                project_id=self.test_project_id,
                session_id=self.test_session_id,
                message="Also include password reset functionality",
                response="Great addition! I'll include password reset in the authentication system.",
                created_at=datetime.now()
            )
        ]
        
        result = await unified_samurai_agent.complete_session(
            session_id=self.test_session_id,
            project_id=self.test_project_id,
            project_context=self.project_context
        )
        
        assert isinstance(result, dict), "Expected dictionary result"
        assert "status" in result, "Result should have status"
        assert "memories_created" in result, "Result should have memories_created"
        
        logger.info(f"✅ Session completion: {result}")
    
    async def test_error_handling(self):
        """Test error handling and fallbacks."""
        logger.info("Testing error handling...")
        
        # Test with invalid project context
        invalid_context = ConversationContext(
            session_messages=[],
            conversation_summary="",
            relevant_tasks=[],
            relevant_memories=[],
            project_context={}  # Empty context
        )
        
        # Should not crash
        intent = await unified_samurai_agent._analyze_user_intent(
            "Test message", invalid_context
        )
        
        assert intent.intent_type == "pure_discussion", "Should fallback to pure_discussion"
        logger.info(f"✅ Error handling: fallback to {intent.intent_type}")
        
        # Test processing error handling
        result = await unified_samurai_agent._handle_processing_error(
            "Test message", Exception("Test error"), self.project_context
        )
        
        assert result["type"] == "error", "Should return error type"
        assert "error" in result, "Should include error information"
        logger.info("✅ Processing error handling works")
    
    async def test_conversation_summary(self):
        """Test conversation summary generation."""
        logger.info("Testing conversation summary...")
        
        summary = unified_samurai_agent._create_conversation_summary(
            self.conversation_history, "Current message"
        )
        
        assert isinstance(summary, str), "Summary should be string"
        assert len(summary) > 0, "Summary should not be empty"
        assert "Current message" in summary, "Should include current message"
        
        logger.info(f"✅ Conversation summary: {summary[:100]}...")
    
    async def test_formatting_methods(self):
        """Test formatting methods for context."""
        logger.info("Testing formatting methods...")
        
        # Test task formatting
        test_tasks = [
            Task(id="1", title="Task 1", description="Description 1", completed=False, project_id=self.test_project_id),
            Task(id="2", title="Task 2", description="Description 2", completed=True, project_id=self.test_project_id)
        ]
        
        formatted_tasks = unified_samurai_agent._format_tasks_for_context(test_tasks)
        assert "Task 1" in formatted_tasks, "Should include task titles"
        assert "⏸️" in formatted_tasks, "Should include pending indicator"
        assert "✅" in formatted_tasks, "Should include completed indicator"
        
        logger.info(f"✅ Task formatting: {formatted_tasks}")
        
        # Test memory formatting
        test_memories = [
            Memory(id="1", title="Memory 1", content="Content 1", category="decision", type="decision", project_id=self.test_project_id),
            Memory(id="2", title="Memory 2", content="Content 2", category="note", type="note", project_id=self.test_project_id)
        ]
        
        formatted_memories = unified_samurai_agent._format_memories_for_context(test_memories)
        assert "Memory 1" in formatted_memories, "Should include memory titles"
        assert "[decision]" in formatted_memories, "Should include memory types"
        
        logger.info(f"✅ Memory formatting: {formatted_memories}")
    
    async def run_all_tests(self):
        """Run all tests."""
        logger.info("🚀 Starting Unified Samurai Agent Tests")
        logger.info("=" * 50)
        
        try:
            await self.test_intent_analysis()
            await self.test_memory_request_detection()
            await self.test_context_loading()
            await self.test_response_path_selection()
            await self.test_task_breakdown_generation()
            await self.test_session_completion()
            await self.test_error_handling()
            await self.test_conversation_summary()
            await self.test_formatting_methods()
            
            logger.info("=" * 50)
            logger.info("✅ All tests passed! Unified Samurai Agent is working correctly.")
            
        except Exception as e:
            logger.error(f"❌ Test failed: {e}")
            raise


async def main():
    """Main test runner."""
    tester = UnifiedAgentTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main()) 