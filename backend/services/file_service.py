import json
import os
import shutil
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import logging
from pathlib import Path
import tempfile
from contextlib import contextmanager

# Import models
try:
    from models import Project, Memory, Task, ChatMessage
except ImportError:
    # Fallback for when running the file directly
    import sys
    import os
    # Add parent directory to path
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from models import Project, Memory, Task, ChatMessage

# Constants
DATA_DIR = "data"
BACKUP_DIR = "data/backups"
MAX_BACKUPS = 5

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FileService:
    """Comprehensive file service for data persistence using JSON files."""
    
    def __init__(self, data_dir: str = DATA_DIR, backup_dir: str = BACKUP_DIR):
        self.data_dir = Path(data_dir)
        self.backup_dir = Path(backup_dir)
        self._ensure_directories()
    
    def _ensure_directories(self) -> None:
        """Ensure data and backup directories exist."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.backup_dir.mkdir(parents=True, exist_ok=True)
    
    def _get_file_path(self, filename: str) -> Path:
        """Get full file path for a given filename."""
        return self.data_dir / filename
    
    def _get_project_file_path(self, project_id: str, file_type: str) -> Path:
        """Get project-specific file path."""
        return self.data_dir / f"project-{project_id}-{file_type}.json"
    
    @contextmanager
    def _atomic_write(self, file_path: Path):
        """Context manager for atomic file writes."""
        temp_file = None
        try:
            # Create temporary file in the same directory
            temp_file = file_path.with_suffix('.tmp')
            yield temp_file
            
            # Atomic rename
            temp_file.replace(file_path)
            logger.debug(f"Successfully wrote {file_path}")
            
        except Exception as e:
            logger.error(f"Error during atomic write to {file_path}: {e}")
            if temp_file and temp_file.exists():
                temp_file.unlink()
            raise
    
    def _create_backup(self, file_path: Path) -> None:
        """Create a backup of the file before modification."""
        if not file_path.exists():
            return
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"{file_path.stem}_{timestamp}{file_path.suffix}"
        backup_path = self.backup_dir / backup_name
        
        try:
            shutil.copy2(file_path, backup_path)
            logger.debug(f"Created backup: {backup_path}")
            
            # Rotate old backups
            self._rotate_backups(file_path.stem)
            
        except Exception as e:
            logger.warning(f"Failed to create backup for {file_path}: {e}")
    
    def _rotate_backups(self, file_stem: str) -> None:
        """Rotate backup files, keeping only the most recent ones."""
        try:
            backup_files = list(self.backup_dir.glob(f"{file_stem}_*"))
            backup_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
            
            # Remove old backups beyond the limit
            for old_backup in backup_files[MAX_BACKUPS:]:
                old_backup.unlink()
                logger.debug(f"Removed old backup: {old_backup}")
                
        except Exception as e:
            logger.warning(f"Failed to rotate backups: {e}")
    
    def _load_json(self, file_path: Path) -> List[Dict[str, Any]]:
        """Load JSON data from file with error handling."""
        try:
            if not file_path.exists():
                logger.info(f"File not found: {file_path}, returning empty list")
                return []
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if not isinstance(data, list):
                    logger.warning(f"Invalid JSON format in {file_path}, expected list")
                    return []
                return data
                
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in {file_path}: {e}")
            return []
        except Exception as e:
            logger.error(f"Error reading {file_path}: {e}")
            return []
    
    def _save_json(self, file_path: Path, data: List[Dict[str, Any]]) -> None:
        """Save JSON data to file with atomic write and backup."""
        try:
            # Create backup before modification
            self._create_backup(file_path)
            
            # Atomic write
            with self._atomic_write(file_path) as temp_file:
                with open(temp_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False, default=str)
                    
        except Exception as e:
            logger.error(f"Error saving to {file_path}: {e}")
            raise
    
    def _validate_project_data(self, data: Dict[str, Any]) -> bool:
        """Validate project data structure."""
        required_fields = ['id', 'name', 'description', 'tech_stack']
        return all(field in data for field in required_fields)
    
    def _validate_memory_data(self, data: Dict[str, Any]) -> bool:
        """Validate memory data structure."""
        required_fields = ['id', 'title', 'content', 'type']
        return all(field in data for field in required_fields)
    
    def _validate_task_data(self, data: Dict[str, Any]) -> bool:
        """Validate task data structure."""
        required_fields = ['id', 'title', 'description', 'prompt', 'completed', 'order']
        return all(field in data for field in required_fields)
    
    def _validate_chat_message_data(self, data: Dict[str, Any]) -> bool:
        """Validate chat message data structure."""
        required_fields = ['id', 'role', 'content', 'timestamp']
        return all(field in data for field in required_fields)
    
    # Directory management
    def ensure_data_dir(self) -> None:
        """Ensure data directory exists."""
        self._ensure_directories()
    
    def get_file_path(self, filename: str) -> str:
        """Get file path for a given filename."""
        return str(self._get_file_path(filename))
    
    # Project operations
    def load_projects(self) -> List[Project]:
        """Load all projects from projects.json."""
        self.ensure_data_dir()
        file_path = self._get_file_path("projects.json")
        data = self._load_json(file_path)
        
        projects = []
        for item in data:
            if self._validate_project_data(item):
                try:
                    projects.append(Project(**item))
                except Exception as e:
                    logger.warning(f"Invalid project data: {e}")
                    continue
        
        logger.info(f"Loaded {len(projects)} projects")
        return projects
    
    def save_project(self, project: Project) -> None:
        """Save or update a project."""
        self.ensure_data_dir()
        projects = self.load_projects()
        
        # Remove existing project with same ID
        projects = [p for p in projects if p.id != project.id]
        projects.append(project)
        
        # Save with atomic write
        file_path = self._get_file_path("projects.json")
        self._save_json(file_path, [p.dict() for p in projects])
        logger.info(f"Saved project: {project.name}")
    
    def delete_project(self, project_id: str) -> bool:
        """Delete a project and all its associated data."""
        self.ensure_data_dir()
        projects = self.load_projects()
        
        # Find and remove project
        original_count = len(projects)
        projects = [p for p in projects if p.id != project_id]
        
        if len(projects) == original_count:
            logger.warning(f"Project not found for deletion: {project_id}")
            return False
        
        # Save updated projects list
        file_path = self._get_file_path("projects.json")
        self._save_json(file_path, [p.dict() for p in projects])
        
        # Delete project-specific files
        self._delete_project_files(project_id)
        
        logger.info(f"Deleted project: {project_id}")
        return True
    
    def get_project_by_id(self, project_id: str) -> Optional[Project]:
        """Get a specific project by ID."""
        projects = self.load_projects()
        for project in projects:
            if project.id == project_id:
                return project
        return None
    
    def _delete_project_files(self, project_id: str) -> None:
        """Delete all files associated with a project."""
        file_types = ['memories', 'tasks', 'chat']
        for file_type in file_types:
            file_path = self._get_project_file_path(project_id, file_type)
            if file_path.exists():
                try:
                    file_path.unlink()
                    logger.debug(f"Deleted {file_path}")
                except Exception as e:
                    logger.warning(f"Failed to delete {file_path}: {e}")
    
    # Memory operations
    def load_memories(self, project_id: str) -> List[Memory]:
        """Load all memories for a project."""
        self.ensure_data_dir()
        file_path = self._get_project_file_path(project_id, "memories")
        data = self._load_json(file_path)
        
        memories = []
        for item in data:
            if self._validate_memory_data(item):
                try:
                    memories.append(Memory(**item))
                except Exception as e:
                    logger.warning(f"Invalid memory data: {e}")
                    continue
        
        logger.debug(f"Loaded {len(memories)} memories for project {project_id}")
        return memories
    
    def save_memory(self, project_id: str, memory: Memory) -> None:
        """Save a single memory for a project."""
        memories = self.load_memories(project_id)
        
        # Remove existing memory with same ID
        memories = [m for m in memories if m.id != memory.id]
        memories.append(memory)
        
        file_path = self._get_project_file_path(project_id, "memories")
        self._save_json(file_path, [m.dict() for m in memories])
        logger.info(f"Saved memory: {memory.title}")
    
    def save_memories(self, project_id: str, memories: List[Memory]) -> None:
        """Save multiple memories for a project."""
        file_path = self._get_project_file_path(project_id, "memories")
        self._save_json(file_path, [m.dict() for m in memories])
        logger.info(f"Saved {len(memories)} memories for project {project_id}")
    
    def delete_memory(self, project_id: str, memory_id: str) -> bool:
        """Delete a specific memory."""
        memories = self.load_memories(project_id)
        
        original_count = len(memories)
        memories = [m for m in memories if m.id != memory_id]
        
        if len(memories) == original_count:
            logger.warning(f"Memory not found for deletion: {memory_id}")
            return False
        
        file_path = self._get_project_file_path(project_id, "memories")
        self._save_json(file_path, [m.dict() for m in memories])
        logger.info(f"Deleted memory: {memory_id}")
        return True
    
    # Task operations
    def load_tasks(self, project_id: str) -> List[Task]:
        """Load all tasks for a project."""
        self.ensure_data_dir()
        file_path = self._get_project_file_path(project_id, "tasks")
        data = self._load_json(file_path)
        
        tasks = []
        for item in data:
            if self._validate_task_data(item):
                try:
                    tasks.append(Task(**item))
                except Exception as e:
                    logger.warning(f"Invalid task data: {e}")
                    continue
        
        # Sort by order
        tasks.sort(key=lambda x: x.order)
        logger.debug(f"Loaded {len(tasks)} tasks for project {project_id}")
        return tasks
    
    def save_tasks(self, project_id: str, tasks: List[Task]) -> None:
        """Save multiple tasks for a project."""
        file_path = self._get_project_file_path(project_id, "tasks")
        self._save_json(file_path, [t.dict() for t in tasks])
        logger.info(f"Saved {len(tasks)} tasks for project {project_id}")
    
    def save_task(self, project_id: str, task: Task) -> None:
        """Save a single task for a project."""
        tasks = self.load_tasks(project_id)
        
        # Remove existing task with same ID
        tasks = [t for t in tasks if t.id != task.id]
        tasks.append(task)
        
        # Sort by order
        tasks.sort(key=lambda x: x.order)
        
        file_path = self._get_project_file_path(project_id, "tasks")
        self._save_json(file_path, [t.dict() for t in tasks])
        logger.info(f"Saved task: {task.title}")
    
    def update_task_status(self, project_id: str, task_id: str, completed: bool) -> bool:
        """Update task completion status."""
        tasks = self.load_tasks(project_id)
        
        for task in tasks:
            if task.id == task_id:
                task.completed = completed
                file_path = self._get_project_file_path(project_id, "tasks")
                self._save_json(file_path, [t.dict() for t in tasks])
                logger.info(f"Updated task status: {task_id} -> {completed}")
                return True
        
        logger.warning(f"Task not found for status update: {task_id}")
        return False
    
    # Chat operations
    def load_chat_history(self, project_id: str) -> List[ChatMessage]:
        """Load chat history for a project."""
        self.ensure_data_dir()
        file_path = self._get_project_file_path(project_id, "chat")
        data = self._load_json(file_path)
        
        messages = []
        for item in data:
            if self._validate_chat_message_data(item):
                try:
                    messages.append(ChatMessage(**item))
                except Exception as e:
                    logger.warning(f"Invalid chat message data: {e}")
                    continue
        
        # Sort by timestamp
        messages.sort(key=lambda x: x.timestamp)
        logger.debug(f"Loaded {len(messages)} chat messages for project {project_id}")
        return messages
    
    def save_chat_message(self, project_id: str, message: ChatMessage) -> None:
        """Save a single chat message."""
        messages = self.load_chat_history(project_id)
        messages.append(message)
        
        file_path = self._get_project_file_path(project_id, "chat")
        self._save_json(file_path, [m.dict() for m in messages])
        logger.debug(f"Saved chat message: {message.id}")
    
    def save_chat_history(self, project_id: str, messages: List[ChatMessage]) -> None:
        """Save multiple chat messages."""
        file_path = self._get_project_file_path(project_id, "chat")
        self._save_json(file_path, [m.dict() for m in messages])
        logger.info(f"Saved {len(messages)} chat messages for project {project_id}")
    
    # Utility methods
    def get_project_stats(self, project_id: str) -> Dict[str, int]:
        """Get statistics for a project."""
        memories = self.load_memories(project_id)
        tasks = self.load_tasks(project_id)
        messages = self.load_chat_history(project_id)
        
        completed_tasks = sum(1 for task in tasks if task.completed)
        
        return {
            "memories": len(memories),
            "tasks": len(tasks),
            "completed_tasks": completed_tasks,
            "chat_messages": len(messages)
        }
    
    def cleanup_orphaned_files(self) -> int:
        """Clean up files for non-existent projects."""
        projects = self.load_projects()
        project_ids = {p.id for p in projects}
        
        cleaned_count = 0
        for file_path in self.data_dir.glob("project-*-*.json"):
            # Extract project ID from filename
            parts = file_path.stem.split('-')
            if len(parts) >= 2:
                file_project_id = parts[1]
                if file_project_id not in project_ids:
                    try:
                        file_path.unlink()
                        cleaned_count += 1
                        logger.info(f"Cleaned up orphaned file: {file_path}")
                    except Exception as e:
                        logger.warning(f"Failed to clean up {file_path}: {e}")
        
        return cleaned_count


# Global file service instance
file_service = FileService()


# Test functions
def test_file_service():
    """Test all file service functionality."""
    logger.info("Starting file service tests...")
    
    try:
        # Test project operations
        project = Project(
            id="test-project",
            name="Test Project",
            description="A test project for file service",
            tech_stack="Python, FastAPI, React",
            created_at=datetime.now()
        )
        
        # Save project
        file_service.save_project(project)
        logger.info("✓ Project saved successfully")
        
        # Load projects
        projects = file_service.load_projects()
        assert len(projects) > 0, "No projects loaded"
        logger.info("✓ Projects loaded successfully")
        
        # Get project by ID
        loaded_project = file_service.get_project_by_id("test-project")
        assert loaded_project is not None, "Project not found by ID"
        logger.info("✓ Project retrieved by ID successfully")
        
        # Test memory operations
        memory = Memory(
            id="test-memory",
            title="Test Memory",
            content="This is a test memory",
            type="note",
            created_at=datetime.now()
        )
        
        file_service.save_memory("test-project", memory)
        memories = file_service.load_memories("test-project")
        assert len(memories) > 0, "No memories loaded"
        logger.info("✓ Memory operations successful")
        
        # Test task operations
        task = Task(
            id="test-task",
            title="Test Task",
            description="A test task",
            prompt="Create a test task",
            completed=False,
            order=1,
            created_at=datetime.now()
        )
        
        file_service.save_task("test-project", task)
        tasks = file_service.load_tasks("test-project")
        assert len(tasks) > 0, "No tasks loaded"
        logger.info("✓ Task operations successful")
        
        # Test chat operations
        message = ChatMessage(
            id="test-message",
            role="user",
            content="Hello, this is a test message",
            timestamp=datetime.now()
        )
        
        file_service.save_chat_message("test-project", message)
        messages = file_service.load_chat_history("test-project")
        assert len(messages) > 0, "No chat messages loaded"
        logger.info("✓ Chat operations successful")
        
        # Test project stats
        stats = file_service.get_project_stats("test-project")
        assert stats["memories"] > 0, "No memories in stats"
        assert stats["tasks"] > 0, "No tasks in stats"
        assert stats["chat_messages"] > 0, "No chat messages in stats"
        logger.info("✓ Project stats successful")
        
        # Clean up test data
        file_service.delete_project("test-project")
        logger.info("✓ Test cleanup successful")
        
        logger.info("🎉 All file service tests passed!")
        
    except Exception as e:
        logger.error(f"❌ File service test failed: {e}")
        raise


if __name__ == "__main__":
    test_file_service() 