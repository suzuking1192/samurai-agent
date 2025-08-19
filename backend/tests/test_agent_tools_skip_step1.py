import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from services.agent_tools import ExtractCodeContextTool
from services.code_parser import FileInfo, CodeElement


class TestAgentToolsSkipStep1:
    """Test that Step 1 is skipped when there are fewer than 1000 files."""
    
    @pytest.fixture
    def agent_tools(self):
        return ExtractCodeContextTool()
    
    @pytest.fixture
    def small_file_infos(self):
        """Create a small set of file infos (less than 1000 files)."""
        file_infos = {}
        for i in range(50):  # Only 50 files
            file_path = f"file_{i}.py"
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
    
    @pytest.fixture
    def large_file_infos(self):
        """Create a large set of file infos (more than 1000 files)."""
        file_infos = {}
        for i in range(1500):  # 1500 files
            file_path = f"file_{i}.py"
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
    async def test_skip_step1_small_codebase(self, agent_tools, small_file_infos):
        """Test that Step 1 is skipped when there are fewer than 1000 files."""
        request = "test request"
        max_iterations = 3
        
        # Mock the GeminiService
        with patch('services.gemini_service.GeminiService') as mock_gemini_class:
            mock_gemini = AsyncMock()
            mock_gemini_class.return_value = mock_gemini
            
            # Mock Step 2 to return some results
            mock_gemini.chat_with_system_prompt.return_value = '{"file_1.py": ["function_1", "class_1"]}'
            
            # Mock the _step2_identify_relevant_elements method
            with patch.object(agent_tools, '_step2_identify_relevant_elements') as mock_step2:
                mock_step2.return_value = {"file_1.py": ["function_1", "class_1"]}
                
                # Mock the _step1_identify_relevant_files method to ensure it's not called
                with patch.object(agent_tools, '_step1_identify_relevant_files') as mock_step1:
                    result = await agent_tools._identify_relevant_files_and_methods(
                        small_file_infos, request, max_iterations
                    )
                    
                    # Verify Step 1 was NOT called
                    mock_step1.assert_not_called()
                    
                    # Verify Step 2 was called with ALL files
                    mock_step2.assert_called_once()
                    call_args = mock_step2.call_args
                    assert call_args[0][0] == small_file_infos  # file_infos
                    assert call_args[0][1] == list(small_file_infos.keys())  # all file paths
                    assert call_args[0][2] == request
                    assert call_args[0][3] == mock_gemini
                    
                    # Verify result
                    assert result == {"file_1.py": ["function_1", "class_1"]}
    
    @pytest.mark.asyncio
    async def test_use_step1_large_codebase(self, agent_tools, large_file_infos):
        """Test that Step 1 is used when there are more than 1000 files."""
        request = "test request"
        max_iterations = 3
        
        # Mock the GeminiService
        with patch('services.gemini_service.GeminiService') as mock_gemini_class:
            mock_gemini = AsyncMock()
            mock_gemini_class.return_value = mock_gemini
            
            # Mock Step 1 to return a subset of files
            with patch.object(agent_tools, '_step1_identify_relevant_files') as mock_step1:
                mock_step1.return_value = ["file_1.py", "file_2.py", "file_3.py"]
                
                # Mock Step 2 to return results
                with patch.object(agent_tools, '_step2_identify_relevant_elements') as mock_step2:
                    mock_step2.return_value = {"file_1.py": ["function_1"], "file_2.py": ["class_2"]}
                    
                    result = await agent_tools._identify_relevant_files_and_methods(
                        large_file_infos, request, max_iterations
                    )
                    
                    # Verify Step 1 WAS called
                    mock_step1.assert_called_once()
                    
                    # Verify Step 2 was called with the subset from Step 1
                    mock_step2.assert_called_once()
                    call_args = mock_step2.call_args
                    assert call_args[0][0] == large_file_infos  # file_infos
                    assert call_args[0][1] == ["file_1.py", "file_2.py", "file_3.py"]  # subset from Step 1
                    assert call_args[0][2] == request
                    assert call_args[0][3] == mock_gemini
                    
                    # Verify result
                    assert result == {"file_1.py": ["function_1"], "file_2.py": ["class_2"]}
    
    @pytest.mark.asyncio
    async def test_skip_step1_exactly_999_files(self, agent_tools):
        """Test that Step 1 is skipped when there are exactly 999 files."""
        # Create exactly 999 files
        file_infos = {}
        for i in range(999):
            file_path = f"file_{i}.py"
            elements = [CodeElement(name=f"function_{i}", type="function", line_number=1, file_path=file_path)]
            file_infos[file_path] = FileInfo(
                path=file_path,
                name=f"file_{i}.py",
                extension=".py",
                language="python",
                size=1000,
                elements=elements,
                last_modified=1234567890.0
            )
        
        request = "test request"
        max_iterations = 3
        
        with patch('services.gemini_service.GeminiService') as mock_gemini_class:
            mock_gemini = AsyncMock()
            mock_gemini_class.return_value = mock_gemini
            
            with patch.object(agent_tools, '_step1_identify_relevant_files') as mock_step1:
                with patch.object(agent_tools, '_step2_identify_relevant_elements') as mock_step2:
                    mock_step2.return_value = {"file_1.py": ["function_1"]}
                    
                    result = await agent_tools._identify_relevant_files_and_methods(
                        file_infos, request, max_iterations
                    )
                    
                    # Verify Step 1 was NOT called (999 < 1000)
                    mock_step1.assert_not_called()
                    
                    # Verify Step 2 was called with all files
                    mock_step2.assert_called_once()
                    call_args = mock_step2.call_args
                    assert len(call_args[0][1]) == 999  # all 999 files passed to Step 2
    
    @pytest.mark.asyncio
    async def test_use_step1_exactly_1000_files(self, agent_tools):
        """Test that Step 1 is used when there are exactly 1000 files."""
        # Create exactly 1000 files
        file_infos = {}
        for i in range(1000):
            file_path = f"file_{i}.py"
            elements = [CodeElement(name=f"function_{i}", type="function", line_number=1, file_path=file_path)]
            file_infos[file_path] = FileInfo(
                path=file_path,
                name=f"file_{i}.py",
                extension=".py",
                language="python",
                size=1000,
                elements=elements,
                last_modified=1234567890.0
            )
        
        request = "test request"
        max_iterations = 3
        
        with patch('services.gemini_service.GeminiService') as mock_gemini_class:
            mock_gemini = AsyncMock()
            mock_gemini_class.return_value = mock_gemini
            
            with patch.object(agent_tools, '_step1_identify_relevant_files') as mock_step1:
                mock_step1.return_value = ["file_1.py", "file_2.py"]
                
                with patch.object(agent_tools, '_step2_identify_relevant_elements') as mock_step2:
                    mock_step2.return_value = {"file_1.py": ["function_1"]}
                    
                    result = await agent_tools._identify_relevant_files_and_methods(
                        file_infos, request, max_iterations
                    )
                    
                    # Verify Step 1 WAS called (1000 >= 1000)
                    mock_step1.assert_called_once()
                    
                    # Verify Step 2 was called with subset from Step 1
                    mock_step2.assert_called_once()
                    call_args = mock_step2.call_args
                    assert call_args[0][1] == ["file_1.py", "file_2.py"]  # subset from Step 1
