import re

def test_markdown_extraction():
    """Test the markdown extraction regex pattern"""
    
    # This is the actual response format we're getting
    response = '''```json
{
  "relevance_score": 9,
  "context": "The provided code content in `test.py` is highly relevant to a 'test request' due to its naming conventions, which strongly suggest it's intended to be a Python test file. While the functions and methods themselves are largely empty (`pass`) or simply return static data, their names follow established patterns for test discovery in popular Python testing frameworks like `pytest` and `unittest`.\\n\\nKey components and their potential significance:\\n\\n1.  **`def test_function():`**: This function is named with the `test_` prefix, which is the standard convention for identifying test functions that `pytest` will automatically discover and execute. In a real test scenario, this function would contain assertions to verify specific behaviors.\\n\\n2.  **`class TestClass:`**: This class is named with the `Test` prefix, indicating it's a test class. Testing frameworks like `unittest` and `pytest` often use classes to group related test methods. Each method within this class that starts with `test_` would be considered a test case.\\n\\n3.  **`def __init__(self):`**: A standard constructor for `TestClass`. Currently, it does nothing (`pass`), but in a functional test class, it could be used for setup that applies to all tests within `TestClass` (e.g., initializing resources, setting up mock objects).\\n\\n4.  **`def method_with_newlines(self):`**: This method, although not prefixed with `test_`, is part of `TestClass`. It returns a Python dictionary (`dict`) with nested structures (another dictionary and a list). This demonstrates how complex data structures can be defined within a test file. Such a method might be used to:\\n    *   Generate test data (fixtures).\\n    *   Define expected results for assertions.\\n    *   Provide configuration data for tests.\\n    The explicit use of newlines in the dictionary definition enhances readability, which is good practice for complex data structures.\\n\\nIn summary, this file serves as a structural blueprint or a placeholder for a Python test suite, demonstrating how to define test functions, test classes, and helper methods that provide data. It is a fundamental example of how test code is organized in Python.",
  "relevant_code": "def test_function():\\n    pass\\n\\nclass TestClass:\\n    def __init__(self):\\n        pass\\n\\n    def method_with_newlines(self):\\n        return {\\n            \\"key\\": \\"value\\",\\n            \\"nested\\": {\\n                \\"array\\": [\\n                    \\"item1\\",\\n                    \\"item2\\"\\n                ]\\n            }\\n        }",
  "file_path": "test.py"
}
```'''
    
    print(f"Response length: {len(response)}")
    print(f"Response starts with: {repr(response[:50])}")
    print(f"Response ends with: {repr(response[-50:])}")
    
    # Test the current regex pattern
    pattern = r'```(?:json)?\s*\n(.*?)\n```'
    match = re.search(pattern, response, re.DOTALL)
    
    if match:
        print(f"✅ Markdown extraction succeeded!")
        extracted = match.group(1).strip()
        print(f"Extracted JSON starts with: {repr(extracted[:50])}")
        print(f"Extracted JSON ends with: {repr(extracted[-50:])}")
        
        # Try to parse the extracted JSON
        import json
        try:
            parsed = json.loads(extracted)
            print(f"✅ JSON parsing succeeded: {parsed}")
        except json.JSONDecodeError as e:
            print(f"❌ JSON parsing failed: {e}")
    else:
        print(f"❌ Markdown extraction failed!")
        
        # Try different patterns
        patterns = [
            r'```json\s*\n(.*?)\n```',
            r'```\s*\n(.*?)\n```',
            r'```(.*?)```',
            r'```json\n(.*?)\n```',
        ]
        
        for i, pattern in enumerate(patterns):
            match = re.search(pattern, response, re.DOTALL)
            if match:
                print(f"✅ Pattern {i} worked: {pattern}")
                extracted = match.group(1).strip()
                print(f"Extracted: {repr(extracted[:100])}")
                break
            else:
                print(f"❌ Pattern {i} failed: {pattern}")


if __name__ == "__main__":
    test_markdown_extraction()
