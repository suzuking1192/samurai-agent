"""
Integration test demonstrating the spec clarification rephrasing feature.

This test shows how the UnifiedSamuraiAgent can identify and rephrase
codebase-relevant questions within spec_clarification responses.
"""

import pytest
from unittest.mock import patch, AsyncMock
from services.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext, IntentAnalysis


class TestSpecClarificationRephrasingIntegration:
    """Integration tests for the spec clarification rephrasing feature."""
    
    @pytest.fixture
    def agent(self):
        """Create a UnifiedSamuraiAgent instance for testing."""
        return UnifiedSamuraiAgent()
    
    @pytest.fixture
    def mock_conversation_context(self):
        """Create a mock conversation context with a connected codebase."""
        return ConversationContext(
            session_messages=[],
            conversation_summary="User wants to add user authentication to their app",
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
    async def test_spec_clarification_with_codebase_question_rephrasing(self, agent, mock_conversation_context):
        """
        Test the complete flow: spec clarification response with codebase questions
        gets rephrased into confirmation statements.
        """
        # Mock the initial spec clarification response generation
        mock_initial_response = """
        Thanks for the clarification! Now I need to understand your current implementation:

        1. How is user authentication currently implemented in your codebase?
        2. What database are you using for user storage?
        3. Do you want to support social login providers?

        This will help me create the most appropriate tasks for your authentication feature.
        """
        
        # Mock the question identification
        mock_identified_questions = [
            {
                "question": "How is user authentication currently implemented in your codebase?",
                "start": 89,
                "end": 165
            },
            {
                "question": "What database are you using for user storage?",
                "start": 167,
                "end": 225
            }
        ]
        
        # Mock code context extraction results
        mock_code_context_results = [
            {
                "success": True,
                "context": "JWT-based authentication with token validation",
                "relevant_code": "class AuthService:\n    def authenticate(self, token):\n        return jwt.decode(token)",
                "file_path": "services/auth.py"
            },
            {
                "success": True,
                "context": "PostgreSQL database with User table",
                "relevant_code": "class User:\n    id = Column(Integer, primary_key=True)\n    email = Column(String)",
                "file_path": "models/user.py"
            }
        ]
        
        # Mock rephrased questions
        mock_rephrased_questions = [
            "Is it correct that you have JWT-based authentication with token validation in services/auth.py?",
            "Is it correct that you're using PostgreSQL with a User table in models/user.py?"
        ]
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_initial_response), \
             patch.object(agent, '_identify_codebase_relevant_questions', return_value=mock_identified_questions), \
             patch.object(agent.tool_registry, 'execute_tool', side_effect=mock_code_context_results), \
             patch.object(agent, '_rephrase_question_with_context', side_effect=mock_rephrased_questions):
            
            # Create intent analysis for spec_clarification
            intent_analysis = IntentAnalysis(
                intent_type="spec_clarification",
                confidence=0.9,
                reasoning="User is providing specifications",
                needs_clarification=True,
                clarification_questions=["What's the current auth implementation?"],
                accumulated_specs={}
            )
            
            # Process the spec clarification
            result = await agent._handle_spec_clarification(
                "I want to add user authentication with JWT tokens",
                mock_conversation_context,
                intent_analysis
            )
            
            # Verify the response type
            assert result["type"] == "spec_clarification_response"
            
            # Verify that questions were rephrased
            response = result["response"]
            assert "Is it correct that you have JWT-based authentication" in response
            assert "Is it correct that you're using PostgreSQL" in response
            
            # Verify that original questions are not present
            assert "How is user authentication currently implemented in your codebase?" not in response
            assert "What database are you using for user storage?" not in response
            
            # Verify that non-codebase questions remain unchanged
            assert "Do you want to support social login providers?" in response

    @pytest.mark.asyncio
    async def test_spec_clarification_with_partial_codebase_answers(self, agent, mock_conversation_context):
        """
        Test that questions are only rephrased when codebase answers are found,
        and original questions are preserved when no relevant code is found.
        """
        # Mock the initial spec clarification response
        mock_initial_response = """
        Great! I need to understand your current setup:

        1. How is user authentication currently implemented in your codebase?
        2. What database are you using for user storage?
        3. Do you want to support social login providers?

        This will help me create the right tasks.
        """
        
        # Mock the question identification
        mock_identified_questions = [
            {
                "question": "How is user authentication currently implemented in your codebase?",
                "start": 45,
                "end": 121
            },
            {
                "question": "What database are you using for user storage?",
                "start": 123,
                "end": 181
            }
        ]
        
        # Mock code context extraction results - only one successful
        mock_code_context_results = [
            {
                "success": True,
                "context": "JWT-based authentication with token validation",
                "relevant_code": "class AuthService:\n    def authenticate(self, token):\n        return jwt.decode(token)",
                "file_path": "services/auth.py"
            },
            {
                "success": False,
                "message": "No relevant database code found"
            }
        ]
        
        # Mock rephrased question (only for the successful one)
        mock_rephrased_question = "Is it correct that you have JWT-based authentication with token validation in services/auth.py?"
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_initial_response), \
             patch.object(agent, '_identify_codebase_relevant_questions', return_value=mock_identified_questions), \
             patch.object(agent.tool_registry, 'execute_tool', side_effect=mock_code_context_results), \
             patch.object(agent, '_rephrase_question_with_context', return_value=mock_rephrased_question):
            
            # Create intent analysis for spec_clarification
            intent_analysis = IntentAnalysis(
                intent_type="spec_clarification",
                confidence=0.9,
                reasoning="User is providing specifications",
                needs_clarification=True,
                clarification_questions=["What's the current auth implementation?"],
                accumulated_specs={}
            )
            
            # Process the spec clarification
            result = await agent._handle_spec_clarification(
                "I want to add user authentication with JWT tokens",
                mock_conversation_context,
                intent_analysis
            )
            
            response = result["response"]
            
            # Verify that the successful question was rephrased
            assert "Is it correct that you have JWT-based authentication" in response
            
            # Verify that the unsuccessful question was preserved
            assert "What database are you using for user storage?" in response
            
            # Verify that non-codebase questions remain unchanged
            assert "Do you want to support social login providers?" in response

    @pytest.mark.asyncio
    async def test_spec_clarification_with_no_codebase_questions(self, agent, mock_conversation_context):
        """
        Test that responses without codebase-relevant questions are not modified.
        """
        # Mock the initial spec clarification response with no codebase questions
        mock_initial_response = """
        Excellent! I understand your requirements:

        1. Do you want to support social login providers?
        2. Should we implement password reset functionality?
        3. What validation rules should we apply to user registration?

        This will help me create the right tasks.
        """
        
        # Mock no codebase-relevant questions identified
        mock_identified_questions = []
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_initial_response), \
             patch.object(agent, '_identify_codebase_relevant_questions', return_value=mock_identified_questions):
            
            # Create intent analysis for spec_clarification
            intent_analysis = IntentAnalysis(
                intent_type="spec_clarification",
                confidence=0.9,
                reasoning="User is providing specifications",
                needs_clarification=True,
                clarification_questions=["What features do you want?"],
                accumulated_specs={}
            )
            
            # Process the spec clarification
            result = await agent._handle_spec_clarification(
                "I want to add user authentication with social login",
                mock_conversation_context,
                intent_analysis
            )
            
            response = result["response"]
            
            # Verify that the response is unchanged (accounting for strip() processing)
            assert response == mock_initial_response.strip()
            
            # Verify that all original questions are present
            assert "Do you want to support social login providers?" in response
            assert "Should we implement password reset functionality?" in response
            assert "What validation rules should we apply to user registration?" in response
