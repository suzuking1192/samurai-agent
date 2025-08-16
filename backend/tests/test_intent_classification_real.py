import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from services.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext


class TestRealIntentClassification:
    """Test cases for real intent classification scenarios."""
    
    @pytest.fixture
    def mock_gemini_service(self):
        """Create a mock Gemini service."""
        mock_service = AsyncMock()
        mock_service.is_api_key_valid.return_value = True
        return mock_service
    
    @pytest.fixture
    def agent(self, mock_gemini_service):
        """Create a UnifiedSamuraiAgent instance with mocked dependencies."""
        agent = UnifiedSamuraiAgent()
        agent.gemini_service = mock_gemini_service
        return agent
    
    @pytest.fixture
    def basic_context(self):
        """Create a basic conversation context for testing."""
        return ConversationContext(
            session_messages=[],
            conversation_summary="Test conversation",
            relevant_memories=[],
            project_context={
                'name': 'Test Project',
                'tech_stack': 'Python, React',
                'stage': 'Development'
            },
            task_context=None
        )
    
    @pytest.mark.asyncio
    async def test_user_question_classified_as_pure_discussion(self, agent, basic_context, mock_gemini_service):
        """Test that the user's specific question is correctly classified as pure_discussion."""
        # Mock the AI to return pure_discussion for the user's question
        mock_gemini_service.chat_with_system_prompt.return_value = "pure_discussion"
        
        # This is the exact message the user mentioned
        message = "I want to talk about implementing a button where users can select local folder and then our agent has access to read those files in the folder any time. How can I build this?"
        
        result = await agent._analyze_user_intent(message, basic_context)
        
        # Verify the result
        assert result.intent_type == "pure_discussion"
        assert result.confidence >= 0.6
        assert "pure_discussion" in result.reasoning.lower()
        
        # Verify the AI was called with the correct prompt
        mock_gemini_service.chat_with_system_prompt.assert_called_once()
        call_args = mock_gemini_service.chat_with_system_prompt.call_args
        assert message == call_args[0][0]  # First argument should be the message
        
        # Verify the prompt contains our improved guidance
        system_prompt = call_args[0][1]  # Second argument should be the system prompt
        assert "pure_discussion" in system_prompt
        assert "ready_for_action" in system_prompt
        assert "How can I build this?" in system_prompt  # Verify the user's message is in the prompt
    
    @pytest.mark.asyncio
    async def test_explicit_task_request_classified_as_ready_for_action(self, agent, basic_context, mock_gemini_service):
        """Test that explicit task creation requests are correctly classified."""
        # Mock the AI to return ready_for_action
        mock_gemini_service.chat_with_system_prompt.return_value = "ready_for_action"
        
        message = "Create tasks for implementing a button where users can select local folder and then our agent has access to read those files in the folder any time."
        
        result = await agent._analyze_user_intent(message, basic_context)
        
        assert result.intent_type == "ready_for_action"
        assert result.confidence >= 0.8
        assert "ready_for_action" in result.reasoning.lower()
    
    @pytest.mark.asyncio
    async def test_keyword_fallback_for_pure_discussion(self, agent, basic_context, mock_gemini_service):
        """Test that the keyword fallback correctly identifies pure_discussion patterns."""
        # Mock the AI to return an unclear response
        mock_gemini_service.chat_with_system_prompt.return_value = "discussion"
        
        message = "How can I implement file system access in a web application?"
        
        result = await agent._analyze_user_intent(message, basic_context)
        
        # Should fall back to pure_discussion based on keyword mapping
        assert result.intent_type == "pure_discussion"
    
    @pytest.mark.asyncio
    async def test_keyword_fallback_for_ready_for_action(self, agent, basic_context, mock_gemini_service):
        """Test that the keyword fallback correctly identifies ready_for_action patterns."""
        # Mock the AI to return an unclear response
        mock_gemini_service.chat_with_system_prompt.return_value = "create tasks"
        
        message = "Create tasks for the file upload feature"
        
        result = await agent._analyze_user_intent(message, basic_context)
        
        # Should fall back to ready_for_action based on keyword mapping
        assert result.intent_type == "ready_for_action"
    
    @pytest.mark.asyncio
    async def test_feature_exploration_patterns(self, agent, basic_context, mock_gemini_service):
        """Test that feature exploration patterns are correctly identified."""
        # Mock the AI to return feature_exploration
        mock_gemini_service.chat_with_system_prompt.return_value = "feature_exploration"
        
        message = "I'm thinking about adding a file upload feature to our app"
        
        result = await agent._analyze_user_intent(message, basic_context)
        
        assert result.intent_type == "feature_exploration"
        assert result.needs_clarification == True  # Feature exploration should need clarification
    
    @pytest.mark.asyncio
    async def test_spec_clarification_patterns(self, agent, basic_context, mock_gemini_service):
        """Test that spec clarification patterns are correctly identified."""
        # Mock the AI to return spec_clarification
        mock_gemini_service.chat_with_system_prompt.return_value = "spec_clarification"
        
        message = "Yes, we should use drag and drop for the file upload, and it should support multiple file types"
        
        result = await agent._analyze_user_intent(message, basic_context)
        
        assert result.intent_type == "spec_clarification"


if __name__ == "__main__":
    pytest.main([__file__])
