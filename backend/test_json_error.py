#!/usr/bin/env python3

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'services'))

from services.utils import parse_ai_json_response, clean_ai_json_response, extract_json_from_ai_response
import json

# Test the exact error case from the logs
malformed_json = '''
{
  "relevance_score": 8,
  "context": "This is a context with
  multiple lines and unescaped quotes like "this" and "that"",
  "relevant_code": "def test():\\n    pass",
  "file_path": "test.py"
}
'''

print('Testing malformed JSON...')
try:
    # Test clean_ai_json_response directly
    print('Testing clean_ai_json_response...')
    cleaned = clean_ai_json_response(malformed_json)
    print('Cleaned type:', type(cleaned))
    print('Cleaned result:', repr(cleaned))
    
    # Test if cleaned_json is valid JSON
    try:
        parsed_cleaned = json.loads(cleaned)
        print('Cleaned JSON is valid:', parsed_cleaned)
    except json.JSONDecodeError as e:
        print('Cleaned JSON is invalid:', e)
    
    # Test parse_ai_json_response
    print('\nTesting parse_ai_json_response...')
    result = parse_ai_json_response(malformed_json)
    print('Result type:', type(result))
    print('Result:', result)
    
    # Test the specific error scenario - simulate the error from the logs
    print('\nSimulating the error scenario...')
    # Simulate what happens in the agent_tools.py code
    analysis = result
    print('Analysis type:', type(analysis))
    print('Analysis content:', repr(analysis))
    
    if isinstance(analysis, dict):
        try:
            relevance_score = analysis.get("relevance_score", 0)
            print('Relevance score:', relevance_score)
        except Exception as e:
            print('Error accessing relevance_score:', e)
    else:
        print('Analysis is not a dict, it is:', type(analysis))
        print('Analysis content:', repr(analysis))
        # This is where the error would occur in the original code
        try:
            relevance_score = analysis.get("relevance_score", 0)
        except AttributeError as e:
            print('Expected AttributeError:', e)
    
    # Test a scenario where clean_ai_json_response returns an error string
    print('\nTesting error string scenario...')
    # Create a malformed JSON that would cause clean_ai_json_response to return an error string
    very_malformed_json = '''
    {
      "relevance_score": 8,
      "context": "This is a context with
      multiple lines and unescaped quotes like "this" and "that"",
      "relevant_code": "def test():\\n    pass",
      "file_path": "test.py"
    '''
    
    cleaned_error = clean_ai_json_response(very_malformed_json)
    print('Cleaned error type:', type(cleaned_error))
    print('Cleaned error result:', repr(cleaned_error))
    
    # Test parse_ai_json_response with the error string
    result_error = parse_ai_json_response(very_malformed_json)
    print('Result error type:', type(result_error))
    print('Result error:', result_error)
    
    # Test the exact error scenario from the logs
    print('\nTesting exact error scenario...')
    # Simulate the exact error from the logs
    # The error shows '\n  "relevance_score"' which suggests analysis is a string
    # Let's simulate this by creating a case where analysis is a string
    analysis_string = '\n  "relevance_score"'
    print('Analysis string:', repr(analysis_string))
    
    try:
        relevance_score = analysis_string.get("relevance_score", 0)
    except AttributeError as e:
        print('Expected AttributeError:', e)
        print('This is the exact error from the logs!')
    
    # Test extract_json_from_ai_response directly
    print('\nTesting extract_json_from_ai_response...')
    # Create a very malformed response that might cause issues
    very_bad_response = '''
    This is not JSON at all
    It has some text that looks like JSON but isn't:
    "relevance_score": 8
    "context": "some context"
    '''
    
    fallback_result = extract_json_from_ai_response(very_bad_response)
    print('Fallback result type:', type(fallback_result))
    print('Fallback result:', fallback_result)
    
    # Test parse_ai_json_response with the very bad response
    result_bad = parse_ai_json_response(very_bad_response)
    print('Result bad type:', type(result_bad))
    print('Result bad:', result_bad)
        
except Exception as e:
    print('Error:', e)
    import traceback
    traceback.print_exc()
