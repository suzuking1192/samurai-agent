"""
Integration tests for intent tracking flow.
"""

import pytest
import os
import tempfile
import shutil
from unittest.mock import patch, MagicMock
from backend.services.agent_core.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext
from services.file_service import FileService
from models import UserIntentEnum, Session, Project


class TestIntentTrackingIntegration:
    """Integration tests for intent tracking flow."""
    
    def setup_method(self):
        """Set up test fixtures."""
        # Create temporary directory for test data
        self.temp_dir = tempfile.mkdtemp()
        
        # Initialize services with test data directory
        self.file_service = FileService(data_dir=self.temp_dir)
        self.agent = UnifiedSamuraiAgent()
        self.agent.file_service = self.file_service
        
        # Create a test project
        self.project = Project(
            id="test-project-123",
            name="Test Project",
            description="Test project for intent tracking",
            tech_stack="Python, FastAPI"
        )
        self.file_service.save_project(self.project)
        
        # Create a test session
        self.session = self.file_service.create_session(self.project.id, "Test Session")
        
        # Create conversation context
        self.conversation_context = ConversationContext(
            session_messages=[],
            conversation_summary="Test conversation",
            relevant_memories=[],
            project_context={
                "id": self.project.id,
                "name": self.project.name,
                "tech_stack": self.project.tech_stack,
                "project_detail": "",
                "codebase_path": None
            },
            session_id=self.session.id
        )
    
    def teardown_method(self):
        """Clean up test fixtures."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    @pytest.mark.asyncio
    async def test_complete_intent_tracking_flow(self):
        """Test the complete flow from process_message to session persistence."""
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
                
                # Process a message
                result = await self.agent.process_message(
                    message="Create tasks for user authentication",
                    project_id=self.project.id,
                    project_context=self.conversation_context.project_context,
                    session_id=self.session.id,
                    conversation_history=[],
                    session=self.session
                )
                
                # Verify the result
                assert result["type"] == "unified_response"
                assert result["response"] == "Test response"
                
                # Reload the session to verify it was updated
                updated_session = self.file_service.get_session_by_id(self.project.id, self.session.id)
                assert updated_session is not None
                # Since the session starts with INITIAL_STATE, ready_for_action should be overridden to feature_exploration
                assert updated_session.previous_session_intent == UserIntentEnum.FEATURE_EXPLORATION
    
    @pytest.mark.asyncio
    async def test_intent_override_flow(self):
        """Test that intent override works in the complete flow."""
        # Set the session's previous intent to pure_discussion
        self.session.previous_session_intent = UserIntentEnum.PURE_DISCUSSION
        self.file_service.save_session(self.project.id, self.session)
        
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
                
                # Process a message
                result = await self.agent.process_message(
                    message="Create tasks for user authentication",
                    project_id=self.project.id,
                    project_context=self.conversation_context.project_context,
                    session_id=self.session.id,
                    conversation_history=[],
                    session=self.session
                )
                
                # Verify the result
                assert result["type"] == "unified_response"
                
                # Check that the intent was overridden in the result
                intent_analysis = result.get("intent_analysis", {})
                assert intent_analysis.get("intent_type") == "feature_exploration"
                
                # Reload the session to verify it was updated with the overridden intent
                updated_session = self.file_service.get_session_by_id(self.project.id, self.session.id)
                assert updated_session is not None
                assert updated_session.previous_session_intent == UserIntentEnum.FEATURE_EXPLORATION
    
    @pytest.mark.asyncio
    async def test_multi_turn_conversation_intent_tracking(self):
        """Test intent tracking across multiple conversation turns."""
        # Turn 1: Start with feature_exploration
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "feature_exploration"
            
            with patch.object(self.agent, '_select_and_execute_response_path') as mock_response:
                mock_response.return_value = {
                    "type": "unified_response",
                    "response": "What kind of authentication do you want?",
                    "tool_calls_made": 0,
                    "tool_results": []
                }
                
                result1 = await self.agent.process_message(
                    message="I want to add user authentication",
                    project_id=self.project.id,
                    project_context=self.conversation_context.project_context,
                    session_id=self.session.id,
                    conversation_history=[],
                    session=self.session
                )
                
                assert result1["intent_analysis"]["intent_type"] == "feature_exploration"
        
        # Reload session and verify it was updated
        session_after_turn1 = self.file_service.get_session_by_id(self.project.id, self.session.id)
        assert session_after_turn1.previous_session_intent == UserIntentEnum.FEATURE_EXPLORATION
        
        # Turn 2: User provides spec_clarification
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "spec_clarification"
            
            with patch.object(self.agent, '_select_and_execute_response_path') as mock_response:
                mock_response.return_value = {
                    "type": "unified_response",
                    "response": "Great! JWT with email/password sounds good.",
                    "tool_calls_made": 0,
                    "tool_results": []
                }
                
                result2 = await self.agent.process_message(
                    message="I want JWT tokens with email/password login",
                    project_id=self.project.id,
                    project_context=self.conversation_context.project_context,
                    session_id=self.session.id,
                    conversation_history=[],
                    session=session_after_turn1
                )
                
                assert result2["intent_analysis"]["intent_type"] == "spec_clarification"
        
        # Reload session and verify it was updated
        session_after_turn2 = self.file_service.get_session_by_id(self.project.id, self.session.id)
        assert session_after_turn2.previous_session_intent == UserIntentEnum.SPEC_CLARIFICATION
        
        # Turn 3: User requests ready_for_action (should pass through)
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "ready_for_action"
            
            with patch.object(self.agent, '_select_and_execute_response_path') as mock_response:
                mock_response.return_value = {
                    "type": "unified_response",
                    "response": "Creating tasks for JWT authentication...",
                    "tool_calls_made": 1,
                    "tool_results": []
                }
                
                result3 = await self.agent.process_message(
                    message="Create tasks for JWT authentication with email/password",
                    project_id=self.project.id,
                    project_context=self.conversation_context.project_context,
                    session_id=self.session.id,
                    conversation_history=[],
                    session=session_after_turn2
                )
                
                assert result3["intent_analysis"]["intent_type"] == "ready_for_action"
        
        # Reload session and verify it was updated
        session_after_turn3 = self.file_service.get_session_by_id(self.project.id, self.session.id)
        assert session_after_turn3.previous_session_intent == UserIntentEnum.READY_FOR_ACTION
    
    @pytest.mark.asyncio
    async def test_intent_override_in_multi_turn_conversation(self):
        """Test that intent override works correctly in multi-turn conversations."""
        # Turn 1: Start with pure_discussion
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "pure_discussion"
            
            with patch.object(self.agent, '_select_and_execute_response_path') as mock_response:
                mock_response.return_value = {
                    "type": "unified_response",
                    "response": "Authentication is a security mechanism...",
                    "tool_calls_made": 0,
                    "tool_results": []
                }
                
                result1 = await self.agent.process_message(
                    message="How does authentication work?",
                    project_id=self.project.id,
                    project_context=self.conversation_context.project_context,
                    session_id=self.session.id,
                    conversation_history=[],
                    session=self.session
                )
                
                assert result1["intent_analysis"]["intent_type"] == "pure_discussion"
        
        # Reload session and verify it was updated
        session_after_turn1 = self.file_service.get_session_by_id(self.project.id, self.session.id)
        assert session_after_turn1.previous_session_intent == UserIntentEnum.PURE_DISCUSSION
        
        # Turn 2: User requests ready_for_action (should be overridden)
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = "ready_for_action"
            
            with patch.object(self.agent, '_select_and_execute_response_path') as mock_response:
                mock_response.return_value = {
                    "type": "unified_response",
                    "response": "Let me help you explore this feature...",
                    "tool_calls_made": 0,
                    "tool_results": []
                }
                
                result2 = await self.agent.process_message(
                    message="Create tasks for user authentication",
                    project_id=self.project.id,
                    project_context=self.conversation_context.project_context,
                    session_id=self.session.id,
                    conversation_history=[],
                    session=session_after_turn1
                )
                
                # Should be overridden to feature_exploration
                assert result2["intent_analysis"]["intent_type"] == "feature_exploration"
        
        # Reload session and verify it was updated with the overridden intent
        session_after_turn2 = self.file_service.get_session_by_id(self.project.id, self.session.id)
        assert session_after_turn2.previous_session_intent == UserIntentEnum.FEATURE_EXPLORATION


if __name__ == "__main__":
    pytest.main([__file__])
