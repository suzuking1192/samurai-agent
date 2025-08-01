#!/usr/bin/env python3
"""
Example usage of Gemini Service
This file demonstrates how to use the GeminiService class
"""

import asyncio
from services.gemini_service import GeminiService

async def example_usage():
    """Example usage of the Gemini service"""
    
    # Initialize the service
    service = GeminiService()
    
    print("🤖 Gemini Service Examples")
    print("=" * 50)
    
    # Example 1: Basic question
    print("\n1️⃣ Basic Question:")
    response = await service.chat("What is FastAPI?")
    print(f"Q: What is FastAPI?")
    print(f"A: {response[:150]}...")
    
    # Example 2: With project context
    print("\n2️⃣ With Project Context:")
    context = "Project: Todo App, Tech: React + FastAPI, Goal: Build user authentication"
    response = await service.chat("How should I implement login?", context)
    print(f"Q: How should I implement login?")
    print(f"Context: {context}")
    print(f"A: {response[:150]}...")
    
    # Example 3: With custom system prompt
    print("\n3️⃣ With Custom System Prompt:")
    system_prompt = "You are an expert Python developer. Be concise and practical. Focus on best practices."
    response = await service.chat_with_system_prompt("Explain Pydantic models", system_prompt)
    print(f"Q: Explain Pydantic models")
    print(f"System: {system_prompt}")
    print(f"A: {response[:150]}...")
    
    # Example 4: Code review request
    print("\n4️⃣ Code Review Request:")
    code_context = """
    I'm building a FastAPI app with this structure:
    - main.py (FastAPI app)
    - models.py (Pydantic models)
    - database.py (SQLAlchemy setup)
    """
    response = await service.chat("What should I add to make this production-ready?", code_context)
    print(f"Q: What should I add to make this production-ready?")
    print(f"A: {response[:150]}...")

if __name__ == "__main__":
    asyncio.run(example_usage()) 