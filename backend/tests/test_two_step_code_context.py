"""
Test the two-step code context extraction approach
"""

import pytest
import asyncio
import tempfile
import os
import json
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock

from backend.services.tools.agent_tools import ExtractCodeContextTool
from services.code_parser import CodeParser


class TestTwoStepCodeContext:
    """Test the two-step code context extraction approach"""
    
    def setup_method(self):
        """Set up test environment"""
        self.tool = ExtractCodeContextTool()
        self.temp_dir = tempfile.mkdtemp()
        self.test_project_id = "test_project"
        
        # Create test files
        self._create_test_files()
    
    def teardown_method(self):
        """Clean up test environment"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def _create_mock_element(self, name: str, element_type: str):
        """Create a proper mock element with name attribute"""
        element = Mock()
        element.name = name
        element.type = element_type
        return element
    
    def _create_test_files(self):
        """Create test files with various code elements"""
        # Create models.py with Task class
        models_file = os.path.join(self.temp_dir, "models.py")
        with open(models_file, 'w') as f:
            f.write("""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class Task(BaseModel):
    id: str
    title: str
    description: str
    status: str = "pending"
    priority: str = "medium"
    completed: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    project_id: str
    parent_task_id: Optional[str] = None
    review_warnings: List[str] = []
    
    def update_status(self, new_status: str):
        self.status = new_status
        self.updated_at = datetime.now()
    
    def mark_completed(self):
        self.completed = True
        self.status = "completed"
        self.updated_at = datetime.now()

class Memory(BaseModel):
    id: str
    title: str
    content: str
    category: str = "general"
    created_at: datetime
    project_id: str

class Project(BaseModel):
    id: str
    name: str
    description: str
    created_at: datetime
    codebase_path: Optional[str] = None
""")
        
        # Create agent_tools.py with various tools
        tools_file = os.path.join(self.temp_dir, "agent_tools.py")
        with open(tools_file, 'w') as f:
            f.write("""
import uuid
from typing import Dict, Any

class CreateTaskTool:
    name = "create_task"
    description = "Create a new task"
    
    async def execute(self, title: str, description: str, **kwargs):
        return {"success": True, "task_id": str(uuid.uuid4())}

class UpdateTaskTool:
    name = "update_task"
    description = "Update an existing task"
    
    async def execute(self, task_id: str, **kwargs):
        return {"success": True, "message": "Task updated"}

class ExtractCodeContextTool:
    name = "extract_code_context"
    description = "Extract code context from codebase"
    
    async def execute(self, request: str, **kwargs):
        return {"success": True, "context": "Code context extracted"}
""")
        
        # Create a service file
        service_file = os.path.join(self.temp_dir, "task_service.py")
        with open(service_file, 'w') as f:
            f.write("""
from typing import List, Optional
from models import Task

class TaskService:
    def __init__(self):
        self.tasks = []
    
    async def create_task(self, title: str, description: str, **kwargs) -> Task:
        task = Task(
            id=str(uuid.uuid4()),
            title=title,
            description=description,
            **kwargs
        )
        self.tasks.append(task)
        return task
    
    async def get_task(self, project_id: str, task_id: str) -> Optional[Task]:
        for task in self.tasks:
            if task.id == task_id and task.project_id == project_id:
                return task
        return None
    
    async def list_tasks(self, project_id: str) -> List[Task]:
        return [task for task in self.tasks if task.project_id == project_id]
    
    async def update_task(self, project_id: str, task_id: str, updates: dict) -> Optional[Task]:
        task = await self.get_task(project_id, task_id)
        if task:
            for key, value in updates.items():
                if hasattr(task, key):
                    setattr(task, key, value)
        return task
""")
    
    @pytest.mark.asyncio
    async def test_step1_identify_relevant_files(self):
        """Test Step 1: Identifying relevant files from all available files"""
        # Mock the code parser to return our test files
        with patch('services.agent_tools.code_parser') as mock_parser:
            # Create mock file infos
            file_infos = {}
            for file_path in Path(self.temp_dir).glob("*.py"):
                file_info = Mock()
                file_info.name = file_path.name
                file_info.language = "python"
                file_info.elements = [
                    self._create_mock_element("Task", "class"),
                    self._create_mock_element("Memory", "class"),
                    self._create_mock_element("Project", "class"),
                    self._create_mock_element("create_task", "function"),
                    self._create_mock_element("update_task", "function"),
                    self._create_mock_element("extract_code_context", "function"),
                ]
                file_infos[str(file_path)] = file_info
            
            mock_parser.scan_codebase.return_value = file_infos
            
            # Mock the LLM response for Step 1
            with patch('backend.services.llm_providers.gemini_service.GeminiService') as mock_gemini:
                mock_service = Mock()
                # Get the actual file paths to return in the mock response
                actual_paths = list(file_infos.keys())
                mock_response = json.dumps([os.path.basename(path) for path in actual_paths[:2]])
                mock_service.chat_with_system_prompt = AsyncMock(
                    return_value=mock_response
                )
                mock_gemini.return_value = mock_service
                
                # Test the method
                relevant_files = await self.tool._step1_identify_relevant_files(
                    file_infos, 
                    "What are data fields of Task data model?", 
                    mock_service
                )
                
                # Debug: print the results
                print(f"Step 1 results: {relevant_files}")
                print(f"Available file paths: {list(file_infos.keys())}")
                print(f"Mock response: {mock_response}")
                
                # Verify results
                assert len(relevant_files) == 2
                assert any("models.py" in f for f in relevant_files)
                assert any("task_service.py" in f for f in relevant_files)
    
    @pytest.mark.asyncio
    async def test_step2_identify_relevant_elements(self):
        """Test Step 2: Identifying relevant elements from selected files"""
        # Create mock file infos with detailed elements
        file_infos = {}
        models_file = os.path.join(self.temp_dir, "models.py")
        file_info = Mock()
        file_info.name = "models.py"
        file_info.language = "python"
        file_info.elements = [
            self._create_mock_element("Task", "class"),
            self._create_mock_element("Memory", "class"),
            self._create_mock_element("Project", "class"),
        ]
        file_infos[models_file] = file_info
        
        relevant_files = [models_file]
        
        # Mock the LLM response for Step 2
        with patch('backend.services.llm_providers.gemini_service.GeminiService') as mock_gemini:
            mock_service = Mock()
            # Get the actual file path to return in the mock response
            actual_path = os.path.basename(models_file)
            mock_response = json.dumps({actual_path: ["Task"]})
            mock_service.chat_with_system_prompt = AsyncMock(
                return_value=mock_response
            )
            mock_gemini.return_value = mock_service
            
            # Test the method
            relevant_files_and_methods = await self.tool._step2_identify_relevant_elements(
                file_infos, 
                relevant_files, 
                "What are data fields of Task data model?", 
                mock_service
            )
            
            # Verify results
            assert len(relevant_files_and_methods) == 1
            assert models_file in relevant_files_and_methods
            assert "Task" in relevant_files_and_methods[models_file]
    
    @pytest.mark.asyncio
    async def test_two_step_approach_integration(self):
        """Test the complete two-step approach integration"""
        # Mock the code parser
        with patch('services.agent_tools.code_parser') as mock_parser:
            # Create mock file infos
            file_infos = {}
            for file_path in Path(self.temp_dir).glob("*.py"):
                file_info = Mock()
                file_info.name = file_path.name
                file_info.language = "python"
                file_info.elements = [
                    self._create_mock_element("Task", "class"),
                    self._create_mock_element("Memory", "class"),
                    self._create_mock_element("Project", "class"),
                    self._create_mock_element("create_task", "function"),
                    self._create_mock_element("update_task", "function"),
                ]
                file_infos[str(file_path)] = file_info
            
            mock_parser.scan_codebase.return_value = file_infos
            
            # Mock the LLM responses for both steps
            with patch('backend.services.llm_providers.gemini_service.GeminiService') as mock_gemini:
                mock_service = Mock()
                # Step 1 response
                mock_service.chat_with_system_prompt = AsyncMock()
                # Get actual file paths for the mock responses
                actual_paths = list(file_infos.keys())
                step1_response = json.dumps([os.path.basename(actual_paths[0])])
                step2_response = json.dumps({os.path.basename(actual_paths[0]): ["Task"]})
                mock_service.chat_with_system_prompt.side_effect = [
                    step1_response,  # Step 1 response
                    step2_response   # Step 2 response
                ]
                mock_gemini.return_value = mock_service
                
                # Test the complete method
                result = await self.tool._identify_relevant_files_and_methods(
                    file_infos, 
                    "What are data fields of Task data model?", 
                    3
                )
                
                # Verify results
                assert len(result) == 1
                assert any("models.py" in f for f in result.keys())
                assert "Task" in result[list(result.keys())[0]]
    
    @pytest.mark.asyncio
    async def test_comprehensive_file_list_creation(self):
        """Test the creation of comprehensive file list for Step 1"""
        # Create mock file infos
        file_list = [
            {
                "path": "/path/to/models.py",
                "name": "models.py",
                "language": "python",
                "directory": "/path/to",
                "element_count": 3
            },
            {
                "path": "/path/to/agent_tools.py",
                "name": "agent_tools.py",
                "language": "python",
                "directory": "/path/to",
                "element_count": 5
            },
            {
                "path": "/path/to/services/task_service.py",
                "name": "task_service.py",
                "language": "python",
                "directory": "/path/to/services",
                "element_count": 4
            }
        ]
        
        # Test the method
        summary = self.tool._create_comprehensive_file_list_for_llm(file_list)
        
        # Verify the summary contains all files organized by directory
        assert "📁 /path/to/" in summary
        assert "📁 /path/to/services/" in summary
        assert "📄 models.py (python) - 3 elements" in summary
        assert "📄 agent_tools.py (python) - 5 elements" in summary
        assert "📄 task_service.py (python) - 4 elements" in summary
    
    @pytest.mark.asyncio
    async def test_detailed_elements_summary_creation(self):
        """Test the creation of detailed elements summary for Step 2"""
        # Create mock file infos
        file_infos = {}
        models_file = "/path/to/models.py"
        file_info = Mock()
        file_info.language = "python"
        file_info.elements = [
            self._create_mock_element("Task", "class"),
            self._create_mock_element("Memory", "class"),
            self._create_mock_element("Project", "class"),
        ]
        file_infos[models_file] = file_info
        
        relevant_files = [models_file]
        
        # Test the method
        summary = self.tool._create_detailed_elements_summary_for_llm(file_infos, relevant_files)
        
        # Verify the summary contains all elements without limits
        assert "📁 /path/to/models.py (python):" in summary
        assert "  • class: Task" in summary
        assert "  • class: Memory" in summary
        assert "  • class: Project" in summary
        assert summary.count("  • class:") == 3  # All elements included
