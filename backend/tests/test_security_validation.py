import unittest
import os
import tempfile
from unittest.mock import patch
from services.agent_tools import ExtractCodeContextTool

class TestSecurityValidation(unittest.TestCase):
    """Test that security validation still works correctly."""
    
    def setUp(self):
        """Set up test environment."""
        self.agent_tools = ExtractCodeContextTool()
        
        # Create a temporary directory structure
        self.temp_dir = tempfile.mkdtemp()
        self.project_root = os.path.join(self.temp_dir, "project")
        self.outside_dir = os.path.join(self.temp_dir, "outside")
        
        # Create the directories
        os.makedirs(self.project_root, exist_ok=True)
        os.makedirs(self.outside_dir, exist_ok=True)
    
    def tearDown(self):
        """Clean up test environment."""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_outside_path_rejection(self):
        """Test that paths outside the project are still rejected."""
        project_id = "test-project"
        
        # Mock the file_service to return our test project
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.project_root
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # This should be invalid - the provided path is outside the project codebase_path
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, self.outside_dir
            )
            
            self.assertFalse(is_valid, "Outside directory path should be invalid")
            self.assertIn("outside the project's codebase", error_message)
    
    def test_sibling_path_rejection(self):
        """Test that sibling paths are rejected."""
        project_id = "test-project"
        
        # Create a sibling directory
        sibling_dir = os.path.join(self.temp_dir, "sibling")
        os.makedirs(sibling_dir, exist_ok=True)
        
        # Mock the file_service to return our test project
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.project_root
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # This should be invalid - the provided path is a sibling, not a subdirectory
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, sibling_dir
            )
            
            self.assertFalse(is_valid, "Sibling directory path should be invalid")
            self.assertIn("outside the project's codebase", error_message)
    
    def test_parent_path_rejection(self):
        """Test that parent paths are rejected."""
        project_id = "test-project"
        
        # Create a subdirectory in the project
        sub_dir = os.path.join(self.project_root, "subdir")
        os.makedirs(sub_dir, exist_ok=True)
        
        # Mock the file_service to return our test project
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': sub_dir  # Set project codebase to subdirectory
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # This should be invalid - the provided path is a parent of the project codebase
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, self.project_root
            )
            
            self.assertFalse(is_valid, "Parent directory path should be invalid")
            self.assertIn("outside the project's codebase", error_message)

if __name__ == "__main__":
    unittest.main()
