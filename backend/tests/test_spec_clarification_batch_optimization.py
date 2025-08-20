import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from services.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext


class TestSpecClarificationBatchOptimization:
    """Test the batch optimization for spec clarification question processing."""
    
    @pytest.fixture
    def mock_agent(self):
        """Create a mock UnifiedSamuraiAgent with mocked dependencies."""
        agent = UnifiedSamuraiAgent()
        agent.gemini_service = AsyncMock()
        agent.tool_registry = AsyncMock()
        return agent
    
    @pytest.fixture
    def mock_conversation_context(self):
        """Create a mock conversation context."""
        context = MagicMock(spec=ConversationContext)
        context.project_context = {
            'codebase_path': '/test/path',
            'id': 'test-project-id'
        }
        context.session_id = 'test-session-id'
        return context
    
    @pytest.mark.asyncio
    async def test_batch_processing_single_llm_call(self, mock_agent, mock_conversation_context):
        """Test that batch processing uses only one LLM call for multiple questions."""
        # Mock the LLM responses for different calls
        mock_agent.gemini_service.chat_with_system_prompt.side_effect = [
            # First call: question identification
            '["How is authentication implemented?", "What database models exist?", "Is there error handling in the API?"]',
            # Second call: batch question processing
            '''
            [
              {"original": "How is authentication implemented?", "processed": "Is it correct that authentication uses JWT tokens?"},
              {"original": "What database models exist?", "processed": "Does the User model have an email field?"},
              {"original": "Is there error handling in the API?", "processed": "Is there error handling in the API?"}
            ]
            '''
        ]
        
        # Mock the code context extraction tool
        mock_agent.tool_registry.execute_tool.return_value = {
            "success": True,
            "context": "Authentication uses JWT tokens, User model exists with email field",
            "relevant_code": "class User: email = StringField()",
            "file_path": "/models/user.py"
        }
        
        # Mock the response update
        mock_agent._update_response_with_processed_questions = AsyncMock(return_value="Updated response")
        
        # Test the batch processing
        result = await mock_agent._process_spec_clarification_response(
            "Original response with questions", 
            mock_conversation_context
        )
        
        # Verify that code context extraction was called only once
        mock_agent.tool_registry.execute_tool.assert_called_once()
        call_args = mock_agent.tool_registry.execute_tool.call_args
        assert call_args[1]['natural_language_request'] == "How is authentication implemented? What database models exist? Is there error handling in the API?"
        
        # Verify that LLM was called exactly twice (question identification + batch processing)
        assert mock_agent.gemini_service.chat_with_system_prompt.call_count == 2
        
        assert result == "Updated response"
    
    @pytest.mark.asyncio
    async def test_batch_processing_no_code_context(self, mock_agent, mock_conversation_context):
        """Test that batch processing handles cases where no code context is found."""
        # Mock the LLM response for question identification
        mock_agent.gemini_service.chat_with_system_prompt.return_value = '["How is authentication implemented?", "What database models exist?"]'
        
        # Mock the code context extraction tool returning no results
        mock_agent.tool_registry.execute_tool.return_value = {
            "success": False
        }
        
        # Mock the response update
        mock_agent._update_response_with_processed_questions = AsyncMock(return_value="Updated response")
        
        # Test the batch processing
        result = await mock_agent._process_spec_clarification_response(
            "Original response with questions", 
            mock_conversation_context
        )
        
        # Verify that LLM was called only once for question identification
        assert mock_agent.gemini_service.chat_with_system_prompt.call_count == 1
        
        # Verify that the response update was called with original questions
        mock_agent._update_response_with_processed_questions.assert_called_once()
        call_args = mock_agent._update_response_with_processed_questions.call_args
        processed_questions = call_args[0][1]
        assert len(processed_questions) == 2
        assert processed_questions[0]['original'] == "How is authentication implemented?"
        assert processed_questions[0]['processed'] == "How is authentication implemented?"
        assert processed_questions[1]['original'] == "What database models exist?"
        assert processed_questions[1]['processed'] == "What database models exist?"
    
    @pytest.mark.asyncio
    async def test_batch_processing_missing_project_info(self, mock_agent, mock_conversation_context):
        """Test that batch processing handles missing project information gracefully."""
        # Mock conversation context without project info
        mock_conversation_context.project_context = {}
        
        # Mock the LLM response for question identification
        mock_agent.gemini_service.chat_with_system_prompt.return_value = '["How is authentication implemented?"]'
        
        # Mock the response update
        mock_agent._update_response_with_processed_questions = AsyncMock(return_value="Updated response")
        
        # Test the batch processing
        result = await mock_agent._process_spec_clarification_response(
            "Original response with questions", 
            mock_conversation_context
        )
        
        # Verify that no tool calls were made
        mock_agent.tool_registry.execute_tool.assert_not_called()
        
        # Verify that the response update was called with original questions
        mock_agent._update_response_with_processed_questions.assert_called_once()
        call_args = mock_agent._update_response_with_processed_questions.call_args
        processed_questions = call_args[0][1]
        assert len(processed_questions) == 1
        assert processed_questions[0]['original'] == "How is authentication implemented?"
        assert processed_questions[0]['processed'] == "How is authentication implemented?"
    
    @pytest.mark.asyncio
    async def test_process_questions_with_shared_context(self, mock_agent):
        """Test the shared context processing method directly."""
        questions = [
            "How is authentication implemented?",
            "What database models exist?"
        ]
        context = "Authentication uses JWT tokens"
        relevant_code = "class User: email = StringField()"
        file_path = "/models/user.py"
        
        # Mock the LLM response
        mock_agent.gemini_service.chat_with_system_prompt.return_value = '''
        [
          {"original": "How is authentication implemented?", "processed": "Is it correct that authentication uses JWT tokens?"},
          {"original": "What database models exist?", "processed": "Does the User model have an email field?"}
        ]
        '''
        
        # Test the method
        result = await mock_agent._process_questions_with_shared_context(
            questions, context, relevant_code, file_path
        )
        
        # Verify the result
        assert len(result) == 2
        assert result[0]['original'] == "How is authentication implemented?"
        assert result[0]['processed'] == "Is it correct that authentication uses JWT tokens?"
        assert result[1]['original'] == "What database models exist?"
        assert result[1]['processed'] == "Does the User model have an email field?"
        
        # Verify that LLM was called only once
        mock_agent.gemini_service.chat_with_system_prompt.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_process_questions_with_shared_context_fallback(self, mock_agent):
        """Test that the shared context processing handles malformed responses gracefully."""
        questions = [
            "How is authentication implemented?",
            "What database models exist?"
        ]
        context = "Authentication uses JWT tokens"
        relevant_code = "class User: email = StringField()"
        file_path = "/models/user.py"
        
        # Mock the LLM response with malformed JSON
        mock_agent.gemini_service.chat_with_system_prompt.return_value = "Invalid JSON response"
        
        # Test the method
        result = await mock_agent._process_questions_with_shared_context(
            questions, context, relevant_code, file_path
        )
        
        # Verify that original questions are returned as fallback
        assert len(result) == 2
        assert result[0]['original'] == "How is authentication implemented?"
        assert result[0]['processed'] == "How is authentication implemented?"
        assert result[1]['original'] == "What database models exist?"
        assert result[1]['processed'] == "What database models exist?"
    
    @pytest.mark.asyncio
    async def test_efficiency_comparison(self, mock_agent, mock_conversation_context):
        """Test that batch processing is more efficient than individual processing."""
        # Mock the LLM responses for different calls
        mock_agent.gemini_service.chat_with_system_prompt.side_effect = [
            # First call: question identification
            '["Question 1", "Question 2", "Question 3"]',
            # Second call: batch question processing
            '''
            [
              {"original": "Question 1", "processed": "Processed 1"},
              {"original": "Question 2", "processed": "Processed 2"},
              {"original": "Question 3", "processed": "Processed 3"}
            ]
            '''
        ]
        
        # Mock the code context extraction tool
        mock_agent.tool_registry.execute_tool.return_value = {
            "success": True,
            "context": "Test context",
            "relevant_code": "Test code",
            "file_path": "/test/file.py"
        }
        
        # Mock the response update
        mock_agent._update_response_with_processed_questions = AsyncMock(return_value="Updated response")
        
        # Test the batch processing
        await mock_agent._process_spec_clarification_response(
            "Original response", 
            mock_conversation_context
        )
        
        # Verify that code context extraction was called only once (not once per question)
        assert mock_agent.tool_registry.execute_tool.call_count == 1
        
        # Verify that LLM was called only twice (question identification + batch processing)
        # Instead of 4 times (question identification + 3 individual question processing)
        assert mock_agent.gemini_service.chat_with_system_prompt.call_count == 2


if __name__ == "__main__":
    pytest.main([__file__])
