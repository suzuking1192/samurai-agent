"""
Unit tests for task JSON to markdown conversion functionality.
"""

import pytest
import sys
import os

# Add the parent directory to the path to import the utils module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.utils import convert_task_json_to_markdown


class TestTaskJsonToMarkdown:
    """Test cases for convert_task_json_to_markdown function."""
    
    def test_empty_task_list(self):
        """Test conversion with empty task list."""
        result = convert_task_json_to_markdown([])
        assert result == "No tasks to display."
    
    def test_single_task_without_subtasks(self):
        """Test conversion with a single task without subtasks."""
        task_list = [
            {
                "task_id": "1",
                "title": "Implement login feature",
                "description": "Create user authentication system",
                "priority": "high",
                "status": "pending"
            }
        ]
        
        result = convert_task_json_to_markdown(task_list)
        
        assert "## 1. Implement login feature" in result
        assert "Create user authentication system" in result
        assert "Priority: high | Status: pending" in result
    
    def test_multiple_tasks_without_subtasks(self):
        """Test conversion with multiple root tasks without subtasks."""
        task_list = [
            {
                "task_id": "1",
                "title": "Implement login feature",
                "description": "Create user authentication system",
                "priority": "high"
            },
            {
                "task_id": "2",
                "title": "Add password reset",
                "description": "Implement password reset functionality",
                "priority": "medium"
            }
        ]
        
        result = convert_task_json_to_markdown(task_list)
        
        assert "## 1. Implement login feature" in result
        assert "## 2. Add password reset" in result
        assert "Create user authentication system" in result
        assert "Implement password reset functionality" in result
    
    def test_tasks_with_subtasks(self):
        """Test conversion with tasks that have subtasks."""
        task_list = [
            {
                "task_id": "1",
                "title": "Implement login feature",
                "description": "Create user authentication system",
                "priority": "high"
            },
            {
                "task_id": "2",
                "parent_task_id": "1",
                "title": "Create login form",
                "description": "Design and implement the login form UI",
                "priority": "medium"
            },
            {
                "task_id": "3",
                "parent_task_id": "1",
                "title": "Implement authentication logic",
                "description": "Add backend authentication logic",
                "priority": "high"
            }
        ]
        
        result = convert_task_json_to_markdown(task_list)
        
        assert "## 1. Implement login feature" in result
        assert "  - **Create login form**" in result
        assert "  - **Implement authentication logic**" in result
        assert "Design and implement the login form UI" in result
        assert "Add backend authentication logic" in result
    
    def test_tasks_with_long_description(self):
        """Test conversion with tasks that have long descriptions."""
        task_list = [
            {
                "task_id": "1",
                "title": "Implement login feature",
                "description": "Create user authentication system",
                "long_description": "This involves creating a comprehensive authentication system with JWT tokens, password hashing, and session management.",
                "priority": "high"
            }
        ]
        
        result = convert_task_json_to_markdown(task_list)
        
        assert "## 1. Implement login feature" in result
        assert "Create user authentication system" in result
        assert "**Details:**" in result
        assert "JWT tokens, password hashing, and session management" in result
    
    def test_tasks_with_metadata(self):
        """Test conversion with tasks that have various metadata fields."""
        task_list = [
            {
                "task_id": "1",
                "title": "Implement login feature",
                "description": "Create user authentication system",
                "priority": "high",
                "status": "in_progress",
                "due_date": "2024-01-15"
            }
        ]
        
        result = convert_task_json_to_markdown(task_list)
        
        assert "## 1. Implement login feature" in result
        assert "Priority: high | Status: in_progress | Due: 2024-01-15" in result
    
    def test_orphaned_subtasks(self):
        """Test conversion with subtasks whose parent is not in the list."""
        task_list = [
            {
                "task_id": "2",
                "parent_task_id": "1",  # Parent task_id "1" not in list
                "title": "Create login form",
                "description": "Design and implement the login form UI"
            }
        ]
        
        result = convert_task_json_to_markdown(task_list)
        
        assert "  - **Create login form**" in result
        # The orphaned subtask should be displayed as a bullet point
        assert "Design and implement the login form UI" in result
    
    def test_missing_optional_fields(self):
        """Test conversion with tasks missing optional fields."""
        task_list = [
            {
                "task_id": "1",
                "title": "Implement login feature"
                # Missing description, priority, etc.
            }
        ]
        
        result = convert_task_json_to_markdown(task_list)
        
        assert "## 1. Implement login feature" in result
        # Should not crash and should handle missing fields gracefully
    
    def test_clean_text_functionality(self):
        """Test that text cleaning works properly."""
        task_list = [
            {
                "task_id": "1",
                "title": "Implement login feature",
                "description": "Create user authentication system\n\n\nWith multiple lines\n   and extra spaces",
                "long_description": "This involves creating a comprehensive authentication system.\n\nWith JWT tokens."
            }
        ]
        
        result = convert_task_json_to_markdown(task_list)
        
        # Should not contain excessive newlines or spaces
        assert "Create user authentication system With multiple lines and extra spaces" in result
        assert "This involves creating a comprehensive authentication system. With JWT tokens." in result
    
    def test_complex_hierarchy(self):
        """Test conversion with a complex task hierarchy."""
        task_list = [
            {
                "task_id": "1",
                "title": "Implement authentication system",
                "description": "Complete authentication system",
                "priority": "high"
            },
            {
                "task_id": "2",
                "parent_task_id": "1",
                "title": "Frontend authentication",
                "description": "Login/logout UI components",
                "priority": "medium"
            },
            {
                "task_id": "3",
                "parent_task_id": "2",
                "title": "Login form component",
                "description": "Create the login form React component",
                "priority": "low"
            },
            {
                "task_id": "4",
                "parent_task_id": "1",
                "title": "Backend authentication",
                "description": "API endpoints and logic",
                "priority": "high"
            }
        ]
        
        result = convert_task_json_to_markdown(task_list)
        
        assert "## 1. Implement authentication system" in result
        assert "  - **Frontend authentication**" in result
        assert "    - **Login form component**" in result
        assert "  - **Backend authentication**" in result
