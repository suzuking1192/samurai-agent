import pytest
import asyncio
import json
import tempfile
import os
from unittest.mock import Mock, patch, AsyncMock
from services.agent_tools import ExtractCodeContextTool


class TestExtractCodeContextToolFix:
    """Test the fix for handling large content without chunking in ExtractCodeContextTool"""
    
    @pytest.fixture
    def tool(self):
        return ExtractCodeContextTool()
    
    @pytest.fixture
    def mock_gemini_service(self):
        with patch('services.gemini_service.GeminiService') as mock_service:
            mock_instance = Mock()
            mock_instance.chat_with_system_prompt = AsyncMock()
            mock_service.return_value = mock_instance
            yield mock_instance
    
    @pytest.mark.asyncio
    async def test_large_content_truncation(self, tool, mock_gemini_service):
        """Test that large content is properly truncated and processed without chunking"""
        
        # Mock the LLM response for code analysis
        mock_analysis = {
            "relevance_score": 8,
            "context": "This is a test context",
            "relevant_code": "def test_method(): pass",
            "file_path": "test.py"
        }
        mock_gemini_service.chat_with_system_prompt.return_value = json.dumps(mock_analysis)
        
        # Create a file_methods_map with a large content scenario
        file_methods_map = {"test.py": ["test_method"]}
        
        # Mock file reading to return large content
        with patch('builtins.open', create=True) as mock_open:
            # Create content that's longer than 100,000 characters
            large_content = "def test_method():\n    pass\n" * 5000  # This will be > 100,000 chars
            mock_open.return_value.__enter__.return_value.read.return_value = large_content
            
            # Test the _extract_code_context method directly
            result = await tool._extract_code_context(
                file_methods_map=file_methods_map,
                request="test request",
                max_iterations=3
            )
        
        # Verify the result
        assert result["success"] is True
        assert result["context"] == "This is a test context"
        assert result["relevant_code"] == "def test_method(): pass"
        assert result["file_path"] == "test.py"
        assert result["relevance_score"] == 8
        
        # Verify that the LLM was called
        mock_gemini_service.chat_with_system_prompt.assert_called_once()
        
        # Check that the prompt contains the expected content
        call_args = mock_gemini_service.chat_with_system_prompt.call_args[0][1]
        assert "Code Content:" in call_args
        assert "test request" in call_args
    
    @pytest.mark.asyncio
    async def test_small_content_no_truncation(self, tool, mock_gemini_service):
        """Test that small content is processed normally without truncation"""
        
        # Mock the LLM response for code analysis
        mock_analysis = {
            "relevance_score": 7,
            "context": "This is a test context",
            "relevant_code": "def test_method(): pass",
            "file_path": "test.py"
        }
        mock_gemini_service.chat_with_system_prompt.return_value = json.dumps(mock_analysis)
        
        # Create a file_methods_map with small content
        file_methods_map = {"test.py": ["test_method"]}
        
        # Mock file reading to return small content
        with patch('builtins.open', create=True) as mock_open:
            small_content = "def test_method():\n    pass\n"
            mock_open.return_value.__enter__.return_value.read.return_value = small_content
            
            # Test the _extract_code_context method directly
            result = await tool._extract_code_context(
                file_methods_map=file_methods_map,
                request="test request",
                max_iterations=3
            )
        
        # Verify the result
        assert result["success"] is True
        assert result["context"] == "This is a test context"
        assert result["relevant_code"] == "def test_method(): pass"
        assert result["file_path"] == "test.py"
        assert result["relevance_score"] == 7
        
        # Verify that the LLM was called
        mock_gemini_service.chat_with_system_prompt.assert_called_once()
        
        # Check that the prompt contains the expected content
        call_args = mock_gemini_service.chat_with_system_prompt.call_args[0][1]
        assert "Code Content:" in call_args
        assert "test request" in call_args
    
    @pytest.mark.asyncio
    async def test_json_parsing_error_handling(self, tool, mock_gemini_service):
        """Test that JSON parsing errors are handled gracefully"""
        
        # Mock the LLM response for code analysis to return invalid JSON
        mock_gemini_service.chat_with_system_prompt.return_value = "This is not valid JSON"
        
        # Create a file_methods_map
        file_methods_map = {"test.py": ["test_method"]}
        
        # Mock file reading
        with patch('builtins.open', create=True) as mock_open:
            small_content = "def test_method():\n    pass\n"
            mock_open.return_value.__enter__.return_value.read.return_value = small_content
            
            # Test the _extract_code_context method directly
            result = await tool._extract_code_context(
                file_methods_map=file_methods_map,
                request="test request",
                max_iterations=3
            )
        
        # Verify the result shows failure due to JSON parsing error
        assert result["success"] is False
        assert "Failed to parse code analysis response" in result["message"]
        assert result["context"] is None
        assert result["relevant_code"] is None
        assert result["file_path"] is None
    
    @pytest.mark.asyncio
    async def test_content_truncation_verification(self, tool, mock_gemini_service):
        """Test that content is properly truncated when it exceeds 100,000 characters"""
        
        # Mock the LLM response for code analysis
        mock_analysis = {
            "relevance_score": 9,
            "context": "This is a test context",
            "relevant_code": "def test_method(): pass",
            "file_path": "test.py"
        }
        mock_gemini_service.chat_with_system_prompt.return_value = json.dumps(mock_analysis)
        
        # Create a file_methods_map
        file_methods_map = {"test.py": ["test_method"]}
        
        # Mock file reading to return very large content
        with patch('builtins.open', create=True) as mock_open:
            # Create content that's much longer than 100,000 characters
            large_content = "def test_method():\n    pass\n" * 10000  # This will be > 100,000 chars
            mock_open.return_value.__enter__.return_value.read.return_value = large_content
            
            # Also mock the method extraction to return the full content so it gets truncated
            with patch.object(tool, '_extract_methods_from_file', return_value=large_content):
                
                # Test the _extract_code_context method directly
                result = await tool._extract_code_context(
                    file_methods_map=file_methods_map,
                    request="test request",
                    max_iterations=3
                )
        
        # Verify the result
        assert result["success"] is True
        
        # Verify that the LLM was called
        mock_gemini_service.chat_with_system_prompt.assert_called_once()
        
        # Check that the prompt contains the expected content
        call_args = mock_gemini_service.chat_with_system_prompt.call_args[0][1]
        assert "Code Content:" in call_args
        assert "test request" in call_args
        
        # Verify that the content was truncated (should be around 100,000 chars + truncation message)
        content_start = call_args.find("Code Content:\n") + len("Code Content:\n")
        content_end = call_args.find("\n\nInstructions:")
        if content_end == -1:
            content_end = len(call_args)
        actual_content = call_args[content_start:content_end]
        
        # The content should be truncated to around 100,000 characters
        assert len(actual_content) <= 100000 + 100  # Allow some buffer
        assert "... (truncated due to length)" in actual_content


if __name__ == "__main__":
    pytest.main([__file__])
