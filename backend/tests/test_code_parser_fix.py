import unittest
import tempfile
import os
from pathlib import Path
from services.code_parser import CodeParser


class TestCodeParserFix(unittest.TestCase):
    """Test that the duplicate regex issue has been fixed."""
    
    def setUp(self):
        self.parser = CodeParser()
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_python_function_method_distinction(self):
        """Test that Python functions and methods are properly distinguished."""
        # Create a test Python file with both functions and methods
        test_code = '''#!/usr/bin/env python3
"""Test file for function/method distinction."""

def standalone_function():
    """This is a standalone function."""
    pass

class TestClass:
    """A test class with methods."""
    
    def __init__(self):
        """Constructor method."""
        pass
    
    def instance_method(self):
        """This is an instance method."""
        pass
    
    @classmethod
    def class_method(cls):
        """This is a class method."""
        pass
    
    @staticmethod
    def static_method():
        """This is a static method."""
        pass

def another_function():
    """Another standalone function."""
    pass

class AnotherClass:
    """Another test class."""
    
    def method_in_class(self):
        """Method in another class."""
        pass
'''
        
        test_file = Path(self.temp_dir) / "test_file.py"
        with open(test_file, 'w') as f:
            f.write(test_code)
        
        # Extract elements
        elements = self.parser.extract_elements_from_file(str(test_file), 'python')
        
        # Verify no duplicates
        element_names = [elem.name for elem in elements]
        self.assertEqual(len(element_names), len(set(element_names)), 
                        "Duplicate element names found")
        
        # Verify correct classification
        element_types = {elem.name: elem.type for elem in elements}
        
        # Check standalone functions
        self.assertEqual(element_types['standalone_function'], 'function')
        self.assertEqual(element_types['another_function'], 'function')
        
        # Check classes
        self.assertEqual(element_types['TestClass'], 'class')
        self.assertEqual(element_types['AnotherClass'], 'class')
        
        # Check methods
        self.assertEqual(element_types['__init__'], 'method')
        self.assertEqual(element_types['instance_method'], 'method')
        self.assertEqual(element_types['class_method'], 'method')
        self.assertEqual(element_types['static_method'], 'method')
        self.assertEqual(element_types['method_in_class'], 'method')
        
        # Verify total count (2 classes + 2 functions + 5 methods = 9 elements)
        self.assertEqual(len(elements), 9)
    
    def test_no_duplicate_regex_patterns(self):
        """Test that there are no duplicate regex patterns in the element_patterns."""
        python_patterns = self.parser.element_patterns.get('python', {})
        
        # Check that 'method' is not in the patterns (it was removed)
        self.assertNotIn('method', python_patterns)
        
        # Check that 'function' and 'class' are present
        self.assertIn('function', python_patterns)
        self.assertIn('class', python_patterns)
        
        # Verify that the function pattern is correct
        function_pattern = python_patterns['function']
        self.assertEqual(function_pattern, r'^\s*(?:async\s+)?def\s+(\w+)\s*\(')
    
    def test_async_function_handling(self):
        """Test that async functions are properly handled."""
        test_code = '''#!/usr/bin/env python3

async def async_function():
    """Async standalone function."""
    pass

class AsyncClass:
    """Class with async methods."""
    
    async def async_method(self):
        """Async instance method."""
        pass
    
    def sync_method(self):
        """Sync method."""
        pass

async def another_async_function():
    """Another async function."""
    pass
'''
        
        test_file = Path(self.temp_dir) / "async_test.py"
        with open(test_file, 'w') as f:
            f.write(test_code)
        
        elements = self.parser.extract_elements_from_file(str(test_file), 'python')
        
        # Verify no duplicates
        element_names = [elem.name for elem in elements]
        self.assertEqual(len(element_names), len(set(element_names)))
        
        # Verify correct classification
        element_types = {elem.name: elem.type for elem in elements}
        
        self.assertEqual(element_types['async_function'], 'function')
        self.assertEqual(element_types['another_async_function'], 'function')
        self.assertEqual(element_types['AsyncClass'], 'class')
        self.assertEqual(element_types['async_method'], 'method')
        self.assertEqual(element_types['sync_method'], 'method')
        
        # Verify total count (1 class + 2 functions + 2 methods = 5 elements)
        self.assertEqual(len(elements), 5)


if __name__ == '__main__':
    unittest.main()
