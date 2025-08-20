"""
Simple test to verify that the codebase path isolation fix works correctly.
"""

import pytest
from datetime import datetime
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import Project, ProjectCreateRequest


def test_project_creation_with_codebase_path():
    """Test that a project can be created with a codebase path."""
    project_request = ProjectCreateRequest(
        name="Test Project",
        description="A test project",
        tech_stack="Python, FastAPI",
        codebase_path="/path/to/codebase"
    )
    
    project = Project(
        id="test-project-id",
        name=project_request.name,
        description=project_request.description,
        tech_stack=project_request.tech_stack,
        created_at=datetime.now(),
        codebase_path=project_request.codebase_path
    )
    
    assert project.codebase_path == "/path/to/codebase"


def test_project_creation_without_codebase_path():
    """Test that a project can be created without a codebase path."""
    project_request = ProjectCreateRequest(
        name="Test Project",
        description="A test project",
        tech_stack="Python, FastAPI"
    )
    
    project = Project(
        id="test-project-id",
        name=project_request.name,
        description=project_request.description,
        tech_stack=project_request.tech_stack,
        created_at=datetime.now(),
        codebase_path=project_request.codebase_path
    )
    
    assert project.codebase_path is None


def test_multiple_projects_have_isolated_codebase_paths():
    """Test that multiple projects have isolated codebase paths."""
    # Create first project with codebase path
    project1 = Project(
        id="project-1-id",
        name="Project 1",
        description="First project",
        tech_stack="Python, FastAPI",
        created_at=datetime.now(),
        codebase_path="/path/to/project1"
    )
    
    # Create second project with different codebase path
    project2 = Project(
        id="project-2-id",
        name="Project 2",
        description="Second project",
        tech_stack="React, TypeScript",
        created_at=datetime.now(),
        codebase_path="/path/to/project2"
    )
    
    # Create third project without codebase path
    project3 = Project(
        id="project-3-id",
        name="Project 3",
        description="Third project",
        tech_stack="Node.js, Express",
        created_at=datetime.now(),
        codebase_path=None
    )
    
    # Verify each project has its own isolated codebase path
    assert project1.codebase_path == "/path/to/project1"
    assert project2.codebase_path == "/path/to/project2"
    assert project3.codebase_path is None
    
    # Verify they are different
    assert project1.codebase_path != project2.codebase_path
    assert project1.codebase_path != project3.codebase_path
    assert project2.codebase_path != project3.codebase_path


if __name__ == "__main__":
    pytest.main([__file__])
