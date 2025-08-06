#!/usr/bin/env python3
"""
Test script for the unified spec clarification response method.
"""

import asyncio
import sys
import os
import uuid
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.response_generator import ResponseGenerator, ResponseContext
from models import Task, Memory, Project

async def test_unified_spec_response():
    """Test the unified spec clarification response method."""
    
    # Initialize the response generator
    generator = ResponseGenerator()
    
    # Create test context
    project_id = str(uuid.uuid4())
    context = ResponseContext(
        project_name="Samurai Agent",
        tech_stack="Python, FastAPI, React, TypeScript",
        conversation_summary="User has been discussing adding a new feature for real-time progress tracking with streaming updates. They mentioned wanting to show task completion progress and memory consolidation status.",
        relevant_tasks=[
            Task(
                id=str(uuid.uuid4()),
                title="Implement streaming progress updates",
                description="Add real-time progress tracking for task completion and memory consolidation",
                status="in_progress",
                project_id=project_id
            ),
            Task(
                id=str(uuid.uuid4()),
                title="Add memory consolidation UI",
                description="Create interface for viewing and managing consolidated memories",
                status="pending",
                project_id=project_id
            )
        ],
        relevant_memories=[
            Memory(
                id=str(uuid.uuid4()),
                title="User preferences",
                content="User prefers real-time updates and streaming responses",
                type="note",
                project_id=project_id
            ),
            Memory(
                id=str(uuid.uuid4()),
                title="Technical implementation",
                content="Previous implementation used WebSocket for real-time communication",
                type="spec",
                project_id=project_id
            )
        ],
        user_message="I want to add a notification system that shows when tasks are completed and memories are consolidated. It should have a nice UI with progress bars and real-time updates.",
        intent_type="specification_clarification",
        confidence=0.85
    )
    
    # Test with accumulated specs
    accumulated_specs = {
        "feature_type": "notification_system",
        "ui_components": ["progress_bars", "real_time_updates"],
        "triggers": ["task_completion", "memory_consolidation"],
        "technical_approach": "WebSocket streaming"
    }
    
    print("=== Testing Unified Spec Clarification Response ===\n")
    print("Context:")
    print(f"Project: {context.project_name}")
    print(f"Tech Stack: {context.tech_stack}")
    print(f"User Message: {context.user_message}")
    print(f"Accumulated Specs: {accumulated_specs}")
    print("\n" + "="*50 + "\n")
    
    try:
        # Generate response using the unified method
        response = await generator.generate_spec_clarification_response(context, accumulated_specs)
        
        print("Generated Response:")
        print(response)
        print("\n" + "="*50 + "\n")
        
        # Test with minimal specs (early exploration scenario)
        minimal_specs = {
            "feature_type": "notification_system"
        }
        
        print("Testing with minimal specs (early exploration):")
        response_minimal = await generator.generate_spec_clarification_response(context, minimal_specs)
        print(response_minimal)
        print("\n" + "="*50 + "\n")
        
        # Test with no specs (very early exploration)
        print("Testing with no specs (very early exploration):")
        response_no_specs = await generator.generate_spec_clarification_response(context, {})
        print(response_no_specs)
        
    except Exception as e:
        print(f"Error during testing: {e}")
        import traceback
        traceback.print_exc()

async def test_comparison_scenarios():
    """Test different scenarios to see how the unified method responds."""
    
    generator = ResponseGenerator()
    project_id = str(uuid.uuid4())
    
    scenarios = [
        {
            "name": "Ready for Task Creation",
            "user_message": "I need a user authentication system with JWT tokens, password hashing, and role-based access control. It should integrate with the existing database and follow the same patterns as the current API endpoints.",
            "accumulated_specs": {
                "feature_type": "authentication_system",
                "components": ["JWT_tokens", "password_hashing", "role_based_access"],
                "integration": ["existing_database", "current_api_patterns"],
                "security": ["bcrypt_hashing", "token_refresh"]
            }
        },
        {
            "name": "Needs More Specification",
            "user_message": "I want to add a dashboard that shows project statistics and analytics.",
            "accumulated_specs": {
                "feature_type": "dashboard",
                "purpose": "statistics_and_analytics"
            }
        },
        {
            "name": "Early Exploration",
            "user_message": "I'm thinking about adding some kind of reporting feature to the app.",
            "accumulated_specs": {}
        }
    ]
    
    base_context = ResponseContext(
        project_name="Samurai Agent",
        tech_stack="Python, FastAPI, React, TypeScript",
        conversation_summary="User has been working on various features and is now considering new additions.",
        relevant_tasks=[],
        relevant_memories=[],
        user_message="",
        intent_type="specification_clarification",
        confidence=0.8
    )
    
    for scenario in scenarios:
        print(f"\n=== Testing Scenario: {scenario['name']} ===\n")
        
        # Update context for this scenario
        context = ResponseContext(
            project_name=base_context.project_name,
            tech_stack=base_context.tech_stack,
            conversation_summary=base_context.conversation_summary,
            relevant_tasks=base_context.relevant_tasks,
            relevant_memories=base_context.relevant_memories,
            user_message=scenario['user_message'],
            intent_type=base_context.intent_type,
            confidence=base_context.confidence
        )
        
        try:
            response = await generator.generate_spec_clarification_response(
                context, 
                scenario['accumulated_specs']
            )
            print(f"Response: {response}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    print("Testing Unified Spec Clarification Response Method")
    print("=" * 60)
    
    # Run the main test
    asyncio.run(test_unified_spec_response())
    
    print("\n" + "=" * 60)
    print("Testing Different Scenarios")
    print("=" * 60)
    
    # Run scenario tests
    asyncio.run(test_comparison_scenarios()) 