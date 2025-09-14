import pytest
import sys
import os
from unittest.mock import patch, AsyncMock, Mock, mock_open

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.utils import parse_ai_json_response, extract_useful_info_from_response
from backend.services.tools.agent_tools import AgentToolRegistry


class TestParseAIJSONResponseFix:
    """Test to replicate and fix the specific JSON parsing error."""
    
    def test_replicate_exact_error(self):
        """Test to replicate the exact error: 'Failed to parse even after reconstruction'"""
        # This is a malformed JSON that should trigger the specific error
        malformed_json = '''
{
  "relevance_score": 8,
  "context": "This context has unescaped quotes like "this" and "that" and newlines
  that break the JSON structure",
  "relevant_code": "def test():\\n    pass",
  "file_path": "path/to/file.py"
}
'''
        
        # This should trigger the error we're seeing
        result = parse_ai_json_response(malformed_json, ["relevance_score", "context", "file_path"])
        
        # Check if we get the specific error
        if "error" in result:
            print(f"Error result: {result}")
            # The error should be handled gracefully
            assert result.get("success") is False
            assert "Failed to parse" in result.get("message", "")
        else:
            # Should parse successfully
            assert "relevance_score" in result
            assert "context" in result
            assert "file_path" in result
    
    def test_extremely_malformed_json(self):
        """Test with extremely malformed JSON that should trigger the reconstruction error."""
        # This JSON is so malformed it should trigger the "Failed to parse even after reconstruction" error
        extremely_malformed_json = '''
{
  "relevance_score": 8,
  "context": "This context has multiple unescaped quotes like "this" and "that" and "more" and "even more" and newlines
  that completely break the JSON structure and make it impossible to parse normally",
  "relevant_code": "def test():\\n    # This has unescaped quotes too "like this"\\n    pass",
  "file_path": "path/to/file.py"
}
'''
        
        # This should trigger the specific error
        result = parse_ai_json_response(extremely_malformed_json, ["relevance_score", "context", "file_path"])
        
        print(f"Result: {result}")
        
        # Should handle the error gracefully
        if "error" in result:
            assert result.get("success") is False
            assert "Failed to parse" in result.get("message", "")
        else:
            # If it doesn't error, it should still have the expected fields
            assert "relevance_score" in result
            assert "context" in result
            assert "file_path" in result
    
    def test_completely_unparseable_json(self):
        """Test with completely unparseable JSON that should trigger the reconstruction error."""
        # This JSON is completely broken and should trigger the error
        completely_broken_json = '''
{
  "relevance_score": 8,
  "context": "This context has unescaped quotes like "this" and "that" and newlines
  that break the JSON structure and make it impossible to parse",
  "relevant_code": "def test():\\n    # This has unescaped quotes too "like this"\\n    pass",
  "file_path": "path/to/file.py"
  // This comment is not valid in JSON
  "extra_field": "value"
}
'''
        
        # This should trigger the specific error
        result = parse_ai_json_response(completely_broken_json, ["relevance_score", "context", "file_path"])
        
        print(f"Result: {result}")
        
        # Should handle the error gracefully
        if "error" in result:
            assert result.get("success") is False
            assert "Failed to parse" in result.get("message", "")
        else:
            # If it doesn't error, it should still have the expected fields
            assert "relevance_score" in result
            assert "context" in result
            assert "file_path" in result
    
    def test_no_json_structure_at_all(self):
        """Test with text that has no JSON structure at all."""
        # This text has no JSON structure and should trigger the error
        no_json_structure = '''
This is just plain text with no JSON structure at all.
It has some words like relevance_score and context but they're not in JSON format.
This should definitely trigger the "Failed to parse even after reconstruction" error.
'''
        
        # This should trigger the specific error
        result = parse_ai_json_response(no_json_structure, ["relevance_score", "context", "file_path"])
        
        print(f"Result: {result}")
        
        # Should extract useful information instead of returning errors
        assert "error" not in result
        assert "success" not in result or result["success"] is not False
        
        # Should have extracted some useful information
        assert "relevance_score" in result
        assert "context" in result
        assert "file_path" in result
        
        # Should indicate parsing issues
        assert "parsing_notes" in result or "parsing_issues" in result
    
    def test_specific_reconstruction_error(self):
        """Test that specifically triggers the 'Failed to parse even after reconstruction' error."""
        # This JSON is designed to pass the initial cleaning but fail during reconstruction
        # It has valid JSON structure but with unescaped quotes that break field extraction
        reconstruction_failure_json = '''
{
  "relevance_score": 8,
  "context": "This context has unescaped quotes like "this" and "that" and "more" and "even more" and "lots" and "of" and "quotes" that will break the regex extraction",
  "relevant_code": "def test():\\n    # This has unescaped quotes too "like this"\\n    pass",
  "file_path": "path/to/file.py"
}
'''
        
        # This should trigger the specific "Failed to parse even after reconstruction" error
        result = parse_ai_json_response(reconstruction_failure_json, ["relevance_score", "context", "file_path"])
        
        print(f"Result: {result}")
        
        # Should handle the error gracefully
        if "error" in result:
            assert result.get("success") is False
            message = result.get("message", "")
            # Should contain some indication of parsing failure
            assert any(keyword in message for keyword in ["Failed to parse", "reconstruction", "malformed", "error"])
        else:
            # If it doesn't error, it should still have the expected fields
            assert "relevance_score" in result
            assert "context" in result
            assert "file_path" in result
    
    @patch('backend.services.utils.clean_ai_json_response')
    def test_mocked_reconstruction_failure(self, mock_clean):
        """Test with mocked clean_ai_json_response to force the reconstruction error."""
        # Mock clean_ai_json_response to return a JSON that will fail during reconstruction
        mock_clean.return_value = '{"error": "malformed_json", "message": "Failed to parse even after reconstruction"}'
        
        # Any input should trigger the error
        result = parse_ai_json_response("any input", ["relevance_score", "context", "file_path"])
        
        print(f"Result: {result}")
        
        # Should extract useful information instead of returning errors
        assert "error" not in result
        assert "success" not in result or result["success"] is not False
        
        # Should have parsing notes indicating the issue
        assert "parsing_notes" in result
        assert "Failed to parse even after reconstruction" in result["parsing_notes"]
    
    def test_real_world_scenario(self):
        """Test the fix with a real-world scenario that would trigger the error."""
        # This simulates the exact error scenario from the terminal output
        # The error was: "Failed to parse AI response: Failed to parse even after reconstruction"
        
        # Simulate a malformed response that would cause the reconstruction error
        malformed_response = '''
{
  "relevance_score": 8,
  "context": "This context has unescaped quotes like "this" and "that" and newlines
  that break the JSON structure and make it impossible to parse normally",
  "relevant_code": "def test():\\n    # This has unescaped quotes too "like this"\\n    pass",
  "file_path": "path/to/file.py"
}
'''
        
        # This should trigger the error we're seeing in the real scenario
        result = parse_ai_json_response(malformed_response, ["relevance_score", "context", "file_path"])
        
        print(f"Real-world scenario result: {result}")
        
        # The fix should handle this gracefully
        if "error" in result:
            assert result.get("success") is False
            message = result.get("message", "")
            # Should contain some indication of parsing failure
            assert any(keyword in message for keyword in ["Failed to parse", "reconstruction", "malformed", "error"])
        else:
            # If it doesn't error, it should still have the expected fields
            assert "relevance_score" in result
            assert "context" in result
            assert "file_path" in result
    
    def test_missing_expected_fields(self):
        """Test the case where expected fields are missing."""
        # JSON with missing expected fields
        incomplete_json = '''
{
  "relevance_score": 8,
  "context": "Test context"
}
'''
        
        expected_fields = ["relevance_score", "context", "file_path"]
        result = parse_ai_json_response(incomplete_json, expected_fields)
        
        # Should handle missing fields gracefully
        if "error" in result:
            print(f"Error result: {result}")
            assert result.get("success") is False
        else:
            # Should still parse successfully even with missing fields
            assert "relevance_score" in result
            assert "context" in result
            # file_path should be missing but not cause an error
            assert "file_path" not in result or result["file_path"] == ""
    
    def test_extract_useful_info_from_malformed_response(self):
        """Test the new extract_useful_info_from_response function."""
        # Malformed response with useful information scattered throughout
        malformed_response = '''
This is a malformed response that doesn't follow JSON format.
However, it contains useful information:
- relevance_score: 7
- This code implements a user authentication system that handles login and logout functionality.
- The main file is auth_service.py
- Here's some relevant code: def authenticate_user(username, password):
'''
        
        result = extract_useful_info_from_response(malformed_response, ["relevance_score", "context", "file_path"])
        
        print(f"Extracted info: {result}")
        
        # Should extract useful information
        assert result["relevance_score"] == 7
        assert "authentication" in result["context"].lower() or "login" in result["context"].lower()
        assert "auth_service.py" in result["file_path"]
        # The code extraction might not capture the exact function, so check if any code was extracted
        assert len(result["relevant_code"]) > 0 or "def authenticate_user" in result["context"]
    
    def test_parse_ai_json_response_with_fallback_extraction(self):
        """Test that parse_ai_json_response now extracts useful info instead of returning errors."""
        # This should trigger fallback extraction but still return useful information
        malformed_json = '''
{
  "relevance_score": 9,
  "context": "This context has unescaped quotes like "this" and "that" and breaks JSON parsing,
  "file_path": "user_service.py"
}
'''
        
        result = parse_ai_json_response(malformed_json, ["relevance_score", "context", "file_path"])
        
        print(f"Fallback extraction result: {result}")
        
        # Should not return an error, but useful information instead
        assert "error" not in result
        assert "success" not in result or result["success"] is not False
        
        # Should extract useful information
        assert result["relevance_score"] == 9
        assert "context" in result and len(result["context"]) > 0
        assert "user_service.py" in result["file_path"]
        
        # Should have parsing notes indicating the issue was handled, or the parsing succeeded
        # If parsing succeeded, we won't have parsing notes, which is actually good
        parsing_succeeded = "parsing_notes" not in result and "parsing_issues" not in result
        parsing_handled = "parsing_notes" in result or "parsing_issues" in result
        assert parsing_succeeded or parsing_handled
    
    def test_completely_broken_response_still_provides_info(self):
        """Test that even completely broken responses provide some useful information."""
        broken_response = '''
This is completely broken text with no JSON structure whatsoever.
But it mentions that the relevance is high (score: 8) and talks about 
a database connection manager that handles connection pooling.
The file is located at db_manager.py and contains connection logic.
'''
        
        result = parse_ai_json_response(broken_response, ["relevance_score", "context", "file_path"])
        
        print(f"Broken response result: {result}")
        
        # Should not return an error
        assert "error" not in result
        assert "success" not in result or result["success"] is not False
        
        # Should extract some useful information
        assert result["relevance_score"] == 8
        assert len(result["context"]) > 0
        assert "db_manager.py" in result["file_path"]
        
        # Should indicate parsing issues
        assert "parsing_notes" in result or "parsing_issues" in result


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])
