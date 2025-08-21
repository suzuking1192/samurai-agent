import pytest
import asyncio
import os
import sys
import json

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.agent_tools import ExtractCodeContextTool
from services.gemini_service import GeminiService
from services.utils import parse_ai_json_response


class TestIsolateError:
    """Test to isolate exactly where the error is happening"""
    
    def __init__(self):
        """Set up test fixtures"""
        self.agent_tools = ExtractCodeContextTool()
        self.gemini_service = GeminiService()
    
    @pytest.mark.asyncio
    async def test_isolate_error_location(self):
        """Test to isolate exactly where the error is happening"""
        
        # Get the LLM response
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
            print(f"Step 1: Got LLM response, length: {len(response)}")
            
            # Step 2: Test parse_ai_json_response
            print(f"Step 2: Testing parse_ai_json_response")
            expected_fields = ["relevance_score", "context", "relevant_code", "file_path"]
            analysis = parse_ai_json_response(response, expected_fields)
            print(f"✅ parse_ai_json_response succeeded")
            print(f"Analysis keys: {list(analysis.keys())}")
            
            # Step 3: Test analysis.get("relevance_score", 0)
            print(f"Step 3: Testing analysis.get('relevance_score', 0)")
            relevance_score = analysis.get("relevance_score", 0)
            print(f"✅ relevance_score: {relevance_score}")
            
            # Step 4: Test logging analysis
            print(f"Step 4: Testing logging analysis")
            print(f"Analysis: {analysis}")
            print(f"✅ Logging analysis succeeded")
            
            # Step 5: Test the conditional check
            print(f"Step 5: Testing relevance_score > 0")
            if relevance_score > 0:
                print(f"✅ relevance_score > 0 is True")
                
                # Step 6: Test the return statement
                print(f"Step 6: Testing return statement")
                result = {
                    "success": True,
                    "context": analysis.get("context", ""),
                    "relevant_code": analysis.get("relevant_code", ""),
                    "file_path": analysis.get("file_path"),
                    "relevance_score": relevance_score
                }
                print(f"✅ Return statement succeeded")
                print(f"Result: {result}")
            else:
                print(f"❌ relevance_score <= 0")
                
        except Exception as e:
            print(f"❌ Exception occurred: {e}")
            print(f"Exception type: {type(e)}")
            print(f"Exception args: {e.args}")
            
            # Check if this is the error we're looking for
            if "relevance_score" in str(e):
                print(f"Found the relevance_score error!")
                print(f"Exception string: {repr(str(e))}")


if __name__ == "__main__":
    # Run the test
    test_instance = TestIsolateError()
    
    print("Testing isolate error location...")
    asyncio.run(test_instance.test_isolate_error_location())
