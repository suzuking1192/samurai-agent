"""
Test API key warning functionality.

This test verifies that when the GEMINI_API_KEY is invalid or missing,
the agent returns a specific warning message instead of proceeding with
normal processing.
"""

import pytest
import os
import asyncio
from unittest.mock import patch, MagicMock
from services.unified_samurai_agent import UnifiedSamuraiAgent
from services.gemini_service import GeminiService
from models import ChatMessage, Project


class TestAPIKeyWarning:
    """Test cases for API key warning functionality."""

    @pytest.fixture
    def agent(self):
        """Create a unified agent instance for testing."""
        return UnifiedSamuraiAgent()

    @pytest.fixture
    def mock_project_context(self):
        """Create mock project context for testing."""
        return {
            "name": "Test Project",
            "description": "A test project",
            "tech_stack": "Python, FastAPI",
            "project_detail": "Test project details"
        }

    @pytest.fixture
    def mock_conversation_history(self):
        """Create mock conversation history for testing."""
        return [
            ChatMessage(
                id="1",
                project_id="test-project",
                session_id="test-session",
                message="Hello",
                response="Hi there!",
                intent_type="pure_discussion",
                created_at="2024-01-01T00:00:00"
            )
        ]

    @pytest.mark.asyncio
    async def test_api_key_warning_when_key_missing(self, agent, mock_project_context, mock_conversation_history):
        """Test that warning message is returned when API key is missing."""
        # Mock the GeminiService to simulate missing API key
        with patch.object(agent.gemini_service, 'is_api_key_valid', return_value=False):
            result = await agent.process_message(
                message="Hello, can you help me with my project?",
                project_id="test-project",
                project_context=mock_project_context,
                session_id="test-session",
                conversation_history=mock_conversation_history
            )
            
            # Verify the warning message is returned
            assert result["type"] == "api_key_warning"
            assert "Warning: Gemini API key not found or invalid" in result["response"]
            assert "Please set your GEMINI_API_KEY in the .env file" in result["response"]
            assert result["tool_calls_made"] == 0
            assert result["tool_results"] == []
            
            # Verify intent analysis
            intent_analysis = result.get("intent_analysis", {})
            assert intent_analysis["intent_type"] == "api_key_warning"
            assert intent_analysis["confidence"] == 1.0

    @pytest.mark.asyncio
    async def test_api_key_warning_when_key_invalid(self, agent, mock_project_context, mock_conversation_history):
        """Test that warning message is returned when API key is invalid."""
        # Mock the GeminiService to simulate invalid API key
        with patch.object(agent.gemini_service, 'is_api_key_valid', return_value=False):
            result = await agent.process_message(
                message="Create tasks for user authentication",
                project_id="test-project",
                project_context=mock_project_context,
                session_id="test-session",
                conversation_history=mock_conversation_history
            )
            
            # Verify the warning message is returned regardless of user intent
            assert result["type"] == "api_key_warning"
            assert "Warning: Gemini API key not found or invalid" in result["response"]
            assert "Please set your GEMINI_API_KEY in the .env file" in result["response"]

    @pytest.mark.asyncio
    async def test_normal_processing_when_key_valid(self, agent, mock_project_context, mock_conversation_history):
        """Test that normal processing continues when API key is valid."""
        # Mock the GeminiService to simulate valid API key
        with patch.object(agent.gemini_service, 'is_api_key_valid', return_value=True):
            # Mock the response path execution to return a normal response
            with patch.object(agent, '_select_and_execute_response_path') as mock_execute:
                mock_execute.return_value = {
                    "type": "discussion_response",
                    "response": "I can help you with your project!",
                    "tool_calls_made": 0,
                    "tool_results": [],
                    "intent_analysis": {
                        "intent_type": "pure_discussion",
                        "confidence": 0.8,
                        "reasoning": "User asked for help",
                        "needs_clarification": False,
                        "clarification_questions": [],
                        "accumulated_specs": {}
                    }
                }
                
                result = await agent.process_message(
                    message="Hello, can you help me with my project?",
                    project_id="test-project",
                    project_context=mock_project_context,
                    session_id="test-session",
                    conversation_history=mock_conversation_history
                )
                
                # Verify normal processing continues
                assert result["type"] == "discussion_response"
                assert "I can help you with your project!" in result["response"]
                assert result["intent_analysis"]["intent_type"] == "pure_discussion"

    def test_gemini_service_api_key_validation(self):
        """Test the GeminiService API key validation methods."""
        # Test with missing API key
        with patch.dict(os.environ, {}, clear=True):
            service = GeminiService()
            assert not service.is_api_key_valid()
        
        # Test with empty API key
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}, clear=True):
            service = GeminiService()
            assert not service.is_api_key_valid()
        
        # Test with short API key
        with patch.dict(os.environ, {"GEMINI_API_KEY": "short"}, clear=True):
            service = GeminiService()
            assert not service.is_api_key_valid()
        
        # Test with valid API key
        with patch.dict(os.environ, {"GEMINI_API_KEY": "valid_api_key_that_is_long_enough"}, clear=True):
            service = GeminiService()
            assert service.is_api_key_valid()

    def test_gemini_service_mock_mode(self):
        """Test that mock mode overrides API key validation."""
        # Test with valid API key but mock mode enabled
        with patch.dict(os.environ, {
            "GEMINI_API_KEY": "valid_api_key_that_is_long_enough",
            "SAMURAI_USE_MOCK_LLM": "1"
        }, clear=True):
            service = GeminiService()
            assert not service.is_api_key_valid()  # Should be False due to mock mode


if __name__ == "__main__":
    pytest.main([__file__])
