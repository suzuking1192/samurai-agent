# FileService Documentation

## Overview

The `FileService` class provides comprehensive data persistence functionality for the Samurai Agent project using JSON files. It handles all CRUD operations for projects, memories, tasks, and chat history with robust error handling, data validation, and backup systems.

## Features

### ✅ Core Functionality
- **Project Management**: Create, read, update, delete projects
- **Memory Storage**: Store and retrieve project memories with categorization
- **Task Management**: Manage tasks with status tracking and ordering
- **Chat History**: Persistent chat message storage with timestamps
- **Data Validation**: Automatic validation of data structures
- **Error Handling**: Graceful handling of missing files and invalid data

### 🔒 Data Integrity
- **Atomic Writes**: Prevents data corruption during file operations
- **Backup System**: Automatic backups before modifications
- **Data Validation**: Schema validation for all data types
- **Concurrent Access**: Safe handling of multiple operations

### 🛡️ Advanced Features
- **Backup Rotation**: Automatic cleanup of old backup files
- **Orphaned File Cleanup**: Remove files for deleted projects
- **Project Statistics**: Get comprehensive project metrics
- **Logging**: Detailed logging for debugging and monitoring

## File Structure

```
data/
├── projects.json                    # All projects list
├── project-{id}-memories.json       # Project-specific memories
├── project-{id}-tasks.json          # Project-specific tasks
├── project-{id}-chat.json           # Project-specific chat history
└── backups/                         # Automatic backup files
    ├── projects_YYYYMMDD_HHMMSS.json
    ├── project-{id}-memories_YYYYMMDD_HHMMSS.json
    └── ...
```

## Quick Start

### Basic Usage

```python
from services.file_service import FileService
from models import Project, Memory, Task, ChatMessage
from datetime import datetime

# Initialize file service
fs = FileService()

# Create a project
project = Project(
    id="my-project",
    name="My Web App",
    description="A modern web application",
    tech_stack="React, Python, FastAPI",
    created_at=datetime.now()
)

# Save project
fs.save_project(project)

# Load all projects
projects = fs.load_projects()

# Get specific project
project = fs.get_project_by_id("my-project")
```

### Memory Management

```python
# Create a memory
memory = Memory(
    id="memory-1",
    title="Database Design",
    content="Use PostgreSQL with proper indexing",
    type="decision",
    created_at=datetime.now()
)

# Save memory
fs.save_memory("my-project", memory)

# Load all memories for a project
memories = fs.load_memories("my-project")

# Delete memory
fs.delete_memory("my-project", "memory-1")
```

### Task Management

```python
# Create a task
task = Task(
    id="task-1",
    title="Implement Authentication",
    description="Create login and registration",
    prompt="Build JWT-based authentication system",
    completed=False,
    order=1,
    created_at=datetime.now()
)

# Save task
fs.save_task("my-project", task)

# Load tasks (automatically sorted by order)
tasks = fs.load_tasks("my-project")

# Update task status
fs.update_task_status("my-project", "task-1", True)
```

### Chat History

```python
# Create chat message
message = ChatMessage(
    id="msg-1",
    role="user",
    content="How do I implement authentication?",
    timestamp=datetime.now()
)

# Save message
fs.save_chat_message("my-project", message)

# Load chat history (automatically sorted by timestamp)
messages = fs.load_chat_history("my-project")
```

## API Reference

### Directory Management

#### `ensure_data_dir() -> None`
Ensures data and backup directories exist.

#### `get_file_path(filename: str) -> str`
Gets the full file path for a given filename.

### Project Operations

#### `load_projects() -> List[Project]`
Loads all projects from `projects.json`.

#### `save_project(project: Project) -> None`
Saves or updates a project (creates backup automatically).

#### `delete_project(project_id: str) -> bool`
Deletes a project and all its associated data files.

#### `get_project_by_id(project_id: str) -> Optional[Project]`
Retrieves a specific project by ID.

### Memory Operations

#### `load_memories(project_id: str) -> List[Memory]`
Loads all memories for a specific project.

#### `save_memory(project_id: str, memory: Memory) -> None`
Saves a single memory for a project.

#### `save_memories(project_id: str, memories: List[Memory]) -> None`
Saves multiple memories for a project.

#### `delete_memory(project_id: str, memory_id: str) -> bool`
Deletes a specific memory.

### Task Operations

#### `load_tasks(project_id: str) -> List[Task]`
Loads all tasks for a project (sorted by order).

#### `save_tasks(project_id: str, tasks: List[Task]) -> None`
Saves multiple tasks for a project.

#### `save_task(project_id: str, task: Task) -> None`
Saves a single task for a project.

#### `update_task_status(project_id: str, task_id: str, completed: bool) -> bool`
Updates the completion status of a task.

### Chat Operations

#### `load_chat_history(project_id: str) -> List[ChatMessage]`
Loads chat history for a project (sorted by timestamp).

#### `save_chat_message(project_id: str, message: ChatMessage) -> None`
Saves a single chat message.

#### `save_chat_history(project_id: str, messages: List[ChatMessage]) -> None`
Saves multiple chat messages.

### Utility Methods

#### `get_project_stats(project_id: str) -> Dict[str, int]`
Returns project statistics including counts of memories, tasks, completed tasks, and chat messages.

#### `cleanup_orphaned_files() -> int`
Removes files for non-existent projects and returns the number of cleaned files.

## Error Handling

The FileService handles various error scenarios gracefully:

- **Missing Files**: Returns empty lists instead of throwing errors
- **Invalid JSON**: Logs warnings and skips invalid data
- **File Permissions**: Logs errors and continues operation
- **Data Validation**: Validates data structure before saving

### Error Recovery

```python
# The service automatically handles missing files
memories = fs.load_memories("non-existent-project")
# Returns empty list instead of throwing error

# Invalid data is logged and skipped
# The service continues operation even with corrupted files
```

## Backup System

### Automatic Backups
- Backups are created before any file modification
- Backup files include timestamps for easy identification
- Old backups are automatically rotated (keeps last 5 backups)

### Backup File Naming
```
projects_20250801_161417.json
project-my-project-memories_20250801_161417.json
```

### Manual Backup Management
```python
# Check backup directory
backup_dir = Path("data/backups")
backup_files = list(backup_dir.glob("*.json"))

# Restore from backup (manual process)
# Copy backup file to main data file
```

## Data Validation

The service validates all data before saving:

### Project Validation
- Required fields: `id`, `name`, `description`, `tech_stack`

### Memory Validation
- Required fields: `id`, `title`, `content`, `type`

### Task Validation
- Required fields: `id`, `title`, `description`, `prompt`, `completed`, `order`

### Chat Message Validation
- Required fields: `id`, `role`, `content`, `timestamp`

## Performance Considerations

### File Operations
- Uses atomic writes to prevent data corruption
- Efficient JSON serialization with proper encoding
- Minimal file I/O with batch operations

### Memory Usage
- Loads data on-demand rather than keeping everything in memory
- Automatic cleanup of temporary files
- Efficient data structures for large datasets

## Testing

### Run Tests
```bash
cd backend
python test_file_service.py
```

### Run Examples
```bash
cd backend
python example_usage.py
```

### Test Coverage
- ✅ Basic CRUD operations
- ✅ Error handling scenarios
- ✅ Data integrity validation
- ✅ Backup system functionality
- ✅ Orphaned file cleanup

## Best Practices

### 1. Use Atomic Operations
```python
# Good: Use the provided methods
fs.save_project(project)

# Avoid: Direct file manipulation
# with open("data/projects.json", "w") as f:
#     json.dump(data, f)
```

### 2. Handle Errors Gracefully
```python
try:
    project = fs.get_project_by_id("my-project")
    if project:
        # Process project
        pass
    else:
        # Handle missing project
        pass
except Exception as e:
    logger.error(f"Error accessing project: {e}")
```

### 3. Use Project-Specific Operations
```python
# Good: Use project-specific methods
memories = fs.load_memories("my-project")

# Avoid: Loading all data and filtering
# all_memories = fs.load_all_memories()
# project_memories = [m for m in all_memories if m.project_id == "my-project"]
```

### 4. Regular Cleanup
```python
# Clean up orphaned files periodically
cleaned_count = fs.cleanup_orphaned_files()
print(f"Cleaned up {cleaned_count} orphaned files")
```

## Troubleshooting

### Common Issues

#### 1. File Permission Errors
```
Error: Permission denied when writing to data/projects.json
```
**Solution**: Check file permissions and ensure write access to the data directory.

#### 2. JSON Decode Errors
```
Error: JSON decode error in data/projects.json
```
**Solution**: Check for corrupted files and restore from backup if necessary.

#### 3. Missing Data
```
Warning: Invalid project data: missing required field 'name'
```
**Solution**: Validate data before saving and check for schema changes.

### Debug Mode
Enable debug logging for detailed information:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Migration and Upgrades

### Schema Changes
When updating data models:
1. Create backup of existing data
2. Update validation functions
3. Test with sample data
4. Migrate existing data if necessary

### File Format Changes
The service handles JSON format changes gracefully:
- Invalid data is logged and skipped
- Missing fields use default values
- New fields are ignored if not required

## Contributing

When contributing to the FileService:

1. **Add Tests**: Include tests for new functionality
2. **Update Documentation**: Document new methods and features
3. **Follow Patterns**: Use existing error handling and validation patterns
4. **Backward Compatibility**: Ensure changes don't break existing data

## License

This file service is part of the Samurai Agent project and follows the same license terms. 