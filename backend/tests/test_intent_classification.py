import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from services.unified_samurai_agent import UnifiedSamuraiAgent
from services.unified_samurai_agent import ConversationContext


class TestIntentClassification:
    """Test cases for improved intent classification in UnifiedSamuraiAgent."""
    
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
    async def test_question_seeking_guidance_is_pure_discussion(self, agent, basic_context, mock_gemini_service):
        """Test that questions seeking guidance are classified as pure_discussion."""
        # Mock the AI response to return pure_discussion
        mock_gemini_service.chat_with_system_prompt.return_value = "pure_discussion"
        
        message = "I want to talk about implementing a button where users can select local folder and then our agent has access to read those files in the folder any time. How can I build this?"
        
        result = await agent._analyze_user_intent(message, basic_context)
        
        assert result.intent_type == "pure_discussion"
        assert "How can I build this?" in message  # Verify the question pattern
    
    @pytest.mark.asyncio
    async def test_explicit_task_request_is_ready_for_action(self, agent, basic_context, mock_gemini_service):
        """Test that explicit task creation requests are classified as ready_for_action."""
        # Mock the AI response to return ready_for_action
        mock_gemini_service.chat_with_system_prompt.return_value = "ready_for_action"
        
        message = "Create tasks for implementing a button where users can select local folder and then our agent has access to read those files in the folder any time."
        
        result = await agent._analyze_user_intent(message, basic_context)
        
        assert result.intent_type == "ready_for_action"
        assert "Create tasks" in message  # Verify the explicit action pattern
    
    @pytest.mark.asyncio
    async def test_detailed_description_without_action_request_is_spec_clarification(self, agent, basic_context, mock_gemini_service):
        """Test that detailed descriptions without explicit action requests are spec_clarification."""
        # Mock the AI response to return spec_clarification
        mock_gemini_service.chat_with_system_prompt.return_value = "spec_clarification"
        
        message = "Here's the complete specification for the folder selection feature: users can select local folders, the agent will have read access, and it should work with any file type. The button should be in the main interface."
        
        result = await agent._analyze_user_intent(message, basic_context)
        
        assert result.intent_type == "spec_clarification"
        # Verify no explicit action language
        assert "create tasks" not in message.lower()
        assert "break this down" not in message.lower()
    
    @pytest.mark.asyncio
    async def test_theoretical_question_is_pure_discussion(self, agent, basic_context, mock_gemini_service):
        """Test that theoretical questions are classified as pure_discussion."""
        # Mock the AI response to return pure_discussion
        mock_gemini_service.chat_with_system_prompt.return_value = "pure_discussion"
        
        message = "How does file system access work in web applications?"
        
        result = await agent._analyze_user_intent(message, basic_context)
        
        assert result.intent_type == "pure_discussion"
        assert message.startswith("How does")  # Verify the question pattern
    
    @pytest.mark.asyncio
    async def test_feature_exploration_is_correctly_classified(self, agent, basic_context, mock_gemini_service):
        """Test that feature exploration is correctly classified."""
        # Mock the AI response to return feature_exploration
        mock_gemini_service.chat_with_system_prompt.return_value = "feature_exploration"
        
        message = "I'm thinking about adding a file upload feature to our app. Maybe we could let users drag and drop files?"
        
        result = await agent._analyze_user_intent(message, basic_context)
        
        assert result.intent_type == "feature_exploration"
        assert "thinking about" in message.lower()  # Verify the exploration pattern


if __name__ == "__main__":
    pytest.main([__file__])
