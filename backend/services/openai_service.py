"""
OpenAI LLM service implementation.
"""
import asyncio
import logging
from typing import Optional
from openai import AsyncOpenAI
from .llm_abstract_service import AbstractLLMService

logger = logging.getLogger(__name__)


class OpenAIService(AbstractLLMService):
    """
    OpenAI LLM service implementation.
    """
    
    def __init__(self):
        """Initialize the OpenAI service."""
        super().__init__(
            provider_name="OpenAI",
            api_key_env_var="OPENAI_API_KEY",
            models_env_var="OPENAI_MODELS",
            input_cost_env_var="OPENAI_INPUT_COST_PER_M_TOKENS",
            output_cost_env_var="OPENAI_OUTPUT_COST_PER_M_TOKENS"
        )
    
    def _initialize_client(self):
        """Initialize the OpenAI client."""
        if self.use_mock:
            return self._create_mock_client()
        elif self.is_key_valid:
            return AsyncOpenAI(api_key=self.api_key)
        else:
            return None
    
    def _create_mock_client(self):
        """Create a mock OpenAI client for testing."""
        class _DummyOpenAIClient:
            def __init__(self, service):
                self.service = service
                self.chat = _DummyChat(service)
        
        class _DummyChat:
            def __init__(self, service):
                self.service = service
                self.completions = _DummyCompletions(service)
        
        class _DummyCompletions:
            def __init__(self, service):
                self.service = service
            
            async def create(self, **kwargs):
                class _DummyResponse:
                    def __init__(self, service, message):
                        self.choices = [_DummyChoice(service, message)]
                        self.usage = _DummyUsage()
                
                class _DummyChoice:
                    def __init__(self, service, message):
                        self.message = _DummyMessage(service, message)
                
                class _DummyMessage:
                    def __init__(self, service, message):
                        self.content = service._create_mock_response(message)
                
                class _DummyUsage:
                    def __init__(self):
                        self.prompt_tokens = 0
                        self.completion_tokens = 0
                        self.total_tokens = 0
                
                messages = kwargs.get('messages', [])
                user_message = ""
                for msg in messages:
                    if msg.get('role') == 'user':
                        user_message = msg.get('content', '')
                        break
                
                return _DummyResponse(self.service, user_message)
        
        return _DummyOpenAIClient(self)
    
    async def chat(self, message: str, context: str = "", project_id: str = None) -> str:
        """
        Chat with OpenAI. Automatically tracks and saves cost information.
        
        Args:
            message: User message
            context: Optional context string
            project_id: Optional project ID for cost tracking
            
        Returns:
            Response text string
        """
        # Check if API key is invalid (not mock mode)
        if not self.is_key_valid and not self.use_mock:
            return f"Warning: OpenAI API key not found or invalid. Please set your OPENAI_API_KEY in the .env file to enable full functionality."
        
        try:
            # Prepare messages
            messages = []
            if context:
                messages.append({"role": "system", "content": f"Context: {context}"})
            messages.append({"role": "user", "content": message})
            
            # Make API call
            response = await self.client.chat.completions.create(
                model=self.default_model,
                messages=messages,
            )
            
            # Extract response and token usage
            response_text = response.choices[0].message.content
            input_tokens = response.usage.prompt_tokens
            output_tokens = response.usage.completion_tokens
            cost = self._calculate_llm_cost(input_tokens, output_tokens)
            
            logger.debug(f"OpenAI token usage - Input: {input_tokens}, Output: {output_tokens}, Cost: ${cost:.6f}")
            
            # Automatically save cost tracking
            self._save_llm_call_record(input_tokens, output_tokens, cost, project_id, self.default_model)
            
            return response_text
            
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
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
            return f"Warning: OpenAI API key not found or invalid. Please set your OPENAI_API_KEY in the .env file to enable full functionality."
        
        try:
            # Prepare messages
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ]
            
            # Make API call
            response = await self.client.chat.completions.create(
                model=self.default_model,
                messages=messages,
            )
            
            # Extract response and token usage
            response_text = response.choices[0].message.content
            input_tokens = response.usage.prompt_tokens
            output_tokens = response.usage.completion_tokens
            cost = self._calculate_llm_cost(input_tokens, output_tokens)
            
            logger.debug(f"OpenAI token usage - Input: {input_tokens}, Output: {output_tokens}, Cost: ${cost:.6f}")
            
            # Automatically save cost tracking
            self._save_llm_call_record(input_tokens, output_tokens, cost, project_id, self.default_model)
            
            return response_text
            
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return f"I'm having trouble processing that request. Please try again."
    
    async def chat_with_model(self, message: str, model: str, context: str = "", project_id: str = None) -> str:
        """
        Chat with a specific OpenAI model.
        
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
            return f"Warning: OpenAI API key not found or invalid. Please set your OPENAI_API_KEY in the .env file to enable full functionality."
        
        try:
            # Prepare messages
            messages = []
            if context:
                messages.append({"role": "system", "content": f"Context: {context}"})
            messages.append({"role": "user", "content": message})
            
            # Make API call
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,
            )
            
            # Extract response and token usage
            response_text = response.choices[0].message.content
            input_tokens = response.usage.prompt_tokens
            output_tokens = response.usage.completion_tokens
            cost = self._calculate_llm_cost(input_tokens, output_tokens)
            
            logger.debug(f"OpenAI token usage - Input: {input_tokens}, Output: {output_tokens}, Cost: ${cost:.6f}")
            
            # Automatically save cost tracking
            self._save_llm_call_record(input_tokens, output_tokens, cost, project_id, model)
            
            return response_text
            
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return f"I'm having trouble processing that request. Please try again."
