import unittest
import os
import tempfile
import shutil
from pathlib import Path
from backend.services.tools.agent_tools import ExtractCodeContextTool

class TestPathValidationFix(unittest.TestCase):
    """Test the path validation fix for nested directories with same name."""
    
    def setUp(self):
        """Set up test environment."""
        self.agent_tools = ExtractCodeContextTool()
        
        # Create a temporary directory structure that mimics the issue
        self.temp_dir = tempfile.mkdtemp()
        self.project_root = os.path.join(self.temp_dir, "samurai-agent")
        self.backend_dir = os.path.join(self.project_root, "backend")
        self.nested_samurai_dir = os.path.join(self.backend_dir, "samurai-agent")
        
        # Create the directory structure
        os.makedirs(self.nested_samurai_dir, exist_ok=True)
        
        # Create some test files
        with open(os.path.join(self.project_root, "README.md"), "w") as f:
            f.write("# Project Root")
        
        with open(os.path.join(self.backend_dir, "main.py"), "w") as f:
            f.write("# Backend Main")
        
        with open(os.path.join(self.nested_samurai_dir, "test.py"), "w") as f:
            f.write("# Nested Test")
    
    def tearDown(self):
        """Clean up test environment."""
        shutil.rmtree(self.temp_dir)
    
    def test_project_root_path_validation(self):
        """Test that project root path is valid."""
        # Mock project with project root as codebase_path
        project_id = "test-project"
        
        # Mock the file_service to return our test project
        from unittest.mock import patch
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.project_root
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, self.project_root
            )
            
            self.assertTrue(is_valid, f"Project root path should be valid: {error_message}")
            self.assertEqual(canonicalized_path, os.path.realpath(self.project_root))
    
    def test_nested_directory_path_validation(self):
        """Test that nested directory path is valid."""
        # Mock project with project root as codebase_path
        project_id = "test-project"
        
        # Mock the file_service to return our test project
        from unittest.mock import patch
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.project_root
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # This should be valid - the provided path is a subdirectory of the project codebase_path
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, self.nested_samurai_dir
            )
            
            self.assertTrue(is_valid, f"Nested directory path should be valid: {error_message}")
            self.assertEqual(canonicalized_path, os.path.realpath(self.nested_samurai_dir))
    
    def test_backend_directory_path_validation(self):
        """Test that backend directory path is valid."""
        # Mock project with project root as codebase_path
        project_id = "test-project"
        
        # Mock the file_service to return our test project
        from unittest.mock import patch
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.project_root
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # This should be valid - the provided path is a subdirectory of the project codebase_path
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, self.backend_dir
            )
            
            self.assertTrue(is_valid, f"Backend directory path should be valid: {error_message}")
            self.assertEqual(canonicalized_path, os.path.realpath(self.backend_dir))
    
    def test_outside_directory_path_validation(self):
        """Test that paths outside the project are rejected."""
        # Mock project with project root as codebase_path
        project_id = "test-project"
        
        # Mock the file_service to return our test project
        from unittest.mock import patch
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.project_root
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # This should be invalid - the provided path is outside the project codebase_path
            outside_path = os.path.join(self.temp_dir, "outside-project")
            os.makedirs(outside_path, exist_ok=True)
            
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, outside_path
            )
            
            self.assertFalse(is_valid, "Outside directory path should be invalid")
            self.assertIn("outside the project's codebase", error_message)

if __name__ == "__main__":
    unittest.main()
