import os
import tempfile
import shutil
import pytest
from unittest.mock import Mock, patch
from pathlib import Path

# Import the agent tools to test
from backend.services.tools.agent_tools import ExtractCodeContextTool
from models import Project


class TestPathValidationSecurity:
    """Test suite for path validation security in agent_tools.py"""
    
    def setup_method(self):
        """Set up test environment before each test."""
        self.tool = ExtractCodeContextTool()
        
        # Create temporary directories for testing
        self.temp_dir = tempfile.mkdtemp()
        self.project_dir = os.path.join(self.temp_dir, "project")
        self.outside_dir = os.path.join(self.temp_dir, "outside")
        
        # Create the directories
        os.makedirs(self.project_dir, exist_ok=True)
        os.makedirs(self.outside_dir, exist_ok=True)
        
        # Create some test files
        with open(os.path.join(self.project_dir, "test.py"), "w") as f:
            f.write("print('hello world')")
        
        with open(os.path.join(self.outside_dir, "secret.py"), "w") as f:
            f.write("SECRET_KEY = 'super_secret'")
    
    def teardown_method(self):
        """Clean up test environment after each test."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_valid_path_within_project(self):
        """Test that a valid path within the project's codebase is accepted."""
        # Mock the file service to return a project with the project_dir as codebase_path
        mock_project = Mock()
        mock_project.codebase_path = self.project_dir
        
        with patch('backend.services.file_service.file_service') as mock_file_service:
            mock_file_service.get_project_by_id.return_value = mock_project
            
            # Test with a subdirectory of the project
            subdir = os.path.join(self.project_dir, "src")
            os.makedirs(subdir, exist_ok=True)
            
            is_valid, canonicalized_path, error_message = self.tool._validate_and_canonicalize_path(
                "test_project_id", subdir
            )
            
            assert is_valid is True
            assert canonicalized_path == os.path.realpath(subdir)
            assert error_message == ""
    
    def test_path_outside_project_codebase(self):
        """Test that a path outside the project's codebase is rejected."""
        # Mock the file service to return a project with the project_dir as codebase_path
        mock_project = Mock()
        mock_project.codebase_path = self.project_dir
        
        with patch('backend.services.file_service.file_service') as mock_file_service:
            mock_file_service.get_project_by_id.return_value = mock_project
            
            # Test with a path outside the project
            is_valid, canonicalized_path, error_message = self.tool._validate_and_canonicalize_path(
                "test_project_id", self.outside_dir
            )
            
            assert is_valid is False
            assert canonicalized_path == ""
            assert "outside the project's codebase" in error_message
    
    def test_nonexistent_project(self):
        """Test that a nonexistent project returns an error."""
        with patch('backend.services.file_service.file_service') as mock_file_service:
            mock_file_service.get_project_by_id.return_value = None
            
            is_valid, canonicalized_path, error_message = self.tool._validate_and_canonicalize_path(
                "nonexistent_project_id", self.project_dir
            )
            
            assert is_valid is False
            assert canonicalized_path == ""
            assert "not found" in error_message
    
    def test_project_without_codebase_path(self):
        """Test that a project without a configured codebase_path returns an error."""
        mock_project = Mock()
        mock_project.codebase_path = None
        
        with patch('backend.services.file_service.file_service') as mock_file_service:
            mock_file_service.get_project_by_id.return_value = mock_project
            
            is_valid, canonicalized_path, error_message = self.tool._validate_and_canonicalize_path(
                "test_project_id", self.project_dir
            )
            
            assert is_valid is False
            assert canonicalized_path == ""
            assert "No codebase path configured" in error_message
    
    def test_nonexistent_path(self):
        """Test that a nonexistent path returns an error."""
        mock_project = Mock()
        mock_project.codebase_path = self.project_dir
        
        with patch('backend.services.file_service.file_service') as mock_file_service:
            mock_file_service.get_project_by_id.return_value = mock_project
            
            nonexistent_path = os.path.join(self.project_dir, "nonexistent")
            is_valid, canonicalized_path, error_message = self.tool._validate_and_canonicalize_path(
                "test_project_id", nonexistent_path
            )
            
            assert is_valid is False
            assert canonicalized_path == ""
            assert "not a directory" in error_message
    
    def test_path_to_file_not_directory(self):
        """Test that a path to a file (not directory) is rejected."""
        mock_project = Mock()
        mock_project.codebase_path = self.project_dir
        
        with patch('backend.services.file_service.file_service') as mock_file_service:
            mock_file_service.get_project_by_id.return_value = mock_project
            
            file_path = os.path.join(self.project_dir, "test.py")
            is_valid, canonicalized_path, error_message = self.tool._validate_and_canonicalize_path(
                "test_project_id", file_path
            )
            
            assert is_valid is False
            assert canonicalized_path == ""
            assert "not a directory" in error_message
    
    def test_symlink_attack_prevention(self):
        """Test that symlink attacks are prevented through canonicalization."""
        mock_project = Mock()
        mock_project.codebase_path = self.project_dir
        
        with patch('backend.services.file_service.file_service') as mock_file_service:
            mock_file_service.get_project_by_id.return_value = mock_project
            
            # Create a symlink that points outside the project
            symlink_path = os.path.join(self.project_dir, "malicious_link")
            try:
                os.symlink(self.outside_dir, symlink_path)
                
                is_valid, canonicalized_path, error_message = self.tool._validate_and_canonicalize_path(
                    "test_project_id", symlink_path
                )
                
                assert is_valid is False
                assert canonicalized_path == ""
                assert "outside the project's codebase" in error_message
            finally:
                # Clean up symlink
                if os.path.exists(symlink_path):
                    os.unlink(symlink_path)
    
    def test_directory_traversal_attack(self):
        """Test that directory traversal attacks are prevented."""
        mock_project = Mock()
        mock_project.codebase_path = self.project_dir
        
        with patch('backend.services.file_service.file_service') as mock_file_service:
            mock_file_service.get_project_by_id.return_value = mock_project
            
            # Create a directory outside the project to test traversal
            outside_subdir = os.path.join(self.outside_dir, "subdir")
            os.makedirs(outside_subdir, exist_ok=True)
            
            # Test various directory traversal attempts that resolve to existing directories
            traversal_paths = [
                os.path.join(self.project_dir, "..", "outside", "subdir"),
            ]
            
            for traversal_path in traversal_paths:
                is_valid, canonicalized_path, error_message = self.tool._validate_and_canonicalize_path(
                    "test_project_id", traversal_path
                )
                
                assert is_valid is False
                assert canonicalized_path == ""
                assert "outside the project's codebase" in error_message
    
    def test_absolute_path_attack(self):
        """Test that absolute paths outside the project are rejected."""
        mock_project = Mock()
        mock_project.codebase_path = self.project_dir
        
        with patch('backend.services.file_service.file_service') as mock_file_service:
            mock_file_service.get_project_by_id.return_value = mock_project
            
            # Test with absolute path outside project
            is_valid, canonicalized_path, error_message = self.tool._validate_and_canonicalize_path(
                "test_project_id", self.outside_dir
            )
            
            assert is_valid is False
            assert canonicalized_path == ""
            assert "outside the project's codebase" in error_message
    
    def test_exact_project_path_match(self):
        """Test that the exact project codebase path is accepted."""
        mock_project = Mock()
        mock_project.codebase_path = self.project_dir
        
        with patch('backend.services.file_service.file_service') as mock_file_service:
            mock_file_service.get_project_by_id.return_value = mock_project
            
            is_valid, canonicalized_path, error_message = self.tool._validate_and_canonicalize_path(
                "test_project_id", self.project_dir
            )
            
            assert is_valid is True
            assert canonicalized_path == os.path.realpath(self.project_dir)
            assert error_message == ""
    
    def test_file_service_exception_handling(self):
        """Test that exceptions from file service are handled gracefully."""
        with patch('backend.services.file_service.file_service') as mock_file_service:
            mock_file_service.get_project_by_id.side_effect = Exception("Database error")
            
            is_valid, canonicalized_path, error_message = self.tool._validate_and_canonicalize_path(
                "test_project_id", self.project_dir
            )
            
            assert is_valid is False
            assert canonicalized_path == ""
            assert "Failed to validate path" in error_message
    
    def test_canonicalization_preserves_valid_paths(self):
        """Test that valid paths are properly canonicalized."""
        mock_project = Mock()
        mock_project.codebase_path = self.project_dir
        
        with patch('backend.services.file_service.file_service') as mock_file_service:
            mock_file_service.get_project_by_id.return_value = mock_project
            
            # Test with a path that has redundant separators
            redundant_path = os.path.join(self.project_dir, "src", "..", "src")
            os.makedirs(os.path.join(self.project_dir, "src"), exist_ok=True)
            
            is_valid, canonicalized_path, error_message = self.tool._validate_and_canonicalize_path(
                "test_project_id", redundant_path
            )
            
            assert is_valid is True
            expected_canonical = os.path.realpath(os.path.join(self.project_dir, "src"))
            assert canonicalized_path == expected_canonical
            assert error_message == ""


if __name__ == "__main__":
    pytest.main([__file__])
