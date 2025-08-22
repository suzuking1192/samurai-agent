import google.genai as genai
import os
import logging
import asyncio
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        # Configure Gemini with graceful fallback for local/dev/test
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.use_mock = os.getenv("SAMURAI_USE_MOCK_LLM") == "1"
        self.is_key_valid = self._validate_api_key()
        
        # Load cost configuration
        self.input_cost_per_m_tokens = float(os.getenv("GEMINI_INPUT_COST_PER_M_TOKENS", "0.30"))
        self.output_cost_per_m_tokens = float(os.getenv("GEMINI_OUTPUT_COST_PER_M_TOKENS", "2.50"))

        if self.use_mock:
            logger.warning("SAMURAI_USE_MOCK_LLM=1 detected. Using mock LLM model for responses.")
            
            class _DummyResponse:
                def __init__(self, text: str):
                    self.text = text
                    self.usage_metadata = None

            class _DummyClient:
                def models(self):
                    class _DummyModels:
                        def generate_content(self, model: str, contents: list):
                            # Return a fast, deterministic mock response
                            preview = contents[0]["parts"][0]["text"] if contents and contents[0].get("parts") else ""
                            if len(preview) > 120:
                                preview = preview[:120] + "..."
                            return _DummyResponse(text=f"[mock-ai] {preview if preview else 'OK'}")
                    return _DummyModels()

            self.client = _DummyClient()
            logger.info("Gemini service initialized with mock client")
        elif self.is_key_valid:
            self.client = genai.Client(api_key=self.api_key)
            logger.info("Gemini service initialized successfully")
        else:
            logger.warning("GEMINI_API_KEY not set or invalid. Service will return warning messages.")
            self.client = None

    def _validate_api_key(self) -> bool:
        """Check if the API key is valid and available."""
        return bool(self.api_key and len(self.api_key) > 10)

    def is_api_key_valid(self) -> bool:
        """Return whether the API key is valid and the service can make real API calls."""
        return self.is_key_valid and not self.use_mock

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
                model="gemini-2.5-flash",
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
            self._save_llm_call_record(input_tokens, output_tokens, cost, project_id)
            
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
                model="gemini-2.5-flash",
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
            self._save_llm_call_record(input_tokens, output_tokens, cost, project_id)
            
            return response.text
            
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return f"I'm having trouble processing that request. Please try again."

    # Intentionally keep LLM surface minimal here; orchestration lives in dedicated services.

    def _calculate_llm_cost(self, input_tokens: int, output_tokens: int) -> float:
        """
        Calculate the cost for an LLM call based on token usage.
        
        Args:
            input_tokens: Number of input tokens used
            output_tokens: Number of output tokens generated
            
        Returns:
            Calculated cost in dollars
        """
        input_cost = (input_tokens / 1_000_000) * self.input_cost_per_m_tokens
        output_cost = (output_tokens / 1_000_000) * self.output_cost_per_m_tokens
        return input_cost + output_cost
    
    def _save_llm_call_record(self, input_tokens: int, output_tokens: int, cost: float, project_id: str = None) -> None:
        """
        Save LLM call record to daily usage file.
        
        Args:
            input_tokens: Number of input tokens used
            output_tokens: Number of output tokens generated  
            cost: Calculated cost for the call
            project_id: Project ID if available
        """
        try:
            # Save record even if token counts are 0 (for tracking purposes)
            # This allows us to track usage even when the API doesn't provide token metadata
            from models import LLMCallRecord
            from services.file_service import file_service
            
            record = LLMCallRecord(
                timestamp=datetime.now(),
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost=cost,
                project_id=project_id or "unknown",
                model_name="gemini-2.5-flash"
            )
            
            file_service.save_llm_call_record(record)
            logger.debug(f"Saved LLM call record: {input_tokens} input, {output_tokens} output, ${cost:.6f}")
        except Exception as e:
            logger.error(f"Failed to save LLM call record: {e}")
            # Don't raise - cost tracking failure shouldn't break the main functionality

    def _safe_ai_call(self, prompt: str) -> str:
        """Make AI call with error handling (synchronous)"""
        # Check if API key is invalid (not mock mode)
        if not self.is_key_valid and not self.use_mock:
            return "Warning: Gemini API key not found or invalid. Please set your GEMINI_API_KEY in the .env file to enable full functionality."
        
        try:
            contents = [{"parts": [{"text": prompt}]}]
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
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