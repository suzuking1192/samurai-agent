import unittest
import os
from unittest.mock import patch
from services.agent_tools import ExtractCodeContextTool

class TestRealScenarioFix(unittest.TestCase):
    """Test the real scenario that was failing."""
    
    def setUp(self):
        """Set up test environment."""
        self.agent_tools = ExtractCodeContextTool()
        
        # The real paths from the issue
        self.project_codebase_path = "/Users/yutosuzuki/code/samurai-agent"
        self.provided_path = "/Users/yutosuzuki/code/samurai-agent/backend/samurai-agent"
        
        # Verify these paths actually exist
        self.assertTrue(os.path.exists(self.project_codebase_path), "Project codebase path should exist")
        self.assertTrue(os.path.exists(self.provided_path), "Provided path should exist")
    
    def test_real_scenario_path_validation(self):
        """Test the real scenario that was failing."""
        project_id = "test-project"
        
        # Mock the file_service to return our test project
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.project_codebase_path
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # This should now be valid - the provided path is a subdirectory of the project codebase_path
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, self.provided_path
            )
            
            self.assertTrue(is_valid, f"Real scenario path should be valid: {error_message}")
            self.assertEqual(canonicalized_path, os.path.realpath(self.provided_path))
    
    def test_project_root_path_validation(self):
        """Test that project root path is also valid."""
        project_id = "test-project"
        
        # Mock the file_service to return our test project
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.project_codebase_path
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # This should be valid - the provided path equals the project codebase_path
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, self.project_codebase_path
            )
            
            self.assertTrue(is_valid, f"Project root path should be valid: {error_message}")
            self.assertEqual(canonicalized_path, os.path.realpath(self.project_codebase_path))

if __name__ == "__main__":
    unittest.main()
