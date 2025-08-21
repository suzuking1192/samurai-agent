"""
Utility functions for the Samurai Agent services.
"""

import re
import json
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


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


def clean_ai_json_response(json_str: str) -> str:
    """
    Clean and fix common JSON parsing issues in AI responses.
    
    This utility handles malformed JSON from AI models that may contain:
    - Unescaped quotes in string values
    - Newlines and control characters
    - Trailing commas
    - Non-printable characters
    
    Args:
        json_str: The raw JSON string from AI response
        
    Returns:
        Cleaned JSON string that should be parseable
    """
    try:
        import re
        
        # Remove any leading/trailing whitespace
        json_str = json_str.strip()
        
        # Handle newlines and other control characters in string values
        json_str = re.sub(r'[\r\n\t]', ' ', json_str)
        
        # Remove any trailing commas before closing braces/brackets
        json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
        
        # Try to fix common malformed JSON patterns
        # Remove any non-printable characters except spaces
        json_str = ''.join(char for char in json_str if char.isprintable() or char.isspace())
        
        # Ensure the JSON starts and ends properly
        if not json_str.startswith('{'):
            # Try to find the first opening brace
            start_idx = json_str.find('{')
            if start_idx != -1:
                json_str = json_str[start_idx:]
        
        if not json_str.endswith('}'):
            # Try to find the last closing brace
            end_idx = json_str.rfind('}')
            if end_idx != -1:
                json_str = json_str[:end_idx + 1]
            else:
                # If no closing brace found, return fallback
                return '{"error": "malformed_json", "message": "No closing brace found"}'
        
        # Try to validate the JSON structure
        try:
            json.loads(json_str)
            return json_str
        except json.JSONDecodeError:
            # If still invalid, try to fix common quote issues
            # This is a more aggressive approach to handle unescaped quotes
            
            # For malformed JSON with unescaped quotes, we need a more aggressive approach
            # Let's manually reconstruct the JSON by extracting each field
            try:
                # Extract relevance_score
                score_match = re.search(r'"relevance_score"\s*:\s*(\d+)', json_str)
                relevance_score = int(score_match.group(1)) if score_match else 0
                
                # Extract context - find everything between "context": " and the next field
                context_start = json_str.find('"context"')
                context = ""
                if context_start != -1:
                    quote_start = json_str.find('"', context_start + 10)
                    if quote_start != -1:
                        # Look for the next field
                        for field in ['"relevant_code"', '"file_path"', '"relevance_score"']:
                            field_pos = json_str.find(field, quote_start + 1)
                            if field_pos != -1:
                                # Find the comma before this field
                                comma_pos = json_str.rfind(',', quote_start + 1, field_pos)
                                if comma_pos != -1:
                                    context = json_str[quote_start + 1:comma_pos].strip()
                                    # Remove trailing quote if present
                                    if context.endswith('"'):
                                        context = context[:-1]
                                    break
                        else:
                            # If no next field found, try to find the closing brace
                            brace_pos = json_str.find('}', quote_start + 1)
                            if brace_pos != -1:
                                context = json_str[quote_start + 1:brace_pos].strip()
                                # Remove trailing quote if present
                                if context.endswith('"'):
                                    context = context[:-1]
                
                # Extract relevant_code
                code_match = re.search(r'"relevant_code"\s*:\s*"([^"]*)"', json_str)
                relevant_code = code_match.group(1) if code_match else ""
                
                # Extract file_path
                path_match = re.search(r'"file_path"\s*:\s*"([^"]*)"', json_str)
                file_path = path_match.group(1) if path_match else ""
                
                # Reconstruct valid JSON - escape quotes in context
                context_escaped = context.replace('"', '\\"')
                json_str = f'{{"relevance_score": {relevance_score}, "context": "{context_escaped}", "relevant_code": "{relevant_code}", "file_path": "{file_path}"}}'
                
            except Exception as e:
                logger.warning(f"Error reconstructing JSON: {e}")
                return '{"error": "malformed_json", "message": "Failed to reconstruct JSON"}'
            
            # Try parsing again
            try:
                json.loads(json_str)
                return json_str
            except json.JSONDecodeError:
                # If still failing, return fallback
                return '{"error": "malformed_json", "message": "Failed to parse even after reconstruction"}'
        
    except Exception as e:
        logger.warning(f"Error cleaning JSON string: {e}")
        # Return a minimal valid JSON as fallback
        return '{"error": "malformed_json", "message": "Unexpected error during cleaning"}'


def extract_json_from_ai_response(response: str) -> Optional[Dict[str, Any]]:
    """
    Extract JSON from AI response using multiple fallback strategies.
    
    This utility handles various AI response formats:
    - Clean JSON responses
    - JSON embedded in markdown or other text
    - Malformed JSON with syntax errors
    - Non-JSON responses that contain structured data
    
    Args:
        response: The raw AI response
        
    Returns:
        Parsed JSON dict or None if extraction fails completely
    """
    try:
        import re
        import json
        
        # Strategy 1: Try to find JSON with brace counting
        # Look for content between curly braces, handling nested braces
        brace_count = 0
        start_idx = -1
        end_idx = -1
        
        for i, char in enumerate(response):
            if char == '{':
                if brace_count == 0:
                    start_idx = i
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0 and start_idx != -1:
                    end_idx = i
                    break
        
        if start_idx != -1 and end_idx != -1:
            json_candidate = response[start_idx:end_idx + 1]
            try:
                # Clean and parse
                cleaned_json = clean_ai_json_response(json_candidate)
                return json.loads(cleaned_json)
            except:
                pass
        
        # Strategy 2: Try to extract individual fields using regex
        relevance_score = 0
        context = ""
        relevant_code = ""
        file_path = ""
        
        # Extract relevance_score - be more flexible with the pattern
        score_match = re.search(r'"relevance_score"\s*:\s*(\d+)', response)
        if score_match:
            relevance_score = int(score_match.group(1))
        
        # Extract context - handle unescaped quotes by looking for content between quotes
        # This is more robust for malformed JSON
        context_start = response.find('"context"')
        if context_start != -1:
            # Find the opening quote after "context":
            quote_start = response.find('"', context_start + 10)
            if quote_start != -1:
                # For malformed JSON with unescaped quotes, we need to find the next field
                # Look for the next field after context
                next_field_start = response.find('"', quote_start + 1)
                if next_field_start != -1:
                    # Look for the pattern that indicates the next field
                    for field in ['"relevant_code"', '"file_path"', '"relevance_score"']:
                        field_pos = response.find(field, quote_start + 1)
                        if field_pos != -1:
                            # Find the comma before this field
                            comma_pos = response.rfind(',', quote_start + 1, field_pos)
                            if comma_pos != -1:
                                context = response[quote_start + 1:comma_pos].strip()
                                # Remove trailing quote if present
                                if context.endswith('"'):
                                    context = context[:-1]
                                # Clean up any remaining escape sequences
                                context = context.replace('\\"', '"')
                                break
                    else:
                        # If no next field found, try to find the closing brace
                        brace_pos = response.find('}', quote_start + 1)
                        if brace_pos != -1:
                            context = response[quote_start + 1:brace_pos].strip()
                            # Remove trailing quote if present
                            if context.endswith('"'):
                                context = context[:-1]
                            # Clean up any remaining escape sequences
                            context = context.replace('\\"', '"')
        
        # Extract relevant_code
        code_match = re.search(r'"relevant_code"\s*:\s*"([^"]*)"', response)
        if code_match:
            relevant_code = code_match.group(1)
        
        # Extract file_path
        path_match = re.search(r'"file_path"\s*:\s*"([^"]*)"', response)
        if path_match:
            file_path = path_match.group(1)
        
        # Return reconstructed JSON
        return {
            "relevance_score": relevance_score,
            "context": context,
            "relevant_code": relevant_code,
            "file_path": file_path
        }
        
    except Exception as e:
        logger.warning(f"Fallback JSON extraction failed: {e}")
        return None


def parse_ai_json_response(response: str, expected_fields: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Parse AI JSON response with robust error handling and fallback strategies.
    
    This is the main entry point for parsing AI responses. It combines
    cleaning and fallback extraction strategies to handle malformed JSON.
    
    Args:
        response: The raw AI response
        expected_fields: Optional list of expected fields for validation
        
    Returns:
        Dictionary with parsed data or error information
    """
    try:
        # First, try to find and clean JSON from the response
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            json_str = json_match.group()
        else:
            json_str = response
        
        # Clean the JSON string
        cleaned_json = clean_ai_json_response(json_str)
        
        # Try to parse the cleaned JSON
        try:
            parsed_data = json.loads(cleaned_json)
            
            # Validate expected fields if provided
            if expected_fields:
                missing_fields = [field for field in expected_fields if field not in parsed_data]
                if missing_fields:
                    logger.warning(f"Missing expected fields: {missing_fields}")
            
            return parsed_data
            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse cleaned JSON: {e}")
            
            # Try fallback extraction
            fallback_result = extract_json_from_ai_response(response)
            if fallback_result:
                logger.info("Successfully extracted data using fallback method")
                return fallback_result
            else:
                return {
                    "success": False,
                    "error": "json_parse_failed",
                    "message": f"Failed to parse AI response: {str(e)}",
                    "raw_response": response[:500] + "..." if len(response) > 500 else response
                }
    
    except Exception as e:
        logger.error(f"Error parsing AI JSON response: {e}")
        return {
            "success": False,
            "error": "unexpected_error",
            "message": f"Unexpected error: {str(e)}",
            "raw_response": response[:500] + "..." if len(response) > 500 else response
        }
