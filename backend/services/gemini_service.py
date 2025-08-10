import google.generativeai as genai
import os
import logging
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        # Configure Gemini with graceful fallback for local/dev/test
        api_key = os.getenv("GEMINI_API_KEY")
        use_mock = os.getenv("SAMURAI_USE_MOCK_LLM") == "1"

        if not api_key or use_mock:
            if use_mock:
                logger.warning("SAMURAI_USE_MOCK_LLM=1 detected. Using mock LLM model for responses.")
            else:
                logger.warning("GEMINI_API_KEY not set. Falling back to mock LLM model for local/testing.")

            class _DummyResponse:
                def __init__(self, text: str):
                    self.text = text

            class _DummyModel:
                def generate_content(self, prompt: str):
                    # Return a fast, deterministic mock response
                    preview = (prompt or "").strip()
                    if len(preview) > 120:
                        preview = preview[:120] + "..."
                    return _DummyResponse(text=f"[mock-ai] {preview if preview else 'OK'}")

            self.model = _DummyModel()
            logger.info("Gemini service initialized with mock model")
        else:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
            logger.info("Gemini service initialized successfully")

    async def chat(self, message: str, context: str = "") -> str:
        """Simple chat with optional context"""
        try:
            if context:
                full_prompt = f"Context: {context}\n\nUser: {message}"
            else:
                full_prompt = message
                
            # Offload blocking SDK call to a background thread to avoid blocking the event loop
            response = await asyncio.to_thread(self.model.generate_content, full_prompt)
            return response.text
            
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return f"I'm having trouble processing that request. Please try again."

    async def chat_with_system_prompt(self, message: str, system_prompt: str) -> str:
        """Chat with a custom system prompt"""
        try:
            full_prompt = f"{system_prompt}\n\nUser: {message}"
            # Offload blocking SDK call to a background thread to avoid blocking the event loop
            response = await asyncio.to_thread(self.model.generate_content, full_prompt)
            return response.text
            
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return f"I'm having trouble processing that request. Please try again."

    # Intentionally keep LLM surface minimal here; orchestration lives in dedicated services.

    def _safe_ai_call(self, prompt: str) -> str:
        """Make AI call with error handling (synchronous)"""
        try:
            response = self.model.generate_content(prompt)
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