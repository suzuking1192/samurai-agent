import pytest
import asyncio
import json
import os
import tempfile
from unittest.mock import Mock, patch, AsyncMock, MagicMock
import sys

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.agent_tools import ExtractCodeContextTool


class TestEfficientCodeContext:
    """Test the efficiency improvements in code context extraction."""
    
    @pytest.fixture
    def extract_tool(self):
        return ExtractCodeContextTool()
    
    @pytest.fixture
    def mock_gemini_service(self):
        mock_service = Mock()
        mock_service.chat_with_system_prompt = AsyncMock()
        return mock_service
    
    def test_step2_prompt_includes_relevance_ordering(self, extract_tool):
        """Test that the Step 2 prompt includes instructions for relevance ordering."""
        # Create a simple test scenario
        file_infos = {
            "test_file.py": Mock(
                language="python",
                elements=[
                    Mock(name="relevant_method", type="function"),
                    Mock(name="less_relevant_method", type="function")
                ]
            )
        }
        relevant_files = ["test_file.py"]
        request = "test request"
        
        # Mock the gemini service
        mock_service = Mock()
        mock_service.chat_with_system_prompt = AsyncMock(return_value='{"test_file.py": ["relevant_method"]}')
        
        # Call the method directly
        result = asyncio.run(extract_tool._step2_identify_relevant_elements(
            file_infos, relevant_files, request, mock_service
        ))
        
        # Verify the prompt was called
        mock_service.chat_with_system_prompt.assert_called_once()
        prompt = mock_service.chat_with_system_prompt.call_args[0][1]
        
        # Check that the prompt includes relevance ordering instructions
        assert "Order files and methods by relevance" in prompt
        assert "most relevant files and methods should appear FIRST" in prompt
        assert "list methods in order of relevance (most relevant first)" in prompt
        assert "relevance ordering" in prompt
        assert "CRITICAL: Order files and methods by relevance" in prompt
        assert "The system will prioritize the first files and methods" in prompt
    
    @pytest.mark.asyncio
    async def test_extract_code_context_uses_first_chunk_only_when_large(self, extract_tool):
        """Test that _extract_code_context only processes the first chunk when content is large."""
        # Create a temporary file with large content
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            # Create content that exceeds max_chunk_size (100000)
            large_content = "def test_method():\n    pass\n" * 5000  # This will be > 100000 chars
            f.write(large_content)
            temp_file_path = f.name
        
        try:
            # Mock file_methods_map
            file_methods_map = {
                temp_file_path: ["test_method"]
            }
            request = "test request"
            max_iterations = 1
            
            # Mock the gemini service
            mock_service = Mock()
            mock_service.chat_with_system_prompt = AsyncMock(return_value=json.dumps({
                "relevance_score": 8,
                "context": "Test context",
                "relevant_code": "test code",
                "file_path": temp_file_path
            }))
            
            # Mock the GeminiService import
            with patch('services.gemini_service.GeminiService', return_value=mock_service):
                # Call the method
                result = await extract_tool._extract_code_context(
                    file_methods_map, request, max_iterations
                )
                
                # Verify that only one LLM call was made (for the first chunk only)
                assert mock_service.chat_with_system_prompt.call_count == 1
                
                # Verify the result is successful
                assert result["success"] is True
                assert "Test context" in result["context"]
                
        finally:
            # Clean up
            os.unlink(temp_file_path)
    
    @pytest.mark.asyncio
    async def test_extract_code_context_processes_all_chunks_when_small(self, extract_tool):
        """Test that _extract_code_context processes all chunks when content is small."""
        # Create a temporary file with small content
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            # Create content that is small (< 100000 chars)
            small_content = "def test_method():\n    pass\n" * 100  # This will be < 100000 chars
            f.write(small_content)
            temp_file_path = f.name
        
        try:
            # Mock file_methods_map
            file_methods_map = {
                temp_file_path: ["test_method"]
            }
            request = "test request"
            max_iterations = 1
            
            # Mock the gemini service
            mock_service = Mock()
            mock_service.chat_with_system_prompt = AsyncMock(return_value=json.dumps({
                "relevance_score": 8,
                "context": "Test context",
                "relevant_code": "test code",
                "file_path": temp_file_path
            }))
            
            # Mock the GeminiService import
            with patch('services.gemini_service.GeminiService', return_value=mock_service):
                # Call the method
                result = await extract_tool._extract_code_context(
                    file_methods_map, request, max_iterations
                )
                
                # Verify that LLM call was made (should be 1 for small content)
                assert mock_service.chat_with_system_prompt.call_count == 1
                
                # Verify the result is successful
                assert result["success"] is True
                
        finally:
            # Clean up
            os.unlink(temp_file_path)
    
    def test_relevance_ordering_instructions_are_complete(self, extract_tool):
        """Test that all relevance ordering instructions are properly included in the prompt."""
        # Create a simple test scenario
        file_infos = {"test.py": Mock(language="python", elements=[])}
        relevant_files = ["test.py"]
        request = "test"
        
        # Mock the gemini service
        mock_service = Mock()
        mock_service.chat_with_system_prompt = AsyncMock(return_value='{}')
        
        # Call the method
        asyncio.run(extract_tool._step2_identify_relevant_elements(
            file_infos, relevant_files, request, mock_service
        ))
        
        prompt = mock_service.chat_with_system_prompt.call_args[0][1]
        
        # Check for all specific relevance ordering instructions
        required_instructions = [
            "CRITICAL: Order files and methods by relevance",
            "most relevant files and methods should appear FIRST",
            "list methods in order of relevance (most relevant first)",
            "The system will prioritize the first files and methods",
            "relevance ordering"
        ]
        
        for instruction in required_instructions:
            assert instruction in prompt, f"Missing instruction: {instruction}"


if __name__ == "__main__":
    pytest.main([__file__])
