import uuid
import json
import logging
import asyncio
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field

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
                     connected_codebase_path: str = None, session_id: str = None,
                     max_files_to_scan: int = 5000, max_iterations: int = 3) -> Dict[str, Any]:
        """
        Extract relevant code context from the codebase based on a natural language request.
        
        Args:
            natural_language_request: The user's request in natural language
            project_id: The project identifier
            connected_codebase_path: Path to the codebase (optional, will use project path if not provided)
            session_id: The chat session identifier for persistence
            max_files_to_scan: Maximum number of files to scan
            max_iterations: Maximum number of LLM iterations for file selection
        
        Returns:
            Dictionary containing extracted code context
        """
        try:
            # Determine codebase path
            if not connected_codebase_path:
                # Try to get the project's codebase_path from the database
                try:
                    from .file_service import file_service
                    project = file_service.get_project_by_id(project_id)
                    if project and project.codebase_path:
                        connected_codebase_path = project.codebase_path
                    else:
                        # Fallback to project ID if no codebase_path is set
                        connected_codebase_path = f"../{project_id}"
                except Exception as e:
                    logger.warning(f"Failed to get project codebase_path: {e}")
                    # Fallback to project ID
                    connected_codebase_path = f"../{project_id}"
            
            # Validate codebase path exists
            if not os.path.exists(connected_codebase_path):
                return {
                    "success": False,
                    "message": f"❌ Codebase path not found: {connected_codebase_path}",
                    "context": None,
                    "relevant_code": None,
                    "file_path": None
                }
            
            # Step 1: Scan the codebase for files and methods
            logger.info(f"Scanning codebase at {connected_codebase_path}")
            try:
                file_infos = code_parser.scan_codebase(connected_codebase_path, max_files_to_scan)
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
        """Use LLM to identify the most relevant files and methods for the request."""
        try:
            from .gemini_service import GeminiService
            gemini_service = GeminiService()
            
            # Create a detailed summary of available files and methods for the LLM
            file_summary = self._create_detailed_file_summary_for_llm(file_infos)
            
            prompt = f"""
You are an expert code analyzer. Given a user request and a list of files with their methods/classes in a codebase, 
identify the most relevant files and specific methods/classes that would help answer the request.

User Request: {request}

Available Files and Methods:
{file_summary}

Instructions:
1. Analyze the user request carefully
2. Look for files that contain relevant code, functions, classes, or concepts
3. For each relevant file, identify the specific methods/classes that are most relevant
4. Consider file names, paths, and the types of code elements they contain
5. Return a JSON object with file paths as keys and arrays of method/class names as values
6. Limit to 3-5 most relevant files
7. If no files seem relevant, return an empty object {{}}

Return format: {{"file1.py": ["method1", "class1"], "file2.js": ["function1"]}}
"""
            
            response = await gemini_service.chat_with_system_prompt("", prompt)
            
            # Extract JSON object from response
            try:
                # Try to find JSON object in the response
                import re
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                if json_match:
                    file_methods_map = json.loads(json_match.group())
                else:
                    # Fallback: try to parse the entire response as JSON
                    file_methods_map = json.loads(response)
                
                # Validate that returned paths exist in our file_infos
                valid_file_methods = {}
                for file_path, methods in file_methods_map.items():
                    if file_path in file_infos:
                        # Validate that the methods exist in the file
                        file_info = file_infos[file_path]
                        valid_methods = []
                        for method in methods:
                            # Check if method exists in the file's elements
                            for element in file_info.elements:
                                if element.name.lower() == method.lower() or method.lower() in element.name.lower():
                                    valid_methods.append(element.name)
                                    break
                        if valid_methods:
                            valid_file_methods[file_path] = valid_methods
                
                logger.info(f"LLM identified {len(valid_file_methods)} relevant files with methods")
                return valid_file_methods
                
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse LLM response as JSON: {e}")
                # Fallback to simple file identification
                fallback_files = code_parser.get_relevant_files(file_infos, request, max_results=3)
                return {file_path: [] for file_path in fallback_files}
                
        except Exception as e:
            logger.error(f"Error identifying relevant files and methods: {e}")
            # Fallback to simple file identification
            fallback_files = code_parser.get_relevant_files(file_infos, request, max_results=3)
            return {file_path: [] for file_path in fallback_files}
    
    def _create_file_summary_for_llm(self, file_infos: Dict[str, Any]) -> str:
        """Create a summary of files for the LLM to analyze."""
        summary_lines = []
        
        for file_path, file_info in file_infos.items():
            elements_summary = []
            for element in file_info.elements[:5]:  # Limit to first 5 elements
                elements_summary.append(f"{element.type}:{element.name}")
            
            elements_str = ", ".join(elements_summary) if elements_summary else "no elements"
            summary_lines.append(f"- {file_path} ({file_info.language}): {elements_str}")
        
        return "\n".join(summary_lines[:50])  # Limit to first 50 files
    
    def _create_detailed_file_summary_for_llm(self, file_infos: Dict[str, Any]) -> str:
        """Create a detailed summary of files and their methods for the LLM to analyze."""
        summary_lines = []
        
        for file_path, file_info in file_infos.items():
            summary_lines.append(f"📁 {file_path} ({file_info.language}):")
            
            if file_info.elements:
                for element in file_info.elements[:10]:  # Limit to first 10 elements
                    summary_lines.append(f"  • {element.type}: {element.name}")
            else:
                summary_lines.append("  • no elements")
            
            summary_lines.append("")  # Empty line for readability
        
        return "\n".join(summary_lines[:100])  # Limit to first 100 lines
    
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
            max_chunk_size = 12000  # Characters per chunk
            chunks = self._split_content_into_chunks(combined_content, max_chunk_size)
            
            # Step 4: Analyze each chunk and accumulate results
            accumulated_context = []
            accumulated_code = []
            best_file_path = None
            total_relevance_score = 0
            
            for i, chunk in enumerate(chunks):
                prompt = f"""
You are an expert code analyzer. Given a user request and code content from multiple files, extract the most relevant 
information that would help answer the request.

User Request: {request}

Code Content (Chunk {i+1}/{len(chunks)}):
{chunk}

Instructions:
1. Analyze the code content in relation to the user request
2. Extract the most relevant code snippets and context
3. Provide a concise summary of how this code relates to the request
4. If the code is not relevant to the request, indicate this clearly
5. Focus on the most important and relevant parts

Return a JSON object with:
- "relevance_score": 0-10 (how relevant this chunk is to the request)
- "context": A brief summary of the relevant code and its purpose
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
                avg_relevance_score = total_relevance_score / len(chunks) if chunks else 0
                
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
        """Extract specific methods from a file based on target method names."""
        try:
            # Get file info to find method locations
            file_info = code_parser.extract_elements_from_file(file_path, code_parser.detect_language(file_path))
            
            extracted_parts = []
            
            for target_method in target_methods:
                for element in file_info:
                    if (element.name.lower() == target_method.lower() or 
                        target_method.lower() in element.name.lower()):
                        # Extract the method content
                        method_content = self._extract_element_content(file_content, element)
                        if method_content:
                            # Include file path in the method header to distinguish from other files
                            extracted_parts.append(f"// {element.type}: {element.name} (from {file_path})\n{method_content}")
                        break
            
            if extracted_parts:
                return "\n\n".join(extracted_parts)
            else:
                return None
                
        except Exception as e:
            logger.warning(f"Error extracting methods from {file_path}: {e}")
            return None
    
    def _extract_element_content(self, file_content: str, element) -> Optional[str]:
        """Extract the content of a specific code element (method, class, etc.)."""
        try:
            # This is a simplified extraction - in a real implementation, you'd want
            # to use proper AST parsing to extract the exact method boundaries
            lines = file_content.split('\n')
            
            # Find the line that contains the element definition
            element_start = None
            for i, line in enumerate(lines):
                if element.name in line and ('def ' in line or 'class ' in line or 'function ' in line):
                    element_start = i
                    break
            
            if element_start is None:
                return None
            
            # Extract a reasonable chunk around the element (simplified approach)
            start_line = max(0, element_start - 2)  # Include 2 lines before
            end_line = min(len(lines), element_start + 20)  # Include up to 20 lines after
            
            return '\n'.join(lines[start_line:end_line])
            
        except Exception as e:
            logger.warning(f"Error extracting element content: {e}")
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