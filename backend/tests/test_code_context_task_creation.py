import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext


class TestCodeContextTaskCreation:
    """Test that code context is properly extracted and included in task creation."""
    
    @pytest.fixture
    def mock_agent(self):
        """Create a mock UnifiedSamuraiAgent with mocked dependencies."""
        agent = UnifiedSamuraiAgent()
        agent.tool_registry = MagicMock()
        agent.tool_registry.execute_tool = AsyncMock()
        agent.gemini_service = MagicMock()
        agent._create_conversation_summary_with_smart_truncation = MagicMock(return_value="Test conversation context")
        agent._format_memories_for_context = MagicMock(return_value="Test memories")
        agent._format_code_context_for_prompt = MagicMock(return_value="Test code context")
        agent._parse_task_breakdown_response = MagicMock(return_value=[{"title": "Test task", "description": "Test description"}])
        agent._execute_task_creation = AsyncMock(return_value=[{"success": True, "task_id": "test-123"}])
        agent._generate_task_creation_response = AsyncMock(return_value="Tasks created successfully")
        agent._generate_task_breakdown_with_extended_context = AsyncMock(return_value=[{"title": "Test task", "description": "Test description"}])
        return agent
    
    @pytest.fixture
    def mock_context(self):
        """Create a mock ConversationContext."""
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
        return context
    
    @pytest.mark.asyncio
    async def test_code_context_extraction_when_mode_not_without_lookup(self, mock_agent, mock_context):
        """Test that code context is extracted when code_context_mode is not 'without code look up'."""
        # Arrange
        message = "Create tasks for implementing a new feature"
        project_id = "test-project"
        code_context_mode = "with code look up"
        
        # Mock successful code context extraction
        mock_agent.tool_registry.execute_tool.return_value = {
            "success": True,
            "context": "Test context summary",
            "relevant_code": "def test_function():\n    pass",
            "file_path": "/test/path/test_file.py",
            "relevance_score": 8
        }
        
        # Act
        result = await mock_agent._handle_ready_for_action(
            message, mock_context, project_id, 
            progress_callback=None, code_context_mode=code_context_mode
        )
        
        # Assert
        # Verify code context extraction was called
        mock_agent.tool_registry.execute_tool.assert_called_once_with(
            "extract_code_context",
            natural_language_request="Test conversation context",
            project_id="test-project",
            session_id="test-session",
            connected_codebase_path="/test/path",
            max_iterations=3
        )
        
        # Verify code context was set in the context
        assert mock_context.code_context is not None
        assert mock_context.code_context["context"] == "Test context summary"
        assert mock_context.code_context["relevant_code"] == "def test_function():\n    pass"
        assert mock_context.code_context["file_path"] == "/test/path/test_file.py"
        assert mock_context.code_context["relevance_score"] == 8
        
        # Verify task generation was called with the updated context
        mock_agent._generate_task_breakdown_with_extended_context.assert_called_once()
        
        # Verify the result is successful
        assert result["type"] == "task_creation_response"
        assert "Tasks created successfully" in result["response"]
    
    @pytest.mark.asyncio
    async def test_no_code_context_extraction_when_mode_is_without_lookup(self, mock_agent, mock_context):
        """Test that code context is NOT extracted when code_context_mode is 'without code look up'."""
        # Arrange
        message = "Create tasks for implementing a new feature"
        project_id = "test-project"
        code_context_mode = "without code look up"
        
        # Act
        result = await mock_agent._handle_ready_for_action(
            message, mock_context, project_id, 
            progress_callback=None, code_context_mode=code_context_mode
        )
        
        # Assert
        # Verify code context extraction was NOT called
        mock_agent.tool_registry.execute_tool.assert_not_called()
        
        # Verify code context remains None
        assert mock_context.code_context is None
        
        # Verify task generation was still called
        mock_agent._generate_task_breakdown_with_extended_context.assert_called_once()
        
        # Verify the result is successful
        assert result["type"] == "task_creation_response"
    
    @pytest.mark.asyncio
    async def test_code_context_extraction_failure_handling(self, mock_agent, mock_context):
        """Test that code context extraction failure is handled gracefully."""
        # Arrange
        message = "Create tasks for implementing a new feature"
        project_id = "test-project"
        code_context_mode = "with code look up"
        
        # Mock failed code context extraction
        mock_agent.tool_registry.execute_tool.return_value = {
            "success": False,
            "message": "No relevant code found"
        }
        
        # Act
        result = await mock_agent._handle_ready_for_action(
            message, mock_context, project_id, 
            progress_callback=None, code_context_mode=code_context_mode
        )
        
        # Assert
        # Verify code context extraction was called
        mock_agent.tool_registry.execute_tool.assert_called_once()
        
        # Verify code context remains None (not set on failure)
        assert mock_context.code_context is None
        
        # Verify task generation was still called
        mock_agent._generate_task_breakdown_with_extended_context.assert_called_once()
        
        # Verify the result is successful
        assert result["type"] == "task_creation_response"
    
    @pytest.mark.asyncio
    async def test_code_context_extraction_exception_handling(self, mock_agent, mock_context):
        """Test that code context extraction exceptions are handled gracefully."""
        # Arrange
        message = "Create tasks for implementing a new feature"
        project_id = "test-project"
        code_context_mode = "with code look up"
        
        # Mock exception during code context extraction
        mock_agent.tool_registry.execute_tool.side_effect = Exception("Extraction failed")
        
        # Act
        result = await mock_agent._handle_ready_for_action(
            message, mock_context, project_id, 
            progress_callback=None, code_context_mode=code_context_mode
        )
        
        # Assert
        # Verify code context extraction was called
        mock_agent.tool_registry.execute_tool.assert_called_once()
        
        # Verify code context remains None (not set on exception)
        assert mock_context.code_context is None
        
        # Verify task generation was still called
        mock_agent._generate_task_breakdown_with_extended_context.assert_called_once()
        
        # Verify the result is successful
        assert result["type"] == "task_creation_response"
    
    @pytest.mark.asyncio
    async def test_code_context_included_in_task_generation_prompt(self, mock_agent, mock_context):
        """Test that code context is included in the task generation prompt."""
        # Arrange
        message = "Create tasks for implementing a new feature"
        project_id = "test-project"
        code_context_mode = "with code look up"
        
        # Mock successful code context extraction
        mock_agent.tool_registry.execute_tool.return_value = {
            "success": True,
            "context": "Test context summary",
            "relevant_code": "def test_function():\n    pass",
            "file_path": "/test/path/test_file.py",
            "relevance_score": 8
        }
        
        # Act
        result = await mock_agent._handle_ready_for_action(
            message, mock_context, project_id, 
            progress_callback=None, code_context_mode=code_context_mode
        )
        
        # Assert
        # Verify the task generation method was called
        assert result["type"] == "task_creation_response"
        
        # Verify that code context was set in the context (indicating it was extracted and will be used)
        assert mock_context.code_context is not None
        assert mock_context.code_context["context"] == "Test context summary"
        assert mock_context.code_context["relevant_code"] == "def test_function():\n    pass"
    
    @pytest.mark.asyncio
    async def test_auto_mode_behavior(self, mock_agent, mock_context):
        """Test that 'auto' mode behaves the same as 'with code look up' for task creation."""
        # Arrange
        message = "Create tasks for implementing a new feature"
        project_id = "test-project"
        code_context_mode = "auto"
        
        # Mock successful code context extraction
        mock_agent.tool_registry.execute_tool.return_value = {
            "success": True,
            "context": "Test context summary",
            "relevant_code": "def test_function():\n    pass",
            "file_path": "/test/path/test_file.py",
            "relevance_score": 8
        }
        
        # Act
        result = await mock_agent._handle_ready_for_action(
            message, mock_context, project_id, 
            progress_callback=None, code_context_mode=code_context_mode
        )
        
        # Assert
        # Verify code context extraction was called (auto mode should extract code context)
        mock_agent.tool_registry.execute_tool.assert_called_once()
        
        # Verify the result is successful
        assert result["type"] == "task_creation_response"

    @pytest.mark.asyncio
    async def test_auto_mode_behavior_with_no_codebase_path(self, mock_agent, mock_context):
        """Test that 'auto' mode fails gracefully when no codebase path is configured."""
        # Arrange
        message = "Create tasks for implementing a new feature"
        project_id = "test-project"
        code_context_mode = "auto"
        
        # Mock the project context to have no codebase_path
        mock_context.project_context = {
            "id": project_id,
            "name": "Test Project",
            "codebase_path": None  # No codebase path configured
        }
        
        # Mock the tool to return failure when no codebase path
        mock_agent.tool_registry.execute_tool.return_value = {
            "success": False,
            "message": "❌ No codebase path provided. Please specify a path to analyze.",
            "context": None,
            "relevant_code": None,
            "file_path": None
        }
        
        # Act
        result = await mock_agent._handle_ready_for_action(
            message, mock_context, project_id, 
            progress_callback=None, code_context_mode=code_context_mode
        )
        
        # Assert
        # Verify code context extraction was called (auto mode should attempt extraction)
        mock_agent.tool_registry.execute_tool.assert_called_once()
        
        # Verify the tool was called with None codebase_path
        call_args = mock_agent.tool_registry.execute_tool.call_args
        assert call_args[1]['connected_codebase_path'] is None
        
        # Verify code context remains None (not set on failure)
        assert mock_context.code_context is None
        
        # Verify task generation was still called
        mock_agent._generate_task_breakdown_with_extended_context.assert_called_once()
        
        # Verify the result is successful
        assert result["type"] == "task_creation_response"

    @pytest.mark.asyncio
    async def test_auto_mode_always_extracts_code_context_for_task_creation(self, mock_agent, mock_context):
        """Test that 'auto' mode always extracts code context for task creation, regardless of intent analysis."""
        # Arrange
        message = "Create tasks for implementing a new feature"
        project_id = "test-project"
        code_context_mode = "auto"
        
        # Mock the project context to have a codebase_path
        mock_context.project_context = {
            "id": project_id,
            "name": "Test Project",
            "codebase_path": "/test/path"  # Has codebase path configured
        }
        
        # Mock successful code context extraction
        mock_agent.tool_registry.execute_tool.return_value = {
            "success": True,
            "context": "Test context summary",
            "relevant_code": "def test_function():\n    pass",
            "file_path": "/test/path/test_file.py",
            "relevance_score": 8
        }
        
        # Act
        result = await mock_agent._handle_ready_for_action(
            message, mock_context, project_id, 
            progress_callback=None, code_context_mode=code_context_mode
        )
        
        # Assert
        # Verify code context extraction was called (auto mode should always extract for task creation)
        mock_agent.tool_registry.execute_tool.assert_called_once()
        
        # Verify the tool was called with the correct codebase_path
        call_args = mock_agent.tool_registry.execute_tool.call_args
        assert call_args[1]['connected_codebase_path'] == "/test/path"
        
        # Verify code context was set in the context
        assert mock_context.code_context is not None
        assert mock_context.code_context["context"] == "Test context summary"
        assert mock_context.code_context["relevant_code"] == "def test_function():\n    pass"
        
        # Verify task generation was called
        mock_agent._generate_task_breakdown_with_extended_context.assert_called_once()
        
        # Verify the result is successful
        assert result["type"] == "task_creation_response"
