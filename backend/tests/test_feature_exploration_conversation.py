import pytest
from unittest.mock import AsyncMock, patch
from backend.services.agent_core.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext, IntentAnalysis


class TestFeatureExplorationConversation:
    """Test that feature exploration returns natural conversation responses."""
    
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
        """Create a basic conversation context."""
        return ConversationContext(
            session_messages=[],
            conversation_summary="Test conversation",
            relevant_memories=[],
            project_context={
                'name': 'Test Project',
                'tech_stack': 'Python, React',
                'project_detail': 'A test project'
            },
            task_context=None,
            code_context={}
        )
    
    @pytest.fixture
    def intent_analysis(self):
        """Create an intent analysis for feature exploration."""
        return IntentAnalysis(
            intent_type="feature_exploration",
            confidence=0.8,
            reasoning="User is exploring a new feature idea",
            needs_clarification=True,
            clarification_questions=["What's your vision for this feature?"],
            accumulated_specs={},
            new_code_context_necessary=False,
            code_context_request=""
        )
    
    @pytest.mark.asyncio
    async def test_feature_exploration_returns_conversational_response(self, agent, basic_context, intent_analysis):
        """Test that feature exploration returns a natural conversation response."""
        # Mock the AI response to return a conversational response
        mock_response = "That's a really interesting feature idea! I'm curious how you envision users interacting with this - would it be a new page, or integrated into an existing workflow?"
        agent.gemini_service.chat_with_system_prompt.return_value = mock_response
        
        # Call the feature exploration method
        result = await agent._handle_feature_exploration(
            "I'm thinking about adding a user dashboard",
            basic_context,
            intent_analysis
        )
        
        # Verify the response type and content
        assert result["type"] == "clarification_request"
        assert "That's a really interesting feature idea" in result["response"]
        assert "I'm curious how you envision" in result["response"]
        
        # Verify it's not a task list
        assert "1." not in result["response"]
        assert "2." not in result["response"]
        assert "Create" not in result["response"]
        assert "Implement" not in result["response"]
        assert "Task" not in result["response"]
    
    @pytest.mark.asyncio
    async def test_feature_exploration_avoids_task_language(self, agent, basic_context, intent_analysis):
        """Test that feature exploration avoids task-related language."""
        # Mock the AI response to return a conversational response
        mock_response = "I like the direction you're thinking! What's your vision for the user experience - should this be something users actively seek out, or more of a background enhancement?"
        agent.gemini_service.chat_with_system_prompt.return_value = mock_response
        
        # Call the feature exploration method
        result = await agent._handle_feature_exploration(
            "Maybe we could add some analytics",
            basic_context,
            intent_analysis
        )
        
        # Verify the response is conversational
        assert result["type"] == "clarification_request"
        assert "I like the direction" in result["response"]
        assert "What's your vision" in result["response"]
        
        # Verify it doesn't contain task-related language
        task_related_terms = [
            "Create tasks", "Implement", "Build", "Set up", "Configure",
            "Database schema", "API endpoints", "Frontend components",
            "Step 1", "Step 2", "First", "Then", "Finally"
        ]
        
        for term in task_related_terms:
            assert term not in result["response"], f"Response should not contain task-related term: {term}"
    
    @pytest.mark.asyncio
    async def test_feature_exploration_uses_conversational_phrases(self, agent, basic_context, intent_analysis):
        """Test that feature exploration uses conversational phrases."""
        # Mock the AI response to return a conversational response
        mock_response = "That's an interesting idea! How do you see users discovering or accessing this functionality?"
        agent.gemini_service.chat_with_system_prompt.return_value = mock_response
        
        # Call the feature exploration method
        result = await agent._handle_feature_exploration(
            "I want to add authentication",
            basic_context,
            intent_analysis
        )
        
        # Verify the response uses conversational phrases
        conversational_phrases = [
            "That's an interesting idea",
            "I'm curious about",
            "How do you envision",
            "What's your thinking on",
            "I like the direction"
        ]
        
        # At least one conversational phrase should be present
        assert any(phrase in result["response"] for phrase in conversational_phrases), \
            "Response should contain conversational phrases"
    
    @pytest.mark.asyncio
    async def test_feature_exploration_asks_clarifying_questions(self, agent, basic_context, intent_analysis):
        """Test that feature exploration asks clarifying questions."""
        # Mock the AI response to return a question-based response
        mock_response = "What problem are you trying to solve with this feature? And how does this fit into your overall product roadmap?"
        agent.gemini_service.chat_with_system_prompt.return_value = mock_response
        
        # Call the feature exploration method
        result = await agent._handle_feature_exploration(
            "I'm thinking about adding a notification system",
            basic_context,
            intent_analysis
        )
        
        # Verify the response asks questions
        assert "?" in result["response"]
        assert "What problem" in result["response"] or "How does" in result["response"]
        
        # Verify it's not providing solutions
        assert "To implement" not in result["response"]
        assert "You'll need to" not in result["response"]
        assert "Here's how" not in result["response"]
