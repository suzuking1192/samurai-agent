import unittest
import os
import tempfile
import shutil
from unittest.mock import patch
from backend.services.tools.agent_tools import ExtractCodeContextTool

class TestExternalPaths(unittest.TestCase):
    """Test external path validation functionality."""
    
    def setUp(self):
        """Set up test environment."""
        self.agent_tools = ExtractCodeContextTool()
        
        # Create a temporary directory structure
        self.temp_dir = tempfile.mkdtemp()
        self.project_root = os.path.join(self.temp_dir, "project")
        self.external_dir = os.path.join(self.temp_dir, "external")
        self.kaizen_dir = os.path.join(self.temp_dir, "kaizen")
        self.kaizen_agent_dir = os.path.join(self.kaizen_dir, "kaizen-agent-internal")
        
        # Create the directories
        os.makedirs(self.project_root, exist_ok=True)
        os.makedirs(self.external_dir, exist_ok=True)
        os.makedirs(self.kaizen_agent_dir, exist_ok=True)
        
        # Create some test files
        with open(os.path.join(self.project_root, "README.md"), "w") as f:
            f.write("# Project Root")
        
        with open(os.path.join(self.external_dir, "external.py"), "w") as f:
            f.write("# External Code")
        
        with open(os.path.join(self.kaizen_agent_dir, "kaizen.py"), "w") as f:
            f.write("# Kaizen Agent Code")
    
    def tearDown(self):
        """Clean up test environment."""
        shutil.rmtree(self.temp_dir)
    
    def test_external_path_allowed(self):
        """Test that external paths are allowed when allow_external_paths=True."""
        project_id = "test-project"
        
        # Mock the file_service to return our test project
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.project_root
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # This should be valid when allow_external_paths=True
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, self.external_dir, allow_external_paths=True
            )
            
            self.assertTrue(is_valid, f"External path should be valid when allowed: {error_message}")
            self.assertEqual(canonicalized_path, os.path.realpath(self.external_dir))
    
    def test_external_path_denied(self):
        """Test that external paths are denied when allow_external_paths=False."""
        project_id = "test-project"
        
        # Mock the file_service to return our test project
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.project_root
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # This should be invalid when allow_external_paths=False
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, self.external_dir, allow_external_paths=False
            )
            
            self.assertFalse(is_valid, "External path should be invalid when not allowed")
            self.assertIn("outside the project's codebase", error_message)
    
    def test_kaizen_agent_path_allowed(self):
        """Test that kaizen-agent-internal path is allowed when allow_external_paths=True."""
        project_id = "test-project"
        
        # Mock the file_service to return our test project
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.project_root
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # This should be valid when allow_external_paths=True
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, self.kaizen_agent_dir, allow_external_paths=True
            )
            
            self.assertTrue(is_valid, f"Kaizen agent path should be valid when allowed: {error_message}")
            self.assertEqual(canonicalized_path, os.path.realpath(self.kaizen_agent_dir))
    
    def test_relative_path_allowed(self):
        """Test that relative paths like ./kaizen/kaizen-agent-internal work."""
        project_id = "test-project"
        
        # Mock the file_service to return our test project
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.project_root
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # Test with relative path
            relative_path = os.path.join("..", "kaizen", "kaizen-agent-internal")
            current_dir = os.getcwd()
            
            try:
                # Change to project directory to test relative path
                os.chdir(self.project_root)
                
                is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                    project_id, relative_path, allow_external_paths=True
                )
                
                self.assertTrue(is_valid, f"Relative path should be valid when allowed: {error_message}")
                self.assertEqual(canonicalized_path, os.path.realpath(self.kaizen_agent_dir))
            finally:
                # Restore original directory
                os.chdir(current_dir)
    
    def test_project_path_still_works(self):
        """Test that project paths still work when allow_external_paths=True."""
        project_id = "test-project"
        
        # Mock the file_service to return our test project
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.project_root
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # This should still be valid
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, self.project_root, allow_external_paths=True
            )
            
            self.assertTrue(is_valid, f"Project path should still be valid: {error_message}")
            self.assertEqual(canonicalized_path, os.path.realpath(self.project_root))

if __name__ == "__main__":
    unittest.main()
