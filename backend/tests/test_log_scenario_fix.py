import unittest
import sys
import os
import tempfile
import json
from unittest.mock import Mock, patch

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.agent_tools import ExtractCodeContextTool
from services.code_parser import CodeElement, FileInfo

class TestLogScenarioFix(unittest.TestCase):
    
    def setUp(self):
        self.extract_tool = ExtractCodeContextTool()
        
        # Create mock file info that matches the scenario from the logs
        self.mock_elements = [
            CodeElement(name="CompactTaskItemProps", type="interface", line_number=10, file_path="test.tsx"),
            CodeElement(name="getStatusIcon", type="function", line_number=20, file_path="test.tsx"),
            CodeElement(name="getPriorityIcon", type="function", line_number=30, file_path="test.tsx"),
            CodeElement(name="getStatusColor", type="function", line_number=40, file_path="test.tsx"),
            CodeElement(name="formatDate", type="function", line_number=50, file_path="test.tsx"),
            CodeElement(name="handleItemClick", type="arrow_function", line_number=60, file_path="test.tsx"),
            CodeElement(name="handleStatusChange", type="arrow_function", line_number=70, file_path="test.tsx"),
        ]
        
        self.mock_file_info = FileInfo(
            path="test.tsx",
            name="test.tsx",
            extension=".tsx",
            language="typescript",
            size=1000,
            elements=self.mock_elements,
            last_modified=1234567890.0
        )
    
    def test_log_scenario_method_matching(self):
        """Test the exact scenario from the logs where LLM returns prefixed method names"""
        
        # These are the exact method names that the LLM returned in the logs
        llm_method_names = [
            "interface CompactTaskItemProps",
            "arrow_function: handleItemClick", 
            "arrow_function: getStatusIcon",
            "arrow_function: getPriorityIcon",
            "arrow_function: getStatusColor",
            "arrow_function: formatDate",
            "arrow_function: handleStatusChange",
        ]
        
        # Test that our improved matching finds all of them
        for llm_method_name in llm_method_names:
            with self.subTest(llm_method_name=llm_method_name):
                matched_element = self.extract_tool._find_matching_element(llm_method_name, self.mock_elements)
                
                self.assertIsNotNone(matched_element, f"Should find match for '{llm_method_name}'")
                
                # Extract the expected element name (remove prefix)
                expected_name = llm_method_name
                if llm_method_name.startswith("interface "):
                    expected_name = llm_method_name[len("interface "):]
                elif llm_method_name.startswith("arrow_function: "):
                    expected_name = llm_method_name[len("arrow_function: "):]
                
                self.assertEqual(matched_element.name, expected_name, 
                               f"Should match '{expected_name}' for '{llm_method_name}'")
    
    def test_old_logic_would_fail(self):
        """Verify that the old logic would indeed fail for these cases"""
        
        llm_method_names = [
            "interface CompactTaskItemProps",
            "arrow_function: handleItemClick",
        ]
        
        for llm_method_name in llm_method_names:
            with self.subTest(llm_method_name=llm_method_name):
                # Simulate the old logic (simple string comparison)
                found_with_old_logic = False
                for element in self.mock_elements:
                    if element.name.lower() == llm_method_name.lower():
                        found_with_old_logic = True
                        break
                
                # The old logic should fail
                self.assertFalse(found_with_old_logic, 
                               f"Old logic should NOT find '{llm_method_name}'")
                
                # The new logic should succeed
                matched_element = self.extract_tool._find_matching_element(llm_method_name, self.mock_elements)
                self.assertIsNotNone(matched_element, 
                                   f"New logic should find '{llm_method_name}'")
    
    def test_method_matching_integration_simulation(self):
        """Simulate the integration where the method matching is used"""
        
        # Simulate the file_methods_map that would be created
        file_methods_map = {
            "test.tsx": ["interface CompactTaskItemProps", "arrow_function: handleItemClick"]
        }
        
        # Simulate the file_infos dictionary
        file_infos = {
            "test.tsx": self.mock_file_info
        }
        
        # Simulate the method matching logic from the actual code
        valid_file_methods = {}
        
        for file_path, methods in file_methods_map.items():
            if file_path in file_infos:
                file_info = file_infos[file_path]
                valid_methods = []
                
                for method in methods:
                    matched_element = self.extract_tool._find_matching_element(method, file_info.elements)
                    if matched_element:
                        valid_methods.append(matched_element.name)
                
                if valid_methods:
                    valid_file_methods[file_path] = valid_methods
        
        # Verify that we found the expected methods
        self.assertIn("test.tsx", valid_file_methods)
        self.assertIn("CompactTaskItemProps", valid_file_methods["test.tsx"])
        self.assertIn("handleItemClick", valid_file_methods["test.tsx"])
        self.assertEqual(len(valid_file_methods["test.tsx"]), 2)

if __name__ == "__main__":
    unittest.main()
