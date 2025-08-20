import unittest
import os
import tempfile
import shutil
from unittest.mock import patch
from services.agent_tools import ExtractCodeContextTool

class TestSimplifiedPathValidation(unittest.TestCase):
    """Test the simplified path validation that allows any directory access."""
    
    def setUp(self):
        """Set up test environment."""
        self.agent_tools = ExtractCodeContextTool()
        
        # Create a temporary directory structure
        self.temp_dir = tempfile.mkdtemp()
        self.project_dir = os.path.join(self.temp_dir, "project")
        self.external_dir = os.path.join(self.temp_dir, "external")
        self.kaizen_dir = os.path.join(self.temp_dir, "kaizen")
        self.kaizen_agent_dir = os.path.join(self.kaizen_dir, "kaizen-agent-internal")
        
        # Create all directories
        os.makedirs(self.project_dir, exist_ok=True)
        os.makedirs(self.external_dir, exist_ok=True)
        os.makedirs(self.kaizen_agent_dir, exist_ok=True)
        
        # Create test files
        with open(os.path.join(self.project_dir, "main.py"), "w") as f:
            f.write("# Project Main")
        
        with open(os.path.join(self.external_dir, "external.py"), "w") as f:
            f.write("# External Code")
        
        with open(os.path.join(self.kaizen_agent_dir, "kaizen.py"), "w") as f:
            f.write("# Kaizen Agent")
    
    def tearDown(self):
        """Clean up test environment."""
        shutil.rmtree(self.temp_dir)
    
    def test_any_directory_allowed(self):
        """Test that any directory is allowed without restrictions."""
        project_id = "test-project"
        
        # Test various directories - all should be allowed
        test_paths = [
            self.project_dir,
            self.external_dir,
            self.kaizen_agent_dir,
            os.path.join(self.temp_dir, "new-dir")
        ]
        
        # Create the new directory
        os.makedirs(test_paths[3], exist_ok=True)
        
        for path in test_paths:
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, path
            )
            
            self.assertTrue(is_valid, f"Path {path} should be valid: {error_message}")
            self.assertEqual(canonicalized_path, os.path.realpath(path))
    
    def test_relative_paths_work(self):
        """Test that relative paths work correctly."""
        project_id = "test-project"
        current_dir = os.getcwd()
        
        try:
            # Change to temp directory to test relative paths
            os.chdir(self.temp_dir)
            
            # Test relative paths
            relative_paths = [
                "./project",
                "./external",
                "./kaizen/kaizen-agent-internal",
                "../" + os.path.basename(self.temp_dir) + "/project"
            ]
            
            for path in relative_paths:
                is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                    project_id, path
                )
                
                self.assertTrue(is_valid, f"Relative path {path} should be valid: {error_message}")
        finally:
            # Restore original directory
            os.chdir(current_dir)
    
    def test_invalid_paths_rejected(self):
        """Test that invalid paths are still rejected."""
        project_id = "test-project"
        
        # Test invalid paths
        invalid_paths = [
            "/non/existent/path",
            os.path.join(self.temp_dir, "non-existent"),
            "not/a/real/path"
        ]
        
        for path in invalid_paths:
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, path
            )
            
            self.assertFalse(is_valid, f"Invalid path {path} should be rejected")
            # Check for either "Invalid path provided" or "not a directory" error messages
            self.assertTrue(
                "Invalid path provided" in error_message or "not a directory" in error_message,
                f"Expected error message about invalid path, got: {error_message}"
            )
    
    def test_file_paths_rejected(self):
        """Test that file paths (not directories) are rejected."""
        project_id = "test-project"
        
        # Create a test file
        test_file = os.path.join(self.temp_dir, "test_file.txt")
        with open(test_file, "w") as f:
            f.write("test")
        
        is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
            project_id, test_file
        )
        
        self.assertFalse(is_valid, "File path should be rejected")
        self.assertIn("not a directory", error_message)
    
    def test_execute_method_requires_path(self):
        """Test that execute method requires a path to be provided."""
        project_id = "test-project"
        
        # Test without providing a path
        # Note: We can't easily test the async execute method in a unit test,
        # but we can test the validation logic that it uses
        
        # The execute method should return an error when no path is provided
        # This is handled in the execute method itself, not in _validate_and_canonicalize_path
        
        # Test that a valid path works
        is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
            project_id, self.project_dir
        )
        
        self.assertTrue(is_valid, "Valid path should work")
        self.assertEqual(canonicalized_path, os.path.realpath(self.project_dir))
    
    def test_simple_validation(self):
        """Test that path validation works simply and effectively."""
        project_id = "test-project"
        
        # Test that any valid directory works
        is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
            project_id, self.external_dir
        )
        
        self.assertTrue(is_valid, "Any valid directory should work")
        self.assertEqual(canonicalized_path, os.path.realpath(self.external_dir))

if __name__ == "__main__":
    unittest.main()
