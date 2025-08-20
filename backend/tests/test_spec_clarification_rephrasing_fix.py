import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from services.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext


class TestSpecClarificationRephrasingFix:
    """Test the fixed spec clarification rephrasing without start/end positions."""
    
    @pytest.fixture
    def agent(self):
        """Create a test agent instance."""
        agent = UnifiedSamuraiAgent()
        agent.gemini_service = AsyncMock()
        agent.tool_registry = AsyncMock()
        return agent
    
    @pytest.fixture
    def conversation_context(self):
        """Create a test conversation context."""
        context = MagicMock(spec=ConversationContext)
        context.project_context = {
            'codebase_path': '/test/path',
            'id': 'test-project'
        }
        context.session_id = 'test-session'
        return context
    
    @pytest.mark.asyncio
    async def test_identify_codebase_relevant_questions_returns_strings(self, agent):
        """Test that _identify_codebase_relevant_questions returns a list of strings."""
        # Mock the LLM response
        agent.gemini_service.chat_with_system_prompt.return_value = '''
[
  "What database schema is currently used?",
  "Are there any existing API endpoints for user management?"
]
'''
        
        chat_response = "I need to understand the current implementation. What database schema is currently used? Also, are there any existing API endpoints for user management?"
        
        result = await agent._identify_codebase_relevant_questions(chat_response)
        
        # Verify the result is a list of strings
        assert isinstance(result, list)
        assert all(isinstance(q, str) for q in result)
        assert len(result) == 2
        assert "What database schema is currently used?" in result
        assert "Are there any existing API endpoints for user management?" in result
    
    @pytest.mark.asyncio
    async def test_identify_codebase_relevant_questions_no_questions(self, agent):
        """Test that _identify_codebase_relevant_questions returns empty list when no questions found."""
        # Mock the LLM response
        agent.gemini_service.chat_with_system_prompt.return_value = '[]'
        
        chat_response = "This is a statement without any questions about the codebase."
        
        result = await agent._identify_codebase_relevant_questions(chat_response)
        
        assert result == []
    
    @pytest.mark.asyncio
    async def test_process_individual_question_with_code_context(self, agent, conversation_context):
        """Test that _process_individual_question works with code context."""
        # Mock the tool registry response
        agent.tool_registry.execute_tool.return_value = {
            "success": True,
            "context": "User model with email field",
            "relevant_code": "class User:\n    email = StringField()",
            "file_path": "/models/user.py"
        }
        
        # Mock the LLM response for rephrasing
        agent.gemini_service.chat_with_system_prompt.return_value = "Is it correct that the User model has an 'email' field?"
        
        question = "What fields does the User model have?"
        
        result = await agent._process_individual_question(question, conversation_context)
        
        # Verify the tool was called
        agent.tool_registry.execute_tool.assert_called_once()
        call_args = agent.tool_registry.execute_tool.call_args
        assert call_args[1]['natural_language_request'] == question
        assert call_args[1]['project_id'] == 'test-project'
        
        # Verify the result is the rephrased question
        assert "User model" in result
        assert "email" in result
    
    @pytest.mark.asyncio
    async def test_process_individual_question_no_code_context(self, agent, conversation_context):
        """Test that _process_individual_question returns original question when no code context found."""
        # Mock the tool registry response
        agent.tool_registry.execute_tool.return_value = {
            "success": False
        }
        
        question = "What fields does the User model have?"
        
        result = await agent._process_individual_question(question, conversation_context)
        
        # Should return the original question
        assert result == question
    
    @pytest.mark.asyncio
    async def test_update_response_with_processed_questions(self, agent):
        """Test that _update_response_with_processed_questions correctly updates the response."""
        # Mock the LLM response
        agent.gemini_service.chat_with_system_prompt.return_value = '''
Updated Response:
I need to understand the current implementation. Is it correct that the User model has an 'email' field? Also, does the API have endpoints for user management?
'''
        
        original_response = "I need to understand the current implementation. What fields does the User model have? Also, are there any existing API endpoints for user management?"
        
        processed_questions = [
            {
                'original': 'What fields does the User model have?',
                'processed': 'Is it correct that the User model has an \'email\' field?'
            },
            {
                'original': 'are there any existing API endpoints for user management?',
                'processed': 'does the API have endpoints for user management?'
            }
        ]
        
        result = await agent._update_response_with_processed_questions(original_response, processed_questions)
        
        # Verify the LLM was called with the correct arguments
        agent.gemini_service.chat_with_system_prompt.assert_called_once()
        call_args = agent.gemini_service.chat_with_system_prompt.call_args
        message, system_prompt = call_args[0]
        assert message == ""
        assert original_response in system_prompt
        assert "What fields does the User model have?" in system_prompt
        assert "Is it correct that the User model has an 'email' field?" in system_prompt
        
        # Verify the result contains the processed questions
        assert "Is it correct that the User model has an 'email' field?" in result
        assert "does the API have endpoints for user management?" in result
    
    @pytest.mark.asyncio
    async def test_process_spec_clarification_response_integration(self, agent, conversation_context):
        """Test the complete integration of the spec clarification response processing."""
        # Mock the question identification
        agent._identify_codebase_relevant_questions = AsyncMock(return_value=[
            "What database schema is currently used?",
            "Are there any existing API endpoints?"
        ])
        
        # Mock the individual question processing
        agent._process_individual_question = AsyncMock(side_effect=[
            "Is it correct that the database uses PostgreSQL?",
            "Does the API have user endpoints?"
        ])
        
        # Mock the response updating
        agent._update_response_with_processed_questions = AsyncMock(return_value=
            "I need to understand the current implementation. Is it correct that the database uses PostgreSQL? Also, does the API have user endpoints?"
        )
        
        chat_response = "I need to understand the current implementation. What database schema is currently used? Also, are there any existing API endpoints?"
        
        result = await agent._process_spec_clarification_response(chat_response, conversation_context)
        
        # Verify all methods were called
        agent._identify_codebase_relevant_questions.assert_called_once_with(chat_response)
        assert agent._process_individual_question.call_count == 2
        agent._update_response_with_processed_questions.assert_called_once()
        
        # Verify the final result
        assert "Is it correct that the database uses PostgreSQL?" in result
        assert "does the API have user endpoints?" in result
    
    @pytest.mark.asyncio
    async def test_process_spec_clarification_response_no_questions(self, agent, conversation_context):
        """Test that the method returns original response when no questions are found."""
        # Mock the question identification to return empty list
        agent._identify_codebase_relevant_questions = AsyncMock(return_value=[])
        
        # Mock the other methods to track calls
        agent._process_individual_question = AsyncMock()
        agent._update_response_with_processed_questions = AsyncMock()
        
        chat_response = "This is a statement without any codebase questions."
        
        result = await agent._process_spec_clarification_response(chat_response, conversation_context)
        
        # Should return the original response
        assert result == chat_response
        
        # Verify no other processing was done
        assert agent._process_individual_question.call_count == 0
        assert agent._update_response_with_processed_questions.call_count == 0


if __name__ == "__main__":
    pytest.main([__file__])
