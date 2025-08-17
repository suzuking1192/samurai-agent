#!/usr/bin/env python3
"""
Test script to verify the two-step code context extraction approach
with a real scenario: finding the Task data model
"""

import asyncio
import os
import sys
import logging

# Add the parent directory to the Python path so we can import our modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.agent_tools import ExtractCodeContextTool

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_task_model_extraction():
    """Test extracting the Task model using the two-step approach"""
    
    # Create the tool
    tool = ExtractCodeContextTool()
    
    # Get the parent directory (backend folder)
    current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Test the request
    request = "What are data fields of Task data model?"
    project_id = "test_project"
    
    logger.info(f"Testing two-step code context extraction")
    logger.info(f"Request: {request}")
    logger.info(f"Codebase path: {current_dir}")
    
    try:
        # Execute the tool
        result = await tool.execute(
            natural_language_request=request,
            project_id=project_id,
            connected_codebase_path=current_dir,
            session_id="test_session"
        )
        
        # Print results
        logger.info(f"Success: {result.get('success')}")
        logger.info(f"Message: {result.get('message')}")
        
        if result.get('success'):
            logger.info(f"Context: {result.get('context', 'No context')}")
            logger.info(f"Relevant code: {result.get('relevant_code', 'No code')}")
            logger.info(f"File path: {result.get('file_path', 'No file path')}")
            logger.info(f"Relevance score: {result.get('relevance_score', 'No score')}")
        else:
            logger.error(f"Error: {result.get('error', 'Unknown error')}")
            logger.error(f"Full result: {result}")
            
    except Exception as e:
        logger.error(f"Exception during execution: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_task_model_extraction())
