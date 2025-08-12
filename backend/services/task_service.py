"""
Service for handling task operations with integrated analysis.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

try:
    from models import Task, TaskWarning
    from .task_analysis_agent import TaskAnalysisAgent
    from .file_service import FileService
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from models import Task, TaskWarning
    from task_analysis_agent import TaskAnalysisAgent
    from file_service import FileService
except ImportError:
    # Try direct import
    from models import Task, TaskWarning
    from task_analysis_agent import TaskAnalysisAgent
    from file_service import FileService

logger = logging.getLogger(__name__)

class TaskService:
    """
    Service for handling task operations with integrated analysis.
    This service ensures that task analysis is performed consistently
    across all task creation and update operations.
    """

    def __init__(self):
        """Initialize the TaskService."""
        self.file_service = FileService()
        self.analysis_agent = TaskAnalysisAgent()

    async def create_task(self, title: str, description: str, project_id: str,
                         priority: str = "medium", status: str = "pending",
                         parent_task_id: Optional[str] = None) -> Task:
        """
        Create a new task with automatic analysis.
        
        Args:
            title: Task title
            description: Task description
            project_id: Project identifier
            priority: Task priority (default: "medium")
            status: Task status (default: "pending")
        
        Returns:
            The created Task object
        """
        # Generate warnings using the analysis agent (disabled temporarily)
        # warnings = await self.analysis_agent.analyze_task(title, description)
        warnings = []
        
        # Determine hierarchy depth with validation (max depth 4)
        depth = 1
        if parent_task_id:
            parent = self.file_service.get_task_by_id(project_id, parent_task_id)
            if not parent:
                raise ValueError("Parent task not found")
            if parent.depth >= 4:
                raise ValueError("Maximum task nesting depth of 4 exceeded")
            depth = parent.depth + 1

        # Create task object with warnings and hierarchy
        task = Task(
            title=title,
            description=description,
            project_id=project_id,
            priority=priority,
            status=status,
            parent_task_id=parent_task_id,
            depth=depth,
            review_warnings=warnings,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Save task
        self.file_service.save_task(project_id, task)
        
        return task

    async def update_task(self, project_id: str, task_id: str,
                         updates: Dict[str, Any]) -> Optional[Task]:
        """
        Update a task and re-analyze if description changes.
        
        Args:
            project_id: Project identifier
            task_id: Task identifier
            updates: Dictionary of fields to update
        
        Returns:
            Updated Task object or None if not found
        """
        # Get existing task
        task = self.file_service.get_task_by_id(project_id, task_id)
        if not task:
            return None
        
        # Update task fields
        for key, value in updates.items():
            if hasattr(task, key):
                setattr(task, key, value)
        
        # Re-analyze if description was updated (disabled temporarily)
        if "description" in updates or "title" in updates:
            # warnings = await self.analysis_agent.analyze_task(task.title, task.description)
            task.review_warnings = []
        
        # Update timestamp
        task.updated_at = datetime.utcnow()
        
        # Save updated task
        self.file_service.save_task(project_id, task)
        
        return task

    async def get_task(self, project_id: str, task_id: str) -> Optional[Task]:
        """
        Get a task by ID.
        
        Args:
            project_id: Project identifier
            task_id: Task identifier
        
        Returns:
            Task object or None if not found
        """
        return self.file_service.get_task_by_id(project_id, task_id)

    async def list_tasks(self, project_id: str) -> List[Task]:
        """
        List all tasks for a project.
        
        Args:
            project_id: Project identifier
        
        Returns:
            List of Task objects
        """
        return self.file_service.load_tasks(project_id)

    async def delete_task(self, project_id: str, task_id: str) -> bool:
        """
        Delete a task.
        
        Args:
            project_id: Project identifier
            task_id: Task identifier
        
        Returns:
            True if task was deleted, False otherwise
        """
        tasks = self.file_service.load_tasks(project_id)
        tasks = [t for t in tasks if t.id != task_id]
        self.file_service.save_tasks(project_id, tasks)
        return True
