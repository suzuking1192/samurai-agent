"""
Tests for intent analysis with previous session intent tracking.
"""

import pytest
from unittest.mock import patch, MagicMock
from services.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext, IntentAnalysis
from models import UserIntentEnum, Session


class TestIntentAnalysisWithPreviousIntent:
    """Test intent analysis with previous session intent logic."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.agent = UnifiedSamuraiAgent()
        self.conversation_context = ConversationContext(
            session_messages=[],
            conversation_summary="Test conversation",
            relevant_memories=[],
            project_context={"name": "Test Project", "tech_stack": "Python"},
            session_id="test-session-123"
        )
    
    @pytest.mark.asyncio
    async def test_intent_analysis_with_feature_exploration_previous_intent(self):
        """Test that ready_for_action passes through when previous intent is feature_exploration."""
        # Create a session with feature_exploration as previous intent
        session = Session(
            project_id="test-project-123",
            name="Test Session",
            previous_session_intent=UserIntentEnum.FEATURE_EXPLORATION
        )
        
        # Mock the LLM to return ready_for_action
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "ready_for_action"
            
            intent_analysis = await self.agent._analyze_user_intent(
                "Create tasks for user authentication",
                self.conversation_context,
                session=session
            )
            
            # Should pass through as ready_for_action
            assert intent_analysis.intent_type == "ready_for_action"
    
    @pytest.mark.asyncio
    async def test_intent_analysis_with_spec_clarification_previous_intent(self):
        """Test that ready_for_action passes through when previous intent is spec_clarification."""
        # Create a session with spec_clarification as previous intent
        session = Session(
            project_id="test-project-123",
            name="Test Session",
            previous_session_intent=UserIntentEnum.SPEC_CLARIFICATION
        )
        
        # Mock the LLM to return ready_for_action
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "ready_for_action"
            
            intent_analysis = await self.agent._analyze_user_intent(
                "Create tasks for user authentication",
                self.conversation_context,
                session=session
            )
            
            # Should pass through as ready_for_action
            assert intent_analysis.intent_type == "ready_for_action"
    
    @pytest.mark.asyncio
    async def test_intent_analysis_with_pure_discussion_previous_intent_override(self):
        """Test that ready_for_action is overridden when previous intent is pure_discussion."""
        # Create a session with pure_discussion as previous intent
        session = Session(
            project_id="test-project-123",
            name="Test Session",
            previous_session_intent=UserIntentEnum.PURE_DISCUSSION
        )
        
        # Mock the LLM to return ready_for_action
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "ready_for_action"
            
            intent_analysis = await self.agent._analyze_user_intent(
                "Create tasks for user authentication",
                self.conversation_context,
                session=session
            )
            
            # Should be overridden to feature_exploration
            assert intent_analysis.intent_type == "feature_exploration"
    
    @pytest.mark.asyncio
    async def test_intent_analysis_with_initial_state_previous_intent_override(self):
        """Test that ready_for_action is overridden when previous intent is initial_state."""
        # Create a session with initial_state as previous intent
        session = Session(
            project_id="test-project-123",
            name="Test Session",
            previous_session_intent=UserIntentEnum.INITIAL_STATE
        )
        
        # Mock the LLM to return ready_for_action
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "ready_for_action"
            
            intent_analysis = await self.agent._analyze_user_intent(
                "Create tasks for user authentication",
                self.conversation_context,
                session=session
            )
            
            # Should be overridden to feature_exploration
            assert intent_analysis.intent_type == "feature_exploration"
    
    @pytest.mark.asyncio
    async def test_intent_analysis_with_direct_action_previous_intent_override(self):
        """Test that ready_for_action is overridden when previous intent is direct_action."""
        # Create a session with direct_action as previous intent
        session = Session(
            project_id="test-project-123",
            name="Test Session",
            previous_session_intent=UserIntentEnum.DIRECT_ACTION
        )
        
        # Mock the LLM to return ready_for_action
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "ready_for_action"
            
            intent_analysis = await self.agent._analyze_user_intent(
                "Create tasks for user authentication",
                self.conversation_context,
                session=session
            )
            
            # Should be overridden to feature_exploration
            assert intent_analysis.intent_type == "feature_exploration"
    
    @pytest.mark.asyncio
    async def test_intent_analysis_with_non_ready_for_action_current_intent(self):
        """Test that non-ready_for_action intents are not overridden regardless of previous intent."""
        # Create a session with pure_discussion as previous intent
        session = Session(
            project_id="test-project-123",
            name="Test Session",
            previous_session_intent=UserIntentEnum.PURE_DISCUSSION
        )
        
        # Mock the LLM to return feature_exploration
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "feature_exploration"
            
            intent_analysis = await self.agent._analyze_user_intent(
                "I'm thinking about adding user authentication",
                self.conversation_context,
                session=session
            )
            
            # Should pass through as feature_exploration (no override)
            assert intent_analysis.intent_type == "feature_exploration"
    
    @pytest.mark.asyncio
    async def test_intent_analysis_without_session(self):
        """Test that intent analysis works without a session parameter."""
        # Mock the LLM to return ready_for_action
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "ready_for_action"
            
            intent_analysis = await self.agent._analyze_user_intent(
                "Create tasks for user authentication",
                self.conversation_context
            )
            
            # Should pass through as ready_for_action (no session to check)
            assert intent_analysis.intent_type == "ready_for_action"
    
    @pytest.mark.asyncio
    async def test_intent_analysis_with_session_no_previous_intent_field(self):
        """Test that intent analysis works with session that has no previous_session_intent field."""
        # Create a mock session without previous_session_intent field
        session = MagicMock()
        del session.previous_session_intent
        
        # Mock the LLM to return ready_for_action
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "ready_for_action"
            
            intent_analysis = await self.agent._analyze_user_intent(
                "Create tasks for user authentication",
                self.conversation_context,
                session=session
            )
            
            # Should pass through as ready_for_action (no previous_intent field to check)
            assert intent_analysis.intent_type == "ready_for_action"
    
    @pytest.mark.asyncio
    async def test_intent_analysis_session_update_logic(self):
        """Test that session's previous_session_intent is updated after intent analysis."""
        # Create a session with initial_state as previous intent
        session = Session(
            project_id="test-project-123",
            name="Test Session",
            previous_session_intent=UserIntentEnum.INITIAL_STATE
        )
        
        # Mock the LLM to return ready_for_action
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "ready_for_action"
            
            # Mock other methods to avoid actual processing
            with patch.object(self.agent, '_select_and_execute_response_path') as mock_response:
                mock_response.return_value = {
                    "type": "unified_response",
                    "response": "Test response",
                    "tool_calls_made": 0,
                    "tool_results": []
                }
                
                # Mock the file service save method
                with patch.object(self.agent.file_service, 'save_session') as mock_save:
                    result = await self.agent.process_message(
                        message="Create tasks for user authentication",
                        project_id="test-project-123",
                        project_context=self.conversation_context.project_context,
                        session_id=session.id,
                        conversation_history=[],
                        session=session
                    )
                    
                    # Should be overridden to feature_exploration
                    assert result["intent_analysis"]["intent_type"] == "feature_exploration"
                    
                    # Session should be updated and saved
                    assert session.previous_session_intent == UserIntentEnum.FEATURE_EXPLORATION
                    mock_save.assert_called_once_with("test-project-123", session)


if __name__ == "__main__":
    pytest.main([__file__])
