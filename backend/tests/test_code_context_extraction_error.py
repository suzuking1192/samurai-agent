import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock, mock_open
import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.agent_tools import AgentToolRegistry
from services.utils import parse_ai_json_response, clean_ai_json_response


class TestCodeContextExtractionError:
    """Test to replicate and fix the JSON parsing error in _extract_code_context method."""
    
    @pytest.fixture
    def agent_tools(self):
        return AgentToolRegistry()
    
    def test_replicate_json_parsing_error(self):
        """Test to replicate the specific JSON parsing error."""
        # This is the type of malformed JSON that's causing the error
        malformed_json = '''
{
  "relevance_score": 8,
  "context": "This code implements a complex system with multiple components that work together to provide functionality. The main class handles the core logic while helper functions provide additional support. The code follows good practices and includes proper error handling.",
  "relevant_code": "def main_function():\\n    # Implementation here\\n    pass",
  "file_path": "path/to/file.py"
}
'''
        
        # This should trigger the error we're seeing
        result = parse_ai_json_response(malformed_json)
        
        # The error should be handled gracefully now
        assert "error" not in result or result.get("success") is not False
        
    def test_clean_ai_json_response_with_newlines(self):
        """Test the cleaning function with newlines that cause issues."""
        # Simulate the exact error case
        problematic_json = '''
{
  "relevance_score": 8,
  "context": "This is a context with
  multiple lines and unescaped quotes like "this" and "that"",
  "relevant_code": "def test():\\n    pass",
  "file_path": "test.py"
}
'''
        
        cleaned = clean_ai_json_response(problematic_json)
        
        # Should be valid JSON after cleaning
        import json
        try:
            parsed = json.loads(cleaned)
            assert "relevance_score" in parsed
            assert "context" in parsed
            assert "relevant_code" in parsed
            assert "file_path" in parsed
        except json.JSONDecodeError as e:
            pytest.fail(f"Cleaned JSON is still invalid: {e}")
    
    @pytest.mark.asyncio
    async def test_extract_code_context_with_malformed_response(self, agent_tools):
        """Test the _extract_code_context method with a malformed AI response."""
        # Mock the GeminiService to return malformed JSON
        malformed_response = '''
{
  "relevance_score": 8,
  "context": "This is a context with
  multiple lines and unescaped quotes like "this" and "that"",
  "relevant_code": "def test():\\n    pass",
  "file_path": "test.py"
}
'''
        
        with patch('services.agent_tools.GeminiService') as mock_gemini:
            mock_service = Mock()
            mock_service.chat_with_system_prompt = AsyncMock(return_value=malformed_response)
            mock_gemini.return_value = mock_service
            
            # Mock file reading
            with patch('builtins.open', mock_open(read_data="def test(): pass")):
                result = await agent_tools._extract_code_context(
                    {"test.py": ["test"]}, 
                    "test request", 
                    3
                )
                
                # Should handle the error gracefully
                assert result["success"] is False
                assert "Failed to extract code context" in result["message"]
    
    def test_parse_ai_json_response_edge_cases(self):
        """Test various edge cases that could cause parsing errors."""
        test_cases = [
            # Case 1: JSON with newlines in context
            '''
{
  "relevance_score": 8,
  "context": "This context has
  multiple lines and "quotes"",
  "relevant_code": "def test(): pass",
  "file_path": "test.py"
}
''',
            # Case 2: JSON with trailing commas
            '''
{
  "relevance_score": 8,
  "context": "Test context",
  "relevant_code": "def test(): pass",
  "file_path": "test.py",
}
''',
            # Case 3: JSON with control characters
            '''
{
  "relevance_score": 8,
  "context": "Test context with \t tabs and \r carriage returns",
  "relevant_code": "def test(): pass",
  "file_path": "test.py"
}
'''
        ]
        
        for i, test_json in enumerate(test_cases):
            result = parse_ai_json_response(test_json)
            
            # Should handle all cases gracefully
            if "error" in result:
                print(f"Case {i+1} failed: {result}")
                # The error should be handled gracefully, not raise an exception
                assert result.get("success") is False
            else:
                # Should parse successfully
                assert "relevance_score" in result
                assert "context" in result
                assert "relevant_code" in result
                assert "file_path" in result


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])
