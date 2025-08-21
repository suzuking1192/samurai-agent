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


class TestExactFlow:
    """Test that simulates the exact flow of the _extract_code_context method"""
    
    def __init__(self):
        """Set up test fixtures"""
        self.agent_tools = ExtractCodeContextTool()
        self.gemini_service = GeminiService()
    
    @pytest.mark.asyncio
    async def test_exact_flow(self):
        """Test the exact flow of the _extract_code_context method"""
        
        # Create a test file
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
        
        test_file_path = "test_file.py"
        with open(test_file_path, "w") as f:
            f.write(test_file_content)
        
        try:
            # Simulate the exact flow of _extract_code_context
            file_methods_map = {test_file_path: ["test_function"]}
            request = "test request"
            max_iterations = 1
            
            print(f"Step 1: Starting _extract_code_context simulation")
            
            # Step 1: Collect all relevant code content
            all_code_content = []
            
            for file_path, target_methods in file_methods_map.items():
                try:
                    print(f"Step 1.1: Reading file {file_path}")
                    # Read file content
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        file_content = f.read()
                    print(f"✅ File read successfully, length: {len(file_content)}")
                    
                    # If specific methods are targeted, extract only those
                    if target_methods:
                        print(f"Step 1.2: Extracting methods {target_methods}")
                        extracted_content = self.agent_tools._extract_methods_from_file(file_content, target_methods, file_path)
                        if extracted_content:
                            # Add file header to distinguish content from different files
                            all_code_content.append(f"=== FILE: {file_path} ===\n{extracted_content}")
                            print(f"✅ Method extraction succeeded, length: {len(extracted_content)}")
                        else:
                            # If method extraction failed, use full file content
                            if len(file_content) > 8000:
                                file_content = file_content[:8000] + "\n... (truncated)"
                            all_code_content.append(f"=== FILE: {file_path} ===\n{file_content}")
                            print(f"✅ Using full file content, length: {len(file_content)}")
                    else:
                        # No specific methods, use full file content
                        if len(file_content) > 8000:
                            file_content = file_content[:8000] + "\n... (truncated)"
                        all_code_content.append(f"=== FILE: {file_path} ===\n{file_content}")
                        print(f"✅ Using full file content, length: {len(file_content)}")
                
                except Exception as e:
                    print(f"❌ Error reading file {file_path}: {e}")
                    continue
            
            print(f"Step 1.3: Collected {len(all_code_content)} content items")
            
            if not all_code_content:
                print(f"❌ No code content could be extracted")
                return
            
            # Step 2: Combine all code content
            print(f"Step 2: Combining code content")
            combined_content = "\n\n".join(all_code_content)
            print(f"✅ Combined content length: {len(combined_content)}")
            
            # Step 3: If combined_content is longer than 100000, remove the rest
            max_content_size = 100000
            if len(combined_content) > max_content_size:
                print(f"Step 3: Truncating content")
                combined_content = combined_content[:max_content_size] + "\n... (truncated due to length)"
                print(f"✅ Content truncated to {len(combined_content)} characters")
            
            # Step 4: Analyze the content directly without chunking
            print(f"Step 4: Creating prompt")
            prompt = """
You are an expert code analyzer. Given a user request and code content from multiple files, extract comprehensive and detailed 
information that would help answer the request. Your analysis should be thorough and include all relevant technical details, 
as this context will be used to generate high-quality responses to user queries.

User Request: {request}

Code Content:
{combined_content}

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
""".format(request=request, combined_content=combined_content)
            
            print(f"Step 5: Calling LLM")
            response = await self.gemini_service.chat_with_system_prompt("", prompt)
            print(f"✅ LLM response received, length: {len(response)}")
            
            # Parse AI response using robust utility function
            print(f"Step 6: Parsing AI response")
            expected_fields = ["relevance_score", "context", "relevant_code", "file_path"]
            analysis = parse_ai_json_response(response, expected_fields)
            print(f"✅ AI response parsed successfully")
            
            # Check if parsing failed
            if "error" in analysis:
                print(f"❌ Parsing failed: {analysis.get('message', 'Unknown error')}")
                return
            
            relevance_score = analysis.get("relevance_score", 0)
            print(f"Step 7: Relevance score: {relevance_score}")
            
            if relevance_score > 0:
                print(f"Step 8: Creating success result")
                result = {
                    "success": True,
                    "context": analysis.get("context", ""),
                    "relevant_code": analysis.get("relevant_code", ""),
                    "file_path": analysis.get("file_path"),
                    "relevance_score": relevance_score
                }
                print(f"✅ Success result created")
                print(f"Result: {result}")
            else:
                print(f"❌ Relevance score <= 0")
                
        except Exception as e:
            print(f"❌ Exception occurred: {e}")
            print(f"Exception type: {type(e)}")
            print(f"Exception args: {e.args}")
            
            # Check if this is the error we're looking for
            if "relevance_score" in str(e):
                print(f"Found the relevance_score error!")
                print(f"Exception string: {repr(str(e))}")
        
        finally:
            # Clean up test file
            if os.path.exists(test_file_path):
                os.remove(test_file_path)


if __name__ == "__main__":
    # Run the test
    test_instance = TestExactFlow()
    
    print("Testing exact flow...")
    asyncio.run(test_instance.test_exact_flow())
