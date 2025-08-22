import unittest
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.agent_tools import AgentToolRegistry
from services.code_parser import CodeElement, FileInfo

class TestMethodMatchingFix(unittest.TestCase):
    
    def setUp(self):
        self.agent_tools = AgentToolRegistry()
    
    def test_method_matching_with_prefixes(self):
        """Test that method matching works with LLM prefixes like 'interface ' and 'arrow_function: '"""
        
        # Create mock file info with actual element names (without prefixes)
        mock_elements = [
            CodeElement(name="CompactTaskItemProps", type="interface", line_number=10, file_path="test.tsx"),
            CodeElement(name="handleItemClick", type="arrow_function", line_number=20, file_path="test.tsx"),
            CodeElement(name="getStatusIcon", type="function", line_number=30, file_path="test.tsx"),
            CodeElement(name="TaskListViewProps", type="interface", line_number=40, file_path="test.tsx"),
        ]
        
        mock_file_info = FileInfo(
            path="test.tsx",
            name="test.tsx",
            extension=".tsx",
            language="typescript",
            size=1000,
            elements=mock_elements,
            last_modified=1234567890.0
        )
        
        # Test cases: LLM method names with prefixes vs actual element names
        test_cases = [
            # LLM method name -> expected actual element name
            ("interface CompactTaskItemProps", "CompactTaskItemProps"),
            ("arrow_function: handleItemClick", "handleItemClick"),
            ("function getStatusIcon", "getStatusIcon"),
            ("interface TaskListViewProps", "TaskListViewProps"),
            # Also test without prefixes
            ("CompactTaskItemProps", "CompactTaskItemProps"),
            ("handleItemClick", "handleItemClick"),
        ]
        
        for llm_method_name, expected_element_name in test_cases:
            with self.subTest(llm_method_name=llm_method_name):
                # Test the current matching logic (should fail for prefixed names)
                found_with_current = False
                for element in mock_file_info.elements:
                    if element.name.lower() == llm_method_name.lower():
                        found_with_current = True
                        break
                
                # Test improved matching logic
                found_with_improved = self._improved_method_matching(llm_method_name, mock_file_info.elements)
                
                print(f"LLM method: '{llm_method_name}' -> Expected: '{expected_element_name}'")
                print(f"  Current logic found: {found_with_current}")
                print(f"  Improved logic found: {found_with_improved}")
                print()
                
                # The improved logic should find matches for all cases
                self.assertTrue(found_with_improved, f"Improved logic should find '{expected_element_name}' for '{llm_method_name}'")
    
    def _improved_method_matching(self, llm_method_name: str, elements: list) -> bool:
        """Improved method matching that handles LLM prefixes"""
        # Remove common LLM prefixes
        prefixes_to_remove = [
            "interface ",
            "arrow_function: ",
            "function ",
            "class ",
            "method ",
            "const ",
            "let ",
            "var ",
        ]
        
        cleaned_method_name = llm_method_name
        for prefix in prefixes_to_remove:
            if cleaned_method_name.lower().startswith(prefix.lower()):
                cleaned_method_name = cleaned_method_name[len(prefix):]
                break
        
        # Try exact match first
        for element in elements:
            if element.name.lower() == cleaned_method_name.lower():
                return True
        
        # Try partial match (in case LLM adds extra words)
        for element in elements:
            if cleaned_method_name.lower() in element.name.lower() or element.name.lower() in cleaned_method_name.lower():
                return True
        
        return False

if __name__ == "__main__":
    unittest.main()
