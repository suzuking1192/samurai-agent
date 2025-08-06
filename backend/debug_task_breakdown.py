#!/usr/bin/env python3
"""
Debug script to see the actual raw response from the AI model.
"""

import asyncio
import sys
import os
from datetime import datetime

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from services.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext
from models import ChatMessage, Task, Memory

async def debug_response():
    """Debug the actual response from the AI model."""
    agent = UnifiedSamuraiAgent()
    
    # Create test context
    context = ConversationContext(
        session_messages=[
            ChatMessage(
                id="1",
                session_id="test-session",
                project_id="test-project",
                message="I need help with my AI agent project",
                response="I'm here to help you with your AI agent project!",
                created_at=datetime.now()
            )
        ],
        conversation_summary="User is working on an AI agent project and needs help with feature implementation.",
        relevant_tasks=[],
        relevant_memories=[],
        project_context={
            "name": "Samurai Agent",
            "tech_stack": "Python/FastAPI/React",
            "description": "An AI-powered development assistant"
        }
    )
    
    # Test with a simple request
    message = "Add a dark mode toggle button to the header"
    
    print("🔍 Debugging AI Response")
    print("=" * 50)
    print(f"Request: {message}")
    print("\nCalling AI model...")
    
    try:
        # Get the raw response from Gemini
        system_prompt = agent._generate_task_breakdown.__code__.co_consts[1]  # This won't work, let me try a different approach
        
        # Let me create a simple test to see the response
        response = await agent.gemini_service.chat_with_system_prompt(
            message, 
            "You are a task breakdown specialist. Break down this feature request into tasks. Return only valid JSON array with tasks containing title, description, priority, and order fields."
        )
        
        print(f"\nRaw Response:")
        print("-" * 30)
        print(response)
        print("-" * 30)
        
        # Try to parse it
        import json
        try:
            parsed = json.loads(response)
            print(f"\n✅ JSON parsed successfully!")
            print(f"Parsed result: {parsed}")
        except json.JSONDecodeError as e:
            print(f"\n❌ JSON parsing failed: {e}")
            print(f"Response type: {type(response)}")
            print(f"Response length: {len(response)}")
            
            # Try to find JSON-like content
            import re
            json_pattern = r'\[.*\]'
            matches = re.findall(json_pattern, response, re.DOTALL)
            if matches:
                print(f"\nFound potential JSON: {matches[0]}")
                try:
                    parsed = json.loads(matches[0])
                    print(f"✅ Extracted JSON parsed successfully!")
                except:
                    print(f"❌ Extracted JSON still failed to parse")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(debug_response()) 