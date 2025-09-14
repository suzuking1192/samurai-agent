import pytest
import asyncio
import sys
import os
from unittest.mock import AsyncMock, patch, MagicMock

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.services.agent_core.unified_samurai_agent import UnifiedSamuraiAgent
from services.gemini_service import GeminiService


class TestCreateTasksButtonIntent:
    """Test that the Create Tasks button message is directly classified as ready_for_action."""
    
    @pytest.fixture
    def agent(self):
        """Create a test agent instance."""
        return UnifiedSamuraiAgent()
    
    @pytest.fixture
    def mock_gemini_service(self):
        """Mock the Gemini service to track calls."""
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
    async def test_create_tasks_button_direct_classification(self, agent_with_mock, mock_gemini_service, mock_context):
        """Test that 'Create tasks based on discussion so far' is directly classified as ready_for_action."""
        
        # Test the specific Create Tasks button message
        message = "Create tasks based on discussion so far"
        
        # Call the intent analysis method
        intent_analysis = await agent_with_mock._analyze_user_intent(
            message=message,
            context=mock_context,
            session=None,
            progress_callback=None,
            code_context_mode="with code look up"
        )
        
        # Verify the AI service was NOT called (should be 0 calls)
        assert mock_gemini_service.chat_with_system_prompt.call_count == 0, "AI service should not be called for Create Tasks button"
        
        # Verify the result is ready_for_action
        assert intent_analysis.intent_type == "ready_for_action"
        assert intent_analysis.confidence == 1.0
        assert "Direct classification for Create Tasks button" in intent_analysis.reasoning
        assert intent_analysis.needs_clarification == False
        assert intent_analysis.clarification_questions == []
        assert intent_analysis.new_code_context_necessary == False
        assert intent_analysis.code_context_request is None
    
    @pytest.mark.asyncio
    async def test_create_tasks_button_with_whitespace(self, agent_with_mock, mock_gemini_service, mock_context):
        """Test that the message works even with extra whitespace."""
        
        # Test with extra whitespace
        message = "  Create tasks based on discussion so far  "
        
        # Call the intent analysis method
        intent_analysis = await agent_with_mock._analyze_user_intent(
            message=message,
            context=mock_context,
            session=None,
            progress_callback=None,
            code_context_mode="with code look up"
        )
        
        # Verify the AI service was NOT called
        assert mock_gemini_service.chat_with_system_prompt.call_count == 0
        
        # Verify the result is ready_for_action
        assert intent_analysis.intent_type == "ready_for_action"
        assert intent_analysis.confidence == 1.0
    
    @pytest.mark.asyncio
    async def test_similar_message_uses_llm(self, agent_with_mock, mock_gemini_service, mock_context):
        """Test that similar but different messages still use the LLM."""
        
        # Mock the AI response
        mock_gemini_service.chat_with_system_prompt.return_value = "ready_for_action"
        
        # Test a similar but different message
        message = "Create tasks for the discussion so far"
        
        # Call the intent analysis method
        intent_analysis = await agent_with_mock._analyze_user_intent(
            message=message,
            context=mock_context,
            session=None,
            progress_callback=None,
            code_context_mode="with code look up"
        )
        
        # Verify the AI service WAS called (should be 2 calls - intent + code context)
        assert mock_gemini_service.chat_with_system_prompt.call_count == 2, "AI service should be called for similar but different messages"
        
        # Verify the result is still ready_for_action but came from LLM
        assert intent_analysis.intent_type == "ready_for_action"
        # Confidence should be different (0.8) since it came from LLM processing
        assert intent_analysis.confidence == 0.8
        assert "enhanced analysis" in intent_analysis.reasoning

    @pytest.mark.asyncio
    async def test_case_sensitivity(self, agent_with_mock, mock_gemini_service, mock_context):
        """Test that the message is case-sensitive."""
        
        # Mock the AI response
        mock_gemini_service.chat_with_system_prompt.return_value = "ready_for_action"
        
        # Test with different case
        message = "CREATE TASKS BASED ON DISCUSSION SO FAR"
        
        # Call the intent analysis method
        intent_analysis = await agent_with_mock._analyze_user_intent(
            message=message,
            context=mock_context,
            session=None,
            progress_callback=None,
            code_context_mode="with code look up"
        )
        
        # Verify the AI service WAS called (case doesn't match exactly)
        assert mock_gemini_service.chat_with_system_prompt.call_count == 2, "AI service should be called for different case"
        
        # Verify the result came from LLM
        assert intent_analysis.confidence == 0.8


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])
