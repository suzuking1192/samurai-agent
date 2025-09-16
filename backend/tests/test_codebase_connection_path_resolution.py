"""
Unit Tests for Codebase Connection Path Resolution Logic

This test suite verifies the new path resolution strategy in the connect_codebase function,
including top-level directory extraction and refined codebase root detection.
"""

import os
import tempfile
import shutil
import pytest
import pytest_asyncio
from unittest.mock import patch, MagicMock
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from main import connect_codebase, CodebaseConnectRequest
from models import Project
from services.core.file_service import FileService


class TestCodebaseConnectionPathResolution:
    """Test suite for codebase connection path resolution logic."""
    
    def setup_method(self):
        """Set up test environment before each test."""
        # Create temporary directories for testing
        self.temp_dir = tempfile.mkdtemp()
        self.test_project_id = "test-project-123"
        
        # Mock file service
        self.mock_file_service = MagicMock()
        self.mock_project = Project(
            id=self.test_project_id,
            name="Test Project",
            description="Test project for path resolution",
            tech_stack="Python + FastAPI"
        )
        self.mock_file_service.get_project_by_id.return_value = self.mock_project
        self.mock_file_service.save_project.return_value = None
        
        # Patch the file service in the main module
        self.file_service_patcher = patch('main.file_service', self.mock_file_service)
        self.file_service_patcher.start()
    
    def teardown_method(self):
        """Clean up test environment after each test."""
        self.file_service_patcher.stop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def create_test_directory_structure(self, base_path, structure):
        """Create a directory structure for testing.
        
        Args:
            base_path: Base directory to create structure in
            structure: Dict representing directory structure
                      e.g., {'my-project': {'src': {'main.py': 'content'}}}
        """
        def create_structure(path, struct):
            for name, content in struct.items():
                item_path = os.path.join(path, name)
                if isinstance(content, dict):
                    os.makedirs(item_path, exist_ok=True)
                    create_structure(item_path, content)
                else:
                    with open(item_path, 'w') as f:
                        f.write(content)
        
        create_structure(base_path, structure)
    
    def test_extract_top_level_directory_simple(self):
        """Test extraction of top-level directory from paths after removing the file."""
        test_cases = [
            ("my-project/src/main.py", "my-project"),  # File removed -> "my-project/src" -> "my-project"
            ("my-project/README.md", "my-project"),    # File removed -> "my-project" -> "my-project"
            ("my-project/", "my-project"),             # Directory -> "my-project" -> "my-project"
            ("my-project", "my-project"),              # Single segment -> "my-project" -> "my-project"
            ("foo/bar/baz.txt", "foo"),                # File removed -> "foo/bar" -> "foo"
            ("single-file.txt", "single-file.txt"),    # Single file -> "single-file.txt" -> "single-file.txt"
        ]
        
        for input_path, expected in test_cases:
            # Test the new logic: remove file if it has extension, then extract top-level
            path_segments = os.path.normpath(input_path).split(os.sep)
            
            # If the last segment is likely a file (has extension), remove it
            if len(path_segments) > 1 and '.' in path_segments[-1]:
                folder_path = os.sep.join(path_segments[:-1])
            else:
                folder_path = os.sep.join(path_segments)
            
            top_level_dir = folder_path.split(os.sep)[0]
            assert top_level_dir == expected, f"Expected '{expected}', got '{top_level_dir}' for input '{input_path}' -> folder '{folder_path}'"
    
    @pytest.mark.asyncio
    async def test_path_resolution_simple_project(self):
        """Test path resolution for a simple project structure."""
        # Create test structure: temp_dir/my-project/src/main.py
        project_structure = {
            'my-project': {
                'src': {
                    'main.py': 'print("Hello World")'
                },
                'README.md': 'Project description'
            }
        }
        
        self.create_test_directory_structure(self.temp_dir, project_structure)
        
        # Test with full relative path
        request = CodebaseConnectRequest(
            path="my-project/src/main.py",
            project_id=self.test_project_id
        )
        
        with patch('os.getcwd', return_value=self.temp_dir):
            with patch('os.path.expanduser', return_value=self.temp_dir):
                response = await connect_codebase(request)
        
        assert response['success'] is True
        # The new logic should resolve to the folder containing the file, not just the top-level directory
        expected_codebase_path = os.path.join(self.temp_dir, 'my-project', 'src')
        assert response['codebase_path'] == expected_codebase_path
        
        # Verify project was saved with correct path
        self.mock_file_service.save_project.assert_called_once()
        saved_project = self.mock_file_service.save_project.call_args[0][0]
        assert saved_project.codebase_path == expected_codebase_path
    
    @pytest.mark.asyncio
    async def test_path_resolution_multiple_candidates(self):
        """Test path resolution when multiple top-level directories exist."""
        # Create multiple projects with same top-level name
        project_structure = {
            'my-project': {
                'src': {
                    'main.py': 'print("Project 1")'
                }
            },
            'another-project': {
                'my-project': {  # Same name, different location
                    'src': {
                        'app.py': 'print("Project 2")'
                    }
                }
            }
        }
        
        self.create_test_directory_structure(self.temp_dir, project_structure)
        
        # Test with path that should match the first project
        request = CodebaseConnectRequest(
            path="my-project/src/main.py",
            project_id=self.test_project_id
        )
        
        with patch('os.getcwd', return_value=self.temp_dir):
            with patch('os.path.expanduser', return_value=self.temp_dir):
                response = await connect_codebase(request)
        
        assert response['success'] is True
        # The new logic should resolve to the folder containing the file
        expected_codebase_path = os.path.join(self.temp_dir, 'my-project', 'src')
        assert response['codebase_path'] == expected_codebase_path
    
    @pytest.mark.asyncio
    async def test_path_resolution_deeper_nesting(self):
        """Test path resolution for deeply nested project structures."""
        # Create a simpler nested structure that matches our search pattern
        project_structure = {
            'my-project': {
                'src': {
                    'components': {
                        'MyComponent.tsx': 'export default MyComponent'
                    }
                }
            }
        }
        
        self.create_test_directory_structure(self.temp_dir, project_structure)
        
        # Test with full relative path
        request = CodebaseConnectRequest(
            path="my-project/src/components/MyComponent.tsx",
            project_id=self.test_project_id
        )
        
        # Mock the resolution strategies to find our test structure
        def mock_expanduser(path):
            if path == "~":
                return self.temp_dir
            # Return a mock path for other expanduser calls to avoid recursion
            return f"/mock/{path.replace('~', 'home')}"
        
        with patch('os.getcwd', return_value=self.temp_dir):
            with patch('os.path.expanduser', side_effect=mock_expanduser):
                response = await connect_codebase(request)
        
        assert response['success'] is True
        # The new logic should resolve to the folder containing the file
        expected_codebase_path = os.path.join(self.temp_dir, 'my-project', 'src', 'components')
        assert response['codebase_path'] == expected_codebase_path
    
    @pytest.mark.asyncio
    async def test_path_resolution_home_directory(self):
        """Test path resolution using home directory strategy."""
        # Create structure in a subdirectory that mimics home directory
        home_like_dir = os.path.join(self.temp_dir, 'home')
        os.makedirs(home_like_dir, exist_ok=True)
        
        project_structure = {
            'my-project': {
                'package.json': '{"name": "my-project"}'
            }
        }
        
        self.create_test_directory_structure(home_like_dir, project_structure)
        
        request = CodebaseConnectRequest(
            path="my-project/package.json",
            project_id=self.test_project_id
        )
        
        # Mock home directory to point to our test directory
        with patch('os.getcwd', return_value='/some/other/directory'):
            with patch('os.path.expanduser', return_value=home_like_dir):
                response = await connect_codebase(request)
        
        assert response['success'] is True
        expected_codebase_path = os.path.join(home_like_dir, 'my-project')
        assert response['codebase_path'] == expected_codebase_path
    
    @pytest.mark.asyncio
    async def test_path_resolution_absolute_path(self):
        """Test that absolute paths are handled correctly."""
        # Create a test project
        project_path = os.path.join(self.temp_dir, 'my-project')
        os.makedirs(project_path, exist_ok=True)
        
        request = CodebaseConnectRequest(
            path=project_path,  # Absolute path
            project_id=self.test_project_id
        )
        
        response = await connect_codebase(request)
        
        assert response['success'] is True
        assert response['codebase_path'] == project_path
    
    @pytest.mark.asyncio
    async def test_path_resolution_nonexistent_path(self):
        """Test error handling for non-existent paths."""
        request = CodebaseConnectRequest(
            path="nonexistent/project/path",
            project_id=self.test_project_id
        )
        
        with pytest.raises(Exception) as exc_info:
            await connect_codebase(request)
        
        # Should raise an HTTP exception about path not existing
        assert "Could not find codebase root" in str(exc_info.value) or "Failed to connect codebase" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_path_resolution_nonexistent_project(self):
        """Test error handling for non-existent project."""
        self.mock_file_service.get_project_by_id.return_value = None
        
        request = CodebaseConnectRequest(
            path="my-project/src/main.py",
            project_id="nonexistent-project"
        )
        
        with pytest.raises(Exception) as exc_info:
            await connect_codebase(request)
        
        # Should raise an HTTP exception about project not found
        assert "Project not found" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_path_resolution_empty_path(self):
        """Test error handling for empty path."""
        request = CodebaseConnectRequest(
            path="",  # Empty path
            project_id=self.test_project_id
        )
        
        with pytest.raises(Exception) as exc_info:
            await connect_codebase(request)
        
        # Should raise an HTTP exception about invalid path
        assert "Path must be a non-empty string" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_path_resolution_invalid_path_type(self):
        """Test error handling for non-string path."""
        # This test is handled by Pydantic validation before reaching our code
        # So we test with an empty string instead
        request = CodebaseConnectRequest(
            path="",  # Empty path (invalid)
            project_id=self.test_project_id
        )
        
        with pytest.raises(Exception) as exc_info:
            await connect_codebase(request)
        
        # Should raise an HTTP exception about invalid path
        assert "Path must be a non-empty string" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_path_resolution_file_vs_directory(self):
        """Test that the function correctly identifies codebase root as directory."""
        # Create a project with files
        project_structure = {
            'my-project': {
                'src': {
                    'main.py': 'print("Hello")'
                },
                'config.json': '{}'
            }
        }
        
        self.create_test_directory_structure(self.temp_dir, project_structure)
        
        # Test with path pointing to a file
        request = CodebaseConnectRequest(
            path="my-project/src/main.py",
            project_id=self.test_project_id
        )
        
        with patch('os.getcwd', return_value=self.temp_dir):
            with patch('os.path.expanduser', return_value=self.temp_dir):
                response = await connect_codebase(request)
        
        assert response['success'] is True
        # Should return the directory containing the file, not the file itself
        expected_codebase_path = os.path.join(self.temp_dir, 'my-project', 'src')
        assert response['codebase_path'] == expected_codebase_path
        assert os.path.isdir(response['codebase_path'])
    
    @pytest.mark.asyncio
    async def test_path_resolution_no_samurai_agent_base_dir_dependency(self):
        """Test that SAMURAI_AGENT_BASE_DIR environment variable is not used."""
        # Set the environment variable
        with patch.dict(os.environ, {'SAMURAI_AGENT_BASE_DIR': '/some/custom/path'}):
            # Create test structure
            project_structure = {
                'my-project': {
                    'README.md': 'Test project'
                }
            }
            
            self.create_test_directory_structure(self.temp_dir, project_structure)
            
            request = CodebaseConnectRequest(
                path="my-project/README.md",
                project_id=self.test_project_id
            )
            
            with patch('os.getcwd', return_value=self.temp_dir):
                with patch('os.path.expanduser', return_value=self.temp_dir):
                    response = await connect_codebase(request)
            
            assert response['success'] is True
            # Should use our test directory, not the SAMURAI_AGENT_BASE_DIR
            expected_codebase_path = os.path.join(self.temp_dir, 'my-project')
            assert response['codebase_path'] == expected_codebase_path
    
    @pytest.mark.asyncio
    async def test_path_resolution_common_development_directories(self):
        """Test path resolution using common development directories."""
        # Create a mock Documents directory structure
        docs_dir = os.path.join(self.temp_dir, 'Documents')
        os.makedirs(docs_dir, exist_ok=True)
        
        project_structure = {
            'my-project': {
                'src': {
                    'index.js': 'console.log("Hello World")'
                }
            }
        }
        
        self.create_test_directory_structure(docs_dir, project_structure)
        
        # Mock common paths to include our test Documents directory
        common_paths = [docs_dir, '/other/path']
        
        def mock_expanduser(path):
            if path == "~/Documents":
                return docs_dir
            # Return a mock path for other expanduser calls to avoid recursion
            return f"/mock/{path.replace('~', 'home')}"
        
        request = CodebaseConnectRequest(
            path="my-project/src/index.js",
            project_id=self.test_project_id
        )
        
        with patch('os.getcwd', return_value='/some/other/directory'):
            with patch('os.path.expanduser', side_effect=mock_expanduser):
                response = await connect_codebase(request)
        
        assert response['success'] is True
        # The new logic should resolve to the folder containing the file
        expected_codebase_path = os.path.join(docs_dir, 'my-project', 'src')
        assert response['codebase_path'] == expected_codebase_path


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
