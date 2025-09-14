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
        # But first, try to escape newlines within quotes properly
        try:
            # Try to parse as-is first
            json.loads(json_str)
            # If it works, no need to clean
            return json_str
        except json.JSONDecodeError:
            # If parsing fails, try to fix newlines in string values
            # This is a more sophisticated approach to handle unescaped newlines in JSON strings
            import re
            
            # Find all string values and escape newlines within them
            def escape_newlines_in_strings(match):
                content = match.group(1)
                # Escape newlines and other control characters
                content = content.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
                return f'"{content}"'
            
            # Replace newlines in string values with escaped newlines
            json_str = re.sub(r'"([^"]*)"', escape_newlines_in_strings, json_str)
            
            # Also replace newlines outside of quotes with spaces
            json_str = re.sub(r'[\r\n\t](?=(?:[^"]*"[^"]*")*[^"]*$)', ' ', json_str)
        
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


def extract_useful_info_from_response(response: str, expected_fields: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Extract useful information from AI response even when JSON parsing fails.
    
    This function attempts to extract meaningful content from the response
    using various strategies, ensuring users get some useful information
    even when the response is malformed.
    
    Args:
        response: The raw AI response
        expected_fields: Optional list of expected fields for extraction
        
    Returns:
        Dictionary with extracted information and metadata
    """
    try:
        import re
        
        # Initialize result with default values
        result = {
            "relevance_score": 0,
            "context": "",
            "file_path": "",
            "relevant_code": "",
            "parsing_issues": []
        }
        
        # Try to extract relevance score
        score_patterns = [
            r'"relevance_score"\s*:\s*(\d+)',
            r'relevance_score\s*:\s*(\d+)',
            r'relevance[^\d]*(\d+)',
            r'score[^\d]*(\d+)',
            r'-\s*relevance_score:\s*(\d+)',  # For bullet point format
            r'relevance.*?(\d+)',  # More flexible relevance matching
        ]
        
        for pattern in score_patterns:
            match = re.search(pattern, response, re.IGNORECASE)
            if match:
                try:
                    result["relevance_score"] = int(match.group(1))
                    break
                except (ValueError, IndexError):
                    continue
        
        # Try to extract context - use multiple strategies
        context_patterns = [
            r'"context"\s*:\s*"([^"]*(?:"[^"]*"[^"]*)*)"',  # Handle some quotes
            r'"context"\s*:\s*"([^"]+)"',  # Simple quoted context
            r'context[^:]*:\s*"([^"]+)"',  # Case insensitive
            r'context[^:]*:\s*([^\n,}]+)',  # Unquoted context
        ]
        
        context_found = False
        for pattern in context_patterns:
            match = re.search(pattern, response, re.IGNORECASE | re.DOTALL)
            if match:
                context = match.group(1).strip()
                if len(context) > 10:  # Only use if substantial content
                    result["context"] = context.replace('\\"', '"')  # Unescape quotes
                    context_found = True
                    break
        
        # If no structured context found, try to extract meaningful text
        if not context_found:
            # Look for descriptive text that might be useful
            text_patterns = [
                r'This\s+(?:code|function|method|class|file)[^.]*\.[^.]*\.',
                r'The\s+(?:code|function|method|class|file)[^.]*\.[^.]*\.',
                r'(?:implements?|provides?|handles?|manages?)[^.]*\.[^.]*\.',
            ]
            
            for pattern in text_patterns:
                matches = re.findall(pattern, response, re.IGNORECASE | re.DOTALL)
                if matches:
                    result["context"] = " ".join(matches[:3])  # Take first 3 matches
                    break
            
            # If still no context, use the first substantial sentence
            if not result["context"]:
                sentences = re.findall(r'[A-Z][^.!?]*[.!?]', response)
                substantial_sentences = [s for s in sentences if len(s.strip()) > 20]
                if substantial_sentences:
                    result["context"] = substantial_sentences[0].strip()
        
        # Try to extract file path
        path_patterns = [
            r'"file_path"\s*:\s*"([^"]+)"',
            r'file_path[^:]*:\s*"([^"]+)"',
            r'file[^:]*:\s*"([^"]+)"',
            r'path[^:]*:\s*"([^"]+)"',
            r'([a-zA-Z_][a-zA-Z0-9_]*\.(?:py|js|ts|java|cpp|c|h|rb|php|go|rs))',  # File extensions
        ]
        
        for pattern in path_patterns:
            match = re.search(pattern, response, re.IGNORECASE)
            if match:
                result["file_path"] = match.group(1).strip()
                break
        
        # Try to extract relevant code
        code_patterns = [
            (r'"relevant_code"\s*:\s*"([^"]+)"', 1),
            (r'relevant_code[^:]*:\s*"([^"]+)"', 1),
            (r'code[^:]*:\s*"([^"]+)"', 1),
            (r'```(?:python|javascript|typescript|java|cpp|c)?\s*\n(.*?)\n```', 1),  # Code blocks
            (r'`([^`]+)`', 1),  # Inline code
            (r'(def\s+\w+\([^)]*\):)', 1),  # Function definitions - capture the whole thing
            (r'(class\s+\w+[^:]*:)', 1),  # Class definitions - capture the whole thing
            (r'Here\'s some relevant code:\s*([^\n]+)', 1),  # Explicit code mentions
            (r'relevant code:\s*([^\n]+)', 1),  # Case insensitive
        ]
        
        for pattern, group_num in code_patterns:
            match = re.search(pattern, response, re.IGNORECASE | re.DOTALL)
            if match:
                try:
                    code = match.group(group_num).strip()
                    if len(code) > 5:  # Only use if substantial
                        result["relevant_code"] = code.replace('\\n', '\n').replace('\\"', '"')
                        break
                except IndexError:
                    continue
        
        # If we couldn't extract much useful information, include a portion of the raw response
        if not result["context"] and not result["relevant_code"]:
            # Clean up the response and use it as context
            clean_response = re.sub(r'[{}"\[\]]', '', response)  # Remove JSON artifacts
            clean_response = re.sub(r'\s+', ' ', clean_response).strip()  # Normalize whitespace
            if len(clean_response) > 50:
                result["context"] = clean_response[:500] + ("..." if len(clean_response) > 500 else "")
                result["parsing_issues"].append("Used raw response as context due to parsing failure")
        
        # Add metadata about what we found
        found_fields = [field for field in ["relevance_score", "context", "file_path", "relevant_code"] 
                       if result[field]]
        
        if expected_fields:
            missing_fields = [field for field in expected_fields if not result.get(field)]
            if missing_fields:
                result["parsing_issues"].append(f"Could not extract: {', '.join(missing_fields)}")
        
        # Clean up empty parsing_issues
        if not result["parsing_issues"]:
            del result["parsing_issues"]
        
        return result
        
    except Exception as e:
        logger.warning(f"Error in fallback information extraction: {e}")
        return {
            "relevance_score": 0,
            "context": "Unable to extract information from response due to parsing errors",
            "file_path": "",
            "relevant_code": "",
            "parsing_issues": [f"Extraction failed: {str(e)}"]
        }


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
        # First, try to extract JSON from markdown code blocks if present
        # Look for ```json ... ``` or ``` ... ``` patterns
        markdown_match = re.search(r'```(?:json)?\s*\n(.*?)\n```', response, re.DOTALL)
        if markdown_match:
            json_str = markdown_match.group(1).strip()
        else:
            # Fallback to finding JSON with brace counting for better accuracy
            json_str = response
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
                json_str = response[start_idx:end_idx + 1]
        
        # Clean the JSON string
        cleaned_json = clean_ai_json_response(json_str)
        
        # Try to parse the cleaned JSON
        try:
            parsed_data = json.loads(cleaned_json)
            
            # Check if the parsed data contains an error message from clean_ai_json_response
            if isinstance(parsed_data, dict) and "error" in parsed_data:
                logger.warning(f"JSON cleaning returned error: {parsed_data.get('message', 'Unknown error')}")
                # Instead of returning an error, extract useful information
                logger.info("Attempting to extract useful information despite JSON parsing issues")
                extracted_info = extract_useful_info_from_response(response, expected_fields)
                extracted_info["parsing_notes"] = f"JSON parsing failed: {parsed_data.get('message', 'Unknown error')}"
                return extracted_info
            
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
                # Instead of returning an error, extract useful information
                logger.info("Attempting to extract useful information despite JSON parsing failure")
                extracted_info = extract_useful_info_from_response(response, expected_fields)
                extracted_info["parsing_notes"] = f"JSON parsing failed: {str(e)}"
                return extracted_info
    
    except Exception as e:
        logger.error(f"Error parsing AI JSON response: {e}")
        # Even in case of unexpected errors, try to extract useful information
        logger.info("Attempting to extract useful information despite unexpected error")
        try:
            extracted_info = extract_useful_info_from_response(response, expected_fields)
            extracted_info["parsing_notes"] = f"Unexpected error during parsing: {str(e)}"
            return extracted_info
        except Exception as extraction_error:
            logger.error(f"Failed to extract information even with fallback method: {extraction_error}")
            return {
                "relevance_score": 0,
                "context": "Unable to extract information from response due to severe parsing errors",
                "file_path": "",
                "relevant_code": "",
                "parsing_notes": f"All parsing methods failed: {str(e)}"
            }
