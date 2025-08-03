"""
Response handling service for managing long AI responses gracefully without user-facing error messages.
"""

import logging
from typing import List, Optional
from pydantic import ValidationError

logger = logging.getLogger(__name__)

def handle_agent_response(response_text: str, max_length: int = 4500) -> str:
    """
    Handle long responses gracefully without showing error messages to users.
    
    Args:
        response_text: The original AI response
        max_length: Maximum allowed length
    
    Returns:
        Intelligently summarized response or original if within limits
    """
    if len(response_text) <= max_length:
        return response_text
    
    # Log for debugging but don't show user
    logger.info(f"Response summarized from {len(response_text)} to {max_length} chars")
    
    # Intelligently summarize the response
    summarized = intelligently_summarize_response(response_text, max_length)
    return summarized

def intelligently_summarize_response(full_response: str, target_length: int = 4500) -> str:
    """
    Summarize long response while preserving key information and actionable content.
    """
    # Simple summarization logic - could be enhanced with LLM
    if len(full_response) <= target_length:
        return full_response
    
    # Find natural break points
    sentences = full_response.split('. ')
    paragraphs = full_response.split('\n\n')
    
    # Try to keep the most important parts
    if len(paragraphs) > 1:
        # Keep first paragraph and any with key words
        important_keywords = ['task', 'implement', 'create', 'add', 'build', 'setup', 'configure']
        important_paragraphs = [paragraphs[0]]  # Always keep first
        
        for paragraph in paragraphs[1:]:
            if any(keyword in paragraph.lower() for keyword in important_keywords):
                important_paragraphs.append(paragraph)
        
        summarized = '\n\n'.join(important_paragraphs)
        
        # If still too long, truncate at sentence level
        if len(summarized) > target_length:
            sentences = summarized.split('. ')
            summarized = '. '.join(sentences[:3]) + '.'
            
            if len(summarized) > target_length:
                summarized = summarized[:target_length-3] + "..."
    
    else:
        # Single paragraph - truncate at sentence level
        sentences = full_response.split('. ')
        summarized = '. '.join(sentences[:3]) + '.'
        
        if len(summarized) > target_length:
            summarized = summarized[:target_length-3] + "..."
    
    return summarized

def chunk_long_response(response_text: str, chunk_size: int = 4000) -> List[str]:
    """
    Break very long responses into logical chunks sent as separate messages.
    """
    if len(response_text) <= chunk_size:
        return [response_text]
    
    # Find natural break points (code blocks, sections, paragraphs)
    chunks = []
    current_chunk = ""
    
    for paragraph in response_text.split('\n\n'):
        if len(current_chunk + paragraph) <= chunk_size:
            current_chunk += paragraph + '\n\n'
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = paragraph + '\n\n'
    
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    return chunks

def handle_validation_error(error: ValidationError, original_response: str) -> str:
    """
    Handle Pydantic validation errors gracefully without user-facing error messages.
    
    Args:
        error: The validation error
        original_response: The original response that caused the error
    
    Returns:
        A valid response string
    """
    error_str = str(error)
    
    if "string_too_long" in error_str:
        logger.warning(f"Response length validation error: {len(original_response)} chars")
        return handle_agent_response(original_response)
    
    # For other validation errors, return a truncated version
    logger.error(f"Validation error: {error_str}")
    return handle_agent_response(original_response)

# Legacy functions for backward compatibility
def handle_long_response(response: str, max_length: int = 14000) -> str:
    """Legacy function - now uses seamless handling"""
    return handle_agent_response(response, max_length)

def split_long_response(response: str, max_length: int = 14000) -> List[str]:
    """Legacy function - now uses chunking"""
    return chunk_long_response(response, max_length)

def create_response_with_context(
    response: str,
    is_truncated: bool = False,
    total_parts: Optional[int] = None,
    current_part: Optional[int] = None
) -> str:
    """Legacy function - now returns response as-is without context messages"""
    return response 