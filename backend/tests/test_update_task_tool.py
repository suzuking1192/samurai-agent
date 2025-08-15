#!/usr/bin/env python3
"""
Tests for UpdateTaskTool to ensure it handles various parameter combinations correctly
"""

import pytest
import asyncio
import sys
import os
import json
import tempfile
import shutil
from datetime import datetime

# Add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.agent_tools import UpdateTaskTool
from models import Task

class TestUpdateTaskTool:
    """Test cases for UpdateTaskTool parameter handling"""
    
    @pytest.fixture
    def temp_project_dir(self):
        """Create a temporary project directory for testing"""
        temp_dir = tempfile.mkdtemp()
        project_id = "test-project"
        project_dir = os.path.join(temp_dir, "data", project_id)
        os.makedirs(project_dir, exist_ok=True)
        
        yield temp_dir, project_id, project_dir
        
        # Cleanup
        shutil.rmtree(temp_dir)
    
    @pytest.fixture
    def sample_task(self):
        """Create a sample task for testing"""
        return Task(
            id="test-task-123",
            title="Original Task Title",
            description="Original task description",
            status="pending",
            priority="medium",
            project_id="test-project",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
    
    @pytest.fixture
    def update_tool(self):
        """Create UpdateTaskTool instance"""
        return UpdateTaskTool()
    
    def create_task_file(self, project_dir, task):
        """Helper to create a task file"""
        tasks_file = os.path.join(project_dir, "tasks.json")
        with open(tasks_file, 'w') as f:
            json.dump([task.model_dump()], f, default=str)
        return tasks_file
    
    @pytest.mark.asyncio
    async def test_update_task_with_task_title_parameter(self, temp_project_dir, sample_task, update_tool):
        """Test that UpdateTaskTool handles 'task_title' parameter correctly"""
        temp_dir, project_id, project_dir = temp_project_dir
        
        # Create task file
        self.create_task_file(project_dir, sample_task)
        
        # Test with task_title parameter (the problematic one)
        result = await update_tool.execute(
            task_identifier=sample_task.id,
            project_id=project_id,
            task_title="Updated Task Title",  # This was causing the error
            description="Updated description"
        )
        
        # Should not raise an exception
        assert result is not None
        assert isinstance(result, dict)
        assert "success" in result
    
    @pytest.mark.asyncio
    async def test_update_task_with_task_id_parameter(self, temp_project_dir, sample_task, update_tool):
        """Test that UpdateTaskTool handles 'task_id' parameter correctly"""
        temp_dir, project_id, project_dir = temp_project_dir
        
        # Create task file
        self.create_task_file(project_dir, sample_task)
        
        # Test with task_id parameter
        result = await update_tool.execute(
            task_identifier=sample_task.id,
            project_id=project_id,
            task_id="different-task-id",  # This should override task_identifier
            title="Title from task_id"
        )
        
        # Should not raise an exception
        assert result is not None
        assert isinstance(result, dict)
        assert "success" in result
    
    @pytest.mark.asyncio
    async def test_update_task_with_updates_dictionary(self, temp_project_dir, sample_task, update_tool):
        """Test that UpdateTaskTool handles 'updates' dictionary correctly"""
        temp_dir, project_id, project_dir = temp_project_dir
        
        # Create task file
        self.create_task_file(project_dir, sample_task)
        
        # Test with updates dictionary
        result = await update_tool.execute(
            task_identifier=sample_task.id,
            project_id=project_id,
            updates={
                "title": "Title from dict",
                "status": "completed",
                "description": "Description from dict"
            }
        )
        
        # Should not raise an exception
        assert result is not None
        assert isinstance(result, dict)
        assert "success" in result
    
    @pytest.mark.asyncio
    async def test_update_task_with_standard_parameters(self, temp_project_dir, sample_task, update_tool):
        """Test that UpdateTaskTool handles standard parameters correctly"""
        temp_dir, project_id, project_dir = temp_project_dir
        
        # Create task file
        self.create_task_file(project_dir, sample_task)
        
        # Test with standard parameters
        result = await update_tool.execute(
            task_identifier=sample_task.id,
            project_id=project_id,
            title="Standard Title",
            description="Standard Description",
            status="in_progress",
            priority="high"
        )
        
        # Should not raise an exception
        assert result is not None
        assert isinstance(result, dict)
        assert "success" in result
    
    @pytest.mark.asyncio
    async def test_update_task_with_mixed_parameters(self, temp_project_dir, sample_task, update_tool):
        """Test that UpdateTaskTool handles mixed parameter types correctly"""
        temp_dir, project_id, project_dir = temp_project_dir
        
        # Create task file
        self.create_task_file(project_dir, sample_task)
        
        # Test with mixed parameters
        result = await update_tool.execute(
            task_identifier=sample_task.id,
            project_id=project_id,
            title="Mixed Title",
            task_title="Overriding Title",  # This should override title
            updates={
                "status": "completed",
                "priority": "high"
            }
        )
        
        # Should not raise an exception
        assert result is not None
        assert isinstance(result, dict)
        assert "success" in result
    
    @pytest.mark.asyncio
    async def test_update_task_no_unexpected_keyword_errors(self, update_tool):
        """Test that UpdateTaskTool never throws 'unexpected keyword argument' errors"""
        
        # Test various parameter combinations that might cause issues
        test_cases = [
            {
                "task_identifier": "test-task",
                "project_id": "test-project",
                "task_title": "Some Title",
                "task_id": "some-id",
                "title": "Another Title",
                "description": "Some description",
                "updates": {"status": "completed"}
            },
            {
                "task_identifier": "test-task",
                "project_id": "test-project",
                "random_param": "random_value",
                "another_param": "another_value"
            }
        ]
        
        for test_case in test_cases:
            try:
                result = await update_tool.execute(**test_case)
                # Should not raise an exception
                assert result is not None
                assert isinstance(result, dict)
            except TypeError as e:
                if "unexpected keyword argument" in str(e):
                    pytest.fail(f"UpdateTaskTool threw unexpected keyword argument error: {e}")
                # Other TypeError exceptions are acceptable (e.g., missing required parameters)
            except Exception as e:
                # Other exceptions are acceptable as long as they're not about unexpected keywords
                if "unexpected keyword argument" in str(e):
                    pytest.fail(f"UpdateTaskTool threw unexpected keyword argument error: {e}")

if __name__ == "__main__":
    pytest.main([__file__])
