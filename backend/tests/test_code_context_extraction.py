"""
Tests for Code Context Extraction Feature

This module tests the code context extraction functionality including:
- Code parser utility
- Code context storage
- Code context extraction tool
- Integration with UnifiedSamuraiAgent
"""

import pytest
import asyncio
import tempfile
import os
import json
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock

# Import the modules to test
try:
    from services.code_parser import CodeParser, code_parser
    from services.code_context_storage import CodeContextStorage, code_context_storage
    from services.agent_tools import ExtractCodeContextTool
    from services.unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext, IntentAnalysis
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from code_parser import CodeParser, code_parser
    from code_context_storage import CodeContextStorage, code_context_storage
    from agent_tools import ExtractCodeContextTool
    from unified_samurai_agent import UnifiedSamuraiAgent, ConversationContext, IntentAnalysis


class TestCodeParser:
    """Test the CodeParser utility."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.parser = CodeParser()
        self.temp_dir = tempfile.mkdtemp()
    
    def teardown_method(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_detect_language(self):
        """Test language detection for various file types."""
        test_cases = [
            ("test.py", "python"),
            ("main.js", "javascript"),
            ("component.tsx", "typescript"),
            ("User.java", "java"),
            ("main.cpp", "cpp"),
            ("Program.cs", "csharp"),
            ("main.go", "go"),
            ("lib.rs", "rust"),
            ("index.php", "php"),
            ("app.rb", "ruby"),
            ("style.css", "css"),
            ("data.json", "json"),
            ("config.yaml", "yaml"),
            ("README.md", "markdown"),
            ("unknown.xyz", None),
        ]
        
        for file_path, expected_language in test_cases:
            detected = self.parser.detect_language(file_path)
            assert detected == expected_language, f"Failed for {file_path}: expected {expected_language}, got {detected}"
    
    def test_should_ignore_file(self):
        """Test file ignore patterns."""
        ignore_cases = [
            ".git/config",
            "node_modules/package.json",
            "__pycache__/module.pyc",
            ".venv/bin/python",
            ".DS_Store",
            ".idea/settings.xml",
            "dist/bundle.js",
            "build/index.html",
            "coverage/lcov.info",
        ]
        
        for file_path in ignore_cases:
            assert self.parser.should_ignore_file(file_path), f"Should ignore {file_path}"
        
        # Files that should not be ignored
        keep_cases = [
            "src/main.py",
            "app.js",
            "index.html",
            "style.css",
            "package.json",
        ]
        
        for file_path in keep_cases:
            assert not self.parser.should_ignore_file(file_path), f"Should not ignore {file_path}"
    
    def test_extract_elements_from_file(self):
        """Test code element extraction from files."""
        # Create a test Python file
        python_code = """
class TestClass:
    def __init__(self):
        pass
    
    def test_method(self):
        return True

def test_function():
    return "test"

async def async_function():
    return "async"
"""
        
        python_file = os.path.join(self.temp_dir, "test.py")
        with open(python_file, 'w') as f:
            f.write(python_code)
        
        elements = self.parser.extract_elements_from_file(python_file, "python")
        
        assert len(elements) >= 4  # Should find class and methods
        element_names = [e.name for e in elements]
        assert "TestClass" in element_names
        assert "test_method" in element_names
        assert "test_function" in element_names
        assert "async_function" in element_names
    
    def test_scan_codebase(self):
        """Test codebase scanning functionality."""
        # Create test files
        test_files = {
            "main.py": "def main():\n    pass",
            "utils.js": "function helper() {\n    return true;\n}",
            "config.json": '{"key": "value"}',
            ".gitignore": "*.pyc",
        }
        
        for filename, content in test_files.items():
            file_path = os.path.join(self.temp_dir, filename)
            with open(file_path, 'w') as f:
                f.write(content)
        
        file_infos = self.parser.scan_codebase(self.temp_dir, max_files=10)
        
        # Should find Python and JavaScript files, but not JSON or gitignore
        assert len(file_infos) >= 2
        languages = [info.language for info in file_infos.values()]
        assert "python" in languages
        assert "javascript" in languages


class TestCodeContextStorage:
    """Test the CodeContextStorage utility."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.storage = CodeContextStorage(self.temp_dir)
        self.project_id = "test_project"
        self.session_id = "test_session"
        self.test_context = {
            "context": "This is a test context",
            "relevant_code": "def test_function():\n    pass",
            "file_path": "/path/to/test.py",
            "relevance_score": 8
        }
    
    def teardown_method(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_save_and_load_code_context(self):
        """Test saving and loading code context."""
        # Save context
        success = self.storage.save_code_context(
            self.project_id, self.session_id, self.test_context
        )
        assert success
        
        # Load context
        loaded_context = self.storage.load_code_context(self.project_id, self.session_id)
        assert loaded_context is not None
        assert loaded_context["context"] == self.test_context["context"]
        assert loaded_context["relevant_code"] == self.test_context["relevant_code"]
        assert loaded_context["file_path"] == self.test_context["file_path"]
        assert loaded_context["relevance_score"] == self.test_context["relevance_score"]
    
    def test_load_nonexistent_context(self):
        """Test loading non-existent code context."""
        loaded_context = self.storage.load_code_context("nonexistent", "nonexistent")
        assert loaded_context is None
    
    def test_delete_code_context(self):
        """Test deleting code context."""
        # Save context first
        self.storage.save_code_context(self.project_id, self.session_id, self.test_context)
        
        # Delete context
        success = self.storage.delete_code_context(self.project_id, self.session_id)
        assert success
        
        # Verify it's gone
        loaded_context = self.storage.load_code_context(self.project_id, self.session_id)
        assert loaded_context is None
    
    def test_get_context_summary(self):
        """Test getting context summary."""
        # Save context first
        self.storage.save_code_context(self.project_id, self.session_id, self.test_context)
        
        # Get summary
        summary = self.storage.get_context_summary(self.project_id, self.session_id)
        assert summary is not None
        assert summary["project_id"] == self.project_id
        assert summary["session_id"] == self.session_id
        assert summary["has_context"] is True
        assert summary["has_relevant_code"] is True
        assert summary["file_path"] == self.test_context["file_path"]


class TestExtractCodeContextTool:
    """Test the ExtractCodeContextTool."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.tool = ExtractCodeContextTool()
        self.temp_dir = tempfile.mkdtemp()
        
        # Create test code files
        test_files = {
            "main.py": """
class UserService:
    def __init__(self):
        self.users = []
    
    def create_user(self, name, email):
        user = {"name": name, "email": email}
        self.users.append(user)
        return user
    
    def get_user(self, email):
        for user in self.users:
            if user["email"] == email:
                return user
        return None
""",
            "auth.py": """
def authenticate_user(email, password):
    # Authentication logic here
    return True

def generate_token(user_id):
    # Token generation logic
    return "token"
""",
            "config.json": '{"database": "sqlite", "port": 8000}'
        }
        
        for filename, content in test_files.items():
            file_path = os.path.join(self.temp_dir, filename)
            with open(file_path, 'w') as f:
                f.write(content)
    
    def teardown_method(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    @pytest.mark.asyncio
    async def test_extract_code_context_success(self):
        """Test successful code context extraction."""
        # This test verifies the tool can handle basic execution
        # The actual LLM integration would be tested in integration tests
        result = await self.tool.execute(
            natural_language_request="How do I create a user?",
            project_id="test_project",
            connected_codebase_path=self.temp_dir,
            session_id="test_session"
        )
        
        # Should at least return a result (even if no relevant files found)
        assert "success" in result
        # The result should either have a message (for failure) or context (for success)
        assert "message" in result or "context" in result
        assert "context" in result
        assert "relevant_code" in result
        assert "file_path" in result
    
    @pytest.mark.asyncio
    async def test_extract_code_context_no_files(self):
        """Test code context extraction when no relevant files are found."""
        with patch('services.gemini_service.GeminiService') as mock_gemini_class:
            mock_service = Mock()
            mock_service.generate_response = AsyncMock(return_value='[]')
            mock_gemini_class.return_value = mock_service
            
            result = await self.tool.execute(
                natural_language_request="How do I create a user?",
                project_id="test_project",
                connected_codebase_path=self.temp_dir,
                session_id="test_session"
            )
            
            assert result["success"] is False
            assert "No relevant files found" in result["message"]
    
    @pytest.mark.asyncio
    async def test_extract_code_context_invalid_path(self):
        """Test code context extraction with invalid codebase path."""
        result = await self.tool.execute(
            natural_language_request="How do I create a user?",
            project_id="test_project",
            connected_codebase_path="/nonexistent/path",
            session_id="test_session"
        )
        
        assert result["success"] is False
        assert "Codebase path not found" in result["message"]


class TestUnifiedSamuraiAgentIntegration:
    """Test integration of code context extraction with UnifiedSamuraiAgent."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.agent = UnifiedSamuraiAgent()
        self.temp_dir = tempfile.mkdtemp()
        
        # Create test project context
        self.project_context = {
            "id": "test_project",
            "name": "Test Project",
            "tech_stack": "Python, JavaScript",
            "codebase_path": self.temp_dir,
            "project_detail": "A test project for code context extraction"
        }
        
        # Create test code files to make the codebase path valid
        test_file = os.path.join(self.temp_dir, "test.py")
        with open(test_file, 'w') as f:
            f.write("def test_function():\n    pass\n")
        
        # Create test conversation context
        self.conversation_context = ConversationContext(
            session_messages=[],
            conversation_summary="Test conversation",
            relevant_memories=[],
            project_context=self.project_context,
            code_context=None
        )
    
    def teardown_method(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    @pytest.mark.asyncio
    async def test_analyze_user_intent_with_code_context_decision(self):
        """Test that intent analysis includes code context decision in the main prompt."""
        # Mock the GeminiService response with the new JSON format
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = '{"intent_type": "feature_exploration", "new_code_context_necessary": true, "code_context_request": "Find user authentication code including login/logout functions, user model, and JWT token handling"}'
            
            intent_analysis = await self.agent._analyze_user_intent(
                "How do I implement user authentication?", self.conversation_context
            )
            
            assert intent_analysis.intent_type == "feature_exploration"
            assert intent_analysis.new_code_context_necessary is True
            assert intent_analysis.code_context_request == "Find user authentication code including login/logout functions, user model, and JWT token handling"
        
        # Test case where code context is not needed
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            mock_chat.return_value = '{"intent_type": "pure_discussion", "new_code_context_necessary": false, "code_context_request": null}'
            
            intent_analysis = await self.agent._analyze_user_intent(
                "Hello, how are you?", self.conversation_context
            )
            
            assert intent_analysis.intent_type == "pure_discussion"
            assert intent_analysis.new_code_context_necessary is False
            assert intent_analysis.code_context_request is None
    
    def test_format_code_context_for_prompt(self):
        """Test formatting code context for prompts."""
        code_context = {
            "context": "User authentication service",
            "relevant_code": "def authenticate_user(email, password):",
            "file_path": "/path/to/auth.py",
            "relevance_score": 8
        }
        
        formatted = self.agent._format_code_context_for_prompt(code_context)
        
        assert "Relevant Code Found:" in formatted
        assert "File: /path/to/auth.py" in formatted
        assert "Relevance Score: 8/10" in formatted
        assert "Context Summary:" in formatted
        assert "User authentication service" in formatted
        assert "Relevant Code Snippet:" in formatted
        assert "def authenticate_user(email, password):" in formatted
    
    def test_format_code_context_for_prompt_none(self):
        """Test formatting when no code context is available."""
        formatted = self.agent._format_code_context_for_prompt(None)
        assert formatted == "No relevant code context available."
    
    @pytest.mark.asyncio
    async def test_analyze_user_intent_with_code_context(self):
        """Test intent analysis with code context extraction."""
        # Create test code files
        test_file = os.path.join(self.temp_dir, "auth.py")
        with open(test_file, 'w') as f:
            f.write("def authenticate_user(email, password):\n    return True\n")
    
        # Mock the Gemini service to avoid actual API calls
        with patch.object(self.agent.gemini_service, 'chat_with_system_prompt') as mock_chat:
            # Mock the new combined intent analysis format
            mock_chat.return_value = '{"intent_type": "feature_exploration", "new_code_context_necessary": true, "code_context_request": "Find authentication code and user model"}'
    
            intent_analysis = await self.agent._analyze_user_intent(
                "How do I implement user authentication?",
                self.conversation_context
            )
    
            # Verify that the LLM was called for intent analysis with code context decision
            assert mock_chat.call_count >= 1
            assert intent_analysis.intent_type == "feature_exploration"
            assert intent_analysis.new_code_context_necessary is True
            assert intent_analysis.code_context_request == "Find authentication code and user model"


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])
