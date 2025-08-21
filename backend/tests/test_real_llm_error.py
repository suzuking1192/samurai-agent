import pytest
import asyncio
import os
import sys
import json

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.agent_tools import ExtractCodeContextTool
from services.gemini_service import GeminiService


class TestRealLLMError:
    """Test to replicate the real LLM error by calling the actual API"""
    
    def __init__(self):
        """Set up test fixtures"""
        self.agent_tools = ExtractCodeContextTool()
        self.gemini_service = GeminiService()
    
    @pytest.mark.asyncio
    async def test_real_llm_call_with_problematic_content(self):
        """Test calling the real LLM with content that might cause the error"""
        
        # Create a prompt that might trigger the problematic response
        problematic_prompt = """
You are an expert code analyzer. Given a user request and code content from multiple files, extract comprehensive and detailed 
information that would help answer the request. Your analysis should be thorough and include all relevant technical details, 
as this context will be used to generate high-quality responses to user queries.

User Request: test request

Code Content:
=== FILE: test.py ===
def test_function():
    pass

class TestClass:
    def __init__(self):
        pass

    def method_with_newlines(self):
        return {
            "key": "value",
            "nested": {
                "array": [
                    "item1",
                    "item2"
                ]
            }
        }

Instructions:
1. Analyze the code content in relation to the user request
2. Extract the most relevant code snippets and context
3. Provide a comprehensive and detailed analysis of how this code relates to the request, including all relevant technical details, patterns, and implementation specifics
4. If the code is not relevant to the request, indicate this clearly
5. Focus on providing maximum useful information - it's better to include more details than to miss important context
6. Consider the code's architecture, design patterns, data flow, error handling, and integration points

IMPORTANT: You must respond with ONLY a valid JSON object. Do not include any other text, explanations, or formatting outside the JSON.

Return a JSON object with:
- "relevance_score": 0-10 (how relevant this content is to the request)
- "context": A comprehensive and detailed analysis of the relevant code, including its purpose, functionality, key components, data structures, algorithms, dependencies, relationships with other parts of the codebase, and any important implementation details that would be useful for understanding and working with this code
- "relevant_code": The most relevant code snippets from this content (limit to 1000 characters)
- "file_path": The most relevant file path from this content

If the content is not relevant, set relevance_score to 0.

Example response format:
{
  "relevance_score": 8,
  "context": "This code implements...",
  "relevant_code": "def example_function():...",
  "file_path": "path/to/file.py"
}
"""
        
        try:
            # Call the real LLM
            response = await self.gemini_service.chat_with_system_prompt("", problematic_prompt)
            
            print(f"Raw LLM response: {repr(response)}")
            print(f"Response length: {len(response)}")
            
            # Check if the response contains the problematic pattern
            if '\n  "relevance_score"' in response:
                print("Found the problematic pattern in the response!")
                pattern = '\n  "relevance_score"'
            print(f"Pattern location: {response.find(pattern)}")
            
            # Try to parse the response
            try:
                parsed = json.loads(response)
                print(f"JSON parsing succeeded: {parsed}")
            except json.JSONDecodeError as e:
                print(f"JSON parsing failed: {e}")
                print(f"Error position: {e.pos}")
                print(f"Error line: {e.lineno}")
                print(f"Error column: {e.colno}")
                
                # Show the problematic part of the response
                start = max(0, e.pos - 50)
                end = min(len(response), e.pos + 50)
                print(f"Problematic section: {repr(response[start:end])}")
            
        except Exception as e:
            print(f"LLM call exception: {e}")
            print(f"Exception type: {type(e)}")
            print(f"Exception args: {e.args}")
    
    @pytest.mark.asyncio
    async def test_extract_code_context_with_real_llm(self):
        """Test the actual _extract_code_context method with real LLM calls"""
        
        # Create a simple test file
        test_file_content = """
def test_function():
    pass

class TestClass:
    def __init__(self):
        pass

    def method_with_newlines(self):
        return {
            "key": "value",
            "nested": {
                "array": [
                    "item1",
                    "item2"
                ]
            }
        }
"""
        
        # Write test file
        test_file_path = "test_file.py"
        with open(test_file_path, "w") as f:
            f.write(test_file_content)
        
        try:
            # Call the actual method
            result = await self.agent_tools._extract_code_context(
                {test_file_path: ["test_function"]}, 
                "test request", 
                1
            )
            
            print(f"Method result: {result}")
            
            if not result.get("success", True):
                print(f"Error occurred: {result.get('error', 'No error field')}")
                print(f"Message: {result.get('message', 'No message field')}")
                
                # Check if this is the error we're looking for
                error_str = result.get("error", "")
                if "relevance_score" in error_str:
                    print("Found the relevance_score error!")
                    print(f"Error string: {repr(error_str)}")
            
        except Exception as e:
            print(f"Method exception: {e}")
            print(f"Exception type: {type(e)}")
            print(f"Exception args: {e.args}")
            
            # Check if this is the error we're looking for
            if "relevance_score" in str(e):
                print("Found the relevance_score error in exception!")
                print(f"Exception string: {repr(str(e))}")
        
        finally:
            # Clean up test file
            if os.path.exists(test_file_path):
                os.remove(test_file_path)


if __name__ == "__main__":
    # Run the tests
    test_instance = TestRealLLMError()
    
    print("Testing real LLM call with problematic content...")
    asyncio.run(test_instance.test_real_llm_call_with_problematic_content())
    
    print("\nTesting extract code context with real LLM...")
    asyncio.run(test_instance.test_extract_code_context_with_real_llm())
