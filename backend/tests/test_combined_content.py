import pytest
import asyncio
import os
import sys

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.agent_tools import ExtractCodeContextTool


class TestCombinedContent:
    """Test to check what's in the combined_content that's causing the KeyError"""
    
    def __init__(self):
        """Set up test fixtures"""
        self.agent_tools = ExtractCodeContextTool()
    
    def test_combined_content_issue(self):
        """Test to check what's in the combined_content"""
        
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
            # Simulate the exact flow up to the prompt creation
            file_methods_map = {test_file_path: ["test_function"]}
            
            # Step 1: Collect all relevant code content
            all_code_content = []
            
            for file_path, target_methods in file_methods_map.items():
                try:
                    # Read file content
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        file_content = f.read()
                    
                    # If specific methods are targeted, extract only those
                    if target_methods:
                        extracted_content = self.agent_tools._extract_methods_from_file(file_content, target_methods, file_path)
                        if extracted_content:
                            # Add file header to distinguish content from different files
                            all_code_content.append(f"=== FILE: {file_path} ===\n{extracted_content}")
                        else:
                            # If method extraction failed, use full file content
                            if len(file_content) > 8000:
                                file_content = file_content[:8000] + "\n... (truncated)"
                            all_code_content.append(f"=== FILE: {file_path} ===\n{file_content}")
                    else:
                        # No specific methods, use full file content
                        if len(file_content) > 8000:
                            file_content = file_content[:8000] + "\n... (truncated)"
                        all_code_content.append(f"=== FILE: {file_path} ===\n{file_content}")
                
                except Exception as e:
                    print(f"Error reading file {file_path}: {e}")
                    continue
            
            # Step 2: Combine all code content
            combined_content = "\n\n".join(all_code_content)
            
            print(f"Combined content length: {len(combined_content)}")
            print(f"Combined content: {repr(combined_content)}")
            
            # Check if the problematic pattern is in the combined_content
            if '\n  "relevance_score"' in combined_content:
                print(f"❌ Found problematic pattern in combined_content!")
                pattern = '\n  "relevance_score"'
                print(f"Pattern location: {combined_content.find(pattern)}")
                print(f"Context around pattern: {repr(combined_content[combined_content.find(pattern)-20:combined_content.find(pattern)+30])}")
            else:
                print(f"✅ No problematic pattern in combined_content")
            
            # Test the prompt formatting
            request = "test request"
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
"""
            
            try:
                formatted_prompt = prompt.format(request=request, combined_content=combined_content)
                print(f"✅ Prompt formatting succeeded")
            except KeyError as e:
                print(f"❌ KeyError in prompt formatting: {e}")
                print(f"KeyError args: {e.args}")
                
                # Check if the error key is in the combined_content
                error_key = e.args[0]
                if error_key in combined_content:
                    print(f"Found the error key '{error_key}' in combined_content!")
                    print(f"Location: {combined_content.find(error_key)}")
                    print(f"Context: {repr(combined_content[combined_content.find(error_key)-20:combined_content.find(error_key)+30])}")
                
        except Exception as e:
            print(f"Exception occurred: {e}")
            print(f"Exception type: {type(e)}")
            print(f"Exception args: {e.args}")
        
        finally:
            # Clean up test file
            if os.path.exists(test_file_path):
                os.remove(test_file_path)


if __name__ == "__main__":
    # Run the test
    test_instance = TestCombinedContent()
    
    print("Testing combined content issue...")
    test_instance.test_combined_content_issue()
