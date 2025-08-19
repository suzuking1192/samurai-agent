"""
End-to-end test for markdown response functionality.
"""

import pytest
import sys
import os
import json

# Add the parent directory to the path to import the modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext
from services.utils import convert_task_json_to_markdown


class TestE2EMarkdownResponse:
    """End-to-end test cases for markdown response functionality."""
    
    @pytest.fixture
    def agent(self):
        """Create a UnifiedSamuraiAgent instance for testing."""
        return UnifiedSamuraiAgent()
    
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
    
    def test_utils_function_works_independently(self):
        """Test that the utils function works correctly on its own."""
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
        
        markdown = convert_task_json_to_markdown(task_breakdown)
        
        # Verify markdown formatting
        assert "## 1. Implement login feature" in markdown
        assert "  - **Create login form**" in markdown
        assert "Create user authentication system" in markdown
        assert "Design and implement the login form UI" in markdown
        assert "Priority: high" in markdown
        assert "Priority: medium" in markdown
        
        # Verify no raw JSON
        assert "task_id" not in markdown
        assert "parent_task_id" not in markdown
        assert "{" not in markdown
        assert "}" not in markdown
    
    @pytest.mark.asyncio
    async def test_response_generator_integration(self, agent, sample_context):
        """Test that the response generator integrates with the markdown converter."""
        from services.response_generator import ResponseGenerator, ResponseContext
        
        response_generator = ResponseGenerator()
        
        task_breakdown = [
            {
                "task_id": "1",
                "title": "Implement login feature",
                "description": "Create user authentication system",
                "priority": "high"
            }
        ]
        
        tool_results = [{"success": True, "task_id": "1"}]
        
        response_context = ResponseContext(
            project_name="Test Project",
            tech_stack="React, Node.js, PostgreSQL",
            conversation_summary="User wants to implement a login feature",
            relevant_tasks=[],
            relevant_memories=[],
            user_message="Create tasks for login feature",
            intent_type="ready_for_action",
            confidence=0.9
        )
        
        response = await response_generator.generate_task_creation_response(
            tool_results, task_breakdown, response_context
        )
        
        # Verify the response references the task naturally
        assert "Implement login feature" in response
        assert "login" in response.lower()
        
        # Verify no raw JSON field names
        assert "task_id" not in response
        assert "parent_task_id" not in response
        assert "description" not in response
        assert "{" not in response
        assert "}" not in response
    
    def test_markdown_conversion_handles_real_world_scenarios(self):
        """Test markdown conversion with realistic task data."""
        # Simulate a real-world task breakdown
        real_world_tasks = [
            {
                "task_id": "1",
                "title": "Implement user authentication system",
                "description": "Create a comprehensive authentication system with JWT tokens, password hashing, and session management. Include user registration, login, logout, and password reset functionality.",
                "priority": "high",
                "status": "pending"
            },
            {
                "task_id": "2",
                "parent_task_id": "1",
                "title": "Create login form component",
                "description": "Design and implement a React login form component with proper validation, error handling, and responsive design. Include email/password fields and remember me functionality.",
                "priority": "medium",
                "status": "pending"
            },
            {
                "task_id": "3",
                "parent_task_id": "1",
                "title": "Implement backend authentication API",
                "description": "Create REST API endpoints for user authentication including POST /auth/login, POST /auth/register, POST /auth/logout, and POST /auth/reset-password. Implement JWT token generation and validation.",
                "priority": "high",
                "status": "pending"
            },
            {
                "task_id": "4",
                "parent_task_id": "2",
                "title": "Add form validation",
                "description": "Implement client-side form validation for email format, password strength, and required field validation. Show appropriate error messages to users.",
                "priority": "low",
                "status": "pending"
            }
        ]
        
        markdown = convert_task_json_to_markdown(real_world_tasks)
        
        # Verify main task
        assert "## 1. Implement user authentication system" in markdown
        assert "Create a comprehensive authentication system" in markdown
        assert "Priority: high" in markdown
        
        # Verify subtasks
        assert "  - **Create login form component**" in markdown
        assert "  - **Implement backend authentication API**" in markdown
        assert "Design and implement a React login form component" in markdown
        assert "Create REST API endpoints for user authentication" in markdown
        
        # Verify nested subtask
        assert "    - **Add form validation**" in markdown
        assert "Implement client-side form validation" in markdown
        
        # Verify no raw JSON
        assert "task_id" not in markdown
        assert "parent_task_id" not in markdown
        assert "{" not in markdown
        assert "}" not in markdown
    
    def test_markdown_conversion_preserves_hierarchy_structure(self):
        """Test that markdown conversion correctly preserves task hierarchy."""
        hierarchical_tasks = [
            {
                "task_id": "1",
                "title": "Build e-commerce platform",
                "description": "Complete e-commerce platform with user management, product catalog, and payment processing",
                "priority": "high"
            },
            {
                "task_id": "2",
                "parent_task_id": "1",
                "title": "User management system",
                "description": "User registration, authentication, and profile management",
                "priority": "high"
            },
            {
                "task_id": "3",
                "parent_task_id": "2",
                "title": "User authentication",
                "description": "Login, logout, and password reset functionality",
                "priority": "medium"
            },
            {
                "task_id": "4",
                "parent_task_id": "2",
                "title": "User profile management",
                "description": "Profile editing, preferences, and account settings",
                "priority": "medium"
            },
            {
                "task_id": "5",
                "parent_task_id": "1",
                "title": "Product catalog",
                "description": "Product listing, search, filtering, and categorization",
                "priority": "high"
            }
        ]
        
        markdown = convert_task_json_to_markdown(hierarchical_tasks)
        
        # Verify root task
        assert "## 1. Build e-commerce platform" in markdown
        
        # Verify first level subtasks
        assert "  - **User management system**" in markdown
        assert "  - **Product catalog**" in markdown
        
        # Verify second level subtasks
        assert "    - **User authentication**" in markdown
        assert "    - **User profile management**" in markdown
        
        # Verify descriptions are preserved
        assert "Complete e-commerce platform" in markdown
        assert "User registration, authentication" in markdown
        assert "Login, logout, and password reset" in markdown
        assert "Profile editing, preferences" in markdown
        assert "Product listing, search, filtering" in markdown
