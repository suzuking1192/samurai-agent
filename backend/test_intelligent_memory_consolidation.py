#!/usr/bin/env python3
"""
Comprehensive tests for the Intelligent Memory Consolidation system.

This test suite covers:
1. Conversation analysis and insight extraction
2. Multi-category memory processing
3. Memory merging and conflict detection
4. New category creation and validation
5. Session end workflow integration
6. Edge cases and error handling
"""

import pytest
import asyncio
import json
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from typing import List, Dict, Any

# Import the services to test
from services.intelligent_memory_consolidation import (
    IntelligentMemoryConsolidationService,
    ConversationInsight,
    SessionAnalysis,
    CategoryProcessingResult,
    MemoryConsolidationResult,
    MIN_SESSION_LENGTH,
    MIN_SIGNIFICANCE_SCORE,
    MIN_RELEVANCE_SCORE,
    MEMORY_MERGE_THRESHOLD,
    NEW_MEMORY_THRESHOLD
)
from models import ChatMessage, Memory, Project, MemoryCategory


class TestIntelligentMemoryConsolidation:
    """Test suite for intelligent memory consolidation functionality."""

    def setup_method(self):
        """Set up test fixtures before each test method."""
        self.service = IntelligentMemoryConsolidationService()
        self.test_project_id = "test-project-123"
        self.test_session_id = "test-session-456"
        self.test_project_context = {
            "name": "Test E-commerce Platform",
            "description": "A modern e-commerce platform with React frontend",
            "tech_stack": "React, Node.js, PostgreSQL, Redis"
        }

    def create_test_messages(self, count: int = 5) -> List[ChatMessage]:
        """Create test chat messages for conversation analysis."""
        messages = []
        
        conversation_pairs = [
            ("How should I implement user authentication?", 
             "I recommend using JWT tokens with refresh tokens. Store user sessions in Redis for scalability."),
            ("What database schema should I use for products?", 
             "Create a products table with id, name, price, description, category_id, and inventory_count fields."),
            ("Should I use React Context or Redux for state management?", 
             "For this project size, React Context with useReducer should be sufficient. Only migrate to Redux if state becomes too complex."),
            ("How do I handle payment processing?", 
             "Integrate with Stripe for secure payment processing. Create a payments service to handle webhooks and store transaction records."),
            ("What's the best way to deploy this?", 
             "Use Docker containers with AWS ECS or similar container orchestration. Set up CI/CD pipeline with GitHub Actions.")
        ]
        
        for i in range(min(count, len(conversation_pairs))):
            user_msg, assistant_response = conversation_pairs[i]
            message = ChatMessage(
                id=str(uuid.uuid4()),
                project_id=self.test_project_id,
                session_id=self.test_session_id,
                message=user_msg,
                response=assistant_response,
                created_at=datetime.utcnow()
            )
            messages.append(message)
        
        return messages

    def create_test_memories(self) -> List[Memory]:
        """Create test memories for merge testing."""
        return [
            Memory(
                id=str(uuid.uuid4()),
                project_id=self.test_project_id,
                title="Authentication System",
                content="Basic JWT authentication implemented with bcrypt password hashing.",
                category="security",
                type="decision"
            ),
            Memory(
                id=str(uuid.uuid4()),
                project_id=self.test_project_id,
                title="Database Schema",
                content="Users table with basic fields: id, email, password_hash, created_at.",
                category="database",
                type="spec"
            ),
            Memory(
                id=str(uuid.uuid4()),
                project_id=self.test_project_id,
                title="React State Management",
                content="Using React Context for global state management.",
                category="frontend",
                type="decision"
            )
        ]

    @pytest.mark.asyncio
    async def test_conversation_analysis_extracts_insights(self):
        """Test that conversation analysis correctly extracts insights."""
        # Mock the Gemini service response
        mock_analysis_response = {
            "insights": [
                {
                    "content": "Implement JWT authentication with refresh tokens stored in Redis for scalability",
                    "category": "security",
                    "is_new_category": False,
                    "new_category_suggestion": None,
                    "significance_score": 0.9,
                    "insight_type": "decision",
                    "related_keywords": ["jwt", "authentication", "redis", "refresh", "tokens"]
                },
                {
                    "content": "Products table schema: id, name, price, description, category_id, inventory_count",
                    "category": "database",
                    "is_new_category": False,
                    "new_category_suggestion": None,
                    "significance_score": 0.8,
                    "insight_type": "specification",
                    "related_keywords": ["database", "schema", "products", "table"]
                }
            ],
            "session_relevance_score": 0.85,
            "suggested_new_categories": []
        }

        with patch.object(self.service.gemini_service, 'chat_with_system_prompt', 
                         return_value=json.dumps(mock_analysis_response)):
            
            messages = self.create_test_messages()
            analysis = await self.service._analyze_conversation_for_insights(
                messages, self.test_project_context
            )
            
            # Verify analysis results
            assert len(analysis.insights) == 2
            assert analysis.session_relevance_score == 0.85
            assert analysis.total_insights_found == 2
            assert analysis.total_insights_processed == 2
            
            # Check first insight
            insight1 = analysis.insights[0]
            assert insight1.category == "security"
            assert insight1.significance_score == 0.9
            assert insight1.insight_type == "decision"
            assert "jwt" in insight1.related_keywords

    @pytest.mark.asyncio
    async def test_session_too_short_skips_consolidation(self):
        """Test that sessions shorter than minimum length skip consolidation."""
        short_messages = self.create_test_messages(2)  # Less than MIN_SESSION_LENGTH
        
        with patch.object(self.service.file_service, 'load_chat_messages_by_session', 
                         return_value=short_messages):
            
            result = await self.service.consolidate_session_memories(
                self.test_project_id, self.test_session_id, self.test_project_context
            )
            
            assert result.status == "skipped_too_short"
            assert result.total_insights_processed == 0
            assert result.total_memories_affected == 0

    @pytest.mark.asyncio
    async def test_low_relevance_skips_consolidation(self):
        """Test that sessions with low relevance skip consolidation."""
        messages = self.create_test_messages()
        
        # Mock low relevance analysis
        mock_analysis_response = {
            "insights": [],
            "session_relevance_score": 0.3,  # Below MIN_RELEVANCE_SCORE
            "suggested_new_categories": []
        }
        
        with patch.object(self.service.file_service, 'load_chat_messages_by_session', 
                         return_value=messages), \
             patch.object(self.service.gemini_service, 'chat_with_system_prompt', 
                         return_value=json.dumps(mock_analysis_response)):
            
            result = await self.service.consolidate_session_memories(
                self.test_project_id, self.test_session_id, self.test_project_context
            )
            
            assert result.status == "no_relevant_insights"
            assert result.session_relevance == 0.3

    @pytest.mark.asyncio
    async def test_memory_merging_with_existing_memory(self):
        """Test merging insights into existing memories."""
        messages = self.create_test_messages()
        existing_memories = self.create_test_memories()
        
        # Mock analysis with insights
        mock_analysis_response = {
            "insights": [
                {
                    "content": "Enhanced JWT authentication with refresh tokens and Redis session storage",
                    "category": "security",
                    "is_new_category": False,
                    "new_category_suggestion": None,
                    "significance_score": 0.9,
                    "insight_type": "decision",
                    "related_keywords": ["jwt", "authentication", "redis", "refresh"]
                }
            ],
            "session_relevance_score": 0.8,
            "suggested_new_categories": []
        }
        
        # Mock merge decision
        mock_merge_response = {
            "has_conflict": False,
            "should_merge": True,
            "merge_reason": "Insight adds complementary information to existing auth system"
        }
        
        # Mock merged content
        mock_merged_response = {
            "title": "Enhanced Authentication System",
            "content": "JWT authentication with bcrypt password hashing, enhanced with refresh tokens stored in Redis for improved scalability and session management.",
            "category": "security"
        }
        
        with patch.object(self.service.file_service, 'load_chat_messages_by_session', 
                         return_value=messages), \
             patch.object(self.service.file_service, 'load_memories', 
                         return_value=existing_memories), \
             patch.object(self.service.file_service, 'save_memories') as mock_save, \
             patch.object(self.service.gemini_service, 'chat_with_system_prompt') as mock_gemini:
            
            # Configure gemini responses in order
            mock_gemini.side_effect = [
                json.dumps(mock_analysis_response),  # Analysis
                json.dumps(mock_merge_response),     # Merge decision
                json.dumps(mock_merged_response)     # Merged content
            ]
            
            result = await self.service.consolidate_session_memories(
                self.test_project_id, self.test_session_id, self.test_project_context
            )
            
            # Verify consolidation results
            assert result.status == "completed"
            assert result.total_insights_processed == 1
            assert len(result.categories_affected) == 1
            assert result.categories_affected[0].category == "security"
            assert result.categories_affected[0].memories_updated == 1
            assert result.categories_affected[0].memories_created == 0
            
            # Verify save was called
            mock_save.assert_called_once()

    @pytest.mark.asyncio
    async def test_new_memory_creation(self):
        """Test creating new memories for high-significance insights."""
        messages = self.create_test_messages()
        existing_memories = []  # No existing memories
        
        # Mock analysis with high-significance insight
        mock_analysis_response = {
            "insights": [
                {
                    "content": "Implement microservices architecture with API gateway for scalability",
                    "category": "architecture",
                    "is_new_category": False,
                    "new_category_suggestion": None,
                    "significance_score": 0.95,  # High significance
                    "insight_type": "decision",
                    "related_keywords": ["microservices", "api", "gateway", "architecture"]
                }
            ],
            "session_relevance_score": 0.8,
            "suggested_new_categories": []
        }
        
        # Mock title generation
        mock_title = "Microservices Architecture Decision"
        
        with patch.object(self.service.file_service, 'load_chat_messages_by_session', 
                         return_value=messages), \
             patch.object(self.service.file_service, 'load_memories', 
                         return_value=existing_memories), \
             patch.object(self.service.file_service, 'save_memories') as mock_save, \
             patch.object(self.service.gemini_service, 'chat_with_system_prompt') as mock_gemini:
            
            # Configure gemini responses
            mock_gemini.side_effect = [
                json.dumps(mock_analysis_response),  # Analysis
                mock_title  # Title generation
            ]
            
            result = await self.service.consolidate_session_memories(
                self.test_project_id, self.test_session_id, self.test_project_context
            )
            
            # Verify new memory was created
            assert result.status == "completed"
            assert result.total_insights_processed == 1
            assert len(result.categories_affected) == 1
            assert result.categories_affected[0].category == "architecture"
            assert result.categories_affected[0].memories_created == 1
            assert result.categories_affected[0].memories_updated == 0

    @pytest.mark.asyncio
    async def test_new_category_creation(self):
        """Test handling of new category suggestions."""
        messages = self.create_test_messages()
        existing_memories = []
        
        # Mock analysis with new category suggestion
        mock_analysis_response = {
            "insights": [
                {
                    "content": "Implement comprehensive API rate limiting and throttling strategy",
                    "category": "api_management",
                    "is_new_category": True,
                    "new_category_suggestion": "api_management",
                    "significance_score": 0.85,
                    "insight_type": "specification",
                    "related_keywords": ["api", "rate", "limiting", "throttling"]
                }
            ],
            "session_relevance_score": 0.8,
            "suggested_new_categories": [
                {
                    "name": "api_management",
                    "description": "API design, versioning, rate limiting, and management",
                    "justification": "Need category for API-specific decisions and patterns"
                }
            ]
        }
        
        mock_title = "API Rate Limiting Strategy"
        
        with patch.object(self.service.file_service, 'load_chat_messages_by_session', 
                         return_value=messages), \
             patch.object(self.service.file_service, 'load_memories', 
                         return_value=existing_memories), \
             patch.object(self.service.file_service, 'save_memories') as mock_save, \
             patch.object(self.service.gemini_service, 'chat_with_system_prompt') as mock_gemini:
            
            mock_gemini.side_effect = [
                json.dumps(mock_analysis_response),
                mock_title
            ]
            
            result = await self.service.consolidate_session_memories(
                self.test_project_id, self.test_session_id, self.test_project_context
            )
            
            # Verify new category was handled
            assert result.status == "completed"
            assert "api_management" in result.new_categories_created
            assert len(result.categories_affected) == 1
            assert result.categories_affected[0].category == "api_management"
            assert result.categories_affected[0].is_new_category == True

    @pytest.mark.asyncio
    async def test_conflict_detection_prevents_merge(self):
        """Test that conflicting insights are not merged."""
        messages = self.create_test_messages()
        existing_memories = self.create_test_memories()
        
        # Mock analysis with conflicting insight
        mock_analysis_response = {
            "insights": [
                {
                    "content": "Use OAuth2 with external providers instead of JWT for authentication",
                    "category": "security",
                    "is_new_category": False,
                    "new_category_suggestion": None,
                    "significance_score": 0.85,
                    "insight_type": "decision",
                    "related_keywords": ["oauth2", "authentication", "external"]
                }
            ],
            "session_relevance_score": 0.8,
            "suggested_new_categories": []
        }
        
        # Mock conflict detection
        mock_conflict_response = {
            "has_conflict": True,
            "conflict_reason": "OAuth2 contradicts existing JWT authentication decision",
            "should_merge": False,
            "merge_reason": "Conflicting authentication approaches"
        }
        
        with patch.object(self.service.file_service, 'load_chat_messages_by_session', 
                         return_value=messages), \
             patch.object(self.service.file_service, 'load_memories', 
                         return_value=existing_memories), \
             patch.object(self.service.file_service, 'save_memories') as mock_save, \
             patch.object(self.service.gemini_service, 'chat_with_system_prompt') as mock_gemini:
            
            mock_gemini.side_effect = [
                json.dumps(mock_analysis_response),
                json.dumps(mock_conflict_response)
            ]
            
            result = await self.service.consolidate_session_memories(
                self.test_project_id, self.test_session_id, self.test_project_context
            )
            
            # Verify no merge occurred due to conflict
            assert result.status == "completed"
            assert result.total_insights_processed == 1
            # Since conflict prevented merge and significance < NEW_MEMORY_THRESHOLD, nothing should be created
            assert len(result.categories_affected) == 1
            assert result.categories_affected[0].memories_updated == 0
            assert result.categories_affected[0].memories_created == 0

    @pytest.mark.asyncio
    async def test_multi_category_processing(self):
        """Test processing insights across multiple categories in single session."""
        messages = self.create_test_messages()
        existing_memories = self.create_test_memories()
        
        # Mock analysis with insights from multiple categories
        mock_analysis_response = {
            "insights": [
                {
                    "content": "Enhanced JWT authentication with refresh tokens",
                    "category": "security",
                    "is_new_category": False,
                    "new_category_suggestion": None,
                    "significance_score": 0.85,
                    "insight_type": "decision",
                    "related_keywords": ["jwt", "authentication", "refresh"]
                },
                {
                    "content": "Implement React Context with useReducer for state management",
                    "category": "frontend",
                    "is_new_category": False,
                    "new_category_suggestion": None,
                    "significance_score": 0.8,
                    "insight_type": "decision",
                    "related_keywords": ["react", "context", "state", "reducer"]
                },
                {
                    "content": "Products table with advanced inventory tracking fields",
                    "category": "database",
                    "is_new_category": False,
                    "new_category_suggestion": None,
                    "significance_score": 0.9,
                    "insight_type": "specification",
                    "related_keywords": ["database", "products", "inventory"]
                }
            ],
            "session_relevance_score": 0.85,
            "suggested_new_categories": []
        }
        
        # Mock merge decisions for each category
        mock_responses = [
            json.dumps(mock_analysis_response),  # Analysis
            # Responses for each insight (conflict check + merge)
            json.dumps({"has_conflict": False, "should_merge": True}),  # Security merge decision
            json.dumps({"title": "Enhanced Authentication System", "content": "Enhanced content", "category": "security"}),  # Security merge
            json.dumps({"has_conflict": False, "should_merge": True}),  # Frontend merge decision  
            json.dumps({"title": "Enhanced React State Management", "content": "Enhanced content", "category": "frontend"}),  # Frontend merge
            json.dumps({"has_conflict": False, "should_merge": True}),  # Database merge decision
            json.dumps({"title": "Enhanced Database Schema", "content": "Enhanced content", "category": "database"}),  # Database merge
        ]
        
        with patch.object(self.service.file_service, 'load_chat_messages_by_session', 
                         return_value=messages), \
             patch.object(self.service.file_service, 'load_memories', 
                         return_value=existing_memories), \
             patch.object(self.service.file_service, 'save_memories') as mock_save, \
             patch.object(self.service.gemini_service, 'chat_with_system_prompt') as mock_gemini:
            
            mock_gemini.side_effect = mock_responses
            
            result = await self.service.consolidate_session_memories(
                self.test_project_id, self.test_session_id, self.test_project_context
            )
            
            # Verify multi-category processing
            assert result.status == "completed"
            assert result.total_insights_processed == 3
            assert len(result.categories_affected) == 3
            
            # Check each category was processed
            categories = {cat.category for cat in result.categories_affected}
            assert categories == {"security", "frontend", "database"}
            
            # Verify all were updates (merged into existing)
            for cat_result in result.categories_affected:
                assert cat_result.memories_updated == 1
                assert cat_result.memories_created == 0

    def test_category_validation(self):
        """Test new category name validation."""
        # Valid category names
        assert self.service._validate_new_category_name("api_management") == True
        assert self.service._validate_new_category_name("user_workflows") == True
        assert self.service._validate_new_category_name("payment_processing") == True
        
        # Invalid category names
        assert self.service._validate_new_category_name("API Management") == False  # Uppercase
        assert self.service._validate_new_category_name("api management") == False  # Spaces
        assert self.service._validate_new_category_name("a" * 50) == False  # Too long
        assert self.service._validate_new_category_name("frontend") == False  # Duplicate existing

    def test_content_similarity_calculation(self):
        """Test content similarity calculation."""
        text1 = "JWT authentication with refresh tokens and Redis storage"
        text2 = "JWT auth using refresh tokens stored in Redis database"
        text3 = "OAuth2 authentication with external providers"
        
        # Similar texts should have high similarity
        similarity1 = self.service._calculate_content_similarity(text1, text2)
        assert similarity1 > 0.5
        
        # Different texts should have low similarity
        similarity2 = self.service._calculate_content_similarity(text1, text3)
        assert similarity2 < 0.3

    def test_keyword_extraction(self):
        """Test keyword extraction from content."""
        content = "Implement JWT authentication with refresh tokens stored in Redis for scalability and performance"
        keywords = self.service._extract_keywords_from_content(content)
        
        # Should extract meaningful keywords
        assert "implement" in keywords
        assert "authentication" in keywords
        assert "refresh" in keywords
        assert "tokens" in keywords
        assert "redis" in keywords
        assert "scalability" in keywords
        
        # Should not include stop words
        assert "with" not in keywords
        assert "for" not in keywords
        assert "and" not in keywords

    def test_conversation_text_building(self):
        """Test building conversation text from chat messages."""
        messages = self.create_test_messages(2)
        conversation_text = self.service._build_session_conversation_text(messages)
        
        # Should contain user and assistant messages
        assert "User:" in conversation_text
        assert "Assistant:" in conversation_text
        assert "How should I implement user authentication?" in conversation_text
        assert "JWT tokens with refresh tokens" in conversation_text

    @pytest.mark.asyncio
    async def test_error_handling_in_consolidation(self):
        """Test error handling during consolidation process."""
        messages = self.create_test_messages()
        
        # Mock gemini service to raise an exception
        with patch.object(self.service.file_service, 'load_chat_messages_by_session', 
                         return_value=messages), \
             patch.object(self.service.gemini_service, 'chat_with_system_prompt', 
                         side_effect=Exception("LLM service error")):
            
            result = await self.service.consolidate_session_memories(
                self.test_project_id, self.test_session_id, self.test_project_context
            )
            
            # Should handle error gracefully
            assert result.status == "error"
            assert result.total_insights_processed == 0
            assert result.total_memories_affected == 0


def run_memory_consolidation_tests():
    """Run all memory consolidation tests with detailed output."""
    import subprocess
    import sys
    
    print("🧪 Running Intelligent Memory Consolidation Tests...")
    print("=" * 60)
    
    try:
        # Run pytest with verbose output
        result = subprocess.run([
            sys.executable, "-m", "pytest", 
            "test_intelligent_memory_consolidation.py", 
            "-v", "--tb=short", "--color=yes"
        ], capture_output=True, text=True, cwd=".")
        
        print("STDOUT:")
        print(result.stdout)
        
        if result.stderr:
            print("\nSTDERR:")
            print(result.stderr)
        
        print(f"\nTest exit code: {result.returncode}")
        
        if result.returncode == 0:
            print("✅ All tests passed!")
        else:
            print("❌ Some tests failed!")
            
        return result.returncode == 0
        
    except Exception as e:
        print(f"❌ Error running tests: {e}")
        return False


if __name__ == "__main__":
    # Run tests when script is executed directly
    success = run_memory_consolidation_tests()
    exit(0 if success else 1)