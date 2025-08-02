"""
Test file for response handling functionality.
"""

import pytest
from services.response_service import (
    handle_long_response, 
    split_long_response, 
    create_response_with_context,
    handle_validation_error
)
from pydantic import ValidationError

def test_handle_long_response_truncation():
    """Test that long responses are properly truncated."""
    # Create a very long response
    long_response = "This is a test. " * 1000  # ~18,000 characters
    
    result = handle_long_response(long_response)
    
    # Should be truncated
    assert len(result) <= 15000
    assert "[Response truncated" in result
    assert "please ask for more details" in result

def test_handle_long_response_no_truncation():
    """Test that short responses are not truncated."""
    short_response = "This is a short response."
    
    result = handle_long_response(short_response)
    
    # Should not be truncated
    assert result == short_response
    assert "[Response truncated" not in result

def test_split_long_response():
    """Test that long responses are split into parts."""
    # Create a response that needs splitting
    long_response = "Part 1. " * 500 + "Part 2. " * 500 + "Part 3. " * 500
    
    parts = split_long_response(long_response, max_length=2000)
    
    # Should be split into multiple parts
    assert len(parts) > 1
    assert all(len(part) <= 2000 for part in parts)
    
    # Parts should end with natural breaks when possible
    for part in parts[:-1]:  # All except last part
        assert part.endswith('.') or part.endswith('...')

def test_create_response_with_context():
    """Test response context creation."""
    response = "This is a test response."
    
    # Test truncated response
    truncated_result = create_response_with_context(response, is_truncated=True)
    assert "exceeded our limits" in truncated_result
    
    # Test multi-part response
    part_result = create_response_with_context(response, total_parts=3, current_part=1)
    assert "Part 1 of 3" in part_result
    
    # Test final part
    final_part_result = create_response_with_context(response, total_parts=3, current_part=3)
    assert "Part 3 of 3" in final_part_result
    assert "completes the full response" in final_part_result

def test_handle_validation_error():
    """Test validation error handling."""
    response = "This is a test response. " * 1000  # Very long
    
    # Create a mock validation error
    class MockValidationError:
        def __str__(self):
            return "1 validation error for ChatMessage\nresponse\n  String should have at most 5000 characters [type=string_too_long]"
    
    mock_error = MockValidationError()
    
    result = handle_validation_error(mock_error, response)
    
    # Should be truncated
    assert len(result) <= 15000
    assert "[Response truncated" in result

def test_response_length_limits():
    """Test that responses respect the new character limit."""
    # Test with exactly 14000 characters (the truncation limit)
    exact_length_response = "a" * 14000
    
    result = handle_long_response(exact_length_response)
    assert len(result) == 14000
    
    # Test with more than 14000 characters
    too_long_response = "a" * 16000
    
    result = handle_long_response(too_long_response)
    assert len(result) <= 15000  # Should be truncated to fit in 15000 limit
    assert "[Response truncated" in result

if __name__ == "__main__":
    # Run tests
    test_handle_long_response_truncation()
    test_handle_long_response_no_truncation()
    test_split_long_response()
    test_create_response_with_context()
    test_handle_validation_error()
    test_response_length_limits()
    
    print("All tests passed!") 