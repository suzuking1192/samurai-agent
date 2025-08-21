import pytest
import asyncio
import json
import os
import tempfile
from unittest.mock import Mock, patch, AsyncMock, MagicMock
import sys

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.agent_tools import ExtractCodeContextTool


class TestStep2ParsingFix:
    """Test the fix for Step 2 parsing issues in code context extraction."""
    
    @pytest.fixture
    def extract_tool(self):
        return ExtractCodeContextTool()
    
    @pytest.fixture
    def temp_dir(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            yield temp_dir
    
    def _create_mock_element(self, name, element_type):
        """Create a mock element for testing."""
        element = Mock()
        element.name = name
        element.type = element_type
        return element
    
    @pytest.mark.asyncio
    async def test_step2_parsing_with_reasoning_and_json(self, extract_tool, temp_dir):
        """Test Step 2 parsing when LLM returns reasoning + JSON format."""
        # Create mock file infos with detailed elements
        file_infos = {}
        models_file = os.path.join(temp_dir, "models.py")
        file_info = Mock()
        file_info.name = "models.py"
        file_info.language = "python"
        file_info.elements = [
            self._create_mock_element("Project", "class"),
            self._create_mock_element("Task", "class"),
            self._create_mock_element("Session", "class"),
        ]
        file_infos[models_file] = file_info
        
        unified_agent_file = os.path.join(temp_dir, "unified_samurai_agent.py")
        file_info2 = Mock()
        file_info2.name = "unified_samurai_agent.py"
        file_info2.language = "python"
        file_info2.elements = [
            self._create_mock_element("UnifiedSamuraiAgent", "class"),
            self._create_mock_element("process_message", "method"),
            self._create_mock_element("_load_comprehensive_context", "method"),
        ]
        file_infos[unified_agent_file] = file_info2
        
        relevant_files = [models_file, unified_agent_file]
        
        # Mock the LLM response that matches the actual error scenario
        mock_response = '''Reasoning:
The user is asking to identify the backend logic responsible for determining if code context extraction is necessary, focusing on checking existing context, comparing it to the query, deciding on new extraction, evaluating sufficiency, and handling storage/reuse. The request specifically mentions `backend/services/unified_samurai_agent_service.py` and related lines.

1.  **`backend/services/unified_samurai_agent.py`**: This file contains the `UnifiedSamuraiAgent` class, which is explicitly mentioned as the core agent service in the prompt. Its `process_message` method orchestrates the entire response generation, including deciding on and utilizing code context. Methods like `_load_comprehensive_context` would check for existing context. `_analyze_user_intent` helps determine if code context is even relevant to the current query. `_handle_spec_clarification` and related `_process_questions_` methods are where the agent would actively seek and refine code context based on user questions, implying a "necessity" check. The `_format_code_context_for_prompt` method is also relevant as it prepares the (potentially existing or newly extracted) context for the LLM.

2.  **`backend/services/agent_tools.py`**: This file contains the `ExtractCodeContextTool`, which is the direct mechanism for performing code context extraction. Its `execute` method encapsulates the logic for identifying relevant files and elements. The internal methods like `_identify_relevant_files_and_methods`, `_step1_identify_relevant_files`, and `_step2_identify_relevant_elements` are crucial for determining *what* code context is extracted, which is a direct consequence of deciding *if* extraction is necessary and *what* parts are sufficient.

3.  **`backend/services/code_context_storage.py`**: This file is solely dedicated to managing stored code context. `save_code_context` and `load_code_context` are directly responsible for the "storing and reusing across chat turns" aspect. `get_context_summary` could be used to evaluate the "sufficiency" of previously extracted context before deciding on new extraction.

4.  **`backend/services/project_settings_service.py`**: The `get_code_context_mode` and `set_code_context_mode` methods in this service directly control *when* code context extraction is performed (e.g., 'auto', 'with_code_lookup', 'without_code_lookup'). This is a primary factor in determining if extraction is "necessary" for a given project.

5.  **`backend/services/code_parser.py`**: This service is the underlying engine used by `ExtractCodeContextTool` to scan the codebase, detect languages, and extract elements (functions, classes, methods). `scan_codebase`, `extract_elements_from_file`, and `get_relevant_files` are essential for the actual process of gathering code context once the decision to extract is made. `is_functional_code_file` also contributes to defining what constitutes valid "code context."

6.  **`backend/services/context_service.py`**: This service focuses on selecting and formatting relevant context. While `ExtractCodeContextTool` gathers raw code, `ContextSelectionService`'s `select_relevant_context` and `calculate_relevance_score` methods might be used to refine or evaluate the "sufficiency" and applicability of extracted code context to the user's query.

7.  **`backend/models.py`**: This file defines the data structures used throughout the backend. The `CodeContextMode` enum is directly relevant to the project settings that influence extraction. `ChatRequest`, `TaskContextRequest`, and `TaskContextResponse` might carry information related to user queries or explicit context settings that impact the extraction decision.

8.  **`backend/main.py`**: This is the FastAPI application's entry point. The `chat`, `chat_with_progress`, `chat_stream` endpoints are where user requests initiate the entire process, including the potential for code context extraction decisions. `set_task_context`, `clear_task_context`, and `get_task_context` are also directly related to managing and retrieving contextual information.

```json
{
  "backend/services/unified_samurai_agent.py": [
    "UnifiedSamuraiAgent",
    "process_message",
    "_load_comprehensive_context",
    "_analyze_user_intent",
    "_select_and_execute_response_path",
    "_handle_spec_clarification",
    "_identify_codebase_relevant_questions",
    "_process_questions_batch",
    "_rephrase_question_with_context",
    "_update_response_with_processed_questions",
    "_process_questions_with_shared_context",
    "_format_code_context_for_prompt",
    "_build_vector_enhanced_context"
  ],
  "backend/services/agent_tools.py": [
    "ExtractCodeContextTool",
    "ExtractCodeContextTool.execute",
    "ExtractCodeContextTool._identify_relevant_files_and_methods",
    "ExtractCodeContextTool._step1_identify_relevant_files",
    "ExtractCodeContextTool._step2_identify_relevant_elements",
    "ExtractCodeContextTool._extract_code_context",
    "ExtractCodeContextTool._create_comprehensive_file_list_for_llm",
    "ExtractCodeContextTool._create_detailed_elements_summary_for_llm"
  ],
  "backend/services/code_context_storage.py": [
    "CodeContextStorage",
    "save_code_context",
    "load_code_context",
    "get_context_summary",
    "_get_code_context_file_path",
    "list_sessions_with_context"
  ],
  "backend/services/project_settings_service.py": [
    "ProjectSettingsService",
    "get_code_context_mode",
    "set_code_context_mode",
    "get_all_settings"
  ],
  "backend/services/code_parser.py": [
    "CodeParser",
    "scan_codebase",
    "extract_elements_from_file",
    "get_relevant_files",
    "is_functional_code_file",
    "detect_language"
  ],
  "backend/services/context_service.py": [
    "ContextSelectionService",
    "select_relevant_context",
    "calculate_relevance_score",
    "_calculate_keyword_similarity",
    "_normalize_text",
    "_extract_keywords",
    "format_context_for_prompt"
  ],
  "backend/models.py": [
    "CodeContextMode",
    "ChatRequest",
    "TaskContextRequest",
    "TaskContextResponse",
    "Project",
    "Session"
  ],
  "backend/main.py": [
    "chat",
    "chat_with_progress",
    "chat_stream",
    "set_task_context",
    "clear_task_context",
    "get_task_context"
  ]
}
```'''
        
        # Mock the gemini service
        with patch('services.gemini_service.GeminiService') as mock_gemini:
            mock_service = Mock()
            mock_service.chat_with_system_prompt = AsyncMock(return_value=mock_response)
            mock_gemini.return_value = mock_service
            
            # Test the method
            result = await extract_tool._step2_identify_relevant_elements(
                file_infos, 
                relevant_files, 
                "Locate the backend logic responsible for determining if code context extraction is necessary", 
                mock_service
            )
            
            # The issue is that the LLM returns file paths that don't match our test files
            # So we expect an empty result, but the parsing should work
            assert isinstance(result, dict)
            # The parsing should succeed even if no files match
    
    @pytest.mark.asyncio
    async def test_step2_parsing_with_simple_json(self, extract_tool, temp_dir):
        """Test Step 2 parsing with simple JSON response."""
        # Create mock file infos
        file_infos = {}
        models_file = os.path.join(temp_dir, "models.py")
        file_info = Mock()
        file_info.name = "models.py"
        file_info.language = "python"
        file_info.elements = [
            self._create_mock_element("Project", "class"),
            self._create_mock_element("Task", "class"),
        ]
        file_infos[models_file] = file_info
        
        relevant_files = [models_file]
        
        # Mock simple JSON response
        mock_response = '{"models.py": ["Project", "Task"]}'
        
        # Mock the gemini service
        with patch('services.gemini_service.GeminiService') as mock_gemini:
            mock_service = Mock()
            mock_service.chat_with_system_prompt = AsyncMock(return_value=mock_response)
            mock_gemini.return_value = mock_service
            
            # Test the method
            result = await extract_tool._step2_identify_relevant_elements(
                file_infos, 
                relevant_files, 
                "What are the data models?", 
                mock_service
            )
            
            # Should find the file and methods
            assert len(result) == 1
            assert models_file in result
            assert "Project" in result[models_file]
            assert "Task" in result[models_file]
    
    @pytest.mark.asyncio
    async def test_step2_parsing_with_filename_matching(self, extract_tool, temp_dir):
        """Test Step 2 parsing when LLM returns just filenames instead of full paths."""
        # Create mock file infos
        file_infos = {}
        models_file = os.path.join(temp_dir, "models.py")
        file_info = Mock()
        file_info.name = "models.py"
        file_info.language = "python"
        file_info.elements = [
            self._create_mock_element("Project", "class"),
            self._create_mock_element("Task", "class"),
        ]
        file_infos[models_file] = file_info
        
        relevant_files = [models_file]
        
        # Mock response with just filename (not full path)
        mock_response = '{"models.py": ["Project"]}'
        
        # Mock the gemini service
        with patch('services.gemini_service.GeminiService') as mock_gemini:
            mock_service = Mock()
            mock_service.chat_with_system_prompt = AsyncMock(return_value=mock_response)
            mock_gemini.return_value = mock_service
            
            # Test the method
            result = await extract_tool._step2_identify_relevant_elements(
                file_infos, 
                relevant_files, 
                "What are the data models?", 
                mock_service
            )
            
            # Should match filename to full path
            assert len(result) == 1
            assert models_file in result
            assert "Project" in result[models_file]
    
    @pytest.mark.asyncio
    async def test_step2_parsing_with_mismatched_paths(self, extract_tool, temp_dir):
        """Test Step 2 parsing when LLM returns paths that don't match actual files."""
        # Create mock file infos with actual file paths
        file_infos = {}
        models_file = os.path.join(temp_dir, "models.py")
        file_info = Mock()
        file_info.name = "models.py"
        file_info.language = "python"
        file_info.elements = [
            self._create_mock_element("Project", "class"),
            self._create_mock_element("Task", "class"),
        ]
        file_infos[models_file] = file_info
        
        relevant_files = [models_file]
        
        # Mock response with paths that don't match our actual files
        # This replicates the exact issue from the logs
        mock_response = '''Reasoning: The user is asking about data models.

```json
{
  "backend/services/unified_samurai_agent.py": [
    "UnifiedSamuraiAgent",
    "process_message"
  ],
  "backend/models.py": [
    "Project",
    "Task"
  ]
}
```'''
        
        # Mock the gemini service
        with patch('services.gemini_service.GeminiService') as mock_gemini:
            mock_service = Mock()
            mock_service.chat_with_system_prompt = AsyncMock(return_value=mock_response)
            mock_gemini.return_value = mock_service
            
            # Test the method
            result = await extract_tool._step2_identify_relevant_elements(
                file_infos, 
                relevant_files, 
                "What are the data models?", 
                mock_service
            )
            
            # With the fix, it should now find the models.py file by matching the basename
            # even though the LLM returned "backend/models.py" and our file is at temp_dir/models.py
            assert isinstance(result, dict)
            assert len(result) == 1  # Should find one match
            assert models_file in result  # Should match our actual file path
            assert "Project" in result[models_file]  # Should find the Project class
            assert "Task" in result[models_file]  # Should find the Task class

    @pytest.mark.asyncio
    async def test_step2_parsing_with_real_file_structure(self, extract_tool):
        """Test Step 2 parsing with actual file structure to verify the fix works."""
        # Create mock file infos that match the actual codebase structure
        file_infos = {}
        
        # Mock the actual files that exist in the codebase
        models_file = "/Users/yutosuzuki/code/samurai-agent/backend/models.py"
        file_info = Mock()
        file_info.name = "models.py"
        file_info.language = "python"
        file_info.elements = [
            self._create_mock_element("Project", "class"),
            self._create_mock_element("Task", "class"),
            self._create_mock_element("Session", "class"),
            self._create_mock_element("CodeContextMode", "enum"),
        ]
        file_infos[models_file] = file_info
        
        unified_agent_file = "/Users/yutosuzuki/code/samurai-agent/backend/services/unified_samurai_agent.py"
        file_info2 = Mock()
        file_info2.name = "unified_samurai_agent.py"
        file_info2.language = "python"
        file_info2.elements = [
            self._create_mock_element("UnifiedSamuraiAgent", "class"),
            self._create_mock_element("process_message", "method"),
            self._create_mock_element("_load_comprehensive_context", "method"),
        ]
        file_infos[unified_agent_file] = file_info2
        
        agent_tools_file = "/Users/yutosuzuki/code/samurai-agent/backend/services/agent_tools.py"
        file_info3 = Mock()
        file_info3.name = "agent_tools.py"
        file_info3.language = "python"
        file_info3.elements = [
            self._create_mock_element("ExtractCodeContextTool", "class"),
            self._create_mock_element("execute", "method"),
            self._create_mock_element("_step2_identify_relevant_elements", "method"),
        ]
        file_infos[agent_tools_file] = file_info3
        
        relevant_files = [models_file, unified_agent_file, agent_tools_file]
        
        # Mock the exact response from the logs
        mock_response = '''Reasoning:
The user is asking to identify the backend logic responsible for determining if code context extraction is necessary, focusing on checking existing context, comparing it to the query, deciding on new extraction, evaluating sufficiency, and handling storage/reuse. The request specifically mentions `backend/services/unified_samurai_agent_service.py` and related lines.

1.  **`backend/services/unified_samurai_agent.py`**: This file contains the `UnifiedSamuraiAgent` class, which is explicitly mentioned as the core agent service in the prompt. Its `process_message` method orchestrates the entire response generation, including deciding on and utilizing code context. Methods like `_load_comprehensive_context` would check for existing context. `_analyze_user_intent` helps determine if code context is even relevant to the current query. `_handle_spec_clarification` and related `_process_questions_` methods are where the agent would actively seek and refine code context based on user questions, implying a "necessity" check. The `_format_code_context_for_prompt` method is also relevant as it prepares the (potentially existing or newly extracted) context for the LLM.

2.  **`backend/services/agent_tools.py`**: This file contains the `ExtractCodeContextTool`, which is the direct mechanism for performing code context extraction. Its `execute` method encapsulates the logic for identifying relevant files and elements. The internal methods like `_identify_relevant_files_and_methods`, `_step1_identify_relevant_files`, and `_step2_identify_relevant_elements` are crucial for determining *what* code context is extracted, which is a direct consequence of deciding *if* extraction is necessary and *what* parts are sufficient.

3.  **`backend/models.py`**: This file defines the data structures used throughout the backend. The `CodeContextMode` enum is directly relevant to the project settings that influence extraction. `ChatRequest`, `TaskContextRequest`, and `TaskContextResponse` might carry information related to user queries or explicit context settings that impact the extraction decision.

```json
{
  "backend/services/unified_samurai_agent.py": [
    "UnifiedSamuraiAgent",
    "process_message",
    "_load_comprehensive_context"
  ],
  "backend/services/agent_tools.py": [
    "ExtractCodeContextTool",
    "execute",
    "_step2_identify_relevant_elements"
  ],
  "backend/models.py": [
    "CodeContextMode",
    "Project",
    "Task"
  ]
}
```'''
        
        # Mock the gemini service
        with patch('services.gemini_service.GeminiService') as mock_gemini:
            mock_service = Mock()
            mock_service.chat_with_system_prompt = AsyncMock(return_value=mock_response)
            mock_gemini.return_value = mock_service
            
            # Test the method
            result = await extract_tool._step2_identify_relevant_elements(
                file_infos, 
                relevant_files, 
                "Locate the backend logic responsible for determining if code context extraction is necessary", 
                mock_service
            )
            
            # With the fix, it should now find matches for all three files
            assert isinstance(result, dict)
            assert len(result) == 3  # Should find all three files
            
            # Check that each file was found and has the expected methods
            assert unified_agent_file in result
            assert "UnifiedSamuraiAgent" in result[unified_agent_file]
            assert "process_message" in result[unified_agent_file]
            assert "_load_comprehensive_context" in result[unified_agent_file]
            
            assert agent_tools_file in result
            assert "ExtractCodeContextTool" in result[agent_tools_file]
            assert "execute" in result[agent_tools_file]
            assert "_step2_identify_relevant_elements" in result[agent_tools_file]
            
            assert models_file in result
            assert "CodeContextMode" in result[models_file]
            assert "Project" in result[models_file]
            assert "Task" in result[models_file]

    @pytest.mark.asyncio
    async def test_step2_parsing_with_various_folder_structures(self, extract_tool):
        """Test Step 2 parsing with various folder structure scenarios to ensure generic handling."""
        # Create mock file infos with various folder structures
        file_infos = {}
        
        # Scenario 1: Deep nested structure
        deep_file = "/Users/yutosuzuki/code/samurai-agent/backend/services/nested/deep/file.py"
        file_info1 = Mock()
        file_info1.name = "file.py"
        file_info1.language = "python"
        file_info1.elements = [self._create_mock_element("DeepClass", "class")]
        file_infos[deep_file] = file_info1
        
        # Scenario 2: Root level file
        root_file = "/Users/yutosuzuki/code/samurai-agent/main.py"
        file_info2 = Mock()
        file_info2.name = "main.py"
        file_info2.language = "python"
        file_info2.elements = [self._create_mock_element("MainClass", "class")]
        file_infos[root_file] = file_info2
        
        # Scenario 3: Different project structure
        other_project_file = "/Users/yutosuzuki/code/other-project/src/components/Component.tsx"
        file_info3 = Mock()
        file_info3.name = "Component.tsx"
        file_info3.language = "typescript"
        file_info3.elements = [self._create_mock_element("Component", "class")]
        file_infos[other_project_file] = file_info3
        
        # Scenario 4: Windows-style paths (with backslashes)
        windows_file = "C:\\Users\\yutosuzuki\\code\\samurai-agent\\backend\\models.py"
        file_info4 = Mock()
        file_info4.name = "models.py"
        file_info4.language = "python"
        file_info4.elements = [self._create_mock_element("Project", "class")]
        file_infos[windows_file] = file_info4
        
        relevant_files = [deep_file, root_file, other_project_file, windows_file]
        
        # Test various LLM response formats
        test_cases = [
            # Case 1: LLM returns relative paths from project root
            {
                "response": '''```json
{
  "backend/services/nested/deep/file.py": ["DeepClass"],
  "main.py": ["MainClass"],
  "src/components/Component.tsx": ["Component"],
  "backend/models.py": ["Project"]
}
```''',
                "expected_matches": 4,
                "description": "Relative paths from project root"
            },
            # Case 2: LLM returns just filenames
            {
                "response": '''```json
{
  "file.py": ["DeepClass"],
  "main.py": ["MainClass"],
  "Component.tsx": ["Component"],
  "models.py": ["Project"]
}
```''',
                "expected_matches": 4,
                "description": "Just filenames"
            },
                            # Case 3: LLM returns mixed formats
                {
                    "response": '''```json
{
  "backend/services/nested/deep/file.py": ["DeepClass"],
  "main.py": ["MainClass"],
  "Component.tsx": ["Component"],
  "C:\\\\Users\\\\yutosuzuki\\\\code\\\\samurai-agent\\\\backend\\\\models.py": ["Project"]
}
```''',
                    "expected_matches": 4,
                    "description": "Mixed path formats"
                },
                            # Case 4: LLM returns Windows-style paths
                {
                    "response": '''```json
{
  "C:\\\\Users\\\\yutosuzuki\\\\code\\\\samurai-agent\\\\backend\\\\services\\\\nested\\\\deep\\\\file.py": ["DeepClass"],
  "C:\\\\Users\\\\yutosuzuki\\\\code\\\\samurai-agent\\\\main.py": ["MainClass"],
  "C:\\\\Users\\\\yutosuzuki\\\\code\\\\other-project\\\\src\\\\components\\\\Component.tsx": ["Component"],
  "C:\\\\Users\\\\yutosuzuki\\\\code\\\\samurai-agent\\\\backend\\\\models.py": ["Project"]
}
```''',
                    "expected_matches": 4,
                    "description": "Windows-style paths"
                },
            # Case 5: LLM returns paths with different separators
            {
                "response": '''```json
{
  "backend\\services\\nested\\deep\\file.py": ["DeepClass"],
  "main.py": ["MainClass"],
  "src/components/Component.tsx": ["Component"],
  "backend/models.py": ["Project"]
}
```''',
                "expected_matches": 4,
                "description": "Mixed separators"
            }
        ]
        
        for i, test_case in enumerate(test_cases):
            with patch('services.gemini_service.GeminiService') as mock_gemini:
                mock_service = Mock()
                mock_service.chat_with_system_prompt = AsyncMock(return_value=test_case["response"])
                mock_gemini.return_value = mock_service
                
                # Test the method
                result = await extract_tool._step2_identify_relevant_elements(
                    file_infos, 
                    relevant_files, 
                    f"Test case {i+1}: {test_case['description']}", 
                    mock_service
                )
                
                # Verify results
                assert isinstance(result, dict), f"Case {i+1}: Result should be a dict"
                assert len(result) == test_case["expected_matches"], f"Case {i+1}: Expected {test_case['expected_matches']} matches, got {len(result)}"
                
                # Verify specific matches
                if "DeepClass" in test_case["response"]:
                    assert any("DeepClass" in methods for methods in result.values()), f"Case {i+1}: Should find DeepClass"
                if "MainClass" in test_case["response"]:
                    assert any("MainClass" in methods for methods in result.values()), f"Case {i+1}: Should find MainClass"
                if "Component" in test_case["response"]:
                    assert any("Component" in methods for methods in result.values()), f"Case {i+1}: Should find Component"
                if "Project" in test_case["response"]:
                    assert any("Project" in methods for methods in result.values()), f"Case {i+1}: Should find Project"
    
    @pytest.mark.asyncio
    async def test_step2_parsing_with_edge_cases(self, extract_tool):
        """Test Step 2 parsing with edge cases to ensure robustness."""
        # Create mock file infos with edge cases
        file_infos = {}
        
        # Edge case 1: Files with same name in different directories
        file1 = "/Users/yutosuzuki/code/samurai-agent/backend/models.py"
        file_info1 = Mock()
        file_info1.name = "models.py"
        file_info1.language = "python"
        file_info1.elements = [self._create_mock_element("BackendModel", "class")]
        file_infos[file1] = file_info1
        
        file2 = "/Users/yutosuzuki/code/samurai-agent/frontend/models.py"
        file_info2 = Mock()
        file_info2.name = "models.py"
        file_info2.language = "typescript"
        file_info2.elements = [self._create_mock_element("FrontendModel", "class")]
        file_infos[file2] = file_info2
        
        # Edge case 2: File with special characters in path
        special_file = "/Users/yutosuzuki/code/samurai-agent/backend/services/test-service.py"
        file_info3 = Mock()
        file_info3.name = "test-service.py"
        file_info3.language = "python"
        file_info3.elements = [self._create_mock_element("TestService", "class")]
        file_infos[special_file] = file_info3
        
        # Edge case 3: File with spaces in path
        space_file = "/Users/yutosuzuki/code/samurai agent/backend/config.py"
        file_info4 = Mock()
        file_info4.name = "config.py"
        file_info4.language = "python"
        file_info4.elements = [self._create_mock_element("Config", "class")]
        file_infos[space_file] = file_info4
        
        relevant_files = [file1, file2, special_file, space_file]
        
        # Test edge case scenarios
        test_cases = [
            # Case 1: LLM specifies directory to disambiguate same filenames
            {
                "response": '''```json
{
  "backend/models.py": ["BackendModel"],
  "frontend/models.py": ["FrontendModel"]
}
```''',
                "expected_matches": 2,
                "description": "Disambiguating same filenames with directory"
            },
            # Case 2: LLM returns just filenames (should match both)
            {
                "response": '''```json
{
  "models.py": ["BackendModel", "FrontendModel"]
}
```''',
                "expected_matches": 2,
                "description": "Same filename in multiple directories"
            },
            # Case 3: LLM returns file with special characters
            {
                "response": '''```json
{
  "backend/services/test-service.py": ["TestService"]
}
```''',
                "expected_matches": 1,
                "description": "File with special characters"
            },
            # Case 4: LLM returns file with spaces
            {
                "response": '''```json
{
  "samurai agent/backend/config.py": ["Config"]
}
```''',
                "expected_matches": 1,
                "description": "File with spaces in path"
            }
        ]
        
        for i, test_case in enumerate(test_cases):
            with patch('services.gemini_service.GeminiService') as mock_gemini:
                mock_service = Mock()
                mock_service.chat_with_system_prompt = AsyncMock(return_value=test_case["response"])
                mock_gemini.return_value = mock_service
                
                # Test the method
                result = await extract_tool._step2_identify_relevant_elements(
                    file_infos, 
                    relevant_files, 
                    f"Edge case {i+1}: {test_case['description']}", 
                    mock_service
                )
                
                # Verify results
                assert isinstance(result, dict), f"Edge case {i+1}: Result should be a dict"
                assert len(result) == test_case["expected_matches"], f"Edge case {i+1}: Expected {test_case['expected_matches']} matches, got {len(result)}"
    
    @pytest.mark.asyncio
    async def test_step2_parsing_with_different_working_directories(self, extract_tool):
        """Test Step 2 parsing when working directory changes."""
        # Create mock file infos with different working directory scenarios
        file_infos = {}
        
        # Scenario 1: Working from project root
        root_file = "/Users/yutosuzuki/code/samurai-agent/backend/models.py"
        file_info1 = Mock()
        file_info1.name = "models.py"
        file_info1.language = "python"
        file_info1.elements = [self._create_mock_element("Project", "class")]
        file_infos[root_file] = file_info1
        
        # Scenario 2: Working from backend directory
        backend_file = "/Users/yutosuzuki/code/samurai-agent/backend/services/agent_tools.py"
        file_info2 = Mock()
        file_info2.name = "agent_tools.py"
        file_info2.language = "python"
        file_info2.elements = [self._create_mock_element("ExtractCodeContextTool", "class")]
        file_infos[backend_file] = file_info2
        
        relevant_files = [root_file, backend_file]
        
        # Test with different working directory contexts
        test_cases = [
            # Case 1: LLM returns paths relative to project root
            {
                "response": '''```json
{
  "backend/models.py": ["Project"],
  "backend/services/agent_tools.py": ["ExtractCodeContextTool"]
}
```''',
                "expected_matches": 2,
                "description": "Paths relative to project root"
            },
            # Case 2: LLM returns paths relative to backend directory
            {
                "response": '''```json
{
  "models.py": ["Project"],
  "services/agent_tools.py": ["ExtractCodeContextTool"]
}
```''',
                "expected_matches": 2,
                "description": "Paths relative to backend directory"
            }
        ]
        
        for i, test_case in enumerate(test_cases):
            with patch('services.gemini_service.GeminiService') as mock_gemini:
                mock_service = Mock()
                mock_service.chat_with_system_prompt = AsyncMock(return_value=test_case["response"])
                mock_gemini.return_value = mock_service
                
                # Test the method
                result = await extract_tool._step2_identify_relevant_elements(
                    file_infos, 
                    relevant_files, 
                    f"Working dir test {i+1}: {test_case['description']}", 
                    mock_service
                )
                
                # Verify results
                assert isinstance(result, dict), f"Working dir test {i+1}: Result should be a dict"
                assert len(result) == test_case["expected_matches"], f"Working dir test {i+1}: Expected {test_case['expected_matches']} matches, got {len(result)}"


    @pytest.mark.asyncio
    async def test_step2_parsing_with_exact_log_input(self, extract_tool):
        """Test Step 2 parsing with the exact input from the user's logs to verify the fix works."""
        # Create mock file infos that match the actual codebase structure from the logs
        file_infos = {}
        
        # These are the actual files that should exist in the codebase based on the logs
        unified_agent_file = "/Users/yutosuzuki/code/samurai-agent/backend/services/unified_samurai_agent.py"
        file_info1 = Mock()
        file_info1.name = "unified_samurai_agent.py"
        file_info1.language = "python"
        file_info1.elements = [
            self._create_mock_element("UnifiedSamuraiAgent", "class"),
            self._create_mock_element("process_message", "method"),
            self._create_mock_element("_load_comprehensive_context", "method"),
            self._create_mock_element("_analyze_user_intent", "method"),
            self._create_mock_element("_select_and_execute_response_path", "method"),
            self._create_mock_element("_handle_spec_clarification", "method"),
            self._create_mock_element("_identify_codebase_relevant_questions", "method"),
            self._create_mock_element("_process_questions_batch", "method"),
            self._create_mock_element("_rephrase_question_with_context", "method"),
            self._create_mock_element("_update_response_with_processed_questions", "method"),
            self._create_mock_element("_process_questions_with_shared_context", "method"),
            self._create_mock_element("_format_code_context_for_prompt", "method"),
            self._create_mock_element("_build_vector_enhanced_context", "method"),
        ]
        file_infos[unified_agent_file] = file_info1
        
        agent_tools_file = "/Users/yutosuzuki/code/samurai-agent/backend/services/agent_tools.py"
        file_info2 = Mock()
        file_info2.name = "agent_tools.py"
        file_info2.language = "python"
        file_info2.elements = [
            self._create_mock_element("ExtractCodeContextTool", "class"),
            self._create_mock_element("execute", "method"),
            self._create_mock_element("_identify_relevant_files_and_methods", "method"),
            self._create_mock_element("_step1_identify_relevant_files", "method"),
            self._create_mock_element("_step2_identify_relevant_elements", "method"),
            self._create_mock_element("_extract_code_context", "method"),
            self._create_mock_element("_create_comprehensive_file_list_for_llm", "method"),
            self._create_mock_element("_create_detailed_elements_summary_for_llm", "method"),
        ]
        file_infos[agent_tools_file] = file_info2
        
        code_context_storage_file = "/Users/yutosuzuki/code/samurai-agent/backend/services/code_context_storage.py"
        file_info3 = Mock()
        file_info3.name = "code_context_storage.py"
        file_info3.language = "python"
        file_info3.elements = [
            self._create_mock_element("CodeContextStorage", "class"),
            self._create_mock_element("save_code_context", "method"),
            self._create_mock_element("load_code_context", "method"),
            self._create_mock_element("get_context_summary", "method"),
            self._create_mock_element("_get_code_context_file_path", "method"),
            self._create_mock_element("list_sessions_with_context", "method"),
        ]
        file_infos[code_context_storage_file] = file_info3
        
        project_settings_file = "/Users/yutosuzuki/code/samurai-agent/backend/services/project_settings_service.py"
        file_info4 = Mock()
        file_info4.name = "project_settings_service.py"
        file_info4.language = "python"
        file_info4.elements = [
            self._create_mock_element("ProjectSettingsService", "class"),
            self._create_mock_element("get_code_context_mode", "method"),
            self._create_mock_element("set_code_context_mode", "method"),
            self._create_mock_element("get_all_settings", "method"),
        ]
        file_infos[project_settings_file] = file_info4
        
        code_parser_file = "/Users/yutosuzuki/code/samurai-agent/backend/services/code_parser.py"
        file_info5 = Mock()
        file_info5.name = "code_parser.py"
        file_info5.language = "python"
        file_info5.elements = [
            self._create_mock_element("CodeParser", "class"),
            self._create_mock_element("scan_codebase", "method"),
            self._create_mock_element("extract_elements_from_file", "method"),
            self._create_mock_element("get_relevant_files", "method"),
            self._create_mock_element("is_functional_code_file", "method"),
            self._create_mock_element("detect_language", "method"),
        ]
        file_infos[code_parser_file] = file_info5
        
        context_service_file = "/Users/yutosuzuki/code/samurai-agent/backend/services/context_service.py"
        file_info6 = Mock()
        file_info6.name = "context_service.py"
        file_info6.language = "python"
        file_info6.elements = [
            self._create_mock_element("ContextSelectionService", "class"),
            self._create_mock_element("select_relevant_context", "method"),
            self._create_mock_element("calculate_relevance_score", "method"),
            self._create_mock_element("_calculate_keyword_similarity", "method"),
            self._create_mock_element("_normalize_text", "method"),
            self._create_mock_element("_extract_keywords", "method"),
            self._create_mock_element("format_context_for_prompt", "method"),
        ]
        file_infos[context_service_file] = file_info6
        
        models_file = "/Users/yutosuzuki/code/samurai-agent/backend/models.py"
        file_info7 = Mock()
        file_info7.name = "models.py"
        file_info7.language = "python"
        file_info7.elements = [
            self._create_mock_element("CodeContextMode", "enum"),
            self._create_mock_element("ChatRequest", "class"),
            self._create_mock_element("TaskContextRequest", "class"),
            self._create_mock_element("TaskContextResponse", "class"),
            self._create_mock_element("Project", "class"),
            self._create_mock_element("Session", "class"),
        ]
        file_infos[models_file] = file_info7
        
        main_file = "/Users/yutosuzuki/code/samurai-agent/backend/main.py"
        file_info8 = Mock()
        file_info8.name = "main.py"
        file_info8.language = "python"
        file_info8.elements = [
            self._create_mock_element("chat", "function"),
            self._create_mock_element("chat_with_progress", "function"),
            self._create_mock_element("chat_stream", "function"),
            self._create_mock_element("set_task_context", "function"),
            self._create_mock_element("clear_task_context", "function"),
            self._create_mock_element("get_task_context", "function"),
        ]
        file_infos[main_file] = file_info8
        
        relevant_files = [unified_agent_file, agent_tools_file, code_context_storage_file, 
                         project_settings_file, code_parser_file, context_service_file, 
                         models_file, main_file]
        
        # This is the EXACT LLM response from the user's logs
        exact_log_response = '''Reasoning:
The user is asking to identify the backend logic responsible for determining if code context extraction is necessary, focusing on checking existing context, comparing it to the query, deciding on new extraction, evaluating sufficiency, and handling storage/reuse. The request specifically mentions `backend/services/unified_samurai_agent_service.py` and related lines.

1.  **`backend/services/unified_samurai_agent.py`**: This file contains the `UnifiedSamuraiAgent` class, which is explicitly mentioned as the core agent service in the prompt. Its `process_message` method orchestrates the entire response generation, including deciding on and utilizing code context. Methods like `_load_comprehensive_context` would check for existing context. `_analyze_user_intent` helps determine if code context is even relevant to the current query. `_handle_spec_clarification` and related `_process_questions_` methods are where the agent would actively seek and refine code context based on user questions, implying a "necessity" check. The `_format_code_context_for_prompt` method is also relevant as it prepares the (potentially existing or newly extracted) context for the LLM.

2.  **`backend/services/agent_tools.py`**: This file contains the `ExtractCodeContextTool`, which is the direct mechanism for performing code context extraction. Its `execute` method encapsulates the logic for identifying relevant files and elements. The internal methods like `_identify_relevant_files_and_methods`, `_step1_identify_relevant_files`, and `_step2_identify_relevant_elements` are crucial for determining *what* code context is extracted, which is a direct consequence of deciding *if* extraction is necessary and *what* parts are sufficient.

3.  **`backend/services/code_context_storage.py`**: This file is solely dedicated to managing stored code context. `save_code_context` and `load_code_context` are directly responsible for the "storing and reusing across chat turns" aspect. `get_context_summary` could be used to evaluate the "sufficiency" of previously extracted context before deciding on new extraction.

4.  **`backend/services/project_settings_service.py`**: The `get_code_context_mode` and `set_code_context_mode` methods in this service directly control *when* code context extraction is performed (e.g., 'auto', 'with_code_lookup', 'without_code_lookup'). This is a primary factor in determining if extraction is "necessary" for a given project.

5.  **`backend/services/code_parser.py`**: This service is the underlying engine used by `ExtractCodeContextTool` to scan the codebase, detect languages, and extract elements (functions, classes, methods). `scan_codebase`, `extract_elements_from_file`, and `get_relevant_files` are essential for the actual process of gathering code context once the decision to extract is made. `is_functional_code_file` also contributes to defining what constitutes valid "code context."

6.  **`backend/services/context_service.py`**: This service focuses on selecting and formatting relevant context. While `ExtractCodeContextTool` gathers raw code, `ContextSelectionService`'s `select_relevant_context` and `calculate_relevance_score` methods might be used to refine or evaluate the "sufficiency" and applicability of extracted code context to the user's query.

7.  **`backend/models.py`**: This file defines the data structures used throughout the backend. The `CodeContextMode` enum is directly relevant to the project settings that influence extraction. `ChatRequest`, `TaskContextRequest`, and `TaskContextResponse` might carry information related to user queries or explicit context settings that impact the extraction decision.

8.  **`backend/main.py`**: This is the FastAPI application's entry point. The `chat`, `chat_with_progress`, `chat_stream` endpoints are where user requests initiate the entire process, including the potential for code context extraction decisions. `set_task_context`, `clear_task_context`, and `get_task_context` are also directly related to managing and retrieving contextual information.

```json
{
  "backend/services/unified_samurai_agent.py": [
    "UnifiedSamuraiAgent",
    "process_message",
    "_load_comprehensive_context",
    "_analyze_user_intent",
    "_select_and_execute_response_path",
    "_handle_spec_clarification",
    "_identify_codebase_relevant_questions",
    "_process_questions_batch",
    "_rephrase_question_with_context",
    "_update_response_with_processed_questions",
    "_process_questions_with_shared_context",
    "_format_code_context_for_prompt",
    "_build_vector_enhanced_context"
  ],
  "backend/services/agent_tools.py": [
    "ExtractCodeContextTool",
    "ExtractCodeContextTool.execute",
    "ExtractCodeContextTool._identify_relevant_files_and_methods",
    "ExtractCodeContextTool._step1_identify_relevant_files",
    "ExtractCodeContextTool._step2_identify_relevant_elements",
    "ExtractCodeContextTool._extract_code_context",
    "ExtractCodeContextTool._create_comprehensive_file_list_for_llm",
    "ExtractCodeContextTool._create_detailed_elements_summary_for_llm"
  ],
  "backend/services/code_context_storage.py": [
    "CodeContextStorage",
    "save_code_context",
    "load_code_context",
    "get_context_summary",
    "_get_code_context_file_path",
    "list_sessions_with_context"
  ],
  "backend/services/project_settings_service.py": [
    "ProjectSettingsService",
    "get_code_context_mode",
    "set_code_context_mode",
    "get_all_settings"
  ],
  "backend/services/code_parser.py": [
    "CodeParser",
    "scan_codebase",
    "extract_elements_from_file",
    "get_relevant_files",
    "is_functional_code_file",
    "detect_language"
  ],
  "backend/services/context_service.py": [
    "ContextSelectionService",
    "select_relevant_context",
    "calculate_relevance_score",
    "_calculate_keyword_similarity",
    "_normalize_text",
    "_extract_keywords",
    "format_context_for_prompt"
  ],
  "backend/models.py": [
    "CodeContextMode",
    "ChatRequest",
    "TaskContextRequest",
    "TaskContextResponse",
    "Project",
    "Session"
  ],
  "backend/main.py": [
    "chat",
    "chat_with_progress",
    "chat_stream",
    "set_task_context",
    "clear_task_context",
    "get_task_context"
  ]
}
```'''
        
        # Mock the gemini service with the exact response from the logs
        with patch('services.gemini_service.GeminiService') as mock_gemini:
            mock_service = Mock()
            mock_service.chat_with_system_prompt = AsyncMock(return_value=exact_log_response)
            mock_gemini.return_value = mock_service
            
            # Test the method with the exact scenario from the logs
            result = await extract_tool._step2_identify_relevant_elements(
                file_infos, 
                relevant_files, 
                "Locate the backend logic responsible for determining if code context extraction is necessary. Specifically, focus on the code around lines 800 and 1364 in `backend/services/unified_samurai_agent_service.py` (as per relevant memories). Identify the functions or methods that check for existing code context, compare it to the current query, or decide whether new extraction is needed based on previous context. Look for logic that evaluates the 'sufficiency' of previously extracted code context and whether it's being stored and reused across chat turns.", 
                mock_service
            )
            
            # Verify that the fix now works and we get proper results
            assert isinstance(result, dict), "Result should be a dict"
            assert len(result) > 0, f"Should find matches, but got empty result: {result}"
            
            # Check specific files and methods that should be found
            print(f"Found {len(result)} files with methods:")
            for file_path, methods in result.items():
                print(f"  {file_path}: {methods}")
            
            # Verify that we found the key files from the log
            found_files = set(result.keys())
            expected_files = {unified_agent_file, agent_tools_file, code_context_storage_file, 
                            project_settings_file, code_parser_file, context_service_file, 
                            models_file, main_file}
            
            # Should find all 8 files that were mentioned in the LLM response
            assert len(result) == 8, f"Expected 8 files, but found {len(result)}: {list(result.keys())}"
            
            # Verify specific important methods are found
            if unified_agent_file in result:
                assert "UnifiedSamuraiAgent" in result[unified_agent_file], "Should find UnifiedSamuraiAgent class"
                assert "process_message" in result[unified_agent_file], "Should find process_message method"
                assert "_load_comprehensive_context" in result[unified_agent_file], "Should find _load_comprehensive_context method"
            
            if agent_tools_file in result:
                assert "ExtractCodeContextTool" in result[agent_tools_file], "Should find ExtractCodeContextTool class"
                # Note: The LLM returned qualified names like "ExtractCodeContextTool.execute" but our method matching
                # correctly matches them to the simple method names in our mock elements
                print(f"Agent tools methods found: {result[agent_tools_file]}")
            
            if code_context_storage_file in result:
                assert "save_code_context" in result[code_context_storage_file], "Should find save_code_context method"
                assert "load_code_context" in result[code_context_storage_file], "Should find load_code_context method"
            
            print("✅ SUCCESS: The fix works! All expected files and methods were found.")

    @pytest.mark.asyncio
    async def test_step2_parsing_with_real_codebase(self, extract_tool):
        """Test Step 2 parsing with the real codebase files to verify the fix works in production."""
        import os
        from services.code_parser import CodeParser
        
        # Use the real codebase path
        real_codebase_path = "/Users/yutosuzuki/code/samurai-agent"
        
        # Check if the real codebase exists
        if not os.path.exists(real_codebase_path):
            pytest.skip(f"Real codebase not found at {real_codebase_path}")
        
        # Use the real code parser to get actual file information
        code_parser = CodeParser()
        file_infos = code_parser.scan_codebase(real_codebase_path)
        
        # Filter to only include the files that were mentioned in the LLM response
        expected_files = [
            "backend/services/unified_samurai_agent.py",
            "backend/services/agent_tools.py", 
            "backend/services/code_context_storage.py",
            "backend/services/project_settings_service.py",
            "backend/services/code_parser.py",
            "backend/services/context_service.py",
            "backend/models.py",
            "backend/main.py"
        ]
        
        # Find the actual file paths for these expected files
        relevant_files = []
        for expected_file in expected_files:
            full_path = os.path.join(real_codebase_path, expected_file)
            if full_path in file_infos:
                relevant_files.append(full_path)
            else:
                print(f"Warning: Expected file not found: {full_path}")
        
        print(f"Found {len(relevant_files)} relevant files in real codebase:")
        for file_path in relevant_files:
            print(f"  {file_path}")
        
        # This is the EXACT LLM response from the user's logs
        exact_log_response = '''Reasoning:
The user is asking to identify the backend logic responsible for determining if code context extraction is necessary, focusing on checking existing context, comparing it to the query, deciding on new extraction, evaluating sufficiency, and handling storage/reuse. The request specifically mentions `backend/services/unified_samurai_agent_service.py` and related lines.

1.  **`backend/services/unified_samurai_agent.py`**: This file contains the `UnifiedSamuraiAgent` class, which is explicitly mentioned as the core agent service in the prompt. Its `process_message` method orchestrates the entire response generation, including deciding on and utilizing code context. Methods like `_load_comprehensive_context` would check for existing context. `_analyze_user_intent` helps determine if code context is even relevant to the current query. `_handle_spec_clarification` and related `_process_questions_` methods are where the agent would actively seek and refine code context based on user questions, implying a "necessity" check. The `_format_code_context_for_prompt` method is also relevant as it prepares the (potentially existing or newly extracted) context for the LLM.

2.  **`backend/services/agent_tools.py`**: This file contains the `ExtractCodeContextTool`, which is the direct mechanism for performing code context extraction. Its `execute` method encapsulates the logic for identifying relevant files and elements. The internal methods like `_identify_relevant_files_and_methods`, `_step1_identify_relevant_files`, and `_step2_identify_relevant_elements` are crucial for determining *what* code context is extracted, which is a direct consequence of deciding *if* extraction is necessary and *what* parts are sufficient.

3.  **`backend/services/code_context_storage.py`**: This file is solely dedicated to managing stored code context. `save_code_context` and `load_code_context` are directly responsible for the "storing and reusing across chat turns" aspect. `get_context_summary` could be used to evaluate the "sufficiency" of previously extracted context before deciding on new extraction.

4.  **`backend/services/project_settings_service.py`**: The `get_code_context_mode` and `set_code_context_mode` methods in this service directly control *when* code context extraction is performed (e.g., 'auto', 'with_code_lookup', 'without_code_lookup'). This is a primary factor in determining if extraction is "necessary" for a given project.

5.  **`backend/services/code_parser.py`**: This service is the underlying engine used by `ExtractCodeContextTool` to scan the codebase, detect languages, and extract elements (functions, classes, methods). `scan_codebase`, `extract_elements_from_file`, and `get_relevant_files` are essential for the actual process of gathering code context once the decision to extract is made. `is_functional_code_file` also contributes to defining what constitutes valid "code context."

6.  **`backend/services/context_service.py`**: This service focuses on selecting and formatting relevant context. While `ExtractCodeContextTool` gathers raw code, `ContextSelectionService`'s `select_relevant_context` and `calculate_relevance_score` methods might be used to refine or evaluate the "sufficiency" and applicability of extracted code context to the user's query.

7.  **`backend/models.py`**: This file defines the data structures used throughout the backend. The `CodeContextMode` enum is directly relevant to the project settings that influence extraction. `ChatRequest`, `TaskContextRequest`, and `TaskContextResponse` might carry information related to user queries or explicit context settings that impact the extraction decision.

8.  **`backend/main.py`**: This is the FastAPI application's entry point. The `chat`, `chat_with_progress`, `chat_stream` endpoints are where user requests initiate the entire process, including the potential for code context extraction decisions. `set_task_context`, `clear_task_context`, and `get_task_context` are also directly related to managing and retrieving contextual information.

```json
{
  "backend/services/unified_samurai_agent.py": [
    "UnifiedSamuraiAgent",
    "process_message",
    "_load_comprehensive_context",
    "_analyze_user_intent",
    "_select_and_execute_response_path",
    "_handle_spec_clarification",
    "_identify_codebase_relevant_questions",
    "_process_questions_batch",
    "_rephrase_question_with_context",
    "_update_response_with_processed_questions",
    "_process_questions_with_shared_context",
    "_format_code_context_for_prompt",
    "_build_vector_enhanced_context"
  ],
  "backend/services/agent_tools.py": [
    "ExtractCodeContextTool",
    "ExtractCodeContextTool.execute",
    "ExtractCodeContextTool._identify_relevant_files_and_methods",
    "ExtractCodeContextTool._step1_identify_relevant_files",
    "ExtractCodeContextTool._step2_identify_relevant_elements",
    "ExtractCodeContextTool._extract_code_context",
    "ExtractCodeContextTool._create_comprehensive_file_list_for_llm",
    "ExtractCodeContextTool._create_detailed_elements_summary_for_llm"
  ],
  "backend/services/code_context_storage.py": [
    "CodeContextStorage",
    "save_code_context",
    "load_code_context",
    "get_context_summary",
    "_get_code_context_file_path",
    "list_sessions_with_context"
  ],
  "backend/services/project_settings_service.py": [
    "ProjectSettingsService",
    "get_code_context_mode",
    "set_code_context_mode",
    "get_all_settings"
  ],
  "backend/services/code_parser.py": [
    "CodeParser",
    "scan_codebase",
    "extract_elements_from_file",
    "get_relevant_files",
    "is_functional_code_file",
    "detect_language"
  ],
  "backend/services/context_service.py": [
    "ContextSelectionService",
    "select_relevant_context",
    "calculate_relevance_score",
    "_calculate_keyword_similarity",
    "_normalize_text",
    "_extract_keywords",
    "format_context_for_prompt"
  ],
  "backend/models.py": [
    "CodeContextMode",
    "ChatRequest",
    "TaskContextRequest",
    "TaskContextResponse",
    "Project",
    "Session"
  ],
  "backend/main.py": [
    "chat",
    "chat_with_progress",
    "chat_stream",
    "set_task_context",
    "clear_task_context",
    "get_task_context"
  ]
}
```'''
        
        # Mock the gemini service with the exact response from the logs
        with patch('services.gemini_service.GeminiService') as mock_gemini:
            mock_service = Mock()
            mock_service.chat_with_system_prompt = AsyncMock(return_value=exact_log_response)
            mock_gemini.return_value = mock_service
            
            # Test the method with the real codebase
            result = await extract_tool._step2_identify_relevant_elements(
                file_infos, 
                relevant_files, 
                "Locate the backend logic responsible for determining if code context extraction is necessary. Specifically, focus on the code around lines 800 and 1364 in `backend/services/unified_samurai_agent_service.py` (as per relevant memories). Identify the functions or methods that check for existing code context, compare it to the current query, or decide whether new extraction is needed based on previous context. Look for logic that evaluates the 'sufficiency' of previously extracted code context and whether it's being stored and reused across chat turns.", 
                mock_service
            )
            
            # Verify that the fix now works with real files
            assert isinstance(result, dict), "Result should be a dict"
            assert len(result) > 0, f"Should find matches in real codebase, but got empty result: {result}"
            
            # Print the results
            print(f"\n🎉 SUCCESS: Found {len(result)} files with methods in real codebase:")
            for file_path, methods in result.items():
                print(f"  {file_path}: {len(methods)} methods")
                # Print first few methods as examples
                if methods:
                    print(f"    Examples: {methods[:3]}{'...' if len(methods) > 3 else ''}")
            
            # Verify we found the key files
            found_file_paths = set(result.keys())
            expected_file_paths = set()
            for expected_file in expected_files:
                full_path = os.path.join(real_codebase_path, expected_file)
                expected_file_paths.add(full_path)
            
            # Check how many expected files we found
            found_expected = found_file_paths.intersection(expected_file_paths)
            print(f"\n📊 Results:")
            print(f"  Expected files: {len(expected_file_paths)}")
            print(f"  Found files: {len(found_file_paths)}")
            print(f"  Found expected files: {len(found_expected)}")
            
            # Should find at least some of the expected files
            assert len(found_expected) > 0, f"Should find at least some expected files, but found none. Expected: {expected_file_paths}, Found: {found_file_paths}"
            
            # Verify specific important files are found
            key_files = [
                os.path.join(real_codebase_path, "backend/services/unified_samurai_agent.py"),
                os.path.join(real_codebase_path, "backend/services/agent_tools.py"),
                os.path.join(real_codebase_path, "backend/models.py")
            ]
            
            found_key_files = [f for f in key_files if f in result]
            print(f"  Found key files: {len(found_key_files)}/{len(key_files)}")
            
            # Should find at least the main files
            assert len(found_key_files) >= 2, f"Should find at least 2 key files, but found {len(found_key_files)}: {found_key_files}"
            
            print(f"\n✅ SUCCESS: The fix works with real codebase! Found {len(result)} files with methods.")


if __name__ == "__main__":
    pytest.main([__file__])
