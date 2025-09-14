import pytest
import asyncio
import sys
import os
from unittest.mock import AsyncMock, patch, MagicMock

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.services.agent_core.unified_samurai_agent import UnifiedSamuraiAgent
from services.gemini_service import GeminiService


class TestDirectActionStrictRules:
    """Test that direct_action classification is strict and only triggers for explicit commands."""
    
    @pytest.fixture
    def agent(self):
        """Create a test agent instance."""
        return UnifiedSamuraiAgent()
    
    @pytest.fixture
    def mock_gemini_service(self):
        """Mock the Gemini service to return controlled responses."""
        with patch('backend.services.agent_core.unified_samurai_agent.GeminiService') as mock:
            service_instance = AsyncMock()
            # Mock the API key validation to return True
            service_instance.is_api_key_valid.return_value = True
            mock.return_value = service_instance
            yield service_instance
    
    @pytest.fixture
    def agent_with_mock(self, mock_gemini_service):
        """Create a test agent instance with mocked gemini_service."""
        agent = UnifiedSamuraiAgent()
        # Replace the agent's gemini_service with our mock
        agent.gemini_service = mock_gemini_service
        return agent
    
    @pytest.fixture
    def mock_context(self):
        """Create a mock conversation context."""
        context = MagicMock()
        context.task_context = None
        context.conversation_summary = "Test conversation"
        context.project_context = {"name": "Test Project", "tech_stack": "Python", "stage": "Development"}
        context.relevant_memories = []
        context.code_context = None
        return context
    
    @pytest.mark.asyncio
    async def test_progress_statement_not_direct_action(self, agent_with_mock, mock_gemini_service, mock_context):
        """Test that progress statements are classified as pure_discussion, not direct_action."""
        
        # Mock the AI response to return pure_discussion
        mock_gemini_service.chat_with_system_prompt.return_value = "pure_discussion"
        
        # Test the user's specific message
        message = "LLM Cost Calculation and Real-time Display Feature has been completed properly"
        
        # Call the intent analysis method
        intent_analysis = await agent_with_mock._analyze_user_intent(
            message=message,
            context=mock_context,
            session=None,
            progress_callback=None,
            code_context_mode="with code look up"
        )
        
        # Verify the AI was called twice (intent analysis + code context analysis)
        assert mock_gemini_service.chat_with_system_prompt.call_count == 2
        
        # Get the first call (intent analysis)
        first_call = mock_gemini_service.chat_with_system_prompt.call_args_list[0]
        intent_prompt = first_call[0][1]  # Second argument is the system prompt
        
        # Check that the intent analysis prompt contains our strict direct_action rules
        assert "ONLY for EXPLICIT task management commands" in intent_prompt
        assert "Progress statements like" in intent_prompt
        assert "are NOT direct_action" in intent_prompt
        assert "Information sharing about completion status is NOT direct_action" in intent_prompt
        assert "LLM Cost Calculation and Real-time Display Feature has been completed properly" in intent_prompt
        
        # Verify the result is pure_discussion
        assert intent_analysis.intent_type == "pure_discussion"
    
    @pytest.mark.asyncio
    async def test_explicit_command_is_direct_action(self, agent_with_mock, mock_gemini_service, mock_context):
        """Test that explicit task management commands are classified as direct_action."""
        
        # Mock the AI response to return direct_action
        mock_gemini_service.chat_with_system_prompt.return_value = "direct_action"
        
        # Test an explicit command
        message = "Mark task 'LLM Cost Calculation' as complete"
        
        # Call the intent analysis method
        intent_analysis = await agent_with_mock._analyze_user_intent(
            message=message,
            context=mock_context,
            session=None,
            progress_callback=None,
            code_context_mode="with code look up"
        )
        
        # Verify the result is direct_action
        assert intent_analysis.intent_type == "direct_action"
    
    @pytest.mark.asyncio
    async def test_various_progress_statements_not_direct_action(self, agent_with_mock, mock_gemini_service, mock_context):
        """Test various progress statements are not classified as direct_action."""
        
        # Mock the AI response to return pure_discussion
        mock_gemini_service.chat_with_system_prompt.return_value = "pure_discussion"
        
        progress_statements = [
            "I finished the login API endpoint task",
            "The authentication feature has been completed",
            "Task X is done",
            "Feature Y is working properly",
            "This has been implemented successfully",
            "The backend integration is complete"
        ]
        
        for message in progress_statements:
            # Reset the mock for each test
            mock_gemini_service.chat_with_system_prompt.reset_mock()
            
            intent_analysis = await agent_with_mock._analyze_user_intent(
                message=message,
                context=mock_context,
                session=None,
                progress_callback=None,
                code_context_mode="with code look up"
            )
            
            # Verify the result is pure_discussion
            assert intent_analysis.intent_type == "pure_discussion", f"Message '{message}' should be pure_discussion, got {intent_analysis.intent_type}"
    
    @pytest.mark.asyncio
    async def test_explicit_commands_are_direct_action(self, agent_with_mock, mock_gemini_service, mock_context):
        """Test that explicit commands are classified as direct_action."""
        
        # Mock the AI response to return direct_action
        mock_gemini_service.chat_with_system_prompt.return_value = "direct_action"
        
        explicit_commands = [
            "Mark task 'Login API' as complete",
            "Update task 'User Auth' description to include OAuth",
            "Delete task 'Old Feature'",
            "Move task 'Frontend' to high priority",
            "Reassign task 'Backend' to John",
            "Change task 'Database' status to in-progress"
        ]
        
        for message in explicit_commands:
            # Reset the mock for each test
            mock_gemini_service.chat_with_system_prompt.reset_mock()
            
            intent_analysis = await agent_with_mock._analyze_user_intent(
                message=message,
                context=mock_context,
                session=None,
                progress_callback=None,
                code_context_mode="with code look up"
            )
            
            # Verify the result is direct_action
            assert intent_analysis.intent_type == "direct_action", f"Message '{message}' should be direct_action, got {intent_analysis.intent_type}"


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])
