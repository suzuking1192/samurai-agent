import os
import google.generativeai as genai
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class GeminiService:
    """Service for interacting with Google Gemini AI"""
    
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-pro')
    
    async def generate_response(self, prompt: str) -> str:
        """
        Generate a response from Gemini AI
        
        Args:
            prompt: The prompt to send to the AI
            
        Returns:
            AI generated response as string
        """
        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            # TODO: Add proper error handling and logging
            raise Exception(f"Error generating Gemini response: {str(e)}")
    
    async def generate_response_with_context(self, prompt: str, context: str) -> str:
        """
        Generate a response with additional context
        
        Args:
            prompt: The main prompt
            context: Additional context information
            
        Returns:
            AI generated response as string
        """
        try:
            full_prompt = f"Context: {context}\n\nPrompt: {prompt}"
            response = self.model.generate_content(full_prompt)
            return response.text
        except Exception as e:
            # TODO: Add proper error handling and logging
            raise Exception(f"Error generating Gemini response with context: {str(e)}")
    
    async def generate_structured_response(self, prompt: str, structure: str) -> str:
        """
        Generate a response with specific structure requirements
        
        Args:
            prompt: The prompt to send to the AI
            structure: Description of the required response structure
            
        Returns:
            AI generated response following the specified structure
        """
        try:
            structured_prompt = f"{prompt}\n\nPlease respond in the following structure:\n{structure}"
            response = self.model.generate_content(structured_prompt)
            return response.text
        except Exception as e:
            # TODO: Add proper error handling and logging
            raise Exception(f"Error generating structured response: {str(e)}")
    
    def validate_api_key(self) -> bool:
        """
        Validate that the API key is working
        
        Returns:
            True if API key is valid, False otherwise
        """
        try:
            test_response = self.model.generate_content("Hello")
            return test_response.text is not None
        except Exception:
            return False 