from __future__ import annotations
import json
import os
import shutil
from typing import List, Optional, Dict, Any, TYPE_CHECKING
from datetime import datetime
import uuid
import logging
from pathlib import Path
import tempfile
from contextlib import contextmanager

# Import models
try:
    from models import Project, Memory, Task, ChatMessage
    from .embedding_service import embedding_service
    if TYPE_CHECKING:
        from models import Session
except ImportError:
    # Fallback for when running the file directly
    import sys
    import os
    # Add parent directory to path
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from models import Project, Memory, Task, ChatMessage
    from services.embedding_service import embedding_service
    if TYPE_CHECKING:
        from models import Session

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

    def _get_project_detail_path(self, project_id: str) -> Path:
        """Get path for the long-form project detail/specification text file."""
        return self.data_dir / f"project-{project_id}-project_detail.txt"

    def _get_user_preferences_path(self) -> Path:
        """Get path for user preferences (single-user environment)."""
        return self.data_dir / "user-preferences.json"
    
    @contextmanager
    def _atomic_write(self, file_path: Path):
        """Context manager for atomic file writes."""
        # Create backup before writing
        if file_path.exists():
            self._create_backup(file_path)
        
        # Create temporary file
        temp_file = file_path.with_suffix('.tmp')
        try:
            with open(temp_file, 'w', encoding='utf-8') as f:
                yield f
            # Atomic move
            temp_file.replace(file_path)
        except Exception as e:
            # Clean up temp file on error
            if temp_file.exists():
                temp_file.unlink()
            raise e
    
    def _create_backup(self, file_path: Path) -> None:
        """Create a backup of the file before modification."""
        try:
            if not file_path.exists():
                return
            
            # Create backup filename with timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_name = f"{file_path.stem}_{timestamp}{file_path.suffix}"
            backup_path = self.backup_dir / backup_name
            
            # Copy file to backup
            shutil.copy2(file_path, backup_path)
            
            # Rotate old backups
            self._rotate_backups(file_path.stem)
            
            logger.debug(f"Created backup: {backup_path}")
        except Exception as e:
            logger.warning(f"Failed to create backup for {file_path}: {e}")
    
    def _rotate_backups(self, file_stem: str) -> None:
        """Rotate backups to keep only the most recent ones."""
        try:
            # Find all backups for this file
            backup_pattern = f"{file_stem}_*"
            backups = list(self.backup_dir.glob(backup_pattern))
            
            # Sort by modification time (newest first)
            backups.sort(key=lambda x: x.stat().st_mtime, reverse=True)
            
            # Remove old backups
            for backup in backups[MAX_BACKUPS:]:
                try:
                    backup.unlink()
                    logger.debug(f"Removed old backup: {backup}")
                except Exception as e:
                    logger.warning(f"Failed to remove old backup {backup}: {e}")
        except Exception as e:
            logger.warning(f"Failed to rotate backups: {e}")

    # Plain text helpers
    def _load_text(self, file_path: Path) -> str:
        """Load raw text from a file with error handling."""
        try:
            if not file_path.exists():
                return ""
            return file_path.read_text(encoding='utf-8')
        except Exception as e:
            logger.error(f"Error loading text from {file_path}: {e}")
            return ""

    def _save_text(self, file_path: Path, content: str) -> None:
        """Save raw text to a file using atomic write and backups."""
        try:
            with self._atomic_write(file_path) as temp_file:
                temp_file.write(content or "")
        except Exception as e:
            logger.error(f"Error saving text to {file_path}: {e}")
            raise
    
    def _load_json(self, file_path: Path) -> List[Dict[str, Any]]:
        """Load JSON data from file with error handling."""
        try:
            if not file_path.exists():
                return []
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if not isinstance(data, list):
                logger.warning(f"Invalid JSON structure in {file_path}, expected list")
                return []
            
            return data
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error in {file_path}: {e}")
            return []
        except Exception as e:
            logger.error(f"Error loading {file_path}: {e}")
            return []
    
    def _save_json(self, file_path: Path, data: List[Dict[str, Any]]) -> None:
        """Save JSON data to file with atomic write."""
        try:
            with self._atomic_write(file_path) as temp_file:
                json.dump(data, temp_file, indent=2, ensure_ascii=False, default=str)
        except Exception as e:
            logger.error(f"Error saving {file_path}: {e}")
            raise

    def _save_dict_json(self, file_path: Path, data: Dict[str, Any]) -> None:
        """Save dictionary JSON data to file with atomic write."""
        try:
            with self._atomic_write(file_path) as temp_file:
                json.dump(data, temp_file, indent=2, ensure_ascii=False, default=str)
        except Exception as e:
            logger.error(f"Error saving {file_path}: {e}")
            raise
    
    def _validate_project_data(self, data: Dict[str, Any]) -> bool:
        """Validate project data structure."""
        required_fields = ['id', 'name', 'description', 'tech_stack']
        return all(field in data for field in required_fields)
    
    def _validate_memory_data(self, data: Dict[str, Any]) -> bool:
        """Validate memory data structure."""
        required_fields = ['id', 'project_id', 'title', 'content', 'type']
        return all(field in data for field in required_fields)
    
    def _validate_task_data(self, data: Dict[str, Any]) -> bool:
        """Validate task data structure."""
        required_fields = ['id', 'project_id', 'title', 'description']
        if not all(field in data for field in required_fields):
            return False
        # Backfill defaults for new hierarchical fields for legacy data
        data.setdefault('parent_task_id', None)
        data.setdefault('depth', 1)
        return True
    
    def _validate_chat_message_data(self, data: Dict[str, Any]) -> bool:
        """Validate chat message data structure."""
        required_fields = ['id', 'project_id', 'session_id', 'message']
        return all(field in data for field in required_fields)
    
    def _generate_task_embedding(self, task: Task) -> Task:
        """Generate embedding for a task."""
        try:
            if not task.embedding:
                # Prepare text for embedding
                embedding_text = f"{task.title} {task.description}"
                embedding_text = embedding_service.prepare_text_for_embedding(embedding_text)
                
                # Generate embedding
                embedding = embedding_service.generate_embedding(embedding_text)
                
                if embedding:
                    task.embedding = embedding
                    task.embedding_text = embedding_text
                    logger.debug(f"Generated embedding for task: {task.title}")
                else:
                    logger.warning(f"Failed to generate embedding for task: {task.title}")
            
        except Exception as e:
            logger.error(f"Error generating task embedding: {e}")
        
        return task
    
    def _generate_memory_embedding(self, memory: Memory) -> Memory:
        """Generate embedding for a memory."""
        try:
            if not memory.embedding:
                # Prepare text for embedding
                embedding_text = f"{memory.title} {memory.content}"
                embedding_text = embedding_service.prepare_text_for_embedding(embedding_text)
                
                # Generate embedding
                embedding = embedding_service.generate_embedding(embedding_text)
                
                if embedding:
                    memory.embedding = embedding
                    memory.embedding_text = embedding_text
                    logger.debug(f"Generated embedding for memory: {memory.title}")
                else:
                    logger.warning(f"Failed to generate embedding for memory: {memory.title}")
            
        except Exception as e:
            logger.error(f"Error generating memory embedding: {e}")
        
        return memory
    
    def _generate_chat_message_embedding(self, message: ChatMessage) -> ChatMessage:
        """Generate embedding for a chat message."""
        try:
            if not message.embedding:
                # Prepare text for embedding (combine user message and AI response)
                content_parts = []
                if message.message:
                    content_parts.append(f"User: {message.message}")
                if message.response:
                    content_parts.append(f"Agent: {message.response}")
                
                embedding_text = " ".join(content_parts)
                embedding_text = embedding_service.prepare_text_for_embedding(embedding_text)
                
                # Generate embedding
                embedding = embedding_service.generate_embedding(embedding_text)
                
                if embedding:
                    message.embedding = embedding
                    message.embedding_text = embedding_text
                    logger.debug(f"Generated embedding for chat message: {message.id}")
                else:
                    logger.warning(f"Failed to generate embedding for chat message: {message.id}")
            
        except Exception as e:
            logger.error(f"Error generating chat message embedding: {e}")
        
        return message

    # Directory management
    def ensure_data_dir(self) -> None:
        """Ensure data directory exists."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
    
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
        try:
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
        except Exception as e:
            logger.error(f"Error deleting project {project_id}: {e}")
            return False
    
    def get_project_by_id(self, project_id: str) -> Optional[Project]:
        """Get a specific project by ID."""
        projects = self.load_projects()
        for project in projects:
            if project.id == project_id:
                return project
        return None
    
    def _delete_project_files(self, project_id: str) -> None:
        """Delete all files associated with a project."""
        file_types = ['memories', 'tasks', 'chat', 'sessions']
        for file_type in file_types:
            file_path = self._get_project_file_path(project_id, file_type)
            if file_path.exists():
                try:
                    file_path.unlink()
                    logger.debug(f"Deleted {file_path}")
                except Exception as e:
                    logger.warning(f"Failed to delete {file_path}: {e}")
        # Delete project detail text file
        detail_path = self._get_project_detail_path(project_id)
        if detail_path.exists():
            try:
                detail_path.unlink()
                logger.debug(f"Deleted {detail_path}")
            except Exception as e:
                logger.warning(f"Failed to delete {detail_path}: {e}")
    
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
        """Save a single memory for a project with embedding generation."""
        # Generate embedding if not present
        memory = self._generate_memory_embedding(memory)
        
        memories = self.load_memories(project_id)
        
        # Remove existing memory with same ID
        memories = [m for m in memories if m.id != memory.id]
        memories.append(memory)
        
        file_path = self._get_project_file_path(project_id, "memories")
        self._save_json(file_path, [m.dict() for m in memories])
        logger.info(f"Saved memory: {memory.id}")
    
    def save_memories(self, project_id: str, memories: List[Memory]) -> None:
        """Save multiple memories for a project with embedding generation."""
        # Generate embeddings for memories that don't have them
        for memory in memories:
            memory = self._generate_memory_embedding(memory)
        
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
        """Save multiple tasks for a project with embedding generation."""
        # Generate embeddings for tasks that don't have them
        for task in tasks:
            task = self._generate_task_embedding(task)
        
        file_path = self._get_project_file_path(project_id, "tasks")
        self._save_json(file_path, [t.dict() for t in tasks])
        logger.info(f"Saved {len(tasks)} tasks for project {project_id}")
    
    def save_task(self, project_id: str, task: Task) -> None:
        """Save a single task for a project with embedding generation."""
        # Generate embedding if not present
        task = self._generate_task_embedding(task)
        
        tasks = self.load_tasks(project_id)
        
        # Remove existing task with same ID
        tasks = [t for t in tasks if t.id != task.id]
        tasks.append(task)
        
        # Sort by order
        tasks.sort(key=lambda x: x.order)
        
        file_path = self._get_project_file_path(project_id, "tasks")
        self._save_json(file_path, [t.dict() for t in tasks])
        logger.info(f"Saved task: {task.title}")
    
    def get_task_by_id(self, project_id: str, task_id: str) -> Optional[Task]:
        """Get a specific task by ID."""
        tasks = self.load_tasks(project_id)
        for task in tasks:
            if task.id == task_id:
                return task
        return None

    def get_task_by_id_global(self, task_id: str) -> Optional[Task]:
        """Get a specific task by ID across all projects."""
        projects = self.load_projects()
        for project in projects:
            task = self.get_task_by_id(project.id, task_id)
            if task:
                return task
        return None

    def update_task_status(self, project_id: str, task_id: str, completed: bool) -> bool:
        """Update task completion status."""
        tasks = self.load_tasks(project_id)
        
        for task in tasks:
            if task.id == task_id:
                task.completed = completed
                task.status = "completed" if completed else "pending"
                task.updated_at = datetime.utcnow()
                
                # Regenerate embedding if task content changed significantly
                task = self._generate_task_embedding(task)
                
                self.save_tasks(project_id, tasks)
                logger.info(f"Updated task status: {task_id} -> {'completed' if completed else 'pending'}")
                return True
        
        logger.warning(f"Task not found for status update: {task_id}")
        return False

    def delete_task(self, project_id: str, task_id: str) -> bool:
        """Delete a specific task."""
        tasks = self.load_tasks(project_id)
        
        # Also delete children recursively
        to_delete = {task_id}
        changed = True
        while changed:
            changed = False
            for t in list(tasks):
                if getattr(t, 'parent_task_id', None) in to_delete:
                    to_delete.add(t.id)
                    changed = True
        
        original_count = len(tasks)
        tasks = [t for t in tasks if t.id not in to_delete]
        
        if len(tasks) == original_count:
            logger.warning(f"Task not found for deletion: {task_id}")
            return False
        
        file_path = self._get_project_file_path(project_id, "tasks")
        self._save_json(file_path, [t.dict() for t in tasks])
        logger.info(f"Deleted task: {task_id}")
        return True
    
    # Chat operations
    def load_chat_history(self, project_id: str) -> List[ChatMessage]:
        """Load all chat messages for a project with backward compatibility for legacy format."""
        self.ensure_data_dir()
        file_path = self._get_project_file_path(project_id, "chat")
        data = self._load_json(file_path)
        
        messages = []
        for item in data:
            try:
                # Handle legacy format (role/content) vs new format (message/response)
                if "role" in item and "content" in item:
                    # Legacy format - convert to new format
                    if item["role"] == "user":
                        # User message
                        converted_item = {
                            "id": item.get("id", str(uuid.uuid4())),
                            "project_id": project_id,
                            "session_id": item.get("session_id", ""),
                            "message": item["content"],
                            "response": "",
                            "created_at": item.get("timestamp", datetime.now().isoformat())
                        }
                    elif item["role"] == "assistant":
                        # Assistant response - find the previous user message to pair with
                        if messages and messages[-1].response == "":
                            # Update the previous message's response
                            messages[-1].response = item["content"]
                            continue
                        else:
                            # Create a new message pair with empty user message
                            converted_item = {
                                "id": item.get("id", str(uuid.uuid4())),
                                "project_id": project_id,
                                "session_id": item.get("session_id", ""),
                                "message": "",
                                "response": item["content"],
                                "created_at": item.get("timestamp", datetime.now().isoformat())
                            }
                    else:
                        logger.warning(f"Unknown role in legacy chat message: {item['role']}")
                        continue
                else:
                    # New format - validate and use as is
                    if self._validate_chat_message_data(item):
                        converted_item = item
                    else:
                        logger.warning(f"Invalid chat message data: {item}")
                        continue
                
                # Create ChatMessage object
                messages.append(ChatMessage(**converted_item))
                
            except Exception as e:
                logger.warning(f"Error processing chat message: {e}, data: {item}")
                continue
        
        # Sort by creation time
        messages.sort(key=lambda x: x.created_at)
        logger.debug(f"Loaded {len(messages)} chat messages for project {project_id}")
        return messages
    
    def load_chat_messages(self, project_id: str) -> List[ChatMessage]:
        """Alias for load_chat_history for backward compatibility."""
        return self.load_chat_history(project_id)
    
    def save_chat_message(self, project_id: str, message: ChatMessage) -> None:
        """Save a single chat message with embedding generation."""
        # Generate embedding if not present
        message = self._generate_chat_message_embedding(message)
        
        messages = self.load_chat_history(project_id)
        messages.append(message)
        
        file_path = self._get_project_file_path(project_id, "chat")
        self._save_json(file_path, [m.dict() for m in messages])
        logger.info(f"Saved chat message: {message.id}")
    
    def save_chat_history(self, project_id: str, messages: List[ChatMessage]) -> None:
        """Save multiple chat messages with embedding generation."""
        # Generate embeddings for messages that don't have them
        for message in messages:
            message = self._generate_chat_message_embedding(message)
        
        file_path = self._get_project_file_path(project_id, "chat")
        self._save_json(file_path, [m.dict() for m in messages])
        logger.info(f"Saved {len(messages)} chat messages for project {project_id}")
    
    # Session management methods
    def load_sessions(self, project_id: str) -> List["Session"]:
        """Load sessions for a project."""
        self.ensure_data_dir()
        file_path = self._get_project_file_path(project_id, "sessions")
        data = self._load_json(file_path)
        
        sessions = []
        for item in data:
            try:
                # Import Session here to avoid circular imports
                from models import Session
                sessions.append(Session(**item))
            except Exception as e:
                logger.warning(f"Invalid session data: {e}")
                continue
        
        # Sort by last_activity (most recent first)
        sessions.sort(key=lambda x: x.last_activity, reverse=True)
        logger.debug(f"Loaded {len(sessions)} sessions for project {project_id}")
        return sessions
    
    def save_session(self, project_id: str, session: "Session") -> None:
        """Save a single session."""
        sessions = self.load_sessions(project_id)
        
        # Update existing session or add new one
        existing_index = next((i for i, s in enumerate(sessions) if s.id == session.id), None)
        if existing_index is not None:
            sessions[existing_index] = session
        else:
            sessions.append(session)
        
        file_path = self._get_project_file_path(project_id, "sessions")
        self._save_json(file_path, [s.dict() for s in sessions])
        logger.debug(f"Saved session: {session.id}")
    
    def get_session_by_id(self, project_id: str, session_id: str) -> Optional["Session"]:
        """Get a session by ID."""
        sessions = self.load_sessions(project_id)
        return next((s for s in sessions if s.id == session_id), None)
    
    def get_latest_session(self, project_id: str) -> Optional["Session"]:
        """Get the most recent session for a project."""
        sessions = self.load_sessions(project_id)
        return sessions[0] if sessions else None
    
    def create_session(self, project_id: str, name: Optional[str] = None) -> "Session":
        """Create a new session for a project."""
        from models import Session
        
        # Generate session name if not provided
        if not name:
            sessions = self.load_sessions(project_id)
            session_number = len(sessions) + 1
            name = f"Session {session_number}"
        
        session = Session(
            project_id=project_id,
            name=name
        )
        
        self.save_session(project_id, session)
        logger.info(f"Created new session: {session.id} for project {project_id}")
        return session
    
    def update_session_activity(self, project_id: str, session_id: str) -> None:
        """Update the last activity timestamp for a session."""
        session = self.get_session_by_id(project_id, session_id)
        if session:
            from datetime import datetime
            session.last_activity = datetime.now()
            self.save_session(project_id, session)
    
    def load_chat_messages_by_session(self, project_id: str, session_id: str) -> List[ChatMessage]:
        """Load chat messages for a specific session with improved error handling."""
        messages = self.load_chat_history(project_id)
        logger.info(f"Total messages loaded for project {project_id}: {len(messages)}")
        
        if not session_id:
            logger.warning(f"Empty session_id provided for project {project_id}")
            return []
        
        # Debug: Check session_id field in messages
        for i, msg in enumerate(messages[:5]):  # Check first 5 messages
            msg_session_id = getattr(msg, 'session_id', None)
            logger.info(f"Message {i}: session_id = {msg_session_id}")
        
        # Filter messages by session_id, handling both string and None values
        session_messages = []
        for m in messages:
            msg_session_id = getattr(m, 'session_id', None)
            if msg_session_id == session_id:
                session_messages.append(m)
        
        logger.info(f"Messages matching session {session_id}: {len(session_messages)}")
        
        # Sort by created_at
        session_messages.sort(key=lambda x: x.created_at)
        logger.debug(f"Loaded {len(session_messages)} messages for session {session_id}")
        return session_messages
    
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

    # Project detail (long-form spec) operations
    def load_project_detail(self, project_id: str) -> str:
        """Load the long-form project detail/specification text for a project."""
        self.ensure_data_dir()
        path = self._get_project_detail_path(project_id)
        content = self._load_text(path)
        logger.debug(f"Loaded project detail for {project_id}: {len(content)} chars")
        return content

    def save_project_detail(self, project_id: str, content: str) -> None:
        """Persist the long-form project detail/specification text for a project."""
        self.ensure_data_dir()
        path = self._get_project_detail_path(project_id)
        self._save_text(path, content)
        logger.info(f"Saved project detail for {project_id} ({len(content or '')} chars)")

    # User preferences (single-user) operations
    def load_user_preferences(self) -> Dict[str, Any]:
        """Load user preferences. Defaults if not present."""
        self.ensure_data_dir()
        file_path = self._get_user_preferences_path()
        try:
            if not file_path.exists():
                return {"has_seen_task_suggestion_prompt": False}
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if not isinstance(data, dict):
                    return {"has_seen_task_suggestion_prompt": False}
                # Ensure default key exists
                data.setdefault("has_seen_task_suggestion_prompt", False)
                return data
        except Exception as e:
            logger.warning(f"Failed to load user preferences: {e}")
            return {"has_seen_task_suggestion_prompt": False}

    def save_user_preferences(self, preferences: Dict[str, Any]) -> None:
        """Save user preferences to disk."""
        self.ensure_data_dir()
        file_path = self._get_user_preferences_path()
        # Normalize preferences and ensure required keys
        normalized = {
            "has_seen_task_suggestion_prompt": bool(preferences.get("has_seen_task_suggestion_prompt", False))
        }
        self._save_dict_json(file_path, normalized)
        logger.info("Saved user preferences")

    def mark_task_suggestion_seen(self) -> None:
        """Mark the proactive task suggestion banner as seen/dismissed."""
        prefs = self.load_user_preferences()
        if not prefs.get("has_seen_task_suggestion_prompt", False):
            prefs["has_seen_task_suggestion_prompt"] = True
            self.save_user_preferences(prefs)


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