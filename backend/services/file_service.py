import json
import os
from typing import List, Optional
from datetime import datetime
from models import Project, Task, Memory, ChatMessage

class FileService:
    """Service for handling JSON file operations"""
    
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.projects_file = os.path.join(data_dir, "projects.json")
        self.tasks_file = os.path.join(data_dir, "tasks.json")
        self.memories_file = os.path.join(data_dir, "memories.json")
        self.chat_messages_file = os.path.join(data_dir, "chat_messages.json")
        
        # Ensure data directory exists
        os.makedirs(data_dir, exist_ok=True)
        
        # Initialize files if they don't exist
        self._initialize_files()
    
    def _initialize_files(self):
        """Initialize JSON files if they don't exist"""
        files_to_init = [
            (self.projects_file, []),
            (self.tasks_file, []),
            (self.memories_file, []),
            (self.chat_messages_file, [])
        ]
        
        for file_path, default_data in files_to_init:
            if not os.path.exists(file_path):
                self._write_json(file_path, default_data)
    
    def _read_json(self, file_path: str) -> List[dict]:
        """Read JSON file and return list of dictionaries"""
        try:
            if not os.path.exists(file_path):
                return []
            
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            # TODO: Add proper error handling and logging
            print(f"Error reading {file_path}: {str(e)}")
            return []
    
    def _write_json(self, file_path: str, data: List[dict]):
        """Write list of dictionaries to JSON file"""
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        except Exception as e:
            # TODO: Add proper error handling and logging
            print(f"Error writing {file_path}: {str(e)}")
            raise
    
    # Project operations
    def get_projects(self) -> List[Project]:
        """Get all projects"""
        data = self._read_json(self.projects_file)
        return [Project(**project) for project in data]
    
    def get_project(self, project_id: str) -> Optional[Project]:
        """Get a specific project by ID"""
        projects = self.get_projects()
        for project in projects:
            if project.id == project_id:
                return project
        return None
    
    def create_project(self, project: Project) -> Project:
        """Create a new project"""
        projects = self.get_projects()
        project.updated_at = datetime.utcnow()
        projects.append(project.dict())
        self._write_json(self.projects_file, projects)
        return project
    
    def update_project(self, project_id: str, project_data: dict) -> Optional[Project]:
        """Update a project"""
        projects = self.get_projects()
        for i, project in enumerate(projects):
            if project.id == project_id:
                project_data['id'] = project_id
                project_data['updated_at'] = datetime.utcnow()
                projects[i] = Project(**project_data)
                self._write_json(self.projects_file, [p.dict() for p in projects])
                return projects[i]
        return None
    
    def delete_project(self, project_id: str) -> bool:
        """Delete a project"""
        projects = self.get_projects()
        for i, project in enumerate(projects):
            if project.id == project_id:
                projects.pop(i)
                self._write_json(self.projects_file, [p.dict() for p in projects])
                return True
        return False
    
    # Task operations
    def get_tasks(self, project_id: str) -> List[Task]:
        """Get all tasks for a project"""
        data = self._read_json(self.tasks_file)
        tasks = [Task(**task) for task in data if task.get('project_id') == project_id]
        return tasks
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """Get a specific task by ID"""
        data = self._read_json(self.tasks_file)
        for task_data in data:
            if task_data.get('id') == task_id:
                return Task(**task_data)
        return None
    
    def create_task(self, task: Task) -> Task:
        """Create a new task"""
        tasks = self._read_json(self.tasks_file)
        task.updated_at = datetime.utcnow()
        tasks.append(task.dict())
        self._write_json(self.tasks_file, tasks)
        return task
    
    def update_task(self, task_id: str, task_data: dict) -> Optional[Task]:
        """Update a task"""
        tasks = self._read_json(self.tasks_file)
        for i, task in enumerate(tasks):
            if task.get('id') == task_id:
                task_data['id'] = task_id
                task_data['updated_at'] = datetime.utcnow()
                tasks[i] = Task(**task_data)
                self._write_json(self.tasks_file, tasks)
                return tasks[i]
        return None
    
    def delete_task(self, task_id: str) -> bool:
        """Delete a task"""
        tasks = self._read_json(self.tasks_file)
        for i, task in enumerate(tasks):
            if task.get('id') == task_id:
                tasks.pop(i)
                self._write_json(self.tasks_file, tasks)
                return True
        return False
    
    # Memory operations
    def get_memories(self, project_id: str) -> List[Memory]:
        """Get all memories for a project"""
        data = self._read_json(self.memories_file)
        memories = [Memory(**memory) for memory in data if memory.get('project_id') == project_id]
        return memories
    
    def create_memory(self, memory: Memory) -> Memory:
        """Create a new memory"""
        memories = self._read_json(self.memories_file)
        memories.append(memory.dict())
        self._write_json(self.memories_file, memories)
        return memory
    
    def delete_memory(self, memory_id: str) -> bool:
        """Delete a memory"""
        memories = self._read_json(self.memories_file)
        for i, memory in enumerate(memories):
            if memory.get('id') == memory_id:
                memories.pop(i)
                self._write_json(self.memories_file, memories)
                return True
        return False
    
    # Chat message operations
    def get_chat_messages(self, project_id: str) -> List[ChatMessage]:
        """Get all chat messages for a project"""
        data = self._read_json(self.chat_messages_file)
        messages = [ChatMessage(**message) for message in data if message.get('project_id') == project_id]
        return messages
    
    def create_chat_message(self, message: ChatMessage) -> ChatMessage:
        """Create a new chat message"""
        messages = self._read_json(self.chat_messages_file)
        messages.append(message.dict())
        self._write_json(self.chat_messages_file, messages)
        return message 