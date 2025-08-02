"""
Response handling service for managing long AI responses and validation errors.
"""

import logging
from typing import List, Optional
from pydantic import ValidationError

logger = logging.getLogger(__name__)

def handle_long_response(response: str, max_length: int = 14000) -> str:
    """
    Intelligently truncate response while preserving readability.
    
    Args:
        response: The original AI response
        max_length: Maximum allowed length (leaving buffer for truncation message)
    
    Returns:
        Truncated response with appropriate message
    """
    if len(response) <= max_length:
        return response
    
    logger.warning(f"Response truncated for length: {len(response)} chars")
    
    # Try to split at natural breakpoints
    truncated = response[:max_length]
    
    # Find last complete sentence
    last_period = truncated.rfind('.')
    last_newline = truncated.rfind('\n')
    
    # Use the better breakpoint
    if last_period > max_length * 0.8:  # At least 80% of content
        return response[:last_period + 1] + "\n\n[Response truncated due to length - please ask for more details if needed]"
    elif last_newline > max_length * 0.8:
        return response[:last_newline] + "\n\n[Response truncated due to length - please ask for more details if needed]"
    else:
        return truncated + "...\n\n[Response truncated due to length - please ask for more details if needed]"

def split_long_response(response: str, max_length: int = 14000) -> List[str]:
    """
    Split long response into multiple manageable parts.
    
    Args:
        response: The original AI response
        max_length: Maximum length per part
    
    Returns:
        List of response parts
    """
    if len(response) <= max_length:
        return [response]
    
    parts = []
    current_pos = 0
    
    while current_pos < len(response):
        # Find good break point
        end_pos = current_pos + max_length
        if end_pos >= len(response):
            parts.append(response[current_pos:])
            break
            
        # Find last sentence or paragraph break
        chunk = response[current_pos:end_pos]
        last_break = max(
            chunk.rfind('. '),
            chunk.rfind('\n\n'),
            chunk.rfind('.\n')
        )
        
        if last_break > len(chunk) * 0.7:  # Good break point found
            parts.append(response[current_pos:current_pos + last_break + 1])
            current_pos += last_break + 1
        else:  # Force break at max length
            parts.append(response[current_pos:end_pos] + "...")
            current_pos = end_pos
    
    return parts

def create_response_with_context(
    response: str,
    is_truncated: bool = False,
    total_parts: Optional[int] = None,
    current_part: Optional[int] = None
) -> str:
    """
    Create a response with appropriate context about truncation or splitting.
    
    Args:
        response: The response content
        is_truncated: Whether the response was truncated
        total_parts: Total number of parts if split
        current_part: Current part number if split
    
    Returns:
        Response with appropriate context
    """
    if is_truncated:
        return response + "\n\n[Response was very detailed and exceeded our limits. The agent is processing a shorter version for you.]"
    
    if total_parts and total_parts > 1:
        part_info = f"\n\n[Part {current_part} of {total_parts}]"
        if current_part == total_parts:
            part_info += " - This completes the full response."
        return response + part_info
    
    return response

def handle_validation_error(error: ValidationError, original_response: str) -> str:
    """
    Handle Pydantic validation errors gracefully.
    
    Args:
        error: The validation error
        original_response: The original response that caused the error
    
    Returns:
        A valid response string
    """
    error_str = str(error)
    
    if "string_too_long" in error_str:
        logger.warning(f"Response length validation error: {len(original_response)} chars")
        return handle_long_response(original_response)
    
    # For other validation errors, return a truncated version
    logger.error(f"Validation error: {error_str}")
    return handle_long_response(original_response) 