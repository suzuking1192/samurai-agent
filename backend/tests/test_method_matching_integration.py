import unittest
import asyncio
import sys
import os
import tempfile
import json
from pathlib import Path

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.tools.agent_tools import ExtractCodeContextTool
from services.code_parser import CodeElement, FileInfo

class TestMethodMatchingIntegration(unittest.TestCase):
    
    def setUp(self):
        self.extract_tool = ExtractCodeContextTool()
        
        # Create a temporary directory with test files
        self.temp_dir = tempfile.mkdtemp()
        self.test_file_path = os.path.join(self.temp_dir, "test_component.tsx")
        
        # Create a test TypeScript/React file with various elements
        test_content = '''
import React from 'react';

interface CompactTaskItemProps {
    task: Task;
    onToggleExpand: () => void;
    isExpanded: boolean;
}

const CompactTaskItem: React.FC<CompactTaskItemProps> = ({ task, onToggleExpand, isExpanded }) => {
    const handleItemClick = () => {
        onToggleExpand();
    };
    
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return '✅';
            case 'in_progress':
                return '🔄';
            default:
                return '⏳';
        }
    };
    
    const getPriorityIcon = (priority: string) => {
        switch (priority) {
            case 'high':
                return '🔴';
            case 'medium':
                return '🟡';
            default:
                return '🟢';
        }
    };
    
    return (
        <div onClick={handleItemClick}>
            {getStatusIcon(task.status)} {task.title}
        </div>
    );
};

interface TaskListViewProps {
    tasks: Task[];
    onTaskSelect: (task: Task) => void;
}

export default CompactTaskItem;
'''
        
        with open(self.test_file_path, 'w') as f:
            f.write(test_content)
    
    def tearDown(self):
        # Clean up temporary files
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_find_matching_element_with_prefixes(self):
        """Test that _find_matching_element correctly handles LLM prefixes"""
        
        # Create mock elements based on our test file
        elements = [
            CodeElement(name="CompactTaskItemProps", type="interface", line_number=4, file_path=self.test_file_path),
            CodeElement(name="CompactTaskItem", type="const", line_number=8, file_path=self.test_file_path),
            CodeElement(name="handleItemClick", type="arrow_function", line_number=9, file_path=self.test_file_path),
            CodeElement(name="getStatusIcon", type="function", line_number=13, file_path=self.test_file_path),
            CodeElement(name="getPriorityIcon", type="function", line_number=22, file_path=self.test_file_path),
            CodeElement(name="TaskListViewProps", type="interface", line_number=32, file_path=self.test_file_path),
        ]
        
        # Test cases: LLM method names with prefixes
        test_cases = [
            ("interface CompactTaskItemProps", "CompactTaskItemProps"),
            ("arrow_function: handleItemClick", "handleItemClick"),
            ("function getStatusIcon", "getStatusIcon"),
            ("function getPriorityIcon", "getPriorityIcon"),
            ("interface TaskListViewProps", "TaskListViewProps"),
            ("const CompactTaskItem", "CompactTaskItem"),
        ]
        
        for llm_method_name, expected_element_name in test_cases:
            with self.subTest(llm_method_name=llm_method_name):
                matched_element = self.extract_tool._find_matching_element(llm_method_name, elements)
                
                self.assertIsNotNone(matched_element, f"Should find match for '{llm_method_name}'")
                self.assertEqual(matched_element.name, expected_element_name, 
                               f"Should match '{expected_element_name}' for '{llm_method_name}'")
    
    def test_find_matching_element_without_prefixes(self):
        """Test that _find_matching_element works with method names without prefixes"""
        
        elements = [
            CodeElement(name="handleItemClick", type="arrow_function", line_number=9, file_path=self.test_file_path),
            CodeElement(name="getStatusIcon", type="function", line_number=13, file_path=self.test_file_path),
        ]
        
        # Test cases: method names without prefixes
        test_cases = [
            ("handleItemClick", "handleItemClick"),
            ("getStatusIcon", "getStatusIcon"),
        ]
        
        for llm_method_name, expected_element_name in test_cases:
            with self.subTest(llm_method_name=llm_method_name):
                matched_element = self.extract_tool._find_matching_element(llm_method_name, elements)
                
                self.assertIsNotNone(matched_element, f"Should find match for '{llm_method_name}'")
                self.assertEqual(matched_element.name, expected_element_name, 
                               f"Should match '{expected_element_name}' for '{llm_method_name}'")
    
    def test_find_matching_element_no_match(self):
        """Test that _find_matching_element returns None when no match is found"""
        
        elements = [
            CodeElement(name="handleItemClick", type="arrow_function", line_number=9, file_path=self.test_file_path),
        ]
        
        # Test cases: method names that don't exist
        test_cases = [
            "interface NonExistentInterface",
            "function nonExistentFunction",
            "randomMethodName",
        ]
        
        for llm_method_name in test_cases:
            with self.subTest(llm_method_name=llm_method_name):
                matched_element = self.extract_tool._find_matching_element(llm_method_name, elements)
                
                self.assertIsNone(matched_element, f"Should not find match for '{llm_method_name}'")
    
    def test_find_matching_element_case_insensitive(self):
        """Test that _find_matching_element is case insensitive"""
        
        elements = [
            CodeElement(name="HandleItemClick", type="arrow_function", line_number=9, file_path=self.test_file_path),
            CodeElement(name="getStatusIcon", type="function", line_number=13, file_path=self.test_file_path),
        ]
        
        # Test cases: different case variations
        test_cases = [
            ("interface handleitemclick", "HandleItemClick"),
            ("FUNCTION GETSTATUSICON", "getStatusIcon"),
            ("arrow_function: HandleItemClick", "HandleItemClick"),
        ]
        
        for llm_method_name, expected_element_name in test_cases:
            with self.subTest(llm_method_name=llm_method_name):
                matched_element = self.extract_tool._find_matching_element(llm_method_name, elements)
                
                self.assertIsNotNone(matched_element, f"Should find match for '{llm_method_name}'")
                self.assertEqual(matched_element.name, expected_element_name, 
                               f"Should match '{expected_element_name}' for '{llm_method_name}'")

if __name__ == "__main__":
    unittest.main()
