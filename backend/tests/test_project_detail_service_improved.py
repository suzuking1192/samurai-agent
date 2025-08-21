import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from services.project_detail_service import ProjectDetailService
from services.file_service import file_service


class TestProjectDetailServiceImproved:
    """Test suite for the improved project detail service with sophisticated merge logic."""

    @pytest.fixture
    def project_detail_service(self):
        """Create a ProjectDetailService instance with mocked Gemini service."""
        mock_gemini = AsyncMock()
        return ProjectDetailService(gemini_service=mock_gemini)

    @pytest.fixture
    def mock_file_service(self):
        """Mock file service for testing."""
        with patch('services.project_detail_service.file_service') as mock_fs:
            yield mock_fs

    @pytest.mark.asyncio
    async def test_ingest_project_detail_loads_existing_content(self, project_detail_service, mock_file_service):
        """Test that ingest_project_detail loads existing project_detail content."""
        # Arrange
        project_id = "test-project-123"
        existing_content = "# Project Overview\nThis is an existing project detail"
        new_insights = "The project now uses TypeScript instead of JavaScript"
        
        mock_file_service.load_project_detail.return_value = existing_content
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value="Merged content")

        # Act
        result = await project_detail_service.ingest_project_detail(project_id, new_insights)

        # Assert
        mock_file_service.load_project_detail.assert_called_once_with(project_id)
        assert result == "Merged content"

    @pytest.mark.asyncio
    async def test_ingest_project_detail_handles_empty_existing_content(self, project_detail_service, mock_file_service):
        """Test that ingest_project_detail handles empty existing content gracefully."""
        # Arrange
        project_id = "test-project-123"
        new_insights = "This is a new project with TypeScript and React"
        
        mock_file_service.load_project_detail.return_value = ""
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value="New project detail")

        # Act
        result = await project_detail_service.ingest_project_detail(project_id, new_insights)

        # Assert
        mock_file_service.load_project_detail.assert_called_once_with(project_id)
        assert result == "New project detail"

    @pytest.mark.asyncio
    async def test_ingest_project_detail_handles_none_existing_content(self, project_detail_service, mock_file_service):
        """Test that ingest_project_detail handles None existing content gracefully."""
        # Arrange
        project_id = "test-project-123"
        new_insights = "This is a new project with TypeScript and React"
        
        mock_file_service.load_project_detail.return_value = None
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value="New project detail")

        # Act
        result = await project_detail_service.ingest_project_detail(project_id, new_insights)

        # Assert
        mock_file_service.load_project_detail.assert_called_once_with(project_id)
        assert result == "New project detail"

    @pytest.mark.asyncio
    async def test_ingest_project_detail_uses_merge_prompt_when_existing_content(self, project_detail_service, mock_file_service):
        """Test that merge prompt is used when existing content is present."""
        # Arrange
        project_id = "test-project-123"
        existing_content = "# Project Overview\nExisting project details"
        new_insights = "New insights about the project"
        
        mock_file_service.load_project_detail.return_value = existing_content
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value="Merged content")

        # Act
        await project_detail_service.ingest_project_detail(project_id, new_insights, mode="merge")

        # Assert
        call_args = project_detail_service.gemini.chat_with_system_prompt.call_args
        assert call_args is not None
        assert "Perform sophisticated merge of existing project detail with new insights" in call_args[0][0]
        assert "EXISTING PROJECT DETAIL:" in call_args[0][1]
        assert "NEW INSIGHTS TO MERGE:" in call_args[0][1]

    @pytest.mark.asyncio
    async def test_ingest_project_detail_uses_synthesis_prompt_when_no_existing_content(self, project_detail_service, mock_file_service):
        """Test that synthesis prompt is used when no existing content is present."""
        # Arrange
        project_id = "test-project-123"
        new_insights = "New project insights"
        
        mock_file_service.load_project_detail.return_value = ""
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value="New project detail")

        # Act
        await project_detail_service.ingest_project_detail(project_id, new_insights, mode="merge")

        # Assert
        call_args = project_detail_service.gemini.chat_with_system_prompt.call_args
        assert call_args is not None
        assert "Create new project detail from insights" in call_args[0][0]
        assert "NEW INSIGHTS:" in call_args[0][1]

    @pytest.mark.asyncio
    async def test_ingest_project_detail_uses_replace_mode(self, project_detail_service, mock_file_service):
        """Test that replace mode uses synthesis prompt regardless of existing content."""
        # Arrange
        project_id = "test-project-123"
        existing_content = "# Project Overview\nExisting project details"
        new_insights = "New insights about the project"
        
        mock_file_service.load_project_detail.return_value = existing_content
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value="Replaced content")

        # Act
        await project_detail_service.ingest_project_detail(project_id, new_insights, mode="replace")

        # Assert
        call_args = project_detail_service.gemini.chat_with_system_prompt.call_args
        assert call_args is not None
        assert "Create new project detail from insights" in call_args[0][0]
        assert "NEW INSIGHTS:" in call_args[0][1]

    @pytest.mark.asyncio
    async def test_ingest_project_detail_handles_empty_raw_text(self, project_detail_service, mock_file_service):
        """Test that ingest_project_detail returns empty string for empty raw_text."""
        # Arrange
        project_id = "test-project-123"
        empty_text = ""
        
        # Act
        result = await project_detail_service.ingest_project_detail(project_id, empty_text)

        # Assert
        assert result == ""
        mock_file_service.load_project_detail.assert_not_called()
        project_detail_service.gemini.chat_with_system_prompt.assert_not_called()

    @pytest.mark.asyncio
    async def test_ingest_project_detail_handles_whitespace_only_raw_text(self, project_detail_service, mock_file_service):
        """Test that ingest_project_detail returns empty string for whitespace-only raw_text."""
        # Arrange
        project_id = "test-project-123"
        whitespace_text = "   \n\t   "
        
        # Act
        result = await project_detail_service.ingest_project_detail(project_id, whitespace_text)

        # Assert
        assert result == ""
        mock_file_service.load_project_detail.assert_not_called()
        project_detail_service.gemini.chat_with_system_prompt.assert_not_called()

    @pytest.mark.asyncio
    async def test_ingest_project_detail_saves_result(self, project_detail_service, mock_file_service):
        """Test that ingest_project_detail saves the result to file."""
        # Arrange
        project_id = "test-project-123"
        existing_content = "# Project Overview\nExisting project details"
        new_insights = "New insights about the project"
        merged_content = "# Project Overview\nUpdated project details"
        
        mock_file_service.load_project_detail.return_value = existing_content
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value=merged_content)

        # Act
        result = await project_detail_service.ingest_project_detail(project_id, new_insights)

        # Assert
        mock_file_service.save_project_detail.assert_called_once_with(project_id, merged_content)
        assert result == merged_content

    @pytest.mark.asyncio
    async def test_ingest_project_detail_handles_none_gemini_response(self, project_detail_service, mock_file_service):
        """Test that ingest_project_detail handles None response from Gemini gracefully."""
        # Arrange
        project_id = "test-project-123"
        existing_content = "# Project Overview\nExisting project details"
        new_insights = "New insights about the project"
        
        mock_file_service.load_project_detail.return_value = existing_content
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value=None)

        # Act
        result = await project_detail_service.ingest_project_detail(project_id, new_insights)

        # Assert
        mock_file_service.save_project_detail.assert_called_once_with(project_id, "")
        assert result == ""

    @pytest.mark.asyncio
    async def test_ingest_project_detail_handles_empty_gemini_response(self, project_detail_service, mock_file_service):
        """Test that ingest_project_detail handles empty response from Gemini gracefully."""
        # Arrange
        project_id = "test-project-123"
        existing_content = "# Project Overview\nExisting project details"
        new_insights = "New insights about the project"
        
        mock_file_service.load_project_detail.return_value = existing_content
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value="")

        # Act
        result = await project_detail_service.ingest_project_detail(project_id, new_insights)

        # Assert
        mock_file_service.save_project_detail.assert_called_once_with(project_id, "")
        assert result == ""

    @pytest.mark.asyncio
    async def test_ingest_project_detail_handles_whitespace_gemini_response(self, project_detail_service, mock_file_service):
        """Test that ingest_project_detail handles whitespace-only response from Gemini gracefully."""
        # Arrange
        project_id = "test-project-123"
        existing_content = "# Project Overview\nExisting project details"
        new_insights = "New insights about the project"
        
        mock_file_service.load_project_detail.return_value = existing_content
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value="   \n\t   ")

        # Act
        result = await project_detail_service.ingest_project_detail(project_id, new_insights)

        # Assert
        mock_file_service.save_project_detail.assert_called_once_with(project_id, "")
        assert result == ""

    def test_build_merge_system_prompt_contains_critical_rules(self, project_detail_service):
        """Test that the merge system prompt contains all critical merge rules."""
        # Act
        prompt = project_detail_service._build_merge_system_prompt()

        # Assert
        assert "PRESERVATION-FIRST POLICY" in prompt
        assert "GRANULAR CONTRADICTION HANDLING" in prompt
        assert "HEADING MANAGEMENT" in prompt
        assert "CONTENT ORGANIZATION" in prompt
        assert "FORMATTING REQUIREMENTS" in prompt
        assert "COMPLETENESS REQUIREMENTS" in prompt
        assert "EXAMPLES OF CORRECT MERGE BEHAVIOR" in prompt

    def test_build_merge_system_prompt_contains_examples(self, project_detail_service):
        """Test that the merge system prompt contains specific examples."""
        # Act
        prompt = project_detail_service._build_merge_system_prompt()

        # Assert
        assert "Auth uses JWT" in prompt
        assert "stopped using python and now using typescript" in prompt
        assert "Users can upload profile pictures" in prompt

    def test_build_merge_input_structures_content_correctly(self, project_detail_service):
        """Test that the merge input is structured correctly with both existing and new content."""
        # Arrange
        existing_content = "# Project Overview\nExisting details"
        new_insights = "New insights to add"

        # Act
        merge_input = project_detail_service._build_merge_input(existing_content, new_insights)

        # Assert
        assert "EXISTING PROJECT DETAIL:" in merge_input
        assert "NEW INSIGHTS TO MERGE:" in merge_input
        assert existing_content in merge_input
        assert new_insights in merge_input
        assert "INSTRUCTIONS:" in merge_input

    def test_build_synthesis_system_prompt_contains_constraints(self, project_detail_service):
        """Test that the synthesis system prompt contains hard constraints."""
        # Act
        prompt = project_detail_service._build_synthesis_system_prompt()

        # Assert
        assert "HARD CONSTRAINTS:" in prompt
        assert "Extract ONLY facts explicitly present" in prompt
        assert "do NOT fabricate or infer details" in prompt
        assert "ORGANIZE INTO THESE SECTIONS:" in prompt
        assert "FORMATTING:" in prompt


if __name__ == "__main__":
    pytest.main([__file__])
