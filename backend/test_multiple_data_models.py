#!/usr/bin/env python3

import asyncio
import sys
import os

# Add the current directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.agent_tools import ExtractCodeContextTool

async def test_multiple_data_models():
    """Test the code context extraction for multiple data models."""
    print("Testing code context extraction for multiple data models")
    
    # Initialize the tool
    tool = ExtractCodeContextTool()
    codebase_path = "/Users/yutosuzuki/code/samurai-agent/backend"
    
    # Test cases
    test_cases = [
        "What are the data fields of the Project data model?",
        "What are the data fields of the Task data model?", 
        "What are the data fields of the Memory data model?",
        "What are the data fields of the ChatMessage data model?"
    ]
    
    for i, request in enumerate(test_cases, 1):
        print(f"\n{'='*60}")
        print(f"Test Case {i}: {request}")
        print(f"{'='*60}")
        
        # Execute the tool
        result = await tool.execute(
            natural_language_request=request,
            project_id="test_project",
            connected_codebase_path=codebase_path,
            session_id=f"test_session_{i}"
        )
        
        # Print results
        print(f"Success: {result.get('success')}")
        print(f"Message: {result.get('message')}")
        print(f"Context: {result.get('context')}")
        print(f"File path: {result.get('file_path')}")
        print(f"Relevance score: {result.get('relevance_score')}")
        
        if result.get('error'):
            print(f"Error: {result.get('error')}")
        
        if result.get('success'):
            print("✅ PASSED")
        else:
            print("❌ FAILED")
        
        print(f"{'='*60}")

if __name__ == "__main__":
    asyncio.run(test_multiple_data_models())
