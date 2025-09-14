import pytest
import json
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch, MagicMock
from services.project_settings_service import ProjectSettingsService
from backend.services.agent_core.unified_samurai_agent import UnifiedSamuraiAgent
from models import CodeContextMode, ChatRequest

class TestProjectSettingsService:
    """Test the ProjectSettingsService for mode selection persistence."""
    
    @pytest.fixture
    def temp_data_dir(self):
        """Create a temporary data directory for testing."""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)
    
    @pytest.fixture
    def settings_service(self, temp_data_dir):
        """Create a ProjectSettingsService instance with temporary data directory."""
        return ProjectSettingsService(data_dir=temp_data_dir)
    
    def test_get_code_context_mode_default(self, settings_service):
        """Test that get_code_context_mode returns AUTO when no settings file exists."""
        project_id = "test-project-123"
        mode = settings_service.get_code_context_mode(project_id)
        assert mode == CodeContextMode.AUTO
    
    def test_set_and_get_code_context_mode(self, settings_service):
        """Test setting and retrieving code context mode."""
        project_id = "test-project-123"
        
        # Set mode to WITH_CODE_LOOKUP
        success = settings_service.set_code_context_mode(project_id, CodeContextMode.WITH_CODE_LOOKUP)
        assert success is True
        
        # Retrieve the mode
        mode = settings_service.get_code_context_mode(project_id)
        assert mode == CodeContextMode.WITH_CODE_LOOKUP
    
    def test_set_and_get_all_modes(self, settings_service):
        """Test all three modes can be set and retrieved correctly."""
        project_id = "test-project-123"
        
        modes = [
            CodeContextMode.AUTO,
            CodeContextMode.WITH_CODE_LOOKUP,
            CodeContextMode.WITHOUT_CODE_LOOKUP
        ]
        
        for mode in modes:
            success = settings_service.set_code_context_mode(project_id, mode)
            assert success is True
            
            retrieved_mode = settings_service.get_code_context_mode(project_id)
            assert retrieved_mode == mode
    
    def test_get_all_settings(self, settings_service):
        """Test get_all_settings returns the correct structure."""
        project_id = "test-project-123"
        
        # Set a mode
        settings_service.set_code_context_mode(project_id, CodeContextMode.WITH_CODE_LOOKUP)
        
        # Get all settings
        settings = settings_service.get_all_settings(project_id)
        assert "code_context_mode" in settings
        assert settings["code_context_mode"] == CodeContextMode.WITH_CODE_LOOKUP.value
    
    def test_get_all_settings_default(self, settings_service):
        """Test get_all_settings returns default when no file exists."""
        project_id = "test-project-123"
        
        settings = settings_service.get_all_settings(project_id)
        assert "code_context_mode" in settings
        assert settings["code_context_mode"] == CodeContextMode.AUTO.value
    
    def test_delete_project_settings(self, settings_service):
        """Test deleting project settings."""
        project_id = "test-project-123"
        
        # Set a mode first
        settings_service.set_code_context_mode(project_id, CodeContextMode.WITH_CODE_LOOKUP)
        
        # Verify it was set
        mode = settings_service.get_code_context_mode(project_id)
        assert mode == CodeContextMode.WITH_CODE_LOOKUP
        
        # Delete settings
        success = settings_service.delete_project_settings(project_id)
        assert success is True
        
        # Verify it defaults back to AUTO
        mode = settings_service.get_code_context_mode(project_id)
        assert mode == CodeContextMode.AUTO
    
    def test_invalid_mode_handling(self, settings_service):
        """Test handling of invalid mode values in settings file."""
        project_id = "test-project-123"
        
        # Create a settings file with invalid mode
        settings_file = settings_service._get_settings_file_path(project_id)
        settings_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(settings_file, 'w') as f:
            json.dump({"code_context_mode": "invalid_mode"}, f)
        
        # Should default to AUTO
        mode = settings_service.get_code_context_mode(project_id)
        assert mode == CodeContextMode.AUTO
    
    def test_corrupted_settings_file(self, settings_service):
        """Test handling of corrupted settings file."""
        project_id = "test-project-123"
        
        # Create a corrupted settings file
        settings_file = settings_service._get_settings_file_path(project_id)
        settings_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(settings_file, 'w') as f:
            f.write("invalid json content")
        
        # Should default to AUTO
        mode = settings_service.get_code_context_mode(project_id)
        assert mode == CodeContextMode.AUTO



class TestUnifiedSamuraiAgentModeIntegration:
    """Test the UnifiedSamuraiAgent integration with mode selection."""
    
    @pytest.fixture
    def agent(self):
        """Create a UnifiedSamuraiAgent instance for testing."""
        return UnifiedSamuraiAgent()
    
    @pytest.fixture
    def mock_context(self):
        """Create a mock conversation context."""
        return MagicMock(
            session_messages=[],
            conversation_summary="Test conversation",
            relevant_memories=[],
            project_context={"name": "Test Project", "tech_stack": "Python"},
            task_context=None,
            code_context=None
        )
    
    @pytest.mark.asyncio
    @patch.object(UnifiedSamuraiAgent, '_analyze_user_intent')
    @patch.object(UnifiedSamuraiAgent, '_load_comprehensive_context')
    @patch.object(UnifiedSamuraiAgent, '_select_and_execute_response_path')
    async def test_process_message_with_auto_mode(self, mock_execute, mock_load_context, mock_analyze_intent, agent, mock_context):
        """Test process_message with AUTO mode."""
        # Mock dependencies
        mock_load_context.return_value = mock_context
        mock_analyze_intent.return_value = MagicMock(
            intent_type="pure_discussion",
            confidence=0.8,
            reasoning="Test reasoning",
            needs_clarification=False,
            clarification_questions=[],
            accumulated_specs={},
            new_code_context_necessary=False,
            code_context_request=None
        )
        mock_execute.return_value = {
            "type": "pure_discussion",
            "response": "Test response",
            "tool_calls_made": 0,
            "tool_results": [],
            "context_used": {}
        }
        
        # Test with AUTO mode
        result = await agent.process_message(
            message="Test message",
            project_id="test-project",
            project_context={"name": "Test Project"},
            session_id="test-session",
            conversation_history=[],
            code_context_mode="auto"
        )
        
        # Verify the mode was passed to the response path
        mock_execute.assert_called_once()
        call_args = mock_execute.call_args
        # Check that code_context_mode is passed as the last positional argument
        assert call_args[0][-1] == "auto"
    
    @pytest.mark.asyncio
    @patch.object(UnifiedSamuraiAgent, '_analyze_user_intent')
    @patch.object(UnifiedSamuraiAgent, '_load_comprehensive_context')
    @patch.object(UnifiedSamuraiAgent, '_select_and_execute_response_path')
    async def test_process_message_with_with_code_lookup_mode(self, mock_execute, mock_load_context, mock_analyze_intent, agent, mock_context):
        """Test process_message with WITH_CODE_LOOKUP mode."""
        # Mock dependencies
        mock_load_context.return_value = mock_context
        mock_analyze_intent.return_value = MagicMock(
            intent_type="pure_discussion",
            confidence=0.8,
            reasoning="Test reasoning",
            needs_clarification=False,
            clarification_questions=[],
            accumulated_specs={},
            new_code_context_necessary=False,
            code_context_request=None
        )
        mock_execute.return_value = {
            "type": "pure_discussion",
            "response": "Test response",
            "tool_calls_made": 0,
            "tool_results": [],
            "context_used": {}
        }
        
        # Test with WITH_CODE_LOOKUP mode
        result = await agent.process_message(
            message="Test message",
            project_id="test-project",
            project_context={"name": "Test Project"},
            session_id="test-session",
            conversation_history=[],
            code_context_mode="with code look up"
        )
        
        # Verify the mode was passed to the response path
        mock_execute.assert_called_once()
        call_args = mock_execute.call_args
        # Check that code_context_mode is passed as the last positional argument
        assert call_args[0][-1] == "with code look up"
    
    @pytest.mark.asyncio
    @patch.object(UnifiedSamuraiAgent, '_analyze_user_intent')
    @patch.object(UnifiedSamuraiAgent, '_load_comprehensive_context')
    @patch.object(UnifiedSamuraiAgent, '_select_and_execute_response_path')
    async def test_process_message_with_without_code_lookup_mode(self, mock_execute, mock_load_context, mock_analyze_intent, agent, mock_context):
        """Test process_message with WITHOUT_CODE_LOOKUP mode."""
        # Mock dependencies
        mock_load_context.return_value = mock_context
        mock_analyze_intent.return_value = MagicMock(
            intent_type="pure_discussion",
            confidence=0.8,
            reasoning="Test reasoning",
            needs_clarification=False,
            clarification_questions=[],
            accumulated_specs={},
            new_code_context_necessary=False,
            code_context_request=None
        )
        mock_execute.return_value = {
            "type": "pure_discussion",
            "response": "Test response",
            "tool_calls_made": 0,
            "tool_results": [],
            "context_used": {}
        }
        
        # Test with WITHOUT_CODE_LOOKUP mode
        result = await agent.process_message(
            message="Test message",
            project_id="test-project",
            project_context={"name": "Test Project"},
            session_id="test-session",
            conversation_history=[],
            code_context_mode="without code look up"
        )
        
        # Verify the mode was passed to the response path
        mock_execute.assert_called_once()
        call_args = mock_execute.call_args
        # Check that code_context_mode is passed as the last positional argument
        assert call_args[0][-1] == "without code look up"

class TestChatRequestModel:
    """Test the ChatRequest model with code_context_mode field."""
    
    def test_chat_request_with_code_context_mode(self):
        """Test ChatRequest with code_context_mode field."""
        request = ChatRequest(
            message="Test message",
            task_context_id="task-123",
            code_context_mode=CodeContextMode.WITH_CODE_LOOKUP
        )
        
        assert request.message == "Test message"
        assert request.task_context_id == "task-123"
        assert request.code_context_mode == CodeContextMode.WITH_CODE_LOOKUP
    
    def test_chat_request_default_code_context_mode(self):
        """Test ChatRequest defaults to AUTO mode when not specified."""
        request = ChatRequest(message="Test message")
        
        assert request.message == "Test message"
        assert request.code_context_mode == CodeContextMode.AUTO
    
    def test_chat_request_validation(self):
        """Test ChatRequest validation with invalid mode."""
        with pytest.raises(ValueError):
            ChatRequest(
                message="Test message",
                code_context_mode="invalid_mode"
            )
