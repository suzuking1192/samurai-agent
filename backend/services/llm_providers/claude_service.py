"""
Claude LLM service implementation.
"""
import asyncio
import logging
from typing import Optional
from anthropic import AsyncAnthropic
from .llm_abstract_service import AbstractLLMService

logger = logging.getLogger(__name__)


class ClaudeService(AbstractLLMService):
    """
    Claude LLM service implementation.
    """
    
    def __init__(self):
        """Initialize the Claude service."""
        super().__init__(
            provider_name="Claude",
            api_key_env_var="CLAUDE_API_KEY",
            models_env_var="CLAUDE_MODELS",
            input_cost_env_var="CLAUDE_INPUT_COST_PER_M_TOKENS",
            output_cost_env_var="CLAUDE_OUTPUT_COST_PER_M_TOKENS"
        )
    
    def _initialize_client(self):
        """Initialize the Claude client."""
        if self.use_mock:
            return self._create_mock_client()
        elif self.is_key_valid:
            try:
                # Try to initialize with minimal parameters to avoid compatibility issues
                import os
                # Set the API key as environment variable and initialize without explicit api_key parameter
                os.environ['ANTHROPIC_API_KEY'] = self.api_key
                return AsyncAnthropic()
            except Exception as e:
                if "proxies" in str(e) or "unexpected keyword argument" in str(e):
                    logger.warning(f"Claude client initialization failed due to version compatibility issue: {e}")
                    logger.warning("This is likely due to a version mismatch between anthropic and httpx libraries.")
                    logger.warning("Please update your dependencies or use a different LLM provider.")
                    # Set use_mock to True so the service knows it's using mock
                    self.use_mock = True
                    return self._create_mock_client()
                else:
                    logger.error(f"Claude client initialization failed: {e}. Using mock client.")
                    return self._create_mock_client()
        else:
            return None
    
    def _create_mock_client(self):
        """Create a mock Claude client for testing."""
        class _DummyClaudeClient:
            def __init__(self, service):
                self.service = service
                self.messages = _DummyMessages(service)
        
        class _DummyMessages:
            def __init__(self, service):
                self.service = service
            
            async def create(self, **kwargs):
                class _DummyResponse:
                    def __init__(self, service, message):
                        self.content = [_DummyContent(service, message)]
                        self.usage = _DummyUsage()
                
                class _DummyContent:
                    def __init__(self, service, message):
                        self.text = service._create_mock_response(message)
                
                class _DummyUsage:
                    def __init__(self):
                        self.input_tokens = 0
                        self.output_tokens = 0
                
                messages = kwargs.get('messages', [])
                user_message = ""
                for msg in messages:
                    if msg.get('role') == 'user':
                        user_message = msg.get('content', '')
                        break
                
                return _DummyResponse(self.service, user_message)
        
        return _DummyClaudeClient(self)
    
    async def chat(self, message: str, context: str = "", project_id: str = None) -> str:
        """
        Chat with Claude. Automatically tracks and saves cost information.
        
        Args:
            message: User message
            context: Optional context string
            project_id: Optional project ID for cost tracking
            
        Returns:
            Response text string
        """
        # Check if API key is invalid (not mock mode)
        if not self.is_key_valid and not self.use_mock:
            return f"Warning: Claude API key not found or invalid. Please set your CLAUDE_API_KEY in the .env file to enable full functionality."
        
        try:
            # Prepare messages
            messages = []
            if context:
                messages.append({"role": "user", "content": f"Context: {context}\n\nUser: {message}"})
            else:
                messages.append({"role": "user", "content": message})
            
            # Make API call with streaming for large max_tokens
            response_text = ""
            input_tokens = 0
            output_tokens = 0
            
            async with self.client.messages.stream(
                model=self.default_model,
                messages=messages,
                max_tokens=4096
            ) as stream:
                async for chunk in stream:
                    if chunk.type == "content_block_delta" and chunk.delta.type == "text_delta":
                        response_text += chunk.delta.text
                    elif chunk.type == "message_stop":
                        # Extract usage information from the final chunk
                        if hasattr(chunk, 'usage') and chunk.usage:
                            input_tokens = chunk.usage.input_tokens
                            output_tokens = chunk.usage.output_tokens
            
            # Calculate cost
            cost = self._calculate_llm_cost(input_tokens, output_tokens)
            
            logger.debug(f"Claude token usage - Input: {input_tokens}, Output: {output_tokens}, Cost: ${cost:.6f}")
            
            # Automatically save cost tracking
            self._save_llm_call_record(input_tokens, output_tokens, cost, project_id, self.default_model)
            
            return response_text
            
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            return f"I'm having trouble processing that request. Please try again."
    
    async def chat_with_system_prompt(self, message: str, system_prompt: str, project_id: str = None) -> str:
        """
        Chat with a custom system prompt. Automatically tracks and saves cost information.
        
        Args:
            message: User message
            system_prompt: System prompt to guide the conversation
            project_id: Optional project ID for cost tracking
            
        Returns:
            Response text string
        """
        # Check if API key is invalid (not mock mode)
        if not self.is_key_valid and not self.use_mock:
            return f"Warning: Claude API key not found or invalid. Please set your CLAUDE_API_KEY in the .env file to enable full functionality."
        
        try:
            # Prepare messages
            messages = [{"role": "user", "content": message}]
            
            # Make API call
            response = await self.client.messages.create(
                model=self.default_model,
                messages=messages,
                system=system_prompt,
                max_tokens=4096
            )
            
            # Extract response and token usage
            response_text = response.content[0].text
            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            cost = self._calculate_llm_cost(input_tokens, output_tokens)
            
            logger.debug(f"Claude token usage - Input: {input_tokens}, Output: {output_tokens}, Cost: ${cost:.6f}")
            
            # Automatically save cost tracking
            self._save_llm_call_record(input_tokens, output_tokens, cost, project_id, self.default_model)
            
            return response_text
            
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            return f"I'm having trouble processing that request. Please try again."
    
    async def chat_with_model(self, message: str, model: str, context: str = "", project_id: str = None) -> str:
        """
        Chat with a specific Claude model.
        
        Args:
            message: User message
            model: Specific model to use
            context: Optional context string
            project_id: Optional project ID for cost tracking
            
        Returns:
            Response text string
        """
        # Check if API key is invalid (not mock mode)
        if not self.is_key_valid and not self.use_mock:
            return f"Warning: Claude API key not found or invalid. Please set your CLAUDE_API_KEY in the .env file to enable full functionality."
        
        try:
            # Prepare messages
            messages = []
            if context:
                messages.append({"role": "user", "content": f"Context: {context}\n\nUser: {message}"})
            else:
                messages.append({"role": "user", "content": message})
            
            # Make API call
            response = await self.client.messages.create(
                model=model,
                messages=messages,
                max_tokens=4096
            )
            
            # Extract response and token usage
            response_text = response.content[0].text
            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            cost = self._calculate_llm_cost(input_tokens, output_tokens)
            
            logger.debug(f"Claude token usage - Input: {input_tokens}, Output: {output_tokens}, Cost: ${cost:.6f}")
            
            # Automatically save cost tracking
            self._save_llm_call_record(input_tokens, output_tokens, cost, project_id, model)
            
            return response_text
            
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            return f"I'm having trouble processing that request. Please try again."

    def _create_mock_response(self, message: str) -> str:
        """Create a mock response for testing purposes."""
        return f"I'm currently using a mock Claude client due to a version compatibility issue between the anthropic and httpx libraries. Please update your dependencies or use a different LLM provider. Your message was: {message}"
