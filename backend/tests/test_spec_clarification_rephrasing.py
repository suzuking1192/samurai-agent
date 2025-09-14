"""
Tests for the spec clarification rephrasing functionality in UnifiedSamuraiAgent.

This module tests the new ability to identify and rephrase codebase-relevant questions
within spec_clarification responses.
"""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Dict, Any, List

from backend.services.agent_core.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext, IntentAnalysis


class TestSpecClarificationRephrasing:
    """Test suite for spec clarification response rephrasing functionality."""
    
    @pytest.fixture
    def agent(self):
        """Create a UnifiedSamuraiAgent instance for testing."""
        return UnifiedSamuraiAgent()
    
    @pytest.fixture
    def mock_conversation_context(self):
        """Create a mock conversation context for testing."""
        return ConversationContext(
            session_messages=[],
            conversation_summary="Test conversation",
            relevant_memories=[],
            project_context={
                'id': 'test-project-123',
                'name': 'Test Project',
                'tech_stack': 'Python/React',
                'codebase_path': '/path/to/codebase'
            },
            session_id='test-session-456'
        )
    
    @pytest.fixture
    def sample_chat_response_with_questions(self):
        """Sample chat response containing codebase-relevant questions."""
        return """
        Thanks for the clarification! Now I need to understand a few implementation details:

        1. How is the user authentication currently implemented in the codebase?
        2. What database schema is being used for storing user data?
        3. Are there any existing API endpoints for user management?

        This will help me create the most appropriate tasks for your feature.
        """
    
    @pytest.fixture
    def sample_chat_response_without_questions(self):
        """Sample chat response without codebase-relevant questions."""
        return """
        Thanks for the clarification! Based on your requirements, I understand you want to:

        1. Create a user registration system
        2. Implement email verification
        3. Add password reset functionality

        Would you like me to proceed with creating tasks for this feature?
        """

    @pytest.mark.asyncio
    async def test_identify_codebase_relevant_questions_success(self, agent, sample_chat_response_with_questions):
        """Test successful identification of codebase-relevant questions."""
        q1 = "How is the user authentication currently implemented in the codebase?"
        q2 = "What database schema is being used for storing user data?"
        q3 = "Are there any existing API endpoints for user management?"
        
        # Mock the LLM response with the new format (list of strings)
        mock_llm_response = json.dumps([q1, q2, q3])
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_llm_response):
            questions = await agent._identify_codebase_relevant_questions(sample_chat_response_with_questions)
            
            assert len(questions) == 3
            assert questions[0] == q1
            assert questions[1] == q2
            assert questions[2] == q3

    @pytest.mark.asyncio
    async def test_identify_codebase_relevant_questions_no_questions(self, agent, sample_chat_response_without_questions):
        """Test identification when no codebase-relevant questions are present."""
        mock_llm_response = "[]"
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_llm_response):
            questions = await agent._identify_codebase_relevant_questions(sample_chat_response_without_questions)
            
            assert len(questions) == 0

    @pytest.mark.asyncio
    async def test_identify_codebase_relevant_questions_llm_error(self, agent, sample_chat_response_with_questions):
        """Test handling of LLM errors during question identification."""
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', side_effect=Exception("LLM Error")):
            questions = await agent._identify_codebase_relevant_questions(sample_chat_response_with_questions)
            
            assert len(questions) == 0

    @pytest.mark.asyncio
    async def test_process_questions_batch_success(self, agent, mock_conversation_context):
        """Test successful batch processing of questions with code context found."""
        questions = ["How is user authentication implemented?"]
        
        # Mock successful code context extraction
        mock_code_context_result = {
            "success": True,
            "context": "User authentication is implemented using JWT tokens",
            "relevant_code": "class AuthService:\n    def authenticate(self, token):\n        return jwt.decode(token)",
            "file_path": "services/auth.py"
        }
        
        # Mock successful batch processing
        mock_processed_questions = [
            {
                "original": "How is user authentication implemented?",
                "processed": "Is it correct that user authentication uses JWT tokens in services/auth.py?"
            }
        ]
        
        with patch.object(agent.tool_registry, 'execute_tool', return_value=mock_code_context_result), \
             patch.object(agent, '_process_questions_with_shared_context', return_value=mock_processed_questions):
            
            result = await agent._process_questions_batch(questions, mock_conversation_context)
            
            assert result == mock_processed_questions

    @pytest.mark.asyncio
    async def test_process_questions_batch_no_code_context(self, agent, mock_conversation_context):
        """Test batch processing when no relevant code context is found."""
        questions = ["How is user authentication implemented?"]
        
        # Mock unsuccessful code context extraction
        mock_code_context_result = {
            "success": False,
            "message": "No relevant code found"
        }
        
        with patch.object(agent.tool_registry, 'execute_tool', return_value=mock_code_context_result):
            result = await agent._process_questions_batch(questions, mock_conversation_context)
            
            assert result == [{"original": question, "processed": question} for question in questions]

    @pytest.mark.asyncio
    async def test_process_questions_batch_missing_codebase_path(self, agent):
        """Test batch processing when codebase path is not available."""
        questions = ["How is user authentication implemented?"]
        
        # Create context without codebase_path
        context_without_path = ConversationContext(
            session_messages=[],
            conversation_summary="Test conversation",
            relevant_memories=[],
            project_context={
                'id': 'test-project-123',
                'name': 'Test Project',
                'tech_stack': 'Python/React'
                # Missing codebase_path
            },
            session_id='test-session-456'
        )
        
        result = await agent._process_questions_batch(questions, context_without_path)
        
        assert result == [{"original": question, "processed": question} for question in questions]

    @pytest.mark.asyncio
    async def test_rephrase_question_with_context_success(self, agent):
        """Test successful rephrasing of a question with code context."""
        original_question = "How is user authentication implemented?"
        context = "User authentication uses JWT tokens"
        relevant_code = "class AuthService:\n    def authenticate(self, token):\n        return jwt.decode(token)"
        file_path = "services/auth.py"
        
        mock_rephrased = "Is it correct that user authentication uses JWT tokens in services/auth.py?"
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_rephrased):
            result = await agent._rephrase_question_with_context(
                original_question, context, relevant_code, file_path
            )
            
            assert result == mock_rephrased

    @pytest.mark.asyncio
    async def test_rephrase_question_with_context_llm_error(self, agent):
        """Test handling of LLM errors during rephrasing."""
        original_question = "How is user authentication implemented?"
        context = "User authentication uses JWT tokens"
        relevant_code = "class AuthService:\n    def authenticate(self, token):\n        return jwt.decode(token)"
        file_path = "services/auth.py"
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', side_effect=Exception("LLM Error")):
            result = await agent._rephrase_question_with_context(
                original_question, context, relevant_code, file_path
            )
            
            assert result == original_question

    @pytest.mark.asyncio
    async def test_rephrase_question_with_context_invalid_length(self, agent):
        """Test handling of rephrased questions with invalid length."""
        original_question = "How is user authentication implemented?"
        context = "User authentication uses JWT tokens"
        relevant_code = "class AuthService:\n    def authenticate(self, token):\n        return jwt.decode(token)"
        file_path = "services/auth.py"
        
        # Mock a response that's too short
        mock_rephrased = "Yes"
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_rephrased):
            result = await agent._rephrase_question_with_context(
                original_question, context, relevant_code, file_path
            )
            
            assert result == original_question

    @pytest.mark.asyncio
    async def test_process_spec_clarification_response_success(self, agent, mock_conversation_context, sample_chat_response_with_questions):
        """Test successful processing of spec clarification response with questions."""
        # Mock question identification with new format
        mock_questions = [
            "How is the user authentication currently implemented in the codebase?"
        ]
        
        # Mock batch question processing
        mock_processed_questions = [
            {
                "original": "How is the user authentication currently implemented in the codebase?",
                "processed": "Is it correct that user authentication uses JWT tokens in services/auth.py?"
            }
        ]
        
        # Mock response updating
        mock_updated_response = "Thanks! I need to know: Is it correct that user authentication uses JWT tokens in services/auth.py?"
        
        with patch.object(agent, '_identify_codebase_relevant_questions', return_value=mock_questions), \
             patch.object(agent, '_process_questions_batch', return_value=mock_processed_questions), \
             patch.object(agent, '_update_response_with_processed_questions', return_value=mock_updated_response):
            
            result = await agent._process_spec_clarification_response(
                sample_chat_response_with_questions, mock_conversation_context
            )
            
            # Check that the question was replaced
            assert "Is it correct that user authentication uses JWT tokens" in result
            assert "How is the user authentication currently implemented" not in result

    @pytest.mark.asyncio
    async def test_process_spec_clarification_response_no_questions(self, agent, mock_conversation_context, sample_chat_response_without_questions):
        """Test processing when no questions are identified."""
        with patch.object(agent, '_identify_codebase_relevant_questions', return_value=[]):
            result = await agent._process_spec_clarification_response(
                sample_chat_response_without_questions, mock_conversation_context
            )
            
            assert result == sample_chat_response_without_questions

    @pytest.mark.asyncio
    async def test_process_spec_clarification_response_error(self, agent, mock_conversation_context, sample_chat_response_with_questions):
        """Test error handling during processing."""
        with patch.object(agent, '_identify_codebase_relevant_questions', side_effect=Exception("Processing error")):
            result = await agent._process_spec_clarification_response(
                sample_chat_response_with_questions, mock_conversation_context
            )
            
            assert result == sample_chat_response_with_questions

    @pytest.mark.asyncio
    async def test_handle_spec_clarification_with_rephrasing(self, agent, mock_conversation_context):
        """Test that spec clarification handling includes the rephrasing step."""
        message = "I want to add user authentication"
        
        # Mock intent analysis
        intent_analysis = IntentAnalysis(
            intent_type="spec_clarification",
            confidence=0.9,
            reasoning="User is providing specifications",
            needs_clarification=True,
            clarification_questions=["How should authentication work?"],
            accumulated_specs={}
        )
        
        # Mock initial response generation
        mock_initial_response = "Thanks! I need to know: How is authentication currently implemented in your codebase?"
        
        # Mock rephrasing
        mock_rephrased_response = "Thanks! I need to know: Is it correct that authentication uses JWT tokens?"
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_initial_response), \
             patch.object(agent, '_process_spec_clarification_response', return_value=mock_rephrased_response):
            
            result = await agent._handle_spec_clarification(message, mock_conversation_context, intent_analysis)
            
            assert result["type"] == "spec_clarification_response"
            assert result["response"] == mock_rephrased_response
            assert "Is it correct that authentication uses JWT tokens" in result["response"]

    @pytest.mark.asyncio
    async def test_handle_spec_clarification_rephrasing_error(self, agent, mock_conversation_context):
        """Test that spec clarification handling gracefully handles rephrasing errors."""
        message = "I want to add user authentication"
        
        intent_analysis = IntentAnalysis(
            intent_type="spec_clarification",
            confidence=0.9,
            reasoning="User is providing specifications",
            needs_clarification=True,
            clarification_questions=["How should authentication work?"],
            accumulated_specs={}
        )
        
        mock_initial_response = "Thanks! I need to know: How is authentication currently implemented in your codebase?"
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_initial_response), \
             patch.object(agent, '_process_spec_clarification_response', side_effect=Exception("Rephrasing error")):
            
            result = await agent._handle_spec_clarification(message, mock_conversation_context, intent_analysis)
            
            assert result["type"] == "spec_clarification_response"
            # Should fall back to the default error response
            assert "Thanks for those details! Would you like me to create tasks for this feature?" in result["response"]


class TestSpecClarificationRephrasingIntegration:
    """Integration tests for the spec clarification rephrasing functionality."""
    
    @pytest.fixture
    def agent(self):
        """Create a UnifiedSamuraiAgent instance for integration testing."""
        return UnifiedSamuraiAgent()
    
    @pytest.fixture
    def mock_conversation_context(self):
        """Create a mock conversation context for integration testing."""
        return ConversationContext(
            session_messages=[],
            conversation_summary="Test conversation",
            relevant_memories=[],
            project_context={
                'id': 'test-project-123',
                'name': 'Test Project',
                'tech_stack': 'Python/React',
                'codebase_path': '/path/to/codebase'
            },
            session_id='test-session-456'
        )

    @pytest.mark.asyncio
    async def test_full_spec_clarification_flow(self, agent, mock_conversation_context):
        """Test the complete flow from spec clarification to rephrased questions."""
        message = "I want to implement user registration"
        
        intent_analysis = IntentAnalysis(
            intent_type="spec_clarification",
            confidence=0.9,
            reasoning="User is providing specifications",
            needs_clarification=True,
            clarification_questions=["What's the current user model?"],
            accumulated_specs={}
        )
        
        # Mock the entire flow
        mock_initial_response = """
        Great! I need to understand your current setup:

        1. What database are you using for user storage?
        2. How is user authentication currently implemented?
        3. Are there existing user-related API endpoints?

        This will help me create the right tasks.
        """
        
        mock_questions_identified = [
            "What database are you using for user storage?",
            "How is user authentication currently implemented?",
            "Are there existing user-related API endpoints?"
        ]
        
        mock_code_context_results = [
            {
                "success": True,
                "context": "PostgreSQL database with User table",
                "relevant_code": "class User:\n    id = Column(Integer, primary_key=True)\n    email = Column(String)",
                "file_path": "models/user.py"
            },
            {
                "success": True,
                "context": "JWT-based authentication",
                "relevant_code": "def authenticate(token):\n    return jwt.decode(token)",
                "file_path": "services/auth.py"
            },
            {
                "success": False,
                "message": "No existing API endpoints found"
            }
        ]
        
        mock_rephrased_questions = [
            "Is it correct that you're using PostgreSQL with a User table in models/user.py?",
            "Is it correct that authentication uses JWT tokens in services/auth.py?",
            "Are there existing user-related API endpoints?"  # Original question (no code found)
        ]
        
        # Mock the response updating
        mock_updated_response = """
        Great! I need to understand your current setup:

        1. Is it correct that you're using PostgreSQL with a User table in models/user.py?
        2. Is it correct that authentication uses JWT tokens in services/auth.py?
        3. Are there existing user-related API endpoints?

        This will help me create the right tasks.
        """
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_initial_response), \
             patch.object(agent, '_identify_codebase_relevant_questions', return_value=mock_questions_identified), \
             patch.object(agent.tool_registry, 'execute_tool', side_effect=mock_code_context_results), \
             patch.object(agent, '_rephrase_question_with_context', side_effect=mock_rephrased_questions), \
             patch.object(agent, '_update_response_with_processed_questions', return_value=mock_updated_response):
            
            result = await agent._handle_spec_clarification(message, mock_conversation_context, intent_analysis)
            
            assert result["type"] == "spec_clarification_response"
            response = result["response"]
            
            # Check that questions were rephrased where possible
            assert "Is it correct that you're using PostgreSQL" in response
            assert "Is it correct that authentication uses JWT" in response
            assert "Are there existing user-related API endpoints" in response  # Original question preserved
            
            # Check that original questions are not present
            assert "What database are you using for user storage?" not in response
            assert "How is user authentication currently implemented?" not in response

    @pytest.mark.asyncio
    async def test_spec_clarification_with_mixed_question_types(self, agent, mock_conversation_context):
        """Test handling of responses with both codebase-relevant and non-codebase questions."""
        message = "I want to add a shopping cart feature"
        
        intent_analysis = IntentAnalysis(
            intent_type="spec_clarification",
            confidence=0.9,
            reasoning="User is providing specifications",
            needs_clarification=True,
            clarification_questions=["What's the current cart implementation?"],
            accumulated_specs={}
        )
        
        mock_initial_response = """
        Excellent! Let me understand your requirements:

        1. What's the current shopping cart implementation in your codebase?
        2. Do you want to support guest checkout?
        3. What payment methods should be integrated?
        4. How should inventory be managed during checkout?

        This will help me create the right tasks.
        """
        
        mock_questions_identified = [
            "What's the current shopping cart implementation in your codebase?"
        ]
        
        mock_code_context_result = {
            "success": True,
            "context": "Simple cart using session storage",
            "relevant_code": "class Cart:\n    def add_item(self, item):\n        self.items.append(item)",
            "file_path": "models/cart.py"
        }
        
        mock_rephrased = "Is it correct that you have a simple cart using session storage in models/cart.py?"
        
        # Mock the response updating
        mock_updated_response = """
        Excellent! Let me understand your requirements:

        1. Is it correct that you have a simple cart using session storage in models/cart.py?
        2. Do you want to support guest checkout?
        3. What payment methods should be integrated?
        4. How should inventory be managed during checkout?

        This will help me create the right tasks.
        """
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_initial_response), \
             patch.object(agent, '_identify_codebase_relevant_questions', return_value=mock_questions_identified), \
             patch.object(agent.tool_registry, 'execute_tool', return_value=mock_code_context_result), \
             patch.object(agent, '_rephrase_question_with_context', return_value=mock_rephrased), \
             patch.object(agent, '_update_response_with_processed_questions', return_value=mock_updated_response):
            
            result = await agent._handle_spec_clarification(message, mock_conversation_context, intent_analysis)
            
            response = result["response"]
            
            # Check that only the codebase-relevant question was rephrased
            assert "Is it correct that you have a simple cart" in response
            assert "What's the current shopping cart implementation" not in response
            
            # Check that non-codebase questions remain unchanged
            assert "Do you want to support guest checkout?" in response
            assert "What payment methods should be integrated?" in response
            assert "How should inventory be managed during checkout?" in response
