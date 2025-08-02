import google.generativeai as genai
import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        # Configure Gemini
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
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
                
            response = self.model.generate_content(full_prompt)
            return response.text
            
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return f"I'm having trouble processing that request. Please try again."

    async def chat_with_system_prompt(self, message: str, system_prompt: str) -> str:
        """Chat with a custom system prompt"""
        try:
            full_prompt = f"{system_prompt}\n\nUser: {message}"
            response = self.model.generate_content(full_prompt)
            return response.text
            
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return f"I'm having trouble processing that request. Please try again."

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