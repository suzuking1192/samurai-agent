"""
Utility functions for the Samurai Agent services.
"""

from typing import List, Dict, Any, Optional


def convert_task_json_to_markdown(task_list: List[Dict[str, Any]]) -> str:
    """
    Convert a list of task JSON objects to a user-readable markdown format.
    
    Args:
        task_list: List of task dictionaries with keys like task_id, description, 
                  long_description, potential_sub_tasks, etc.
    
    Returns:
        A formatted markdown string representing the tasks in a hierarchical structure.
    """
    if not task_list:
        return "No tasks to display."
    
    markdown_parts = []
    
    # Group tasks by parent_task_id to build hierarchy
    root_tasks = []
    child_tasks = {}
    
    for task in task_list:
        parent_id = task.get('parent_task_id')
        if parent_id is None:
            root_tasks.append(task)
        else:
            if parent_id not in child_tasks:
                child_tasks[parent_id] = []
            child_tasks[parent_id].append(task)
    
    # Process root tasks first
    for i, task in enumerate(root_tasks, 1):
        markdown_parts.append(_format_task_as_markdown(task, i, level=0))
        
        # Add subtasks if they exist
        task_id = task.get('task_id') or task.get('id')
        if task_id and task_id in child_tasks:
            for j, subtask in enumerate(child_tasks[task_id], 1):
                markdown_parts.append(_format_task_as_markdown(subtask, f"{i}.{j}", level=1))
                # Handle nested subtasks (subtasks of subtasks)
                subtask_id = subtask.get('task_id') or subtask.get('id')
                if subtask_id and subtask_id in child_tasks:
                    for k, nested_subtask in enumerate(child_tasks[subtask_id], 1):
                        markdown_parts.append(_format_task_as_markdown(nested_subtask, f"{i}.{j}.{k}", level=2))
    
    # Handle orphaned child tasks (tasks with parent_task_id but parent not in list)
    orphaned_count = 1
    for parent_id, children in child_tasks.items():
        if not any(task.get('task_id') == parent_id or task.get('id') == parent_id for task in task_list):
            for j, subtask in enumerate(children, 1):
                markdown_parts.append(_format_task_as_markdown(subtask, f"?.{orphaned_count}", level=1))
                orphaned_count += 1
    
    return "\n\n".join(markdown_parts)


def _format_task_as_markdown(task: Dict[str, Any], number: Any, level: int = 0) -> str:
    """
    Format a single task as markdown.
    
    Args:
        task: Task dictionary
        number: Task number for display
        level: Indentation level (0 for root, 1 for subtasks, etc.)
    
    Returns:
        Formatted markdown string for the task
    """
    indent = "  " * level
    title = task.get('title', 'Untitled Task')
    description = task.get('description', '')
    long_description = task.get('long_description', '')
    
    # Build the task header
    if level == 0:
        header = f"## {number}. {title}"
    else:
        header = f"{indent}- **{title}**"
    
    markdown_parts = [header]
    
    # Add description if available
    if description:
        # Clean up description - remove excessive whitespace and newlines
        clean_description = _clean_text(description)
        if level == 0:
            markdown_parts.append(f"\n{clean_description}")
        else:
            markdown_parts.append(f"\n{indent}  {clean_description}")
    
    # Add long description if available and different from description
    if long_description and long_description != description:
        clean_long_desc = _clean_text(long_description)
        if level == 0:
            markdown_parts.append(f"\n\n**Details:**\n{clean_long_desc}")
        else:
            markdown_parts.append(f"\n{indent}  **Details:** {clean_long_desc}")
    
    # Add task metadata if available
    metadata_parts = []
    if task.get('priority'):
        metadata_parts.append(f"Priority: {task['priority']}")
    if task.get('status'):
        metadata_parts.append(f"Status: {task['status']}")
    if task.get('due_date'):
        metadata_parts.append(f"Due: {task['due_date']}")
    
    if metadata_parts:
        metadata_text = " | ".join(metadata_parts)
        if level == 0:
            markdown_parts.append(f"\n*{metadata_text}*")
        else:
            markdown_parts.append(f"\n{indent}  *{metadata_text}*")
    
    return "".join(markdown_parts)


def _clean_text(text: str) -> str:
    """
    Clean up text by removing excessive whitespace and formatting.
    
    Args:
        text: Raw text to clean
    
    Returns:
        Cleaned text
    """
    if not text:
        return ""
    
    # Replace multiple newlines with single newlines
    text = '\n'.join(line.strip() for line in text.split('\n') if line.strip())
    
    # Replace multiple spaces with single space
    text = ' '.join(text.split())
    
    return text
