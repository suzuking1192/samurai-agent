#!/usr/bin/env python3
"""
Integration test for the complete intelligent memory consolidation workflow.

This test simulates a realistic user scenario:
1. User starts a session and has conversations about project development
2. User clicks "Start New Conversation" 
3. System analyzes the session and consolidates insights into memories
4. System creates a new session for fresh start
"""

import asyncio
import json
import uuid
from datetime import datetime
from typing import List

from models import Project, ChatMessage, Memory, Session
from services.file_service import FileService
from services.intelligent_memory_consolidation import IntelligentMemoryConsolidationService
from services.gemini_service import GeminiService


class MockGeminiService:
    """Mock Gemini service for testing without API calls."""
    
    async def chat_with_system_prompt(self, message: str, system_prompt: str) -> str:
        """Mock LLM responses based on the type of prompt."""
        
        if "extract ONLY significant, project-relevant insights" in system_prompt:
            # Mock conversation analysis response
            return json.dumps({
                "insights": [
                    {
                        "content": "Implement JWT authentication with refresh tokens stored in Redis for improved security and session management",
                        "category": "security",
                        "is_new_category": False,
                        "new_category_suggestion": None,
                        "significance_score": 0.9,
                        "insight_type": "decision",
                        "related_keywords": ["jwt", "authentication", "redis", "refresh", "tokens", "security"]
                    },
                    {
                        "content": "Use PostgreSQL as primary database with Redis for caching and session storage",
                        "category": "database",
                        "is_new_category": False,
                        "new_category_suggestion": None,
                        "significance_score": 0.85,
                        "insight_type": "decision",
                        "related_keywords": ["postgresql", "redis", "database", "caching", "sessions"]
                    },
                    {
                        "content": "Implement microservices architecture with API gateway for better scalability",
                        "category": "architecture",
                        "is_new_category": False,
                        "new_category_suggestion": None,
                        "significance_score": 0.8,
                        "insight_type": "decision",
                        "related_keywords": ["microservices", "api", "gateway", "architecture", "scalability"]
                    }
                ],
                "session_relevance_score": 0.85,
                "suggested_new_categories": []
            })
        
        elif "Analyze if this new insight conflicts" in system_prompt:
            # Mock conflict analysis - no conflicts
            return json.dumps({
                "has_conflict": False,
                "conflict_reason": None,
                "should_merge": True,
                "merge_reason": "Insight adds complementary information to existing content"
            })
        
        elif "Merge this new insight into the existing memory" in system_prompt:
            # Mock memory merging
            if "JWT" in system_prompt or "authentication" in system_prompt:
                return json.dumps({
                    "title": "Enhanced Authentication System",
                    "content": "JWT-based authentication system with bcrypt password hashing, enhanced with refresh tokens stored in Redis for improved security, scalability, and session management. Supports secure token rotation and automatic session cleanup.",
                    "category": "security"
                })
            elif "database" in system_prompt or "PostgreSQL" in system_prompt:
                return json.dumps({
                    "title": "Database Architecture",
                    "content": "PostgreSQL as primary database with Redis for caching and session storage. Optimized for performance with proper indexing and query optimization strategies.",
                    "category": "database"
                })
            else:
                return json.dumps({
                    "title": "System Architecture", 
                    "content": "Microservices architecture with API gateway for better scalability and service isolation.",
                    "category": "architecture"
                })
        
        elif "Generate a concise, descriptive title" in system_prompt:
            # Mock title generation
            if "microservices" in message.lower():
                return "Microservices Architecture Design"
            elif "jwt" in message.lower() or "auth" in message.lower():
                return "JWT Authentication Strategy"
            else:
                return "System Design Decision"
        
        else:
            # Default response
            return "Mock response"


async def run_integration_test():
    """Run the complete integration test."""
    print("🚀 Starting Memory Consolidation Integration Test")
    print("=" * 60)
    
    # Initialize services
    file_service = FileService()
    consolidation_service = IntelligentMemoryConsolidationService()
    
    # Replace Gemini service with mock
    consolidation_service.gemini_service = MockGeminiService()
    
    # Create test project
    test_project = Project(
        id="integration-test-project",
        name="E-commerce Platform Integration Test",
        description="Testing intelligent memory consolidation",
        tech_stack="React, Node.js, PostgreSQL, Redis"
    )
    
    # Create test session
    test_session = Session(
        id="integration-test-session",
        project_id=test_project.id,
        name="Development Discussion Session"
    )
    
    print(f"📁 Created test project: {test_project.name}")
    print(f"🗣️  Created test session: {test_session.id}")
    
    # Create existing memories to test merging (with content that should be similar to conversation)
    existing_memories = [
        Memory(
            id=str(uuid.uuid4()),
            project_id=test_project.id,
            title="Authentication System",
            content="JWT authentication with refresh tokens for secure user sessions. Uses bcrypt for password hashing and stores session data.",
            category="security",
            type="decision"
        ),
        Memory(
            id=str(uuid.uuid4()),
            project_id=test_project.id,
            title="Database Architecture",
            content="PostgreSQL database with Redis for caching and session storage. Provides ACID compliance with good performance.",
            category="database", 
            type="decision"
        )
    ]
    
    # Save initial memories
    file_service.save_memories(test_project.id, existing_memories)
    print(f"💾 Saved {len(existing_memories)} existing memories")
    
    # Create realistic conversation messages
    conversation_messages = [
        ChatMessage(
            id=str(uuid.uuid4()),
            project_id=test_project.id,
            session_id=test_session.id,
            message="How should I implement authentication for the e-commerce platform?",
            response="I recommend implementing JWT authentication with refresh tokens. Store the refresh tokens in Redis for better performance and scalability. Use bcrypt for password hashing and implement proper token rotation for security.",
            created_at=datetime.utcnow()
        ),
        ChatMessage(
            id=str(uuid.uuid4()),
            project_id=test_project.id,
            session_id=test_session.id,
            message="What database architecture should I use?",
            response="For your e-commerce platform, I suggest using PostgreSQL as the primary database for transactional data, and Redis for caching frequently accessed data and session storage. This combination provides ACID compliance with excellent performance.",
            created_at=datetime.utcnow()
        ),
        ChatMessage(
            id=str(uuid.uuid4()),
            project_id=test_project.id,
            session_id=test_session.id,
            message="Should I use microservices or monolithic architecture?",
            response="Given the scale and complexity of an e-commerce platform, I recommend starting with a modular monolith and then transitioning to microservices as needed. Implement an API gateway from the beginning to prepare for future microservices migration.",
            created_at=datetime.utcnow()
        ),
        ChatMessage(
            id=str(uuid.uuid4()),
            project_id=test_project.id,
            session_id=test_session.id,
            message="How do I handle payment processing securely?",
            response="Integrate with a PCI-compliant payment processor like Stripe. Never store sensitive payment data directly. Use webhooks for payment confirmations and implement proper error handling and retry logic for failed payments.",
            created_at=datetime.utcnow()
        )
    ]
    
    # Save conversation messages
    for message in conversation_messages:
        file_service.save_chat_message(test_project.id, message)
    
    print(f"💬 Saved {len(conversation_messages)} conversation messages")
    
    # Build project context
    project_context = {
        "name": test_project.name,
        "description": test_project.description,
        "tech_stack": test_project.tech_stack
    }
    
    print("\n🔄 Starting memory consolidation process...")
    
    # Run memory consolidation
    result = await consolidation_service.consolidate_session_memories(
        project_id=test_project.id,
        session_id=test_session.id,
        project_context=project_context
    )
    
    print("\n📊 Consolidation Results:")
    print(f"   Status: {result.status}")
    print(f"   Insights processed: {result.total_insights_processed}")
    print(f"   Insights skipped: {result.total_insights_skipped}")
    print(f"   Session relevance: {result.session_relevance:.2f}")
    print(f"   Total memories affected: {result.total_memories_affected}")
    print(f"   Categories affected: {len(result.categories_affected)}")
    
    if result.categories_affected:
        print("\n📋 Category Details:")
        for cat_result in result.categories_affected:
            print(f"   {cat_result.category}:")
            print(f"     - Memories updated: {cat_result.memories_updated}")
            print(f"     - Memories created: {cat_result.memories_created}")
            print(f"     - Insights processed: {cat_result.insights_processed}")
            if cat_result.is_new_category:
                print(f"     - NEW CATEGORY: Yes")
    
    if result.new_categories_created:
        print(f"\n🆕 New categories created: {', '.join(result.new_categories_created)}")
    
    # Verify the results
    print("\n✅ Verification:")
    
    # Check that consolidation completed successfully
    assert result.status == "completed", f"Expected 'completed', got '{result.status}'"
    print("   ✓ Consolidation completed successfully")
    
    # Check that insights were processed
    assert result.total_insights_processed > 0, "No insights were processed"
    print(f"   ✓ {result.total_insights_processed} insights processed")
    
    # Check session relevance
    assert result.session_relevance >= 0.8, f"Low session relevance: {result.session_relevance}"
    print(f"   ✓ High session relevance: {result.session_relevance:.2f}")
    
    # Check that multiple categories were affected
    assert len(result.categories_affected) >= 2, "Expected multiple categories to be affected"
    print(f"   ✓ {len(result.categories_affected)} categories affected")
    
    # Check that memories were either updated or created
    total_updates = sum(cat.memories_updated for cat in result.categories_affected)
    total_created = sum(cat.memories_created for cat in result.categories_affected)
    assert (total_updates + total_created) > 0, "No memories were updated or created"
    print(f"   ✓ {total_updates} memories updated, {total_created} memories created")
    
    # Load updated memories and verify content enhancement
    updated_memories = file_service.load_memories(test_project.id)
    print(f"\n🔍 Examining updated memories ({len(updated_memories)} total):")
    
    security_memories = [m for m in updated_memories if m.category == "security"]
    database_memories = [m for m in updated_memories if m.category == "database"]
    architecture_memories = [m for m in updated_memories if m.category == "architecture"]
    
    for memory in updated_memories:
        print(f"\n   📝 {memory.title} ({memory.category}):")
        print(f"      {memory.content[:100]}...")
    
    # Verify that we have memories in expected categories
    assert len(security_memories) > 0, "Should have security-related memories"
    assert len(database_memories) > 0, "Should have database-related memories"
    print(f"      ✓ Found memories in {len(set(m.category for m in updated_memories))} categories")
    
    # Verify content quality - should contain relevant technical details
    security_content = " ".join([m.content.lower() for m in security_memories])
    database_content = " ".join([m.content.lower() for m in database_memories])
    
    assert any(term in security_content for term in ["jwt", "authentication", "token"]), "Security memories should contain auth-related terms"
    assert any(term in database_content for term in ["postgresql", "redis", "database"]), "Database memories should contain db-related terms"
    print("      ✓ Memories contain appropriate technical content")
    
    print("\n🎉 Integration Test Completed Successfully!")
    print("=" * 60)
    
    # Cleanup
    try:
        import os
        import shutil
        data_path = file_service.data_dir / f"project-{test_project.id}-memories.json"
        if data_path.exists():
            data_path.unlink()
        chat_path = file_service.data_dir / f"project-{test_project.id}-chat.json"  
        if chat_path.exists():
            chat_path.unlink()
        print("🧹 Cleaned up test data files")
    except Exception as e:
        print(f"⚠️  Warning: Could not clean up test files: {e}")
    
    return True


def run_quick_integration_test():
    """Run the integration test with proper async handling."""
    try:
        # Run the async test
        result = asyncio.run(run_integration_test())
        
        if result:
            print("\n✅ ALL INTEGRATION TESTS PASSED!")
            return True
        else:
            print("\n❌ INTEGRATION TESTS FAILED!")
            return False
            
    except Exception as e:
        print(f"\n❌ INTEGRATION TEST ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    # Run integration test when script is executed directly
    success = run_quick_integration_test()
    exit(0 if success else 1)