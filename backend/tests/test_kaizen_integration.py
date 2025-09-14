import unittest
import os
import tempfile
import shutil
from unittest.mock import patch
from backend.services.tools.agent_tools import ExtractCodeContextTool

class TestKaizenIntegration(unittest.TestCase):
    """Test real-world integration with kaizen-agent-internal and other external paths."""
    
    def setUp(self):
        """Set up test environment."""
        self.agent_tools = ExtractCodeContextTool()
        
        # Create a temporary directory structure that mimics real-world scenario
        self.temp_dir = tempfile.mkdtemp()
        
        # Main project structure
        self.samurai_agent = os.path.join(self.temp_dir, "samurai-agent")
        self.samurai_backend = os.path.join(self.samurai_agent, "backend")
        self.samurai_nested = os.path.join(self.samurai_backend, "samurai-agent")
        
        # External kaizen structure
        self.kaizen_dir = os.path.join(self.temp_dir, "kaizen")
        self.kaizen_agent_internal = os.path.join(self.kaizen_dir, "kaizen-agent-internal")
        
        # Other external projects
        self.other_project = os.path.join(self.temp_dir, "other-project")
        
        # Create all directories
        os.makedirs(self.samurai_nested, exist_ok=True)
        os.makedirs(self.kaizen_agent_internal, exist_ok=True)
        os.makedirs(self.other_project, exist_ok=True)
        
        # Create test files
        with open(os.path.join(self.samurai_agent, "README.md"), "w") as f:
            f.write("# Samurai Agent Project")
        
        with open(os.path.join(self.samurai_nested, "main.py"), "w") as f:
            f.write("# Nested Samurai Agent")
        
        with open(os.path.join(self.kaizen_agent_internal, "kaizen.py"), "w") as f:
            f.write("# Kaizen Agent Internal")
        
        with open(os.path.join(self.other_project, "other.py"), "w") as f:
            f.write("# Other Project")
    
    def tearDown(self):
        """Clean up test environment."""
        shutil.rmtree(self.temp_dir)
    
    def test_nested_samurai_agent_without_external(self):
        """Test that nested samurai-agent works without external paths enabled."""
        project_id = "samurai-project"
        
        # Mock the file_service to return our test project
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.samurai_agent
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # This should work - nested directory within project
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, self.samurai_nested, allow_external_paths=False
            )
            
            self.assertTrue(is_valid, f"Nested samurai-agent should be valid: {error_message}")
            self.assertEqual(canonicalized_path, os.path.realpath(self.samurai_nested))
    
    def test_kaizen_agent_internal_with_external_enabled(self):
        """Test that kaizen-agent-internal works when external paths are enabled."""
        project_id = "samurai-project"
        
        # Mock the file_service to return our test project
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.samurai_agent
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # This should work when external paths are enabled
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, self.kaizen_agent_internal, allow_external_paths=True
            )
            
            self.assertTrue(is_valid, f"Kaizen agent internal should be valid with external paths: {error_message}")
            self.assertEqual(canonicalized_path, os.path.realpath(self.kaizen_agent_internal))
    
    def test_kaizen_agent_internal_without_external(self):
        """Test that kaizen-agent-internal is rejected when external paths are disabled."""
        project_id = "samurai-project"
        
        # Mock the file_service to return our test project
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.samurai_agent
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # This should be rejected when external paths are disabled
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, self.kaizen_agent_internal, allow_external_paths=False
            )
            
            self.assertFalse(is_valid, "Kaizen agent internal should be rejected without external paths")
            self.assertIn("outside the project's codebase", error_message)
    
    def test_relative_path_kaizen(self):
        """Test relative path like ./kaizen/kaizen-agent-internal."""
        project_id = "samurai-project"
        
        # Mock the file_service to return our test project
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.samurai_agent
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # Test with relative path from samurai-agent directory
            relative_path = os.path.join("..", "kaizen", "kaizen-agent-internal")
            current_dir = os.getcwd()
            
            try:
                # Change to samurai-agent directory to test relative path
                os.chdir(self.samurai_agent)
                
                is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                    project_id, relative_path, allow_external_paths=True
                )
                
                self.assertTrue(is_valid, f"Relative kaizen path should be valid: {error_message}")
                self.assertEqual(canonicalized_path, os.path.realpath(self.kaizen_agent_internal))
            finally:
                # Restore original directory
                os.chdir(current_dir)
    
    def test_multiple_external_paths(self):
        """Test that multiple external paths work correctly."""
        project_id = "samurai-project"
        
        # Mock the file_service to return our test project
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.samurai_agent
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # Test multiple external paths
            external_paths = [
                self.kaizen_agent_internal,
                self.other_project,
                os.path.join(self.temp_dir, "new-external")
            ]
            
            # Create the new external directory
            os.makedirs(external_paths[2], exist_ok=True)
            
            for path in external_paths:
                is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                    project_id, path, allow_external_paths=True
                )
                
                self.assertTrue(is_valid, f"External path {path} should be valid: {error_message}")
                self.assertEqual(canonicalized_path, os.path.realpath(path))
    
    def test_execute_method_with_external_paths(self):
        """Test the execute method with external paths enabled."""
        project_id = "samurai-project"
        
        # Mock the file_service to return our test project
        from services.file_service import file_service
        
        mock_project = type('Project', (), {
            'id': project_id,
            'codebase_path': self.samurai_agent
        })()
        
        with patch.object(file_service, 'get_project_by_id', return_value=mock_project):
            # Test that the execute method can handle external paths
            # We'll just test the validation part since the full execution requires more setup
            is_valid, canonicalized_path, error_message = self.agent_tools._validate_and_canonicalize_path(
                project_id, self.kaizen_agent_internal, allow_external_paths=True
            )
            
            self.assertTrue(is_valid, f"Execute method should accept external paths: {error_message}")

if __name__ == "__main__":
    unittest.main()
