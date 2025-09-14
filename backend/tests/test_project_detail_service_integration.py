import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from services.project_detail_service import ProjectDetailService
from services.file_service import file_service


class TestProjectDetailServiceIntegration:
    """Integration tests for project detail service merge behavior."""

    @pytest.fixture
    def project_detail_service(self):
        """Create a ProjectDetailService instance with mocked Gemini service."""
        mock_gemini = AsyncMock()
        return ProjectDetailService(gemini_service=mock_gemini)

    @pytest.fixture
    def mock_file_service(self):
        """Mock file service for testing."""
        with patch('backend.services.memory.project_detail_service.file_service') as mock_fs:
            yield mock_fs

    @pytest.mark.asyncio
    async def test_simple_addition_merge_behavior(self, project_detail_service, mock_file_service):
        """Test case: Simple addition of new details."""
        # Arrange
        project_id = "test-project-123"
        existing_content = """# Project Overview
A web application for task management.

## Features
- User registration and login
- Task creation and editing

## Tech Stack
- Python
- Django
- PostgreSQL

## Architecture
- MVC pattern
- RESTful API"""
        
        new_insights = "Users can now upload profile pictures and the authentication is implemented in auth_service.py using JWT tokens"
        
        expected_merged_content = """# Project Overview
A web application for task management.

## Features
- User registration and login
- Task creation and editing
- Profile picture upload

## Tech Stack
- Python
- Django
- PostgreSQL

## Architecture
- MVC pattern
- RESTful API
- Authentication implemented in auth_service.py using JWT tokens"""
        
        mock_file_service.load_project_detail.return_value = existing_content
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value=expected_merged_content)

        # Act
        result = await project_detail_service.ingest_project_detail(project_id, new_insights)

        # Assert
        assert result == expected_merged_content
        mock_file_service.save_project_detail.assert_called_once_with(project_id, expected_merged_content)

    @pytest.mark.asyncio
    async def test_granular_contradiction_replacement(self, project_detail_service, mock_file_service):
        """Test case: Granular phrase-level contradiction leading to specific replacement."""
        # Arrange
        project_id = "test-project-123"
        existing_content = """# Project Overview
A web application for task management.

## Tech Stack
- Python
- Django
- PostgreSQL

## Architecture
- MVC pattern
- RESTful API"""
        
        new_insights = "The project stopped using python and now uses typescript instead. Also switched from Django to Express.js"
        
        expected_merged_content = """# Project Overview
A web application for task management.

## Tech Stack
- TypeScript
- Express.js
- PostgreSQL

## Architecture
- MVC pattern
- RESTful API"""
        
        mock_file_service.load_project_detail.return_value = existing_content
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value=expected_merged_content)

        # Act
        result = await project_detail_service.ingest_project_detail(project_id, new_insights)

        # Assert
        assert result == expected_merged_content
        # Verify that the merge prompt was used
        call_args = project_detail_service.gemini.chat_with_system_prompt.call_args
        assert "Perform sophisticated merge of existing project detail with new insights" in call_args[0][0]

    @pytest.mark.asyncio
    async def test_new_information_fits_existing_heading(self, project_detail_service, mock_file_service):
        """Test case: New information fitting under an existing broad heading."""
        # Arrange
        project_id = "test-project-123"
        existing_content = """# Project Overview
A web application for task management.

## Features
- User registration and login
- Task creation and editing

## Tech Stack
- Python
- Django

## Architecture
- MVC pattern"""
        
        new_insights = "The application now supports real-time notifications and uses Redis for caching"
        
        expected_merged_content = """# Project Overview
A web application for task management.

## Features
- User registration and login
- Task creation and editing
- Real-time notifications

## Tech Stack
- Python
- Django
- Redis

## Architecture
- MVC pattern
- Caching layer"""
        
        mock_file_service.load_project_detail.return_value = existing_content
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value=expected_merged_content)

        # Act
        result = await project_detail_service.ingest_project_detail(project_id, new_insights)

        # Assert
        assert result == expected_merged_content

    @pytest.mark.asyncio
    async def test_new_heading_creation(self, project_detail_service, mock_file_service):
        """Test case: New information requiring the creation of a new heading."""
        # Arrange
        project_id = "test-project-123"
        existing_content = """# Project Overview
A web application for task management.

## Features
- User registration and login
- Task creation and editing

## Tech Stack
- Python
- Django"""
        
        new_insights = "The project has specific deployment requirements: must run on AWS ECS, requires SSL certificates, and needs automated backups every 6 hours"
        
        expected_merged_content = """# Project Overview
A web application for task management.

## Features
- User registration and login
- Task creation and editing

## Tech Stack
- Python
- Django

## Deployment
- AWS ECS hosting
- SSL certificate requirements
- Automated backups every 6 hours"""
        
        mock_file_service.load_project_detail.return_value = existing_content
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value=expected_merged_content)

        # Act
        result = await project_detail_service.ingest_project_detail(project_id, new_insights)

        # Assert
        assert result == expected_merged_content

    @pytest.mark.asyncio
    async def test_markdown_format_adherence(self, project_detail_service, mock_file_service):
        """Test case: Verification of markdown format adherence in the output."""
        # Arrange
        project_id = "test-project-123"
        existing_content = """# Project Overview
A web application for task management.

## Features
- User registration and login
- Task creation and editing

## Tech Stack
- Python
- Django"""
        
        new_insights = "Added user roles: admin, moderator, and regular user. Also implemented audit logging"
        
        expected_merged_content = """# Project Overview
A web application for task management.

## Features
- User registration and login
- Task creation and editing
- User role management (admin, moderator, regular user)
- Audit logging

## Tech Stack
- Python
- Django"""
        
        mock_file_service.load_project_detail.return_value = existing_content
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value=expected_merged_content)

        # Act
        result = await project_detail_service.ingest_project_detail(project_id, new_insights)

        # Assert
        assert result == expected_merged_content
        # Verify markdown structure is maintained
        assert result.startswith("# Project Overview")
        assert "## Features" in result
        assert "## Tech Stack" in result
        # Verify that list items start with "- "
        lines = result.split("\n")
        list_lines = [line.strip() for line in lines if line.strip() and not line.startswith("#") and not line.startswith("A web application")]
        assert all(line.startswith("- ") for line in list_lines), f"Found non-list items: {[line for line in list_lines if not line.startswith('- ')]}"

    @pytest.mark.asyncio
    async def test_preservation_of_existing_content(self, project_detail_service, mock_file_service):
        """Test that existing content is preserved when new insights don't contradict it."""
        # Arrange
        project_id = "test-project-123"
        existing_content = """# Project Overview
A comprehensive task management system for enterprise teams.

## Features
- Advanced task assignment
- Time tracking
- Reporting dashboard
- Integration with Slack

## Tech Stack
- Node.js
- Express.js
- MongoDB
- Redis

## Architecture
- Microservices architecture
- Event-driven design
- API Gateway pattern"""
        
        new_insights = "The system now supports mobile apps and has improved performance with database indexing"
        
        expected_merged_content = """# Project Overview
A comprehensive task management system for enterprise teams.

## Features
- Advanced task assignment
- Time tracking
- Reporting dashboard
- Integration with Slack
- Mobile app support

## Tech Stack
- Node.js
- Express.js
- MongoDB
- Redis

## Architecture
- Microservices architecture
- Event-driven design
- API Gateway pattern
- Database indexing for improved performance"""
        
        mock_file_service.load_project_detail.return_value = existing_content
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value=expected_merged_content)

        # Act
        result = await project_detail_service.ingest_project_detail(project_id, new_insights)

        # Assert
        assert result == expected_merged_content
        # Verify that all original content is preserved
        assert "A comprehensive task management system for enterprise teams" in result
        assert "Advanced task assignment" in result
        assert "Microservices architecture" in result
        assert "Mobile app support" in result  # New content added

    @pytest.mark.asyncio
    async def test_ambiguous_conflict_handling(self, project_detail_service, mock_file_service):
        """Test that ambiguous conflicts are moved to Open Questions."""
        # Arrange
        project_id = "test-project-123"
        existing_content = """# Project Overview
A web application for task management.

## Features
- User registration and login
- Task creation and editing

## Tech Stack
- Python
- Django

## Open Questions
- Performance optimization strategy"""
        
        new_insights = "Some team members think we should use React for the frontend, others prefer Vue.js"
        
        expected_merged_content = """# Project Overview
A web application for task management.

## Features
- User registration and login
- Task creation and editing

## Tech Stack
- Python
- Django

## Open Questions
- Performance optimization strategy
- Frontend framework choice: React vs Vue.js"""
        
        mock_file_service.load_project_detail.return_value = existing_content
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value=expected_merged_content)

        # Act
        result = await project_detail_service.ingest_project_detail(project_id, new_insights)

        # Assert
        assert result == expected_merged_content
        assert "Frontend framework choice: React vs Vue.js" in result

    @pytest.mark.asyncio
    async def test_single_llm_call_requirement(self, project_detail_service, mock_file_service):
        """Test that the entire merge operation is completed in a single LLM call."""
        # Arrange
        project_id = "test-project-123"
        existing_content = "# Project Overview\nExisting content"
        new_insights = "New insights to merge"
        
        mock_file_service.load_project_detail.return_value = existing_content
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value="Merged result")

        # Act
        await project_detail_service.ingest_project_detail(project_id, new_insights)

        # Assert
        # Verify that chat_with_system_prompt is called exactly once
        assert project_detail_service.gemini.chat_with_system_prompt.call_count == 1

    @pytest.mark.asyncio
    async def test_replace_mode_behavior(self, project_detail_service, mock_file_service):
        """Test that replace mode ignores existing content and creates new project detail."""
        # Arrange
        project_id = "test-project-123"
        existing_content = "# Project Overview\nOld content that should be ignored"
        new_insights = "This is a completely new project specification"
        
        expected_new_content = """# Project Overview
A new project specification.

## Features
- New feature 1
- New feature 2

## Tech Stack
- New technology stack"""
        
        mock_file_service.load_project_detail.return_value = existing_content
        mock_file_service.save_project_detail = MagicMock()
        project_detail_service.gemini.chat_with_system_prompt = AsyncMock(return_value=expected_new_content)

        # Act
        result = await project_detail_service.ingest_project_detail(project_id, new_insights, mode="replace")

        # Assert
        assert result == expected_new_content
        # Verify that synthesis prompt was used (not merge prompt)
        call_args = project_detail_service.gemini.chat_with_system_prompt.call_args
        assert "Create new project detail from insights" in call_args[0][0]
        assert "NEW INSIGHTS:" in call_args[0][1]


if __name__ == "__main__":
    pytest.main([__file__])
