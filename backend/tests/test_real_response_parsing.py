import pytest
import asyncio
import os
import sys
import json

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.utils import parse_ai_json_response, clean_ai_json_response, extract_json_from_ai_response


class TestRealResponseParsing:
    """Test parsing the actual LLM response that's causing the error"""
    
    def test_parse_actual_llm_response(self):
        """Test parsing the actual LLM response from the logs"""
        
        # This is the actual response from the LLM that's causing the error
        actual_response = '''```json
{
  "relevance_score": 9,
  "context": "The provided code content in `test.py` is highly relevant to a 'test request' due to its naming conventions, which strongly suggest it's intended to be a Python test file. While the functions and methods themselves are largely empty (`pass`) or simply return static data, their names follow established patterns for test discovery in popular Python testing frameworks like `pytest` and `unittest`.\\n\\nKey components and their potential significance:\\n\\n1.  **`def test_function():`**: This function is named with the `test_` prefix, which is the standard convention for identifying test functions that `pytest` will automatically discover and execute. In a real test scenario, this function would contain assertions to verify specific behaviors.\\n\\n2.  **`class TestClass:`**: This class is named with the `Test` prefix, indicating it's a test class. Testing frameworks like `unittest` and `pytest` often use classes to group related test methods. Each method within this class that starts with `test_` would be considered a test case.\\n\\n3.  **`def __init__(self):`**: A standard constructor for `TestClass`. Currently, it does nothing (`pass`), but in a functional test class, it could be used for setup that applies to all tests within `TestClass` (e.g., initializing resources, setting up mock objects).\\n\\n4.  **`def method_with_newlines(self):`**: This method, although not prefixed with `test_`, is part of `TestClass`. It returns a Python dictionary (`dict`) with nested structures (another dictionary and a list). This demonstrates how complex data structures can be defined within a test file. Such a method might be used to:\\n    *   Generate test data (fixtures).\\n    *   Define expected results for assertions.\\n    *   Provide configuration data for tests.\\n    The explicit use of newlines in the dictionary definition enhances readability, which is good practice for complex data structures.\\n\\nIn summary, this file serves as a structural blueprint or a placeholder for a Python test suite, demonstrating how to define test functions, test classes, and helper methods that provide data. It is a fundamental example of how test code is organized in Python.",
  "relevant_code": "def test_function():\\n    pass\\n\\nclass TestClass:\\n    def __init__(self):\\n        pass\\n\\n    def method_with_newlines(self):\\n        return {\\n            \\"key\\": \\"value\\",\\n            \\"nested\\": {\\n                \\"array\\": [\\n                    \\"item1\\",\\n                    \\"item2\\"\\n                ]\\n            }\\n        }",
  "file_path": "test.py"
}
```'''
        
        print(f"Testing actual LLM response parsing...")
        print(f"Response length: {len(actual_response)}")
        print(f"Response starts with: {repr(actual_response[:100])}")
        print(f"Response ends with: {repr(actual_response[-100])}")
        
        # Test the parse_ai_json_response function
        try:
            result = parse_ai_json_response(actual_response, ["relevance_score", "context", "relevant_code", "file_path"])
            print(f"Parse result: {result}")
            
            if "error" in result:
                print(f"❌ Parse failed with error: {result['error']}")
                print(f"Error message: {result.get('message', 'No message')}")
                print(f"Raw response: {result.get('raw_response', 'No raw response')}")
            else:
                print(f"✅ Parse succeeded!")
                print(f"Relevance score: {result.get('relevance_score')}")
                print(f"Context length: {len(result.get('context', ''))}")
                print(f"Relevant code length: {len(result.get('relevant_code', ''))}")
                print(f"File path: {result.get('file_path')}")
                
        except Exception as e:
            print(f"❌ Parse exception: {e}")
            print(f"Exception type: {type(e)}")
    
    def test_clean_ai_json_response_with_actual_response(self):
        """Test the clean_ai_json_response function with the actual response"""
        
        # Extract just the JSON part from the markdown
        import re
        markdown_response = '''```json
{
  "relevance_score": 9,
  "context": "The provided code content in `test.py` is highly relevant to a 'test request' due to its naming conventions, which strongly suggest it's intended to be a Python test file. While the functions and methods themselves are largely empty (`pass`) or simply return static data, their names follow established patterns for test discovery in popular Python testing frameworks like `pytest` and `unittest`.\\n\\nKey components and their potential significance:\\n\\n1.  **`def test_function():`**: This function is named with the `test_` prefix, which is the standard convention for identifying test functions that `pytest` will automatically discover and execute. In a real test scenario, this function would contain assertions to verify specific behaviors.\\n\\n2.  **`class TestClass:`**: This class is named with the `Test` prefix, indicating it's a test class. Testing frameworks like `unittest` and `pytest` often use classes to group related test methods. Each method within this class that starts with `test_` would be considered a test case.\\n\\n3.  **`def __init__(self):`**: A standard constructor for `TestClass`. Currently, it does nothing (`pass`), but in a functional test class, it could be used for setup that applies to all tests within `TestClass` (e.g., initializing resources, setting up mock objects).\\n\\n4.  **`def method_with_newlines(self):`**: This method, although not prefixed with `test_`, is part of `TestClass`. It returns a Python dictionary (`dict`) with nested structures (another dictionary and a list). This demonstrates how complex data structures can be defined within a test file. Such a method might be used to:\\n    *   Generate test data (fixtures).\\n    *   Define expected results for assertions.\\n    *   Provide configuration data for tests.\\n    The explicit use of newlines in the dictionary definition enhances readability, which is good practice for complex data structures.\\n\\nIn summary, this file serves as a structural blueprint or a placeholder for a Python test suite, demonstrating how to define test functions, test classes, and helper methods that provide data. It is a fundamental example of how test code is organized in Python.",
  "relevant_code": "def test_function():\\n    pass\\n\\nclass TestClass:\\n    def __init__(self):\\n        pass\\n\\n    def method_with_newlines(self):\\n        return {\\n            \\"key\\": \\"value\\",\\n            \\"nested\\": {\\n                \\"array\\": [\\n                    \\"item1\\",\\n                    \\"item2\\"\\n                ]\\n            }\\n        }",
  "file_path": "test.py"
}
```'''
        
        # Extract JSON from markdown
        markdown_match = re.search(r'```(?:json)?\s*\n(.*?)\n```', markdown_response, re.DOTALL)
        if markdown_match:
            json_str = markdown_match.group(1).strip()
            print(f"✅ Extracted JSON from markdown")
            print(f"JSON starts with: {repr(json_str[:100])}")
        else:
            print(f"❌ Failed to extract JSON from markdown")
            return
        
        # Test cleaning the JSON
        try:
            cleaned = clean_ai_json_response(json_str)
            print(f"✅ Cleaned JSON")
            print(f"Cleaned JSON starts with: {repr(cleaned[:100])}")
            
            # Try to parse the cleaned JSON
            parsed = json.loads(cleaned)
            print(f"✅ Parsed cleaned JSON successfully")
            print(f"Relevance score: {parsed.get('relevance_score')}")
            print(f"Context length: {len(parsed.get('context', ''))}")
            print(f"Relevant code length: {len(parsed.get('relevant_code', ''))}")
            print(f"File path: {parsed.get('file_path')}")
            
        except Exception as e:
            print(f"❌ Clean/parse failed: {e}")


if __name__ == "__main__":
    # Run the tests
    test_instance = TestRealResponseParsing()
    
    print("Testing actual LLM response parsing...")
    test_instance.test_parse_actual_llm_response()
    
    print("\nTesting clean AI JSON response with actual response...")
    test_instance.test_clean_ai_json_response_with_actual_response()
