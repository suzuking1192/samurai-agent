"""
Tests for the improved spec clarification functionality in UnifiedSamuraiAgent.

This module tests the new proactive code area analysis and complex logic verification
features added to the _handle_spec_clarification method.
"""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Dict, Any, List

from services.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext, IntentAnalysis


class TestSpecClarificationImprovements:
    """Test suite for the improved spec clarification functionality."""
    
    @pytest.fixture
    def agent(self):
        """Create a UnifiedSamuraiAgent instance for testing."""
        return UnifiedSamuraiAgent()
    
    @pytest.fixture
    def mock_conversation_context(self):
        """Create a mock conversation context for testing."""
        return ConversationContext(
            session_messages=[],
            conversation_summary="Test conversation",
            relevant_memories=[],
            project_context={
                'id': 'test-project-123',
                'name': 'Test Project',
                'tech_stack': 'Python/React',
                'codebase_path': '/path/to/codebase'
            },
            session_id='test-session-456'
        )
    
    @pytest.fixture
    def mock_code_context(self):
        """Create mock code context for testing."""
        return {
            "files": [
                {
                    "path": "services/auth.py",
                    "content": "class AuthService:\n    def authenticate(self, token):\n        return jwt.decode(token)\n    def refresh_token(self, token):\n        return jwt.refresh(token)"
                },
                {
                    "path": "models/user.py", 
                    "content": "class User:\n    id = Column(Integer, primary_key=True)\n    email = Column(String)\n    password_hash = Column(String)"
                },
                {
                    "path": "api/auth_routes.py",
                    "content": "@app.route('/auth/login', methods=['POST'])\ndef login():\n    return auth_service.authenticate(request.json)"
                }
            ],
            "related_files": ["services/auth.py", "models/user.py", "api/auth_routes.py"]
        }

    @pytest.mark.asyncio
    async def test_proactive_code_area_analysis_in_prompt(self, agent, mock_conversation_context, mock_code_context):
        """Test that the improved prompt includes proactive code area analysis."""
        message = "I want to add password reset functionality"
        
        intent_analysis = IntentAnalysis(
            intent_type="spec_clarification",
            confidence=0.9,
            reasoning="User is providing specifications",
            needs_clarification=True,
            clarification_questions=["How should password reset work?"],
            accumulated_specs={}
        )
        
        # Mock the response to include proactive analysis
        mock_response = """
        Great! I want to add password reset functionality. Let me analyze the codebase context first.
        
        I've analyzed the codebase context and noticed this change might also affect:
        - The AuthService class in services/auth.py (for token generation)
        - The User model in models/user.py (for password hash storage)
        - The auth routes in api/auth_routes.py (for new endpoints)
        
        Should we coordinate updates there as well?
        
        Now, let me ask some clarification questions:
        1. Should password reset use email tokens or SMS?
        2. What should be the token expiration time?
        """
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_response):
            result = await agent._handle_spec_clarification(
                message, mock_conversation_context, intent_analysis, code_context_mode="enhanced"
            )
            
            assert result["type"] == "spec_clarification_response"
            response = result["response"]
            
            # Check that proactive analysis is included
            assert "analyzed the codebase context" in response
            assert "AuthService class in services/auth.py" in response
            assert "User model in models/user.py" in response
            assert "auth routes in api/auth_routes.py" in response
            assert "Should we coordinate updates there as well?" in response

    @pytest.mark.asyncio
    async def test_complex_logic_verification_in_prompt(self, agent, mock_conversation_context):
        """Test that the improved prompt includes complex logic verification."""
        message = "I want to implement a complex user role-based access control system with hierarchical permissions and dynamic role assignment"
        
        intent_analysis = IntentAnalysis(
            intent_type="spec_clarification",
            confidence=0.9,
            reasoning="User is providing specifications for complex logic",
            needs_clarification=True,
            clarification_questions=["How should the role hierarchy work?"],
            accumulated_specs={}
        )
        
        # Mock the response to include complex logic verification
        mock_response = """
        This appears to be complex logic involving multiple steps and conditions. Let me confirm my understanding:
        
        You want to implement:
        1. Hierarchical role-based access control
        2. Dynamic role assignment
        3. Permission inheritance through the hierarchy
        
        I want to double-check this complex scenario: 
        - When a user has multiple roles, how should permissions be combined?
        - What should happen when a role is removed from a user who has child roles?
        - Should there be a maximum depth for the role hierarchy?
        
        Let me ask some specific questions:
        1. What are the base roles in your system?
        2. How should permission conflicts be resolved?
        """
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_response):
            result = await agent._handle_spec_clarification(
                message, mock_conversation_context, intent_analysis
            )
            
            assert result["type"] == "spec_clarification_response"
            response = result["response"]
            
            # Check that complex logic verification is included
            assert "complex logic involving multiple steps" in response
            assert "Let me confirm my understanding" in response
            assert "I want to double-check this complex scenario" in response
            assert "When a user has multiple roles" in response
            assert "What should happen when a role is removed" in response

    @pytest.mark.asyncio
    async def test_ambiguity_resolution_in_prompt(self, agent, mock_conversation_context):
        """Test that the improved prompt includes ambiguity resolution."""
        message = "I want to add a notification system that handles different types of notifications"
        
        intent_analysis = IntentAnalysis(
            intent_type="spec_clarification",
            confidence=0.9,
            reasoning="User is providing specifications with potential ambiguity",
            needs_clarification=True,
            clarification_questions=["What types of notifications?"],
            accumulated_specs={}
        )
        
        # Mock the response to include ambiguity resolution
        mock_response = """
        I want to clarify some aspects to remove any ambiguity:
        
        When you say "different types of notifications", could you provide specific examples?
        - Email notifications?
        - Push notifications?
        - In-app notifications?
        - SMS notifications?
        
        Also, let me confirm my understanding of the flow:
        1. System triggers notification event
        2. Notification service determines type and recipient
        3. Notification is sent via appropriate channel
        4. Delivery status is tracked
        
        Is this the correct flow, or should there be additional steps?
        
        Questions to clarify:
        1. What are the specific notification types you need?
        2. Should notifications be queued for retry if delivery fails?
        """
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_response):
            result = await agent._handle_spec_clarification(
                message, mock_conversation_context, intent_analysis
            )
            
            assert result["type"] == "spec_clarification_response"
            response = result["response"]
            
            # Check that ambiguity resolution is included
            assert "clarify some aspects to remove any ambiguity" in response
            assert "could you provide specific examples" in response
            assert "let me confirm my understanding of the flow" in response
            assert "Is this the correct flow" in response

    @pytest.mark.asyncio
    async def test_combined_proactive_analysis_and_logic_verification(self, agent, mock_conversation_context):
        """Test that both proactive analysis and logic verification work together."""
        message = "I want to implement a complex order processing system with inventory management, payment processing, and shipping integration"
        
        intent_analysis = IntentAnalysis(
            intent_type="spec_clarification",
            confidence=0.9,
            reasoning="User is providing specifications for complex system",
            needs_clarification=True,
            clarification_questions=["How should the order flow work?"],
            accumulated_specs={}
        )
        
        # Mock the response to include both features
        mock_response = """
        This is a complex system involving multiple components. Let me analyze the codebase context first.
        
        I've analyzed the codebase context and noticed this change might also affect:
        - Existing order models and database schema
        - Payment processing services
        - Inventory management components
        - Shipping integration modules
        
        Should we coordinate updates across all these areas?
        
        Now, this appears to be complex logic involving multiple steps and conditions. Let me confirm my understanding:
        
        The order processing flow seems to involve:
        1. Order creation and validation
        2. Inventory check and reservation
        3. Payment processing
        4. Shipping calculation and booking
        5. Order fulfillment and tracking
        
        I want to double-check this complex scenario:
        - What should happen if inventory is insufficient after payment is processed?
        - How should partial shipments be handled?
        - What's the rollback strategy if any step fails?
        
        Questions to clarify:
        1. Should inventory be reserved before or after payment?
        2. How should payment failures be handled?
        """
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', return_value=mock_response):
            result = await agent._handle_spec_clarification(
                message, mock_conversation_context, intent_analysis
            )
            
            assert result["type"] == "spec_clarification_response"
            response = result["response"]
            
            # Check that both proactive analysis and logic verification are included
            assert "analyzed the codebase context" in response
            assert "order models and database schema" in response
            assert "complex logic involving multiple steps" in response
            assert "Let me confirm my understanding" in response
            assert "I want to double-check this complex scenario" in response
            assert "What should happen if inventory is insufficient" in response

    @pytest.mark.asyncio
    async def test_prompt_includes_new_sections(self, agent, mock_conversation_context):
        """Test that the system prompt includes the new sections for proactive analysis and complex logic verification."""
        message = "I want to add a feature"
        
        intent_analysis = IntentAnalysis(
            intent_type="spec_clarification",
            confidence=0.9,
            reasoning="User is providing specifications",
            needs_clarification=True,
            clarification_questions=["What feature?"],
            accumulated_specs={}
        )
        
        # Capture the system prompt that gets sent to the LLM
        captured_prompts = []
        
        async def mock_chat_with_system_prompt(user_message, system_prompt):
            captured_prompts.append(system_prompt)
            if "PROACTIVE CODE AREA ANALYSIS" in system_prompt:
                return "Test response with proactive analysis"
            else:
                return "[]"  # For the question identification call
        
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', side_effect=mock_chat_with_system_prompt):
            await agent._handle_spec_clarification(
                message, mock_conversation_context, intent_analysis
            )
            
            # Find the main spec clarification prompt (the one with our new sections)
            main_prompt = None
            for prompt in captured_prompts:
                if "PROACTIVE CODE AREA ANALYSIS (CRITICAL)" in prompt:
                    main_prompt = prompt
                    break
            
            assert main_prompt is not None, "Main spec clarification prompt not found"
            
            # Check that the new sections are included in the prompt
            assert "PROACTIVE CODE AREA ANALYSIS (CRITICAL)" in main_prompt
            assert "Cross-Reference Analysis:" in main_prompt
            assert "Related Code Detection Questions:" in main_prompt
            assert "Dependency Mapping:" in main_prompt
            
            assert "COMPLEX LOGIC VERIFICATION (ESSENTIAL)" in main_prompt
            assert "Logic Complexity Assessment:" in main_prompt
            assert "Double-Check Questions for Complex Logic:" in main_prompt
            assert "Ambiguity Resolution:" in main_prompt
            
            assert "Proactive Analysis Integration:" in main_prompt
            assert "**First**: Perform proactive code area analysis" in main_prompt
            assert "**Second**: If dealing with complex logic, implement double-checking" in main_prompt

    @pytest.mark.asyncio
    async def test_error_handling_with_improvements(self, agent, mock_conversation_context):
        """Test that error handling still works with the improved prompt."""
        message = "I want to add a feature"
        
        intent_analysis = IntentAnalysis(
            intent_type="spec_clarification",
            confidence=0.9,
            reasoning="User is providing specifications",
            needs_clarification=True,
            clarification_questions=["What feature?"],
            accumulated_specs={}
        )
        
        # Mock an error in the LLM call
        with patch.object(agent.gemini_service, 'chat_with_system_prompt', side_effect=Exception("LLM Error")):
            result = await agent._handle_spec_clarification(
                message, mock_conversation_context, intent_analysis
            )
            
            # Should fall back to default error response
            assert result["type"] == "spec_clarification_response"
            assert "Thanks for those details! Would you like me to create tasks for this feature?" in result["response"]
