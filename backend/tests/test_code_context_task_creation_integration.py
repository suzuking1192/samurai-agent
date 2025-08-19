import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.unified_samurai_agent import UnifiedSamuraiAgent


class TestCodeContextTaskCreationIntegration:
    """Integration test for code context extraction in task creation."""
    
    @pytest.mark.asyncio
    async def test_code_context_extraction_in_task_creation_flow(self):
        """Test that code context extraction works in the full task creation flow."""
        # Arrange
        agent = UnifiedSamuraiAgent()
        
        # Mock the tool registry to capture calls
        agent.tool_registry = MagicMock()
        agent.tool_registry.execute_tool = AsyncMock()
        
        # Mock the gemini service
        agent.gemini_service = MagicMock()
        agent.gemini_service.chat_with_system_prompt = AsyncMock(return_value='[{"title": "Test task", "description": "Test description"}]')
        
        # Mock other dependencies
        agent._create_conversation_summary_with_smart_truncation = MagicMock(return_value="Test conversation context")
        agent._format_memories_for_context = MagicMock(return_value="Test memories")
        agent._format_code_context_for_prompt = MagicMock(return_value="Test code context")
        agent._parse_task_breakdown_response = MagicMock(return_value=[{"title": "Test task", "description": "Test description"}])
        agent._execute_task_creation = AsyncMock(return_value=[{"success": True, "task_id": "test-123"}])
        agent._generate_task_creation_response = AsyncMock(return_value="Tasks created successfully")
        
        # Mock successful code context extraction
        agent.tool_registry.execute_tool.return_value = {
            "success": True,
            "context": "Test context summary",
            "relevant_code": "def test_function():\n    pass",
            "file_path": "/test/path/test_file.py",
            "relevance_score": 8
        }
        
        # Create a mock context
        from backend.services.unified_samurai_agent import ConversationContext
        context = ConversationContext(
            session_id="test-session",
            session_messages=[],
            conversation_summary="Test conversation summary",
            project_context={
                "name": "Test Project",
                "tech_stack": "Python/React",
                "codebase_path": "/test/path",
                "project_detail": "Test project details"
            },
            task_context=None,
            relevant_memories=[],
            code_context=None
        )
        
        # Act
        result = await agent._handle_ready_for_action(
            message="Create tasks for implementing a new feature",
            context=context,
            project_id="test-project",
            progress_callback=None,
            code_context_mode="with code look up"
        )
        
        # Assert
        # Verify code context extraction was called
        agent.tool_registry.execute_tool.assert_called_once_with(
            "extract_code_context",
            natural_language_request="Test conversation context",
            project_id="test-project",
            session_id="test-session",
            connected_codebase_path="/test/path",
            max_iterations=3
        )
        
        # Verify code context was set in the context
        assert context.code_context is not None
        assert context.code_context["context"] == "Test context summary"
        assert context.code_context["relevant_code"] == "def test_function():\n    pass"
        assert context.code_context["file_path"] == "/test/path/test_file.py"
        assert context.code_context["relevance_score"] == 8
        
        # Verify the result is successful
        assert result["type"] == "task_creation_response"
        assert "Tasks created successfully" in result["response"]
        
        # Verify that _format_code_context_for_prompt was called (indicating code context was included in the prompt)
        agent._format_code_context_for_prompt.assert_called_once_with(context.code_context)
