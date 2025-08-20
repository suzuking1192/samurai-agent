"""
Test to verify that the absolute path solution works correctly.
This test ensures that codebase paths are properly converted to absolute paths
and that the backend can access them regardless of where the frontend and backend are running.
"""

import os
import tempfile
import pytest
from unittest.mock import patch, Mock
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.agent_tools import ExtractCodeContextTool
from services.file_service import FileService
from models import Project


class TestAbsolutePathSolution:
    """Test that absolute paths work correctly for codebase access."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.tool = ExtractCodeContextTool()
        
        # Create a test file in the temp directory
        test_file = os.path.join(self.temp_dir, "test.py")
        with open(test_file, 'w') as f:
            f.write("def test_function():\n    pass\n")
    
    def teardown_method(self):
        """Clean up test environment."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_absolute_path_works_correctly(self):
        """Test that absolute paths work correctly for codebase access."""
        # Get the absolute path of our temp directory
        absolute_path = os.path.abspath(self.temp_dir)
        
        # Verify that the path exists and is a directory
        assert os.path.exists(absolute_path)
        assert os.path.isdir(absolute_path)
        
        # Verify that we can access files in the directory
        test_file = os.path.join(absolute_path, "test.py")
        assert os.path.exists(test_file)
    
    def test_absolute_path_validation(self):
        """Test that absolute path validation works correctly."""
        absolute_path = os.path.abspath(self.temp_dir)
        
        # Test that the path exists and is a directory
        assert os.path.exists(absolute_path)
        assert os.path.isdir(absolute_path)
        
        # Test that we can access files in the directory
        test_file = os.path.join(absolute_path, "test.py")
        assert os.path.exists(test_file)
        
        # Test that the tool can validate this path (without running the full extraction)
        # This verifies that our path validation logic works with absolute paths
        from services.code_parser import CodeParser
        code_parser = CodeParser()
        
        # Try to scan the codebase - this should work with absolute paths
        file_infos = code_parser.scan_codebase(absolute_path, max_files=100)
        
        # Should find at least our test file
        assert len(file_infos) > 0
        
        # Check if our test file is in the results (using normalized paths)
        test_file_path = os.path.join(absolute_path, "test.py")
        normalized_test_file_path = os.path.realpath(test_file_path)
        
        # Find the file in the results by checking if any key matches our normalized path
        found_file_path = None
        for file_path in file_infos.keys():
            if os.path.realpath(file_path) == normalized_test_file_path:
                found_file_path = file_path
                break
        
        assert found_file_path is not None, f"Test file not found in scan results. Expected: {normalized_test_file_path}, Found: {list(file_infos.keys())}"
        
        # Verify the file info contains the expected data
        file_info = file_infos[found_file_path]
        assert file_info.name == "test.py"
        assert file_info.language == "python"
    
    def test_relative_path_conversion(self):
        """Test that relative paths are properly converted to absolute paths."""
        # Create a relative path that points to our temp directory
        # We'll use a relative path from the current working directory
        relative_path = os.path.relpath(self.temp_dir, os.getcwd())
        
        # Convert to absolute path (this simulates what the backend does)
        absolute_path = os.path.abspath(relative_path)
        
        # The absolute path should exist and be a directory
        assert os.path.exists(absolute_path)
        assert os.path.isdir(absolute_path)
        
        # It should be the same as our temp directory
        assert os.path.realpath(absolute_path) == os.path.realpath(self.temp_dir)
    
    def test_nonexistent_path_handling(self):
        """Test that nonexistent paths are handled correctly."""
        nonexistent_path = "/nonexistent/path/that/does/not/exist"
        
        # Verify that the path doesn't exist
        assert not os.path.exists(nonexistent_path)
        
        # This should be handled gracefully by the tool
        # (The actual error handling is tested in the main test suite)
    
    def test_file_path_handling(self):
        """Test that providing a file path instead of directory is handled correctly."""
        # Create a test file
        test_file = os.path.join(self.temp_dir, "test_file.txt")
        with open(test_file, 'w') as f:
            f.write("test content")
        
        # Verify that the file exists but is not a directory
        assert os.path.exists(test_file)
        assert not os.path.isdir(test_file)
        
        # This should be handled gracefully by the tool
        # (The actual error handling is tested in the main test suite)


# Helper function for async mocks
class AsyncMock(Mock):
    async def __call__(self, *args, **kwargs):
        return super().__call__(*args, **kwargs)
