"""
Integration tests for task creation markdown response functionality.
"""

import pytest
import sys
import os
import json

# Add the parent directory to the path to import the modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext
from services.response_generator import ResponseGenerator, ResponseContext
from models import Task, Memory, Project, ChatMessage


class TestTaskCreationMarkdownIntegration:
    """Test cases for task creation markdown integration."""
    
    @pytest.fixture
    def agent(self):
        """Create a UnifiedSamuraiAgent instance for testing."""
        return UnifiedSamuraiAgent()
    
    @pytest.fixture
    def response_generator(self):
        """Create a ResponseGenerator instance for testing."""
        return ResponseGenerator()
    
    @pytest.fixture
    def sample_context(self):
        """Create a sample conversation context for testing."""
        return ConversationContext(
            session_messages=[],
            conversation_summary="User wants to implement a login feature",
            relevant_memories=[],
            project_context={
                "name": "Test Project",
                "tech_stack": "React, Node.js, PostgreSQL"
            }
        )
    
    @pytest.fixture
    def sample_response_context(self):
        """Create a sample response context for testing."""
        return ResponseContext(
            project_name="Test Project",
            tech_stack="React, Node.js, PostgreSQL",
            conversation_summary="User wants to implement a login feature",
            relevant_tasks=[],
            relevant_memories=[],
            user_message="Create tasks for login feature",
            intent_type="ready_for_action",
            confidence=0.9
        )
    
    def test_task_breakdown_contains_json_structure(self):
        """Test that task breakdown contains the expected JSON structure."""
        task_breakdown = [
            {
                "task_id": "1",
                "title": "Implement login feature",
                "description": "Create user authentication system",
                "priority": "high",
                "status": "pending"
            },
            {
                "task_id": "2",
                "parent_task_id": "1",
                "title": "Create login form",
                "description": "Design and implement the login form UI",
                "priority": "medium"
            }
        ]
        
        # Verify the structure matches what the agent generates
        assert isinstance(task_breakdown, list)
        assert len(task_breakdown) == 2
        assert "task_id" in task_breakdown[0]
        assert "title" in task_breakdown[0]
        assert "description" in task_breakdown[0]
        assert "parent_task_id" in task_breakdown[1]
    
    @pytest.mark.asyncio
    async def test_response_generator_uses_markdown(self, response_generator, sample_response_context):
        """Test that ResponseGenerator converts task breakdown to markdown."""
        task_breakdown = [
            {
                "task_id": "1",
                "title": "Implement login feature",
                "description": "Create user authentication system",
                "priority": "high"
            },
            {
                "task_id": "2",
                "parent_task_id": "1",
                "title": "Create login form",
                "description": "Design and implement the login form UI",
                "priority": "medium"
            }
        ]
        
        tool_results = [
            {"success": True, "task_id": "1"},
            {"success": True, "task_id": "2"}
        ]
        
        response = await response_generator.generate_task_creation_response(
            tool_results, task_breakdown, sample_response_context
        )
        
        # Verify the response references the tasks naturally (not raw JSON)
        assert "Implement login feature" in response
        assert "Create login form" in response
        assert "login" in response.lower()
        
        # Verify the response does NOT contain raw JSON field names
        assert "task_id" not in response
        assert "parent_task_id" not in response
        assert "description" not in response
        assert "status" not in response
        assert "{" not in response
        assert "}" not in response
    
    @pytest.mark.asyncio
    async def test_response_generator_fallback_uses_markdown(self, response_generator, sample_response_context):
        """Test that ResponseGenerator fallback also uses markdown."""
        task_breakdown = [
            {
                "task_id": "1",
                "title": "Implement login feature",
                "description": "Create user authentication system",
                "priority": "high"
            }
        ]
        
        # Simulate a failure in the main response generation
        tool_results = [{"success": True, "task_id": "1"}]
        
        # Mock the LLM call to fail
        original_chat = response_generator.gemini_service.chat_with_system_prompt
        response_generator.gemini_service.chat_with_system_prompt = lambda *args, **kwargs: Exception("LLM failure")
        
        try:
            response = await response_generator.generate_task_creation_response(
                tool_results, task_breakdown, sample_response_context
            )
            
            # Verify the fallback response contains markdown
            assert "## 1. Implement login feature" in response
            assert "Create user authentication system" in response
            
            # Verify the response does NOT contain raw JSON
            assert "task_id" not in response
            assert "{" not in response
            assert "}" not in response
            
        finally:
            # Restore the original method
            response_generator.gemini_service.chat_with_system_prompt = original_chat
    
    def test_markdown_conversion_handles_complex_hierarchy(self):
        """Test that markdown conversion handles complex task hierarchies correctly."""
        from services.utils import convert_task_json_to_markdown
        
        task_breakdown = [
            {
                "task_id": "1",
                "title": "Implement authentication system",
                "description": "Complete authentication system",
                "priority": "high"
            },
            {
                "task_id": "2",
                "parent_task_id": "1",
                "title": "Frontend authentication",
                "description": "Login/logout UI components",
                "priority": "medium"
            },
            {
                "task_id": "3",
                "parent_task_id": "2",
                "title": "Login form component",
                "description": "Create the login form React component",
                "priority": "low"
            }
        ]
        
        markdown = convert_task_json_to_markdown(task_breakdown)
        
        # Verify hierarchical structure
        assert "## 1. Implement authentication system" in markdown
        assert "  - **Frontend authentication**" in markdown
        assert "    - **Login form component**" in markdown
        
        # Verify content is present
        assert "Complete authentication system" in markdown
        assert "Login/logout UI components" in markdown
        assert "Create the login form React component" in markdown
    
    def test_markdown_conversion_handles_missing_fields(self):
        """Test that markdown conversion handles missing optional fields gracefully."""
        from services.utils import convert_task_json_to_markdown
        
        task_breakdown = [
            {
                "task_id": "1",
                "title": "Implement login feature"
                # Missing description, priority, etc.
            }
        ]
        
        markdown = convert_task_json_to_markdown(task_breakdown)
        
        # Should not crash and should display the task
        assert "## 1. Implement login feature" in markdown
    
    def test_markdown_conversion_handles_empty_list(self):
        """Test that markdown conversion handles empty task list."""
        from services.utils import convert_task_json_to_markdown
        
        markdown = convert_task_json_to_markdown([])
        
        assert markdown == "No tasks to display."
