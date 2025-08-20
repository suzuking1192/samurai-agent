import uuid
import json
import logging
import asyncio
import os
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from pydantic import BaseModel, Field
from pathlib import Path
import re

try:
    from .file_service import FileService
    from .code_parser import code_parser
    from .code_context_storage import code_context_storage
    from models import Task, Memory, Project
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from file_service import FileService
    from code_parser import code_parser
    from code_context_storage import code_context_storage
    from models import Task, Memory, Project

logger = logging.getLogger(__name__)


class TaskTool(BaseModel):
    """Base class for task-related tools"""
    pass


class CreateTaskTool(TaskTool):
    name: str = "create_task"
    description: str = "Create a new task in the project"
    
    async def execute(self, title: str, description: str, priority: str = "medium", 
                due_date: Optional[str] = None, project_id: str = None, status: str = "pending",
                parent_task_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a new task with automatic analysis
        """
        try:
            from .task_service import TaskService
            task_service = TaskService()
            
            # Create task with analysis
            task = await task_service.create_task(
                title=title,
                description=description,
                project_id=project_id,
                priority=priority,
                status=status,
                parent_task_id=parent_task_id
            )
            
            # Return success response
            response = {
                "success": True,
                "task_id": task.id,
                "message": f"✅ Created task: '{title}'"
            }
            
            # Add warning count if there are any
            if task.review_warnings:
                warning_count = len(task.review_warnings)
                response["message"] += f" ({warning_count} warning{'s' if warning_count != 1 else ''} to review)"
            
            return response
            
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
    
    async def execute(self, task_identifier: str, project_id: str, 
                     title: str = None, description: str = None, 
                     priority: str = None, status: str = None,
                     due_date: str = None, **kwargs) -> Dict[str, Any]:
        """
        Update task details by title or ID with automatic re-analysis
        Supports both individual parameters and updates dictionary
        """
        try:
            # Handle case where updates are passed as a dictionary
            if 'updates' in kwargs:
                updates = kwargs['updates']
                # Extract individual fields from updates dict
                title = updates.get('title', title)
                description = updates.get('description', description)
                priority = updates.get('priority', priority)
                status = updates.get('status', status)
                due_date = updates.get('due_date', due_date)
            
            # Handle legacy parameter names
            if 'task_title' in kwargs:
                title = kwargs['task_title']
            if 'task_id' in kwargs:
                task_identifier = kwargs['task_id']
            
            # Try to use TaskService first (preferred method)
            try:
                from .task_service import TaskService
                task_service = TaskService()
                
                # Find task by ID or title
                task = None
                if task_identifier:
                    task = await task_service.get_task(project_id, task_identifier)
                    if not task:
                        # Try to find by title
                        tasks = await task_service.list_tasks(project_id)
                        for t in tasks:
                            if t.title.lower() == task_identifier.lower():
                                task = t
                                break
                
                if task:
                    # Prepare updates dictionary
                    updates = {}
                    if title is not None:
                        updates['title'] = title
                    if description is not None:
                        updates['description'] = description
                    if priority is not None:
                        updates['priority'] = priority
                    if status is not None:
                        updates['status'] = status
                    if due_date is not None:
                        updates['due_date'] = due_date
                    
                    # Update task with re-analysis
                    updated_task = await task_service.update_task(
                        project_id=project_id,
                        task_id=task.id,
                        updates=updates
                    )
                    
                    if updated_task:
                        response = {
                            "success": True,
                            "task_id": updated_task.id,
                            "message": f"✅ Updated task: '{updated_task.title}'"
                        }
                        
                        # Add warning count if there are any
                        if updated_task.review_warnings:
                            warning_count = len(updated_task.review_warnings)
                            response["message"] += f" ({warning_count} warning{'s' if warning_count != 1 else ''} to review)"
                        
                        return response
                
            except Exception as service_error:
                logger.warning(f"TaskService update failed, falling back to FileService: {service_error}")
            
            # Fallback to FileService method
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
            if title is not None:
                task.title = title
            if description is not None:
                task.description = description
            if priority is not None:
                task.priority = priority
            if status is not None:
                task.status = status
            if due_date is not None:
                task.due_date = due_date
            
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


class ExtractCodeContextTool(BaseModel):
    name: str = "extract_code_context"
    description: str = "Extract relevant code context from the local codebase based on a natural language request"
    


    async def execute(self, natural_language_request: str, project_id: str, 
                     connected_codebase_path: Optional[str] = None, session_id: Optional[str] = None,
                     max_iterations: int = 3) -> Dict[str, Any]:
        """
        Extract relevant code context from the codebase based on a natural language request.
        
        Args:
            natural_language_request: The user's request in natural language
            project_id: The project identifier (for logging and persistence)
            connected_codebase_path: Path to the codebase to analyze (required)
            session_id: The chat session identifier for persistence
            max_iterations: Maximum number of LLM iterations for file selection
        
        Returns:
            Dictionary containing extracted code context
        """
        try:
            # Validate that a codebase path is provided
            if not connected_codebase_path:
                return {
                    "success": False,
                    "message": f"❌ No codebase path provided. Please specify a path to analyze.",
                    "context": None,
                    "relevant_code": None,
                    "file_path": None
                }
            
            # Validate that the path exists and is a directory
            if not os.path.exists(connected_codebase_path):
                return {
                    "success": False,
                    "message": f"❌ Codebase path does not exist: {connected_codebase_path}",
                    "context": None,
                    "relevant_code": None,
                    "file_path": None
                }
            
            if not os.path.isdir(connected_codebase_path):
                return {
                    "success": False,
                    "message": f"❌ Codebase path is not a directory: {connected_codebase_path}",
                    "context": None,
                    "relevant_code": None,
                    "file_path": None
                }
            
            # Log the path being accessed for transparency
            logger.info(f"Code context extraction - project_id: {project_id}, path: {connected_codebase_path}")
            
            # Step 1: Scan the codebase for files and methods (no file limit for comprehensive coverage)
            logger.info(f"Scanning codebase at {connected_codebase_path}")
            try:
                # Remove file limit to ensure we capture all relevant files
                file_infos = code_parser.scan_codebase(connected_codebase_path, max_files=10000)
                logger.info(f"Code parser returned {len(file_infos)} files")
            except Exception as e:
                logger.error(f"Error scanning codebase: {e}")
                return {
                    "success": False,
                    "message": f"❌ Error scanning codebase: {str(e)}",
                    "context": None,
                    "relevant_code": None,
                    "file_path": None
                }
            
            if not file_infos:
                return {
                    "success": False,
                    "message": "❌ No code files found in the specified codebase",
                    "context": None,
                    "relevant_code": None,
                    "file_path": None
                }
            
            # Step 2: Use LLM to identify relevant files and methods
            logger.info(f"Identifying relevant files for request: {natural_language_request}")
            relevant_files_and_methods = await self._identify_relevant_files_and_methods(
                file_infos, natural_language_request, max_iterations
            )
            logger.info(f"LLM identified {len(relevant_files_and_methods)} relevant files")
            
            if not relevant_files_and_methods:
                return {
                    "success": False,
                    "message": "❌ No relevant files found for the request",
                    "context": None,
                    "relevant_code": None,
                    "file_path": None
                }
            
            # Step 3: Extract and analyze code from relevant files and methods
            extracted_context = await self._extract_code_context(
                relevant_files_and_methods, natural_language_request, max_iterations
            )
            
            # Step 4: Save context if session_id is provided
            if session_id and extracted_context.get("success"):
                logger.info(f"Saving code context for project {project_id}, session {session_id}")
                save_success = code_context_storage.save_code_context(
                    project_id, session_id, extracted_context
                )
                logger.info(f"Save result: {save_success}")
            else:
                logger.info(f"Not saving code context: session_id={session_id}, success={extracted_context.get('success')}")
            
            return extracted_context
            
        except Exception as e:
            logger.error(f"Error extracting code context: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Failed to extract code context: {str(e)}",
                "context": None,
                "relevant_code": None,
                "file_path": None
            }
    
    async def _identify_relevant_files_and_methods(self, file_infos: Dict[str, Any], 
                                                 request: str, max_iterations: int) -> Dict[str, List[str]]:
        """Use LLM to identify the most relevant files and methods for the request using a two-step approach."""
        try:
            from .gemini_service import GeminiService
            gemini_service = GeminiService()
            
            total_files = len(file_infos)
            logger.info(f"Total files in codebase: {total_files}")
            
            # Skip Step 1 if we have fewer than 1000 files - Step 2 can handle all files directly
            if total_files < 1000:
                logger.info(f"Skipping Step 1 - only {total_files} files, proceeding directly to Step 2")
                relevant_files = list(file_infos.keys())
            else:
                # Step 1: Get all file names and let LLM identify relevant files
                logger.info("Step 1: Identifying relevant files from all available files")
                relevant_files = await self._step1_identify_relevant_files(file_infos, request, gemini_service)
                
                if not relevant_files:
                    logger.info("No relevant files identified in Step 1")
                    return {}
                
                logger.info(f"Step 1 identified {len(relevant_files)} relevant files")
            
            # Step 2: For selected files, extract ALL elements and let LLM find relevant ones
            logger.info("Step 2: Extracting all elements from relevant files and identifying specific methods/classes")
            relevant_files_and_methods = await self._step2_identify_relevant_elements(
                file_infos, relevant_files, request, gemini_service
            )
            
            logger.info(f"Step 2 identified {len(relevant_files_and_methods)} files with specific methods")
            return relevant_files_and_methods
                
        except Exception as e:
            logger.error(f"Error in two-step file identification: {e}")
            # Fallback to simple file identification
            fallback_files = code_parser.get_relevant_files(file_infos, request, max_results=3)
            return {file_path: [] for file_path in fallback_files}
    
    async def _step1_identify_relevant_files(self, file_infos: Dict[str, Any], 
                                           request: str, gemini_service) -> List[str]:
        """Step 1: Get all file names and let LLM identify relevant files."""
        try:
            # Create a list of all file names with their structure information
            file_list = []
            for file_path, file_info in file_infos.items():
                # Get directory structure info
                directory = os.path.dirname(file_path)
                if not directory:
                    directory = "root"
                
                file_list.append({
                    "path": file_path,
                    "name": file_info.name,
                    "language": file_info.language,
                    "directory": directory,
                    "element_count": len(file_info.elements)
                })
            
            # Create a comprehensive file summary for the LLM
            file_summary = self._create_comprehensive_file_list_for_llm(file_list)
            
            prompt = f"""
You are an expert code analyzer. Given a user request and a comprehensive list of all files in a codebase, 
identify potentially relevant files that could help answer the request.

User Request: {request}

Available Files (Total: {len(file_list)}):
{file_summary}

Instructions:
1. Analyze the user request carefully
2. Look for files that MIGHT contain relevant code, functions, classes, or concepts
3. Consider file names, paths, directories, and programming languages
4. Be INCLUSIVE rather than restrictive - include files that could potentially be relevant
5. Common files like main.py, app.py, models.py, services/, utils/ are often relevant
6. Include files from relevant directories (e.g., if asking about tasks, include task-related directories)
7. Don't be too strict - it's better to include more files than miss important ones
8. Return a JSON array of file paths that could be relevant
9. You can return up to 15-20 files if needed - the next step will filter them further
10. If no files seem relevant, return an empty array []

IMPORTANT: This is just the first step of a two-step process. The next step will analyze the actual code content 
and filter down to the most relevant elements. So be generous in your selection here.

Return format: ["file1.py", "file2.js", "file3.py"]
"""
            
            response = await gemini_service.chat_with_system_prompt("", prompt)
            
            # Extract JSON array from response
            try:
                import re
                json_match = re.search(r'\[.*\]', response, re.DOTALL)
                if json_match:
                    relevant_file_paths = json.loads(json_match.group())
                else:
                    # Fallback: try to parse the entire response as JSON
                    relevant_file_paths = json.loads(response)
                
                # Validate that returned paths exist in our file_infos
                # Handle both full paths and just filenames
                valid_file_paths = []
                for path in relevant_file_paths:
                    # Check if it's a full path
                    if path in file_infos:
                        valid_file_paths.append(path)
                    else:
                        # Check if it's just a filename by matching against basenames
                        for full_path in file_infos.keys():
                            if os.path.basename(full_path) == path:
                                valid_file_paths.append(full_path)
                                break
                
                logger.info(f"Step 1: LLM identified {len(valid_file_paths)} relevant files out of {len(file_list)} total files")
                return valid_file_paths
                
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse Step 1 LLM response as JSON: {e}")
                # Fallback to simple file identification
                fallback_files = code_parser.get_relevant_files(file_infos, request, max_results=5)
                return fallback_files
                
        except Exception as e:
            logger.error(f"Error in Step 1 file identification: {e}")
            # Fallback to simple file identification
            fallback_files = code_parser.get_relevant_files(file_infos, request, max_results=5)
            return fallback_files
    
    async def _step2_identify_relevant_elements(self, file_infos: Dict[str, Any], 
                                              relevant_files: List[str], 
                                              request: str, gemini_service) -> Dict[str, List[str]]:
        """Step 2: For selected files, extract ALL elements and let LLM find relevant ones."""
        try:
            # Create detailed element information for the selected files
            file_elements_summary = self._create_detailed_elements_summary_for_llm(file_infos, relevant_files)
            logger.info(f"Step 2: Elements summary for LLM:\n{file_elements_summary}")
            
            prompt = f"""
You are an expert code analyzer. Given a user request and detailed information about specific files with ALL their methods, classes, and functions, 
identify potentially relevant files and specific methods/classes that could help answer the request.

User Request: {request}

Selected Files with ALL Elements:
{file_elements_summary}

CRITICAL INSTRUCTIONS:
1. Analyze the user request carefully
2. For each relevant file, identify the specific methods/classes that could be relevant
3. Consider the purpose and functionality of each element
4. Be INCLUSIVE rather than restrictive - include elements that might be related to the request
5. When the request asks about a specific data model (e.g., "Project data model", "Task data model", "User data model"), you MUST include the main class with that exact name
6. If you see a class named exactly what the user is asking for (e.g., "Project" for "Project data model", "Task" for "Task data model"), include it as the highest priority
7. IMPORTANT: Look for exact name matches first. If the user asks for "[ModelName] data model" and you see a class named "[ModelName]", you MUST include it.
8. URGENT: If the user asks about any data model and you see a class with the exact name in the elements list, you MUST include that class in your response.
9. Return a JSON object with file paths as keys and arrays of method/class names as values
10. You can include up to 8-12 files if needed - complex operations often span multiple files
11. For each file, include more methods/classes rather than fewer - it's better to have more information
12. Consider related functionality, utility functions, helper methods, and supporting classes
13. If no elements seem relevant, return an empty object {{}}
14. CRITICAL: Order files and methods by relevance - the most relevant files and methods should appear FIRST in your response
15. For each file, list methods in order of relevance (most relevant first)
16. The system will prioritize the first files and methods in your response, so put the most likely to be relevant content at the top

IMPORTANT: This is the final step before code analysis. More information is better than missing information. 
The next step will analyze all the code content with an LLM, so having comprehensive coverage is crucial.

Please also provide your reasoning for why you selected or did not select specific elements.

Return format: {{"file1.py": ["method1", "class1"], "file2.js": ["function1"]}}

Reasoning: [Explain your selection process and relevance ordering]
"""
            
            response = await gemini_service.chat_with_system_prompt("", prompt)
            
            logger.info(f"Step 2: Raw LLM response: {response}")
            
            # Extract reasoning if present
            import re
            reasoning_match = re.search(r'Reasoning:\s*(.*?)(?=\n\n|$)', response, re.DOTALL)
            if reasoning_match:
                reasoning = reasoning_match.group(1).strip()
                logger.info(f"Step 2: LLM Reasoning: {reasoning}")
            
            # Extract JSON object from response
            try:
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                if json_match:
                    file_methods_map = json.loads(json_match.group())
                else:
                    # Fallback: try to parse the entire response as JSON
                    file_methods_map = json.loads(response)
                
                # Validate that returned paths exist and methods are valid
                valid_file_methods = {}
                for file_path, methods in file_methods_map.items():
                    # Handle both full paths and just filenames
                    actual_file_path = None
                    if file_path in file_infos:
                        actual_file_path = file_path
                    else:
                        # Check if it's just a filename by matching against basenames
                        for full_path in file_infos.keys():
                            if os.path.basename(full_path) == file_path:
                                actual_file_path = full_path
                                break
                    
                    if actual_file_path:
                        # Validate that the methods exist in the file's elements
                        file_info = file_infos[actual_file_path]
                        valid_methods = []
                        for method in methods:
                            logger.info(f"Step 2: Looking for method '{method}' in file {actual_file_path}")
                            # Check if method exists in the file's elements
                            for element in file_info.elements:
                                logger.info(f"Step 2: Checking element '{element.name}' against method '{method}'")
                                if element.name.lower() == method.lower():
                                    logger.info(f"Step 2: Found match! Adding '{element.name}' for method '{method}'")
                                    valid_methods.append(element.name)
                                    break
                        if valid_methods:
                            valid_file_methods[actual_file_path] = valid_methods
                
                logger.info(f"Step 2: LLM identified {len(valid_file_methods)} files with specific methods")
                logger.info(f"Step 2: Valid file methods: {valid_file_methods}")
                return valid_file_methods
                
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse Step 2 LLM response as JSON: {e}")
                # Fallback: return all files with empty method lists
                return {file_path: [] for file_path in relevant_files}
                
        except Exception as e:
            logger.error(f"Error in Step 2 element identification: {e}")
            # Fallback: return all files with empty method lists
            return {file_path: [] for file_path in relevant_files}
    
    def _create_comprehensive_file_list_for_llm(self, file_list: List[Dict[str, Any]]) -> str:
        """Create a comprehensive list of all files for Step 1 LLM analysis."""
        summary_lines = []
        
        # Group files by directory for better organization
        files_by_directory = {}
        for file_info in file_list:
            directory = file_info["directory"]
            if directory not in files_by_directory:
                files_by_directory[directory] = []
            files_by_directory[directory].append(file_info)
        
        # Create organized summary
        for directory, files in files_by_directory.items():
            summary_lines.append(f"📁 {directory}/")
            for file_info in files:
                summary_lines.append(f"  📄 {file_info['name']} ({file_info['language']}) - {file_info['element_count']} elements")
            summary_lines.append("")  # Empty line for readability
        
        return "\n".join(summary_lines)
    
    def _create_detailed_elements_summary_for_llm(self, file_infos: Dict[str, Any], 
                                                relevant_files: List[str]) -> str:
        """Create a detailed summary of ALL elements from selected files for Step 2 LLM analysis."""
        summary_lines = []
        
        for file_path in relevant_files:
            if file_path not in file_infos:
                continue
                
            file_info = file_infos[file_path]
            summary_lines.append(f"📁 {file_path} ({file_info.language}):")
            
            if file_info.elements:
                # Include ALL elements without any limits
                for element in file_info.elements:
                    summary_lines.append(f"  • {element.type}: {element.name}")
            else:
                summary_lines.append("  • no elements")
            
            summary_lines.append("")  # Empty line for readability
        
        return "\n".join(summary_lines)
    
    async def _extract_code_context(self, file_methods_map: Dict[str, List[str]], 
                                  request: str, max_iterations: int) -> Dict[str, Any]:
        """Extract and analyze code from the identified relevant files and methods using cost-effective approach."""
        try:
            from .gemini_service import GeminiService
            gemini_service = GeminiService()
            
            # Step 1: Collect all relevant code content
            all_code_content = []
            
            for file_path, target_methods in file_methods_map.items():
                try:
                    # Read file content
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        file_content = f.read()
                    
                    # If specific methods are targeted, extract only those
                    if target_methods:
                        extracted_content = self._extract_methods_from_file(file_content, target_methods, file_path)
                        if extracted_content:
                            # Add file header to distinguish content from different files
                            all_code_content.append(f"=== FILE: {file_path} ===\n{extracted_content}")
                        else:
                            # If method extraction failed, use full file content
                            if len(file_content) > 8000:
                                file_content = file_content[:8000] + "\n... (truncated)"
                            all_code_content.append(f"=== FILE: {file_path} ===\n{file_content}")
                    else:
                        # No specific methods, use full file content
                        if len(file_content) > 8000:
                            file_content = file_content[:8000] + "\n... (truncated)"
                        all_code_content.append(f"=== FILE: {file_path} ===\n{file_content}")
                
                except Exception as e:
                    logger.warning(f"Error reading file {file_path}: {e}")
                    continue
            
            if not all_code_content:
                return {
                    "success": False,
                    "message": "❌ No code content could be extracted from the identified files",
                    "context": None,
                    "relevant_code": None,
                    "file_path": None
                }
            
            # Step 2: Combine all code content
            combined_content = "\n\n".join(all_code_content)
            
            # Step 3: Process in chunks if content is too long
            max_chunk_size = 100000  # Characters per chunk
            chunks = self._split_content_into_chunks(combined_content, max_chunk_size)
            
            # Step 4: Analyze chunks - if total content exceeds max_chunk_size, only use the first chunk for efficiency
            accumulated_context = []
            accumulated_code = []
            best_file_path = None
            total_relevance_score = 0
            
            # If we have multiple chunks and total content is large, only process the first chunk
            # This saves LLM calls and focuses on the most relevant content (which should be first due to relevance ordering)
            if len(chunks) > 1 and len(combined_content) > max_chunk_size:
                logger.info(f"Total content length ({len(combined_content)}) exceeds max_chunk_size ({max_chunk_size}). Processing only the first chunk for efficiency.")
                chunks_to_process = [chunks[0]]
            else:
                chunks_to_process = chunks
            
            for i, chunk in enumerate(chunks_to_process):
                prompt = f"""
You are an expert code analyzer. Given a user request and code content from multiple files, extract comprehensive and detailed 
information that would help answer the request. Your analysis should be thorough and include all relevant technical details, 
as this context will be used to generate high-quality responses to user queries.

User Request: {request}

Code Content (Chunk {i+1}/{len(chunks)}):
{chunk}

Instructions:
1. Analyze the code content in relation to the user request
2. Extract the most relevant code snippets and context
3. Provide a comprehensive and detailed analysis of how this code relates to the request, including all relevant technical details, patterns, and implementation specifics
4. If the code is not relevant to the request, indicate this clearly
5. Focus on providing maximum useful information - it's better to include more details than to miss important context
6. Consider the code's architecture, design patterns, data flow, error handling, and integration points

Return a JSON object with:
- "relevance_score": 0-10 (how relevant this chunk is to the request)
- "context": A comprehensive and detailed analysis of the relevant code, including its purpose, functionality, key components, data structures, algorithms, dependencies, relationships with other parts of the codebase, and any important implementation details that would be useful for understanding and working with this code
- "relevant_code": The most relevant code snippets from this chunk (limit to 1000 characters)
- "file_path": The most relevant file path from this chunk

If the content is not relevant, set relevance_score to 0.
"""
                
                response = await gemini_service.chat_with_system_prompt("", prompt)
                
                # Extract JSON from response
                try:
                    import re
                    json_match = re.search(r'\{.*\}', response, re.DOTALL)
                    if json_match:
                        analysis = json.loads(json_match.group())
                    else:
                        analysis = json.loads(response)
                    
                    relevance_score = analysis.get("relevance_score", 0)
                    
                    logger.info(f"Chunk {i+1} relevance score: {relevance_score}")
                    logger.info(f"Chunk {i+1} analysis: {analysis}")
                    
                    if relevance_score > 0:
                        accumulated_context.append(analysis.get("context", ""))
                        accumulated_code.append(analysis.get("relevant_code", ""))
                        total_relevance_score += relevance_score
                        
                        # Keep track of the best file path
                        if not best_file_path:
                            best_file_path = analysis.get("file_path")
                
                except json.JSONDecodeError as e:
                    logger.warning(f"Failed to parse analysis for chunk {i+1}: {e}")
                    continue
            
            # Step 5: Combine results
            if accumulated_context and accumulated_code:
                final_context = " ".join(accumulated_context)
                final_code = "\n\n".join(accumulated_code)
                # Calculate average relevance score based on processed chunks, not total chunks
                avg_relevance_score = total_relevance_score / len(chunks_to_process) if chunks_to_process else 0
                
                return {
                    "success": True,
                    "context": final_context,
                    "relevant_code": final_code,
                    "file_path": best_file_path,
                    "relevance_score": avg_relevance_score
                }
            else:
                return {
                    "success": False,
                    "message": "❌ No sufficiently relevant code found for the request",
                    "context": None,
                    "relevant_code": None,
                    "file_path": None
                }
                
        except Exception as e:
            logger.error(f"Error extracting code context: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Failed to extract code context: {str(e)}",
                "context": None,
                "relevant_code": None,
                "file_path": None
            }
    
    def _extract_methods_from_file(self, file_content: str, target_methods: List[str], file_path: str) -> Optional[str]:
        """Extract specific methods from a file based on target method names, with fallback to related code."""
        try:
            # Get file info to find method locations
            detected_language = code_parser.detect_language(file_path)
            if not detected_language:
                logger.warning(f"Could not detect language for file: {file_path}")
                return None
            
            file_info = code_parser.extract_elements_from_file(file_path, detected_language)
            
            extracted_parts = []
            found_exact_matches = set()
            
            # For each target method, always include related code for better context
            for target_method in target_methods:
                # First, try to find exact matches
                exact_found = False
                for element in file_info:
                    if element.name.lower() == target_method.lower():
                        # Extract the method content
                        method_content = self._extract_element_content(file_content, element)
                        if method_content:
                            # Include file path in the method header to distinguish from other files
                            extracted_parts.append(f"// {element.type}: {element.name} (from {file_path})\n{method_content}")
                            found_exact_matches.add(target_method.lower())
                            exact_found = True
                        break
                
                # Always look for related elements to provide better context
                related_elements = []
                for element in file_info:
                    # Check if element name contains the target method name (case-insensitive)
                    if (target_method.lower() in element.name.lower() or 
                        element.name.lower() in target_method.lower()):
                        method_content = self._extract_element_content(file_content, element)
                        if method_content:
                            related_elements.append(f"// {element.type}: {element.name} (related to {target_method}) (from {file_path})\n{method_content}")
                
                # If we found related elements, include them
                if related_elements:
                    extracted_parts.extend(related_elements)
                
                # Also try to extract broader context as additional information
                broader_content = self._extract_broader_context(file_content, target_method, file_info)
                if broader_content:
                    extracted_parts.append(f"// Broader context for {target_method} (from {file_path})\n{broader_content}")
                
                # Debug: log what we extracted
                logger.info(f"Extracted {len(related_elements)} related elements and broader context for {target_method}")
            

            
            if extracted_parts:
                return "\n\n".join(extracted_parts)
            else:
                return None
                
        except Exception as e:
            logger.warning(f"Error extracting methods from {file_path}: {e}")
            return None
    
    def _extract_element_content(self, file_content: str, element) -> Optional[str]:
        """Extract the content of all relevant code elements (methods, classes, etc.) throughout the file."""
        try:
            # This is a simplified extraction - in a real implementation, you'd want
            # to use proper AST parsing to extract the exact method boundaries
            lines = file_content.split('\n')
            
            # Find ALL lines that contain the element definition throughout the file
            element_starts = []
            for i, line in enumerate(lines):
                # Look for exact class definition match - must start with "class " followed by exact name
                if (element.type == 'class' and 
                    line.strip().startswith(f"class {element.name}") and 
                    ('(' in line or ':' in line)):
                    element_starts.append(i)
                # Look for function/method definition match
                elif (element.type in ['function', 'method'] and 
                      f"def {element.name}" in line):
                    element_starts.append(i)
            
            # If we didn't find it with exact matching, try a more flexible approach for classes
            if not element_starts and element.type == 'class':
                for i, line in enumerate(lines):
                    # Look for class definition with the exact name (case-insensitive)
                    if (f"class {element.name}" in line and 
                        ('(' in line or ':' in line)):
                        element_starts.append(i)
            
            # Debug: If we still haven't found it, let's search more broadly
            if not element_starts and element.type == 'class':
                logger.info(f"Debug: Could not find exact match for class {element.name}, searching more broadly...")
                for i, line in enumerate(lines):
                    # Look for any line containing the class name
                    if element.name in line and 'class' in line:
                        logger.info(f"Debug: Found potential match at line {i+1}: {line.strip()}")
                        element_starts.append(i)
            
            if not element_starts:
                return None
            
            # Extract content around ALL found elements
            extracted_parts = []
            for element_start in element_starts:
                # Extract a reasonable chunk around each element (simplified approach)
                start_line = max(0, element_start - 2)  # Include 2 lines before
                end_line = min(len(lines), element_start + 20)  # Include up to 20 lines after
                
                extracted_content = '\n'.join(lines[start_line:end_line])
                extracted_parts.append(f"// Found at line {element_start + 1}\n{extracted_content}")
            
            # Combine all extracted parts
            return '\n\n'.join(extracted_parts)
            
        except Exception as e:
            logger.warning(f"Error extracting element content: {e}")
            return None
    
    def _extract_broader_context(self, file_content: str, target_name: str, file_info) -> Optional[str]:
        """Extract a broader context around where the target might be located."""
        try:
            lines = file_content.split('\n')
            
            # Look for any line that contains the target name
            target_lines = []
            for i, line in enumerate(lines):
                if target_name.lower() in line.lower():
                    target_lines.append(i)
                    logger.info(f"Found '{target_name}' at line {i+1}: {line.strip()}")
            
            # Filter out lines that contain the target name as part of another word
            # (e.g., "Task" in "TaskStatus" should not match when looking for "Task")
            filtered_target_lines = []
            for line_num in target_lines:
                line_content = lines[line_num].strip()
                # Check if the line contains the exact target name as a standalone word
                # or as part of a class definition
                if (f"class {target_name}" in line_content or 
                    f"def {target_name}" in line_content or
                    f" {target_name}:" in line_content or
                    f" {target_name}(" in line_content or
                    f" {target_name}[" in line_content or
                    f" {target_name}=" in line_content):
                    filtered_target_lines.append(line_num)
            
            target_lines = filtered_target_lines
            
            if not target_lines:
                return None
            
            # Find the most relevant occurrence (prefer class definitions)
            best_line = target_lines[0]  # Default to first occurrence
            for line_num in target_lines:
                line_content = lines[line_num].strip()
                # Prefer lines that start with "class " followed by the exact target name
                if (line_content.startswith(f"class {target_name}") and 
                    ('(' in line_content or ':' in line_content)):
                    best_line = line_num
                    logger.info(f"Found best match for '{target_name}' at line {line_num+1}: {line_content}")
                    break
            
            # Extract a broader section around the best occurrence
            start_line = max(0, best_line - 10)  # Include more context before
            end_line = min(len(lines), best_line + 50)  # Include more context after
            
            extracted_content = '\n'.join(lines[start_line:end_line])
            logger.info(f"Extracted broader context for {target_name}: {len(extracted_content)} characters")
            logger.info(f"First 500 chars of broader context: {extracted_content[:500]}")
            return extracted_content
            
        except Exception as e:
            logger.warning(f"Error extracting broader context: {e}")
            return None
    
    def _split_content_into_chunks(self, content: str, max_chunk_size: int) -> List[str]:
        """Split content into chunks while preserving file boundaries."""
        if len(content) <= max_chunk_size:
            return [content]
        
        chunks = []
        current_chunk = ""
        
        # Split by file boundaries first
        file_sections = content.split("=== FILE:")
        
        for section in file_sections:
            if not section.strip():
                continue
            
            # If adding this section would exceed chunk size, start a new chunk
            if len(current_chunk) + len(section) > max_chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = ""
            
            # Add the section to current chunk
            if current_chunk:
                current_chunk += "\n\n=== FILE:" + section
            else:
                current_chunk = "=== FILE:" + section
        
        # Add the last chunk if it has content
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return chunks


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
            
            # Code context tools
            "extract_code_context": ExtractCodeContextTool(),
        }
    
    def get_tool_descriptions(self) -> str:
        """
        Get descriptions of all available tools for the LLM
        """
        descriptions = []
        for tool_name, tool in self.tools.items():
            descriptions.append(f"- {tool_name}: {tool.description}")
        
        return "\n".join(descriptions)
    
    async def execute_tool(self, tool_name: str, **kwargs) -> Dict[str, Any]:
        """
        Execute a tool with given parameters
        """
        if tool_name not in self.tools:
            return {
                "success": False,
                "message": f"❌ Unknown tool: {tool_name}"
            }
        
        try:
            tool = self.tools[tool_name]
            if hasattr(tool, 'execute') and asyncio.iscoroutinefunction(tool.execute):
                return await tool.execute(**kwargs)
            else:
                return tool.execute(**kwargs)
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