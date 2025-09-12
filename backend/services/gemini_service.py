import google.genai as genai
import os
import logging
import asyncio
from datetime import datetime
from dotenv import load_dotenv
from .llm_abstract_service import AbstractLLMService

# Load environment variables
load_dotenv()

# Setup logging
logger = logging.getLogger(__name__)

class GeminiService(AbstractLLMService):
    def __init__(self):
        """Initialize the Gemini service."""
        super().__init__(
            provider_name="Gemini",
            api_key_env_var="GEMINI_API_KEY",
            models_env_var="GEMINI_MODELS",
            input_cost_env_var="GEMINI_INPUT_COST_PER_M_TOKENS",
            output_cost_env_var="GEMINI_OUTPUT_COST_PER_M_TOKENS"
        )

    def _initialize_client(self):
        """Initialize the Gemini client."""
        if self.use_mock:
            return self._create_mock_client()
        elif self.is_key_valid:
            return genai.Client(api_key=self.api_key)
        else:
            return None
    
    def _create_mock_client(self):
        """Create a mock Gemini client for testing."""
        class _DummyResponse:
            def __init__(self, text: str):
                self.text = text
                self.usage_metadata = None

        class _DummyClient:
            def __init__(self, service):
                self.service = service
            
            def models(self):
                class _DummyModels:
                    def __init__(self, service):
                        self.service = service
                    
                    def generate_content(self, model: str, contents: list):
                        # Return a fast, deterministic mock response
                        preview = contents[0]["parts"][0]["text"] if contents and contents[0].get("parts") else ""
                        if len(preview) > 120:
                            preview = preview[:120] + "..."
                        return _DummyResponse(text=self.service._create_mock_response(preview))
                return _DummyModels(self.service)

        return _DummyClient(self)

    async def chat(self, message: str, context: str = "", project_id: str = None) -> str:
        """
        Chat with Gemini. Automatically tracks and saves cost information.
        
        Args:
            message: User message
            context: Optional context string
            project_id: Optional project ID for cost tracking
            
        Returns:
            Response text string
        """
        # Check if API key is invalid (not mock mode)
        if not self.is_key_valid and not self.use_mock:
            return "Warning: Gemini API key not found or invalid. Please set your GEMINI_API_KEY in the .env file to enable full functionality."
        
        try:
            if context:
                full_prompt = f"Context: {context}\n\nUser: {message}"
            else:
                full_prompt = message
                
            # Prepare content for the new API
            contents = [{"parts": [{"text": full_prompt}]}]
            
            # Offload blocking SDK call to a background thread to avoid blocking the event loop
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.default_model,
                contents=contents
            )
            
            # Extract token usage and calculate cost
            input_tokens = 0
            output_tokens = 0
            cost = 0.0
            
            # Extract token count from the new google-genai library
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                input_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0)
                output_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0)
                cost = self._calculate_llm_cost(input_tokens, output_tokens)
                logger.debug(f"Token usage - Input: {input_tokens}, Output: {output_tokens}, Cost: ${cost:.6f}")
            
            # Automatically save cost tracking
            self._save_llm_call_record(input_tokens, output_tokens, cost, project_id, self.default_model)
            
            return response.text
            
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
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
            return "Warning: Gemini API key not found or invalid. Please set your GEMINI_API_KEY in the .env file to enable full functionality."
        
        try:
            full_prompt = system_prompt + "\n\nUser: " + message
            
            # Prepare content for the new API
            contents = [{"parts": [{"text": full_prompt}]}]
            
            # Offload blocking SDK call to a background thread to avoid blocking the event loop
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.default_model,
                contents=contents
            )
            
            # Extract token usage and calculate cost
            input_tokens = 0
            output_tokens = 0
            cost = 0.0
            
            # Extract token count from the new google-genai library
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                input_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0)
                output_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0)
                cost = self._calculate_llm_cost(input_tokens, output_tokens)
                logger.debug(f"Token usage - Input: {input_tokens}, Output: {output_tokens}, Cost: ${cost:.6f}")
            
            # Automatically save cost tracking
            self._save_llm_call_record(input_tokens, output_tokens, cost, project_id, self.default_model)
            
            return response.text
            
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return f"I'm having trouble processing that request. Please try again."

    # Intentionally keep LLM surface minimal here; orchestration lives in dedicated services.

    def _safe_ai_call(self, prompt: str) -> str:
        """Make AI call with error handling (synchronous)"""
        # Check if API key is invalid (not mock mode)
        if not self.is_key_valid and not self.use_mock:
            return "Warning: Gemini API key not found or invalid. Please set your GEMINI_API_KEY in the .env file to enable full functionality."
        
        try:
            contents = [{"parts": [{"text": prompt}]}]
            response = self.client.models.generate_content(
                model=self.default_model,
                contents=contents
            )
            return response.text
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return f"Error: {str(e)}"


async def test_gemini_service():
    """Simple test function"""
    service = GeminiService()
    
    # Test basic chat
    response = await service.chat("Hello! Can you help me with coding?")
    print("Basic chat:", response)
    
    # Test with context
    context = "I'm building a todo app with React and FastAPI"
    response = await service.chat("How should I structure my project?", context)
    print("With context:", response)
    
    # Test with system prompt
    system_prompt = "You are a helpful coding assistant. Give concise, practical advice."
    response = await service.chat_with_system_prompt("Explain REST APIs", system_prompt)
    print("With system prompt:", response)


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_gemini_service()) 