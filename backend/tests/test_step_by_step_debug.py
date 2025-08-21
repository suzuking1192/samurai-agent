import pytest
import asyncio
import os
import sys
import json
import re

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.agent_tools import ExtractCodeContextTool
from services.gemini_service import GeminiService
from services.utils import parse_ai_json_response, clean_ai_json_response


class TestStepByStepDebug:
    """Test to debug the issue step by step"""
    
    def __init__(self):
        """Set up test fixtures"""
        self.agent_tools = ExtractCodeContextTool()
        self.gemini_service = GeminiService()
    
    @pytest.mark.asyncio
    async def test_step_by_step_debug(self):
        """Test the exact flow that's causing the error"""
        
        # Step 1: Get the exact LLM response
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
            # Step 1: Get LLM response
            response = await self.gemini_service.chat_with_system_prompt("", problematic_prompt)
            print(f"Step 1: LLM Response")
            print(f"Response length: {len(response)}")
            print(f"Response starts with: {repr(response[:100])}")
            print(f"Response ends with: {repr(response[-100])}")
            
            # Step 2: Check for the problematic pattern
            if '\n  "relevance_score"' in response:
                print(f"Step 2: Found problematic pattern!")
                pattern = '\n  "relevance_score"'
                print(f"Pattern location: {response.find(pattern)}")
                print(f"Context around pattern: {repr(response[response.find(pattern)-20:response.find(pattern)+30])}")
            else:
                print(f"Step 2: No problematic pattern found")
            
            # Step 3: Try to parse with parse_ai_json_response
            print(f"\nStep 3: Testing parse_ai_json_response")
            try:
                parsed_result = parse_ai_json_response(response, ["relevance_score", "context", "relevant_code", "file_path"])
                print(f"Parse result: {parsed_result}")
                
                if "error" in parsed_result:
                    print(f"❌ Parse failed: {parsed_result['error']}")
                    print(f"Error message: {parsed_result.get('message', 'No message')}")
                else:
                    print(f"✅ Parse succeeded!")
                    print(f"Relevance score: {parsed_result.get('relevance_score')}")
                    
            except Exception as e:
                print(f"❌ Parse exception: {e}")
                print(f"Exception type: {type(e)}")
                print(f"Exception args: {e.args}")
            
            # Step 4: Test the actual method call
            print(f"\nStep 4: Testing actual method call")
            
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
                    print(f"❌ Method failed: {result.get('error', 'No error field')}")
                    print(f"Error message: {result.get('message', 'No message field')}")
                    
                    # Check if this is the error we're looking for
                    error_str = result.get("error", "")
                    if "relevance_score" in error_str:
                        print(f"Found the relevance_score error!")
                        print(f"Error string: {repr(error_str)}")
                else:
                    print(f"✅ Method succeeded!")
                    
            except Exception as e:
                print(f"❌ Method exception: {e}")
                print(f"Exception type: {type(e)}")
                print(f"Exception args: {e.args}")
                
                # Check if this is the error we're looking for
                if "relevance_score" in str(e):
                    print(f"Found the relevance_score error in exception!")
                    print(f"Exception string: {repr(str(e))}")
            
            finally:
                # Clean up test file
                if os.path.exists(test_file_path):
                    os.remove(test_file_path)
                    
        except Exception as e:
            print(f"❌ Overall exception: {e}")
            print(f"Exception type: {type(e)}")
            print(f"Exception args: {e.args}")


if __name__ == "__main__":
    # Run the test
    test_instance = TestStepByStepDebug()
    
    print("Testing step by step debug...")
    asyncio.run(test_instance.test_step_by_step_debug())
