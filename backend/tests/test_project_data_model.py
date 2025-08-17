#!/usr/bin/env python3

import asyncio
import sys
import os

# Add the parent directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.agent_tools import ExtractCodeContextTool

async def test_project_data_model():
    """Test the code context extraction for Project data model."""
    print("Testing code context extraction for Project data model")
    
    # Initialize the tool
    tool = ExtractCodeContextTool()
    
    # Test request
    request = "What are the data fields of the Project data model?"
    codebase_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    print(f"Request: {request}")
    print(f"Codebase path: {codebase_path}")
    
    # Execute the tool
    result = await tool.execute(
        natural_language_request=request,
        project_id="test_project",
        connected_codebase_path=codebase_path,
        session_id="test_session"
    )
    
    # Print results
    print(f"Success: {result.get('success')}")
    print(f"Message: {result.get('message')}")
    print(f"Context: {result.get('context')}")
    print(f"Relevant code: {result.get('relevant_code')}")
    print(f"File path: {result.get('file_path')}")
    print(f"Relevance score: {result.get('relevance_score')}")
    
    if result.get('error'):
        print(f"Error: {result.get('error')}")
    
    print(f"Full result: {result}")

if __name__ == "__main__":
    asyncio.run(test_project_data_model())
