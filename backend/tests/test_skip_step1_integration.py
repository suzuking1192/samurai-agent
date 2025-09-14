import pytest
import tempfile
import os
from unittest.mock import AsyncMock, patch
from backend.services.tools.agent_tools import ExtractCodeContextTool
from services.code_parser import FileInfo, CodeElement


class TestSkipStep1Integration:
    """Integration test to demonstrate the Step 1 skip optimization."""
    
    @pytest.fixture
    def agent_tools(self):
        return ExtractCodeContextTool()
    
    def create_test_files(self, count, temp_dir):
        """Create a specified number of test files."""
        file_infos = {}
        for i in range(count):
            file_path = os.path.join(temp_dir, f"file_{i}.py")
            elements = [
                CodeElement(name=f"function_{i}", type="function", line_number=1, file_path=file_path),
                CodeElement(name=f"class_{i}", type="class", line_number=11, file_path=file_path)
            ]
            file_infos[file_path] = FileInfo(
                path=file_path,
                name=f"file_{i}.py",
                extension=".py",
                language="python",
                size=1000,
                elements=elements,
                last_modified=1234567890.0
            )
        return file_infos
    
    @pytest.mark.asyncio
    async def test_optimization_benefit_small_codebase(self, agent_tools):
        """Test that small codebases benefit from skipping Step 1."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create a small codebase (50 files)
            file_infos = self.create_test_files(50, temp_dir)
            request = "Find user authentication functions"
            max_iterations = 3
            
            # Mock GeminiService
            with patch('backend.services.llm_providers.gemini_service.GeminiService') as mock_gemini_class:
                mock_gemini = AsyncMock()
                mock_gemini_class.return_value = mock_gemini
                
                # Mock Step 2 to return some results
                with patch.object(agent_tools, '_step2_identify_relevant_elements') as mock_step2:
                    mock_step2.return_value = {"file_1.py": ["function_1", "class_1"]}
                    
                    # Mock Step 1 to ensure it's not called
                    with patch.object(agent_tools, '_step1_identify_relevant_files') as mock_step1:
                        result = await agent_tools._identify_relevant_files_and_methods(
                            file_infos, request, max_iterations
                        )
                        
                        # Verify Step 1 was NOT called (optimization working)
                        mock_step1.assert_not_called()
                        
                        # Verify Step 2 was called with ALL files
                        mock_step2.assert_called_once()
                        call_args = mock_step2.call_args
                        assert len(call_args[0][1]) == 50  # All 50 files passed to Step 2
                        
                        # Verify result
                        assert result == {"file_1.py": ["function_1", "class_1"]}
    
    @pytest.mark.asyncio
    async def test_large_codebase_still_uses_step1(self, agent_tools):
        """Test that large codebases still use Step 1 for filtering."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create a large codebase (1500 files)
            file_infos = self.create_test_files(1500, temp_dir)
            request = "Find user authentication functions"
            max_iterations = 3
            
            # Mock GeminiService
            with patch('backend.services.llm_providers.gemini_service.GeminiService') as mock_gemini_class:
                mock_gemini = AsyncMock()
                mock_gemini_class.return_value = mock_gemini
                
                # Mock Step 1 to return a subset
                with patch.object(agent_tools, '_step1_identify_relevant_files') as mock_step1:
                    mock_step1.return_value = ["file_1.py", "file_2.py", "file_3.py"]
                    
                    # Mock Step 2 to return results
                    with patch.object(agent_tools, '_step2_identify_relevant_elements') as mock_step2:
                        mock_step2.return_value = {"file_1.py": ["function_1"]}
                        
                        result = await agent_tools._identify_relevant_files_and_methods(
                            file_infos, request, max_iterations
                        )
                        
                        # Verify Step 1 WAS called (no optimization for large codebases)
                        mock_step1.assert_called_once()
                        
                        # Verify Step 2 was called with subset from Step 1
                        mock_step2.assert_called_once()
                        call_args = mock_step2.call_args
                        assert call_args[0][1] == ["file_1.py", "file_2.py", "file_3.py"]
                        
                        # Verify result
                        assert result == {"file_1.py": ["function_1"]}
    
    @pytest.mark.asyncio
    async def test_threshold_behavior_999_vs_1000(self, agent_tools):
        """Test the exact threshold behavior at 999 vs 1000 files."""
        with tempfile.TemporaryDirectory() as temp_dir:
            request = "Find user authentication functions"
            max_iterations = 3
            
            # Test with 999 files (should skip Step 1)
            file_infos_999 = self.create_test_files(999, temp_dir)
            
            with patch('backend.services.llm_providers.gemini_service.GeminiService') as mock_gemini_class:
                mock_gemini = AsyncMock()
                mock_gemini_class.return_value = mock_gemini
                
                with patch.object(agent_tools, '_step2_identify_relevant_elements') as mock_step2:
                    mock_step2.return_value = {"file_1.py": ["function_1"]}
                    
                    with patch.object(agent_tools, '_step1_identify_relevant_files') as mock_step1:
                        result_999 = await agent_tools._identify_relevant_files_and_methods(
                            file_infos_999, request, max_iterations
                        )
                        
                        # Verify Step 1 was NOT called for 999 files
                        mock_step1.assert_not_called()
                        
                        # Verify Step 2 was called with all 999 files
                        mock_step2.assert_called_once()
                        call_args = mock_step2.call_args
                        assert len(call_args[0][1]) == 999
            
            # Test with 1000 files (should use Step 1)
            file_infos_1000 = self.create_test_files(1000, temp_dir)
            
            with patch('backend.services.llm_providers.gemini_service.GeminiService') as mock_gemini_class:
                mock_gemini = AsyncMock()
                mock_gemini_class.return_value = mock_gemini
                
                with patch.object(agent_tools, '_step1_identify_relevant_files') as mock_step1:
                    mock_step1.return_value = ["file_1.py", "file_2.py"]
                    
                    with patch.object(agent_tools, '_step2_identify_relevant_elements') as mock_step2:
                        mock_step2.return_value = {"file_1.py": ["function_1"]}
                        
                        result_1000 = await agent_tools._identify_relevant_files_and_methods(
                            file_infos_1000, request, max_iterations
                        )
                        
                        # Verify Step 1 WAS called for 1000 files
                        mock_step1.assert_called_once()
                        
                        # Verify Step 2 was called with subset from Step 1
                        mock_step2.assert_called_once()
                        call_args = mock_step2.call_args
                        assert call_args[0][1] == ["file_1.py", "file_2.py"]
