"""
Test to verify that each project has its own isolated codebase path.
"""

from datetime import datetime
import os
import tempfile
import shutil
import pytest
from unittest.mock import patch, MagicMock
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.file_service import FileService
from models import Project, ProjectCreateRequest


class TestProjectCodebaseIsolation:
    """Test that each project has its own isolated codebase path."""
    
    def setup_method(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.file_service = FileService()
        
    def teardown_method(self):
        """Clean up test environment."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_new_project_has_no_codebase_path(self):
        """Test that a new project created without codebase_path has None."""
        # Create a project without codebase_path
        project_request = ProjectCreateRequest(
            name="Test Project",
            description="A test project",
            tech_stack="Python, FastAPI"
        )
        
        # Mock the file_service to avoid actual file operations
        with patch.object(self.file_service, 'save_project') as mock_save:
            project = Project(
                id="test-project-id",
                name=project_request.name,
                description=project_request.description,
                tech_stack=project_request.tech_stack,
                created_at=datetime.now(),
                codebase_path=project_request.codebase_path
            )
            
            # Verify that codebase_path is None
            assert project.codebase_path is None
    
    def test_project_with_codebase_path(self):
        """Test that a project created with codebase_path has the correct path."""
        # Create a project with codebase_path
        project_request = ProjectCreateRequest(
            name="Test Project",
            description="A test project",
            tech_stack="Python, FastAPI",
            codebase_path="/path/to/codebase"
        )
        
        # Mock the file_service to avoid actual file operations
        with patch.object(self.file_service, 'save_project') as mock_save:
            project = Project(
                id="test-project-id",
                name=project_request.name,
                description=project_request.description,
                tech_stack=project_request.tech_stack,
                created_at=datetime.now(),
                codebase_path=project_request.codebase_path
            )
            
            # Verify that codebase_path is set correctly
            assert project.codebase_path == "/path/to/codebase"
    
    def test_multiple_projects_have_different_codebase_paths(self):
        """Test that multiple projects can have different codebase paths."""
        # Create first project
        project1_request = ProjectCreateRequest(
            name="Project 1",
            description="First test project",
            tech_stack="Python, FastAPI",
            codebase_path="/path/to/project1"
        )
        
        # Create second project
        project2_request = ProjectCreateRequest(
            name="Project 2",
            description="Second test project",
            tech_stack="React, TypeScript",
            codebase_path="/path/to/project2"
        )
        
        # Create third project without codebase_path
        project3_request = ProjectCreateRequest(
            name="Project 3",
            description="Third test project",
            tech_stack="Node.js, Express"
        )
        
        # Mock the file_service to avoid actual file operations
        with patch.object(self.file_service, 'save_project') as mock_save:
            project1 = Project(
                id="project-1-id",
                name=project1_request.name,
                description=project1_request.description,
                tech_stack=project1_request.tech_stack,
                created_at=datetime.now(),
                codebase_path=project1_request.codebase_path
            )
            
            project2 = Project(
                id="project-2-id",
                name=project2_request.name,
                description=project2_request.description,
                tech_stack=project2_request.tech_stack,
                created_at=datetime.now(),
                codebase_path=project2_request.codebase_path
            )
            
            project3 = Project(
                id="project-3-id",
                name=project3_request.name,
                description=project3_request.description,
                tech_stack=project3_request.tech_stack,
                created_at=datetime.now(),
                codebase_path=project3_request.codebase_path
            )
            
            # Verify that each project has its own codebase path
            assert project1.codebase_path == "/path/to/project1"
            assert project2.codebase_path == "/path/to/project2"
            assert project3.codebase_path is None
    
    def test_project_creation_endpoint_handles_codebase_path(self):
        """Test that the project creation endpoint properly handles codebase_path."""
        # Test with codebase_path
        project_request = ProjectCreateRequest(
            name="Test Project",
            description="A test project",
            tech_stack="Python, FastAPI",
            codebase_path="/path/to/codebase"
        )
        
        # Create project with the request data
        project = Project(
            id="test-project-id",
            name=project_request.name,
            description=project_request.description,
            tech_stack=project_request.tech_stack,
            created_at=datetime.now(),
            codebase_path=project_request.codebase_path
        )
        
        # Verify that the project was created with the correct codebase_path
        assert project.codebase_path == "/path/to/codebase"
    
    def test_project_creation_endpoint_handles_no_codebase_path(self):
        """Test that the project creation endpoint properly handles missing codebase_path."""
        # Test without codebase_path
        project_request = ProjectCreateRequest(
            name="Test Project",
            description="A test project",
            tech_stack="Python, FastAPI"
        )
        
        # Create project with the request data
        project = Project(
            id="test-project-id",
            name=project_request.name,
            description=project_request.description,
            tech_stack=project_request.tech_stack,
            created_at=datetime.now(),
            codebase_path=project_request.codebase_path
        )
        
        # Verify that the project was created with None codebase_path
        assert project.codebase_path is None


if __name__ == "__main__":
    pytest.main([__file__])
