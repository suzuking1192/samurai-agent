import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from services.unified_samurai_agent import UnifiedSamuraiAgent
from services.file_service import FileService
from models import Project, Session, ChatMessage
from datetime import datetime


class TestProjectContextIdFix:
    """Test that project_context includes 'id' field to prevent code-context extraction from being skipped."""
    
    @pytest.fixture
    def mock_file_service(self):
        """Mock file service with project and session data."""
        mock_service = Mock(spec=FileService)
        
        # Mock project
        mock_project = Mock(spec=Project)
        mock_project.name = "Test Project"
        mock_project.description = "Test Description"
        mock_project.tech_stack = ["Python", "FastAPI"]
        mock_project.codebase_path = "/test/path"
        mock_service.get_project_by_id.return_value = mock_project
        mock_service.load_project_detail.return_value = "Test project detail"
        
        # Mock session
        mock_session = Mock(spec=Session)
        mock_session.id = "test-session-id"
        mock_service.get_latest_session.return_value = mock_session
        mock_service.load_chat_messages_by_session.return_value = []
        
        return mock_service
    
    @pytest.fixture
    def mock_agent(self, mock_file_service):
        """Create a mock unified samurai agent."""
        with patch('services.unified_samurai_agent.FileService', return_value=mock_file_service):
            agent = UnifiedSamuraiAgent()
            # Mock the tool registry to avoid actual tool execution
            agent.tool_registry = Mock()
            agent.tool_registry.execute_tool = AsyncMock()
            return agent
    
    @pytest.mark.asyncio
    async def test_project_context_contains_id_field(self, mock_agent, mock_file_service):
        """Test that project_context includes 'id' field when passed to process_message."""
        
        # Mock the _load_comprehensive_context method to capture the project_context
        captured_project_context = None
        
        async def mock_load_comprehensive_context(message, project_id, session_id, conversation_history, project_context, task_context=None):
            nonlocal captured_project_context
            captured_project_context = project_context
            # Return a mock conversation context
            from services.unified_samurai_agent import ConversationContext
            return ConversationContext(
                session_messages=[],
                conversation_summary="",
                relevant_memories=[],
                project_context=project_context,
                session_id=session_id
            )
        
        mock_agent._load_comprehensive_context = mock_load_comprehensive_context
        
        # Call process_message with a project_id
        project_id = "test-project-id"
        project_context = {
            "id": project_id,  # This should now be included
            "name": "Test Project",
            "description": "Test Description",
            "tech_stack": ["Python", "FastAPI"],
            "project_detail": "Test project detail",
            "codebase_path": "/test/path"
        }
        
        await mock_agent.process_message(
            message="What is the main function?",
            project_id=project_id,
            project_context=project_context,
            session_id="test-session-id",
            conversation_history=[],
            progress_callback=None
        )
        
        # Verify that the project_context contains the 'id' field
        assert captured_project_context is not None
        assert "id" in captured_project_context
        assert captured_project_context["id"] == project_id
    
    @pytest.mark.asyncio
    async def test_code_context_extraction_not_skipped(self, mock_agent):
        """Test that code context extraction is not skipped when project_id is present."""
        
        # Mock the tool registry to capture calls
        mock_agent.tool_registry.execute_tool = AsyncMock()
        
        # Create conversation context with project_context containing 'id'
        from services.unified_samurai_agent import ConversationContext
        
        conversation_context = ConversationContext(
            session_messages=[],
            conversation_summary="",
            relevant_memories=[],
            project_context={
                "id": "test-project-id",
                "codebase_path": "/test/path"
            },
            session_id="test-session-id"
        )
        
        # Call _process_individual_question directly
        result = await mock_agent._process_individual_question(
            "What is the main function?",
            conversation_context
        )
        
        # Verify that the tool was called (not skipped)
        mock_agent.tool_registry.execute_tool.assert_called_once()
        call_args = mock_agent.tool_registry.execute_tool.call_args
        
        # Verify the correct tool was called with correct parameters
        assert call_args[0][0] == "extract_code_context"
        assert call_args[1]["project_id"] == "test-project-id"
        assert call_args[1]["session_id"] == "test-session-id"
        assert call_args[1]["connected_codebase_path"] == "/test/path"
    
    @pytest.mark.asyncio
    async def test_code_context_extraction_skipped_when_id_missing(self, mock_agent):
        """Test that code context extraction is skipped when project_id is missing."""
        
        # Mock the tool registry to capture calls
        mock_agent.tool_registry.execute_tool = AsyncMock()
        
        # Create conversation context WITHOUT 'id' in project_context
        from services.unified_samurai_agent import ConversationContext
        
        conversation_context = ConversationContext(
            session_messages=[],
            conversation_summary="",
            relevant_memories=[],
            project_context={
                "codebase_path": "/test/path"
                # Missing 'id' field
            },
            session_id="test-session-id"
        )
        
        # Call _process_individual_question directly
        result = await mock_agent._process_individual_question(
            "What is the main function?",
            conversation_context
        )
        
        # Verify that the tool was NOT called (skipped)
        mock_agent.tool_registry.execute_tool.assert_not_called()
        
        # Verify that the original question is returned (no processing)
        assert result == "What is the main function?"
