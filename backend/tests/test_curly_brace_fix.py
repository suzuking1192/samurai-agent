def test_curly_brace_fix():
    """Test that the curly brace fix is working"""
    
    # Simulate the combined_content with curly braces
    combined_content = '''=== FILE: test_file.py ===
// function: test_function (from test_file.py)
// Found at line 2

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
        }'''
    
    print(f"Original combined_content length: {len(combined_content)}")
    print(f"Original combined_content contains {{: {combined_content.count('{')}")
    print(f"Original combined_content contains }}: {combined_content.count('}')}")
    
    # Apply the fix
    fixed_content = combined_content.replace("{", "{{").replace("}", "}}")
    
    print(f"Fixed combined_content length: {len(fixed_content)}")
    print(f"Fixed combined_content contains {{: {fixed_content.count('{')}")
    print(f"Fixed combined_content contains }}: {fixed_content.count('}')}")
    
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
        # Test with original content (should fail)
        print(f"\nTesting with original content (should fail)...")
        formatted_prompt = prompt.format(request=request, combined_content=combined_content)
        print(f"❌ This should have failed but didn't!")
    except KeyError as e:
        print(f"✅ Original content failed as expected: {e}")
    
    try:
        # Test with fixed content (should succeed)
        print(f"\nTesting with fixed content (should succeed)...")
        formatted_prompt = prompt.format(request=request, combined_content=fixed_content)
        print(f"✅ Fixed content succeeded!")
        print(f"Formatted prompt length: {len(formatted_prompt)}")
    except KeyError as e:
        print(f"❌ Fixed content failed: {e}")


if __name__ == "__main__":
    test_curly_brace_fix()
