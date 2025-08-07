import uuid
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field

try:
    from .file_service import FileService
    from models import Task, Memory, Project
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from file_service import FileService
    from models import Task, Memory, Project

logger = logging.getLogger(__name__)


class TaskTool(BaseModel):
    """Base class for task-related tools"""
    pass


class CreateTaskTool(TaskTool):
    name: str = "create_task"
    description: str = "Create a new task in the project"
    
    def execute(self, title: str, description: str, priority: str = "medium", 
                due_date: Optional[str] = None, project_id: str = None, status: str = "pending") -> Dict[str, Any]:
        """
        Create a new task
        """
        try:
            file_service = FileService()
            
            # Create task object
            task = Task(
                id=str(uuid.uuid4()),
                project_id=project_id,
                title=title,
                description=description,
                priority=priority,
                status="pending",
                completed=False,
                order=0,  # Will be set by file service
                created_at=datetime.now()
            )
            
            # Load existing tasks and add new one
            existing_tasks = file_service.load_tasks(project_id)
            existing_tasks.append(task)
            
            # Save updated tasks
            file_service.save_tasks(project_id, existing_tasks)
            
            return {
                "success": True,
                "task_id": task.id,
                "message": f"✅ Created task: '{title}'"
            }
        except Exception as e:
            logger.error(f"Error creating task: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Failed to create task: {str(e)}"
            }


class UpdateTaskTool(TaskTool):
    name: str = "update_task"
    description: str = "Update an existing task's details"
    
    def execute(self, task_identifier: str, project_id: str, 
                title: str = None, description: str = None, 
                priority: str = None, status: str = None,
                due_date: str = None) -> Dict[str, Any]:
        """
        Update task details by title or ID
        """
        try:
            file_service = FileService()
            
            # Load existing tasks
            tasks = file_service.load_tasks(project_id)
            
            # Find task by title or ID
            task = None
            for t in tasks:
                if t.id == task_identifier or t.title.lower() == task_identifier.lower():
                    task = t
                    break
            
            if not task:
                return {
                    "success": False,
                    "message": f"❌ Task '{task_identifier}' not found"
                }
            
            # Update fields
            if title: task.title = title
            if description: task.description = description
            if priority: task.priority = priority
            if status: task.status = status
            if due_date: task.due_date = due_date
            
            # Update completion status based on status
            if status == "completed":
                task.completed = True
            elif status in ["pending", "in_progress", "blocked"]:
                task.completed = False
            
            # Save updated tasks
            file_service.save_tasks(project_id, tasks)
            
            return {
                "success": True,
                "task_id": task.id,
                "message": f"✅ Updated task: '{task.title}'"
            }
                
        except Exception as e:
            logger.error(f"Error updating task: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Failed to update task: {str(e)}"
            }


class ChangeTaskStatusTool(TaskTool):
    name: str = "change_task_status"
    description: str = "Change the status of a task (pending, in_progress, completed, blocked)"
    
    def execute(self, task_identifier: str, new_status: str, project_id: str) -> Dict[str, Any]:
        """
        Change task status
        """
        valid_statuses = ["pending", "in_progress", "completed", "blocked"]
        if new_status not in valid_statuses:
            return {
                "success": False,
                "message": f"❌ Invalid status. Use: {', '.join(valid_statuses)}"
            }
        
        try:
            file_service = FileService()
            
            # Load existing tasks
            tasks = file_service.load_tasks(project_id)
            
            # Find task by title or ID
            task = None
            for t in tasks:
                if t.id == task_identifier or t.title.lower() == task_identifier.lower():
                    task = t
                    break
            
            if not task:
                return {
                    "success": False,
                    "message": f"❌ Task '{task_identifier}' not found"
                }
            
            old_status = task.status if hasattr(task, 'status') else "pending"
            task.status = new_status
            
            # Update completion status
            if new_status == "completed":
                task.completed = True
            else:
                task.completed = False
            
            # Save updated tasks
            file_service.save_tasks(project_id, tasks)
            
            status_emoji = {
                "pending": "📋",
                "in_progress": "⏳", 
                "completed": "✅",
                "blocked": "🚫"
            }
            
            return {
                "success": True,
                "task_id": task.id,
                "old_status": old_status,
                "new_status": new_status,
                "message": f"{status_emoji.get(new_status, '📋')} Changed '{task.title}' from {old_status} to {new_status}"
            }
            
        except Exception as e:
            logger.error(f"Error changing task status: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Failed to change status: {str(e)}"
            }


class SearchTasksTool(TaskTool):
    name: str = "search_tasks"
    description: str = "Search for tasks by title, description, or status"
    
    def execute(self, query: str, project_id: str, status_filter: str = None) -> Dict[str, Any]:
        """
        Search tasks
        """
        try:
            file_service = FileService()
            tasks = file_service.load_tasks(project_id)
            
            # Filter tasks based on query and status
            matching_tasks = []
            query_lower = query.lower()
            
            for task in tasks:
                # Check if task matches query
                matches_query = (
                    query_lower in task.title.lower() or
                    query_lower in task.description.lower()
                )
                
                # Check status filter
                matches_status = True
                if status_filter:
                    task_status = getattr(task, 'status', 'pending')
                    matches_status = status_filter.lower() in task_status.lower()
                
                if matches_query and matches_status:
                    matching_tasks.append(task)
            
            if not matching_tasks:
                return {
                    "success": True,
                    "tasks": [],
                    "count": 0,
                    "message": f"🔍 No tasks found matching '{query}'"
                }
            
            task_summaries = []
            for task in matching_tasks:
                task_summaries.append({
                    "id": task.id,
                    "title": task.title,
                    "status": getattr(task, 'status', 'pending'),
                    "priority": getattr(task, 'priority', 'medium'),
                    "completed": task.completed
                })
            
            return {
                "success": True,
                "tasks": task_summaries,
                "count": len(matching_tasks),
                "message": f"🔍 Found {len(matching_tasks)} task(s) matching '{query}'"
            }
            
        except Exception as e:
            logger.error(f"Error searching tasks: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Search failed: {str(e)}"
            }


class DeleteTaskTool(TaskTool):
    name: str = "delete_task"
    description: str = "Delete a task from the project"
    
    def execute(self, task_identifier: str, project_id: str) -> Dict[str, Any]:
        """
        Delete a task by title or ID
        """
        try:
            file_service = FileService()
            
            # Load existing tasks
            tasks = file_service.load_tasks(project_id)
            
            # Find task by title or ID
            task_to_delete = None
            for task in tasks:
                if task.id == task_identifier or task.title.lower() == task_identifier.lower():
                    task_to_delete = task
                    break
            
            if not task_to_delete:
                return {
                    "success": False,
                    "message": f"❌ Task '{task_identifier}' not found"
                }
            
            # Remove task
            tasks = [t for t in tasks if t.id != task_to_delete.id]
            
            # Save updated tasks
            file_service.save_tasks(project_id, tasks)
            
            return {
                "success": True,
                "task_id": task_to_delete.id,
                "message": f"🗑️ Deleted task: '{task_to_delete.title}'"
            }
            
        except Exception as e:
            logger.error(f"Error deleting task: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Failed to delete task: {str(e)}"
            }


# Memory Tools
class CreateMemoryTool(BaseModel):
    name: str = "create_memory"
    description: str = "Create a new memory entry"
    
    def execute(self, title: str, content: str, project_id: str, 
                category: str = "general") -> Dict[str, Any]:
        """
        Create a new memory
        """
        try:
            file_service = FileService()
            
            # Create memory object
            memory = Memory(
                id=str(uuid.uuid4()),
                project_id=project_id,
                title=title,
                content=content,
                category=category,
                type="note",
                created_at=datetime.now()
            )
            
            # Load existing memories and add new one
            existing_memories = file_service.load_memories(project_id)
            existing_memories.append(memory)
            
            # Save updated memories
            file_service.save_memories(project_id, existing_memories)
            
            return {
                "success": True,
                "memory_id": memory.id,
                "message": f"💡 Created memory: '{title}'"
            }
        except Exception as e:
            logger.error(f"Error creating memory: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Failed to create memory: {str(e)}"
            }


class UpdateMemoryTool(BaseModel):
    name: str = "update_memory"
    description: str = "Update an existing memory"
    
    def execute(self, memory_identifier: str, project_id: str,
                title: str = None, content: str = None, 
                category: str = None) -> Dict[str, Any]:
        """
        Update memory details
        """
        try:
            file_service = FileService()
            
            # Load existing memories
            memories = file_service.load_memories(project_id)
            
            # Find memory by title or ID
            memory = None
            for m in memories:
                if m.id == memory_identifier or m.title.lower() == memory_identifier.lower():
                    memory = m
                    break
            
            if not memory:
                return {
                    "success": False,
                    "message": f"❌ Memory '{memory_identifier}' not found"
                }
            
            # Update fields
            if title: memory.title = title
            if content: memory.content = content
            if category: memory.category = category
            
            # Save updated memories
            file_service.save_memories(project_id, memories)
            
            return {
                "success": True,
                "memory_id": memory.id,
                "message": f"💡 Updated memory: '{memory.title}'"
            }
                
        except Exception as e:
            logger.error(f"Error updating memory: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Failed to update memory: {str(e)}"
            }


class SearchMemoriesTool(BaseModel):
    name: str = "search_memories"
    description: str = "Search for memories by title or content"
    
    def execute(self, query: str, project_id: str, category_filter: str = None) -> Dict[str, Any]:
        """
        Search memories
        """
        try:
            file_service = FileService()
            memories = file_service.load_memories(project_id)
            
            # Filter memories based on query and category
            matching_memories = []
            query_lower = query.lower()
            
            for memory in memories:
                # Check if memory matches query
                matches_query = (
                    query_lower in memory.title.lower() or
                    query_lower in memory.content.lower()
                )
                
                # Check category filter
                matches_category = True
                if category_filter:
                    matches_category = category_filter.lower() in memory.category.lower()
                
                if matches_query and matches_category:
                    matching_memories.append(memory)
            
            if not matching_memories:
                return {
                    "success": True,
                    "memories": [],
                    "count": 0,
                    "message": f"🔍 No memories found matching '{query}'"
                }
            
            memory_summaries = []
            for memory in matching_memories:
                memory_summaries.append({
                    "id": memory.id,
                    "title": memory.title,
                    "category": memory.category,
                    "preview": memory.content[:100] + "..." if len(memory.content) > 100 else memory.content
                })
            
            return {
                "success": True,
                "memories": memory_summaries,
                "count": len(matching_memories),
                "message": f"🔍 Found {len(matching_memories)} memor(ies) matching '{query}'"
            }
            
        except Exception as e:
            logger.error(f"Error searching memories: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Search failed: {str(e)}"
            }


class DeleteMemoryTool(BaseModel):
    name: str = "delete_memory"
    description: str = "Delete a memory from the project"
    
    def execute(self, memory_identifier: str, project_id: str) -> Dict[str, Any]:
        """
        Delete a memory by title or ID
        """
        try:
            file_service = FileService()
            
            # Load existing memories
            memories = file_service.load_memories(project_id)
            
            # Find memory by title or ID
            memory_to_delete = None
            for memory in memories:
                if memory.id == memory_identifier or memory.title.lower() == memory_identifier.lower():
                    memory_to_delete = memory
                    break
            
            if not memory_to_delete:
                return {
                    "success": False,
                    "message": f"❌ Memory '{memory_identifier}' not found"
                }
            
            # Remove memory
            memories = [m for m in memories if m.id != memory_to_delete.id]
            
            # Save updated memories
            file_service.save_memories(project_id, memories)
            
            return {
                "success": True,
                "memory_id": memory_to_delete.id,
                "message": f"🗑️ Deleted memory: '{memory_to_delete.title}'"
            }
            
        except Exception as e:
            logger.error(f"Error deleting memory: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Failed to delete memory: {str(e)}"
            }


class AgentToolRegistry:
    """
    Registry of all available tools for the agent
    """
    
    def __init__(self):
        self.tools = {
            # Task tools
            "create_task": CreateTaskTool(),
            "update_task": UpdateTaskTool(),
            "change_task_status": ChangeTaskStatusTool(),
            "search_tasks": SearchTasksTool(),
            "delete_task": DeleteTaskTool(),
            
            # Memory tools  
            "create_memory": CreateMemoryTool(),
            "update_memory": UpdateMemoryTool(),
            "search_memories": SearchMemoriesTool(),
            "delete_memory": DeleteMemoryTool(),
        }
    
    def get_tool_descriptions(self) -> str:
        """
        Get descriptions of all available tools for the LLM
        """
        descriptions = []
        for tool_name, tool in self.tools.items():
            descriptions.append(f"- {tool_name}: {tool.description}")
        
        return "\n".join(descriptions)
    
    def execute_tool(self, tool_name: str, **kwargs) -> Dict[str, Any]:
        """
        Execute a tool with given parameters
        """
        if tool_name not in self.tools:
            return {
                "success": False,
                "message": f"❌ Unknown tool: {tool_name}"
            }
        
        try:
            return self.tools[tool_name].execute(**kwargs)
        except Exception as e:
            logger.error(f"Tool execution failed for {tool_name}: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Tool execution failed: {str(e)}"
            }
    
    def get_available_tools(self) -> List[str]:
        """
        Get list of available tool names
        """
        return list(self.tools.keys()) 