"""
Integration tests for the interactive questions feature.
"""

import pytest
import json
from unittest.mock import Mock, patch, AsyncMock
from models import ChatRequest, UserInteractionSchema, QuestionSchema
from services.unified_samurai_agent import UnifiedSamuraiAgent
from utils.question_detector import _detect_interactive_questions


class TestInteractiveQuestionsIntegration:
    """Integration tests for the interactive questions feature."""
    
    @pytest.fixture
    def mock_agent(self):
        """Create a mock unified samurai agent."""
        agent = UnifiedSamuraiAgent()
        # Mock the dependencies
        agent.llm_provider_service = Mock()
        agent.project_settings_service = Mock()
        agent.file_service = Mock()
        agent.tool_registry = Mock()
        agent.consolidated_memory_service = Mock()
        agent.response_generator = Mock()
        return agent
    
    @pytest.fixture
    def sample_project_context(self):
        """Sample project context for testing."""
        return {
            "id": "test-project-123",
            "name": "Test Project",
            "description": "A test project",
            "tech_stack": "Python, FastAPI, React",
            "project_detail": "This is a test project for interactive questions",
            "codebase_path": "/test/path"
        }
    
    def test_question_detection_in_user_message(self):
        """Test that questions are detected in user messages."""
        # Test confirming question
        message = "Is this the correct approach for implementing authentication?"
        questions = _detect_interactive_questions(message)
        
        assert len(questions) == 1
        assert questions[0].type == "confirming"
        assert questions[0].text == "Is this the correct approach for implementing authentication?"
        assert questions[0].options == []
        
        # Test option question
        message = "For the database, should I choose PostgreSQL, MySQL, or SQLite?"
        questions = _detect_interactive_questions(message)
        
        assert len(questions) == 1
        assert questions[0].type == "option"
        assert "PostgreSQL" in questions[0].options
        assert "MySQL" in questions[0].options
        assert "SQLite" in questions[0].options
    
    def test_user_interaction_processing(self, mock_agent):
        """Test that user interactions are processed correctly."""
        # Test user interaction processing
        message = "I want to implement user authentication"
        user_interaction = UserInteractionSchema(
            question_id="test-question-123",
            action_type="yes",
            question_text="Is this the correct approach?"
        )
        
        processed_message = mock_agent._process_user_interaction(message, user_interaction)
        
        expected_context = "The user confirmed 'Is this the correct approach?' is correct."
        assert expected_context in processed_message
        assert message in processed_message
    
    def test_user_interaction_different_actions(self, mock_agent):
        """Test different user interaction action types."""
        message = "I want to implement user authentication"
        
        # Test "no" action
        user_interaction = UserInteractionSchema(
            question_id="test-question-123",
            action_type="no",
            question_text="Is this the correct approach?"
        )
        processed_message = mock_agent._process_user_interaction(message, user_interaction)
        assert "The user confirmed 'Is this the correct approach?' is incorrect." in processed_message
        
        # Test "skip" action
        user_interaction.action_type = "skip"
        processed_message = mock_agent._process_user_interaction(message, user_interaction)
        assert "The user chose to skip the question" in processed_message
        
        # Test "ai_decide" action
        user_interaction.action_type = "ai_decide"
        processed_message = mock_agent._process_user_interaction(message, user_interaction)
        assert "The user wants the AI to decide" in processed_message
        
        # Test "do_not_know" action
        user_interaction.action_type = "do_not_know"
        processed_message = mock_agent._process_user_interaction(message, user_interaction)
        assert "The user indicated they don't know" in processed_message
        
        # Test "option_selected" action
        user_interaction.action_type = "option_selected"
        user_interaction.selected_option = "PostgreSQL"
        processed_message = mock_agent._process_user_interaction(message, user_interaction)
        assert "The user selected option 'PostgreSQL'" in processed_message
    
    @pytest.mark.asyncio
    async def test_process_message_with_question_detection(self, mock_agent, sample_project_context):
        """Test that process_message detects questions and includes them in response."""
        # Mock the dependencies
        mock_agent._load_comprehensive_context = AsyncMock(return_value=Mock())
        mock_agent._analyze_user_intent = AsyncMock(return_value=Mock(
            intent_type="pure_discussion",
            confidence=0.9,
            reasoning="Test reasoning",
            needs_clarification=False,
            clarification_questions=[],
            accumulated_specs={},
            new_code_context_necessary=False,
            code_context_request=None
        ))
        mock_agent._handle_pure_discussion = AsyncMock(return_value={
            "type": "discussion_response",
            "response": "Test response",
            "tool_calls_made": 0,
            "tool_results": [],
            "context_used": {},
            "code_context": None
        })
        mock_agent._is_explicit_memory_request = Mock(return_value=False)
        
        # Test message with confirming question
        message = "Is this the correct approach for implementing authentication?"
        
        result = await mock_agent.process_message(
            message=message,
            project_id="test-project-123",
            project_context=sample_project_context,
            session_id="test-session-123"
        )
        
        # Check that interactive_questions are included in the response
        assert "interactive_questions" in result
        assert result["interactive_questions"] is not None
        assert len(result["interactive_questions"]) == 1
        assert result["interactive_questions"][0].type == "confirming"
        assert result["interactive_questions"][0].text == message
    
    @pytest.mark.asyncio
    async def test_process_message_with_user_interaction(self, mock_agent, sample_project_context):
        """Test that process_message handles user interactions correctly."""
        # Mock the dependencies
        mock_agent._load_comprehensive_context = AsyncMock(return_value=Mock())
        mock_agent._analyze_user_intent = AsyncMock(return_value=Mock(
            intent_type="pure_discussion",
            confidence=0.9,
            reasoning="Test reasoning",
            needs_clarification=False,
            clarification_questions=[],
            accumulated_specs={},
            new_code_context_necessary=False,
            code_context_request=None
        ))
        mock_agent._handle_pure_discussion = AsyncMock(return_value={
            "type": "discussion_response",
            "response": "Test response with user interaction context",
            "tool_calls_made": 0,
            "tool_results": [],
            "context_used": {},
            "code_context": None
        })
        mock_agent._is_explicit_memory_request = Mock(return_value=False)
        
        # Test message with user interaction
        message = "I want to implement user authentication"
        user_interaction = UserInteractionSchema(
            question_id="test-question-123",
            action_type="yes",
            question_text="Is this the correct approach?"
        )
        
        result = await mock_agent.process_message(
            message=message,
            project_id="test-project-123",
            project_context=sample_project_context,
            session_id="test-session-123",
            user_interaction=user_interaction
        )
        
        # Check that the response includes user interaction context
        assert "interactive_questions" in result
        # The response should be generated with the augmented message that includes user interaction context
        assert result["response"] == "Test response with user interaction context"
    
    def test_chat_request_with_user_interaction(self):
        """Test that ChatRequest can handle user interactions."""
        user_interaction = UserInteractionSchema(
            question_id="test-question-123",
            action_type="yes",
            question_text="Is this the correct approach?"
        )
        
        chat_request = ChatRequest(
            message="I want to implement user authentication",
            user_interaction=user_interaction
        )
        
        assert chat_request.message == "I want to implement user authentication"
        assert chat_request.user_interaction is not None
        assert chat_request.user_interaction.question_id == "test-question-123"
        assert chat_request.user_interaction.action_type == "yes"
        assert chat_request.user_interaction.question_text == "Is this the correct approach?"
    
    def test_question_schema_serialization(self):
        """Test that QuestionSchema can be serialized to JSON."""
        question = QuestionSchema(
            id="test-question-123",
            type="confirming",
            text="Is this the correct approach?",
            options=[]
        )
        
        # Test serialization
        json_data = question.model_dump()
        assert json_data["id"] == "test-question-123"
        assert json_data["type"] == "confirming"
        assert json_data["text"] == "Is this the correct approach?"
        assert json_data["options"] == []
        
        # Test deserialization
        question_from_json = QuestionSchema(**json_data)
        assert question_from_json.id == question.id
        assert question_from_json.type == question.type
        assert question_from_json.text == question.text
        assert question_from_json.options == question.options
    
    def test_user_interaction_schema_serialization(self):
        """Test that UserInteractionSchema can be serialized to JSON."""
        user_interaction = UserInteractionSchema(
            question_id="test-question-123",
            action_type="option_selected",
            selected_option="PostgreSQL",
            question_text="Which database should I use?"
        )
        
        # Test serialization
        json_data = user_interaction.model_dump()
        assert json_data["question_id"] == "test-question-123"
        assert json_data["action_type"] == "option_selected"
        assert json_data["selected_option"] == "PostgreSQL"
        assert json_data["question_text"] == "Which database should I use?"
        
        # Test deserialization
        user_interaction_from_json = UserInteractionSchema(**json_data)
        assert user_interaction_from_json.question_id == user_interaction.question_id
        assert user_interaction_from_json.action_type == user_interaction.action_type
        assert user_interaction_from_json.selected_option == user_interaction.selected_option
        assert user_interaction_from_json.question_text == user_interaction.question_text


if __name__ == "__main__":
    pytest.main([__file__])

