"""
Integration tests for LLM provider functionality.
"""
import pytest
import os
import asyncio
from unittest.mock import patch, MagicMock
from services.llm_provider_service import llm_provider_service
from services.openai_service import OpenAIService
from services.claude_service import ClaudeService
from services.gemini_service import GeminiService


class TestLLMProviderIntegration:
    """Test LLM provider integration functionality."""
    
    def test_llm_provider_service_initialization(self):
        """Test that LLM provider service initializes correctly."""
        assert llm_provider_service is not None
        assert hasattr(llm_provider_service, 'providers')
        assert 'gemini' in llm_provider_service.providers
        assert 'openai' in llm_provider_service.providers
        assert 'claude' in llm_provider_service.providers
    
    def test_get_available_llm_models_with_mock_keys(self):
        """Test getting available models with mock API keys."""
        with patch.dict(os.environ, {
            'GEMINI_API_KEY': 'mock_gemini_key_123456789',
            'OPENAI_API_KEY': 'mock_openai_key_123456789',
            'CLAUDE_API_KEY': 'mock_claude_key_123456789',
            'GEMINI_MODELS': 'gemini-2.5-flash,gemini-2.5-pro',
            'OPENAI_MODELS': 'gpt-4o,gpt-4o-mini',
            'CLAUDE_MODELS': 'claude-3-5-sonnet-20241022,claude-3-5-haiku-20241022'
        }):
            # Reinitialize the service with mock keys
            from services.llm_provider_service import LLMProviderService
            test_service = LLMProviderService()
            
            models = test_service.get_available_llm_models("test-project")
            
            # Should have models from all providers
            assert len(models) > 0
            
            # Check that models have the correct format
            for model in models:
                assert 'id' in model
                assert 'name' in model
                assert 'provider' in model
                assert '-' in model['id']  # Should be in format "provider-model"
    
    def test_get_llm_service_by_model_id(self):
        """Test getting LLM service by model ID."""
        with patch.dict(os.environ, {
            'GEMINI_API_KEY': 'mock_gemini_key_123456789',
            'GEMINI_MODELS': 'gemini-2.5-flash,gemini-2.5-pro'
        }):
            from services.llm_provider_service import LLMProviderService
            test_service = LLMProviderService()
            
            # Test valid model ID
            service = test_service.get_llm_service_by_model_id('gemini-gemini-2.5-flash')
            assert service is not None
            assert hasattr(service, 'chat')
            assert hasattr(service, 'chat_with_system_prompt')
            
            # Test invalid model ID
            service = test_service.get_llm_service_by_model_id('invalid-model')
            assert service is None
    
    def test_openai_service_initialization(self):
        """Test OpenAI service initialization."""
        with patch.dict(os.environ, {
            'OPENAI_API_KEY': 'mock_openai_key_123456789',
            'OPENAI_MODELS': 'gpt-4o,gpt-4o-mini',
            'OPENAI_INPUT_COST_PER_M_TOKENS': '2.50',
            'OPENAI_OUTPUT_COST_PER_M_TOKENS': '10.00'
        }):
            service = OpenAIService()
            
            assert service.provider_name == "OpenAI"
            assert service.is_key_valid
            assert len(service.available_models) == 2
            assert service.default_model == "gpt-4o"
            assert service.input_cost_per_m_tokens == 2.50
            assert service.output_cost_per_m_tokens == 10.00
    
    def test_claude_service_initialization(self):
        """Test Claude service initialization."""
        with patch.dict(os.environ, {
            'CLAUDE_API_KEY': 'mock_claude_key_123456789',
            'CLAUDE_MODELS': 'claude-3-5-sonnet-20241022,claude-3-5-haiku-20241022',
            'CLAUDE_INPUT_COST_PER_M_TOKENS': '3.00',
            'CLAUDE_OUTPUT_COST_PER_M_TOKENS': '15.00'
        }):
            service = ClaudeService()
            
            assert service.provider_name == "Claude"
            assert service.is_key_valid
            assert len(service.available_models) == 2
            assert service.default_model == "claude-3-5-sonnet-20241022"
            assert service.input_cost_per_m_tokens == 3.00
            assert service.output_cost_per_m_tokens == 15.00
    
    def test_gemini_service_initialization(self):
        """Test Gemini service initialization."""
        with patch.dict(os.environ, {
            'GEMINI_API_KEY': 'mock_gemini_key_123456789',
            'GEMINI_MODELS': 'gemini-2.5-flash,gemini-2.5-pro',
            'GEMINI_INPUT_COST_PER_M_TOKENS': '0.30',
            'GEMINI_OUTPUT_COST_PER_M_TOKENS': '2.50'
        }):
            service = GeminiService()
            
            assert service.provider_name == "Gemini"
            assert service.is_key_valid
            assert len(service.available_models) == 2
            assert service.default_model == "gemini-2.5-flash"
            assert service.input_cost_per_m_tokens == 0.30
            assert service.output_cost_per_m_tokens == 2.50
    
    @pytest.mark.asyncio
    async def test_mock_llm_calls(self):
        """Test that mock LLM calls work correctly."""
        with patch.dict(os.environ, {
            'SAMURAI_USE_MOCK_LLM': '1',
            'OPENAI_API_KEY': 'mock_key',
            'OPENAI_MODELS': 'gpt-4o'
        }):
            service = OpenAIService()
            
            # Test chat method
            response = await service.chat("Hello, world!")
            assert response.startswith("[mock-openai]")
            
            # Test chat_with_system_prompt method
            response = await service.chat_with_system_prompt("Hello", "You are a helpful assistant")
            assert response.startswith("[mock-openai]")
    
    def test_api_key_validation(self):
        """Test API key validation logic."""
        # Test valid key
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'valid_key_123456789'}):
            service = OpenAIService()
            assert service._validate_api_key() is True
        
        # Test invalid key (too short)
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'short'}):
            service = OpenAIService()
            assert service._validate_api_key() is False
        
        # Test missing key
        with patch.dict(os.environ, {}, clear=True):
            service = OpenAIService()
            assert service._validate_api_key() is False
    
    def test_cost_calculation(self):
        """Test cost calculation functionality."""
        with patch.dict(os.environ, {
            'OPENAI_API_KEY': 'mock_key',
            'OPENAI_MODELS': 'gpt-4o',
            'OPENAI_INPUT_COST_PER_M_TOKENS': '2.50',
            'OPENAI_OUTPUT_COST_PER_M_TOKENS': '10.00'
        }):
            service = OpenAIService()
            
            # Test cost calculation
            cost = service._calculate_llm_cost(1000, 500)  # 1K input, 500 output tokens
            expected_cost = (1000 / 1_000_000) * 2.50 + (500 / 1_000_000) * 10.00
            assert abs(cost - expected_cost) < 0.0001


if __name__ == "__main__":
    pytest.main([__file__])
