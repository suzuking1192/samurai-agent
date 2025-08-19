"""
Test to verify that virtual environment and library files are properly excluded
from code context extraction.
"""

import os
import tempfile
import shutil
from pathlib import Path
import pytest
from unittest.mock import patch, MagicMock

# Import the code parser
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.code_parser import CodeParser


class TestVirtualEnvExclusion:
    """Test that virtual environment files are properly excluded."""
    
    def setup_method(self):
        """Set up test environment."""
        self.code_parser = CodeParser()
        self.temp_dir = tempfile.mkdtemp()
        
    def teardown_method(self):
        """Clean up test environment."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_ignore_site_packages_files(self):
        """Test that files in site-packages are ignored."""
        # Create a mock site-packages structure
        site_packages_path = os.path.join(self.temp_dir, "lib", "python3.10", "site-packages")
        os.makedirs(site_packages_path, exist_ok=True)
        
        # Create a test file in site-packages
        test_file = os.path.join(site_packages_path, "test_library.py")
        with open(test_file, 'w') as f:
            f.write("def test_function():\n    pass\n")
        
        # Test that the file should be ignored
        assert self.code_parser.should_ignore_file(test_file), f"File {test_file} should be ignored"
    
    def test_ignore_dist_packages_files(self):
        """Test that files in dist-packages are ignored."""
        # Create a mock dist-packages structure
        dist_packages_path = os.path.join(self.temp_dir, "lib", "python3.10", "dist-packages")
        os.makedirs(dist_packages_path, exist_ok=True)
        
        # Create a test file in dist-packages
        test_file = os.path.join(dist_packages_path, "test_library.py")
        with open(test_file, 'w') as f:
            f.write("def test_function():\n    pass\n")
        
        # Test that the file should be ignored
        assert self.code_parser.should_ignore_file(test_file), f"File {test_file} should be ignored"
    
    def test_ignore_lib64_site_packages_files(self):
        """Test that files in lib64/site-packages are ignored."""
        # Create a mock lib64/site-packages structure
        site_packages_path = os.path.join(self.temp_dir, "lib64", "python3.10", "site-packages")
        os.makedirs(site_packages_path, exist_ok=True)
        
        # Create a test file in site-packages
        test_file = os.path.join(site_packages_path, "test_library.py")
        with open(test_file, 'w') as f:
            f.write("def test_function():\n    pass\n")
        
        # Test that the file should be ignored
        assert self.code_parser.should_ignore_file(test_file), f"File {test_file} should be ignored"
    
    def test_ignore_venv_directory_files(self):
        """Test that files in venv directories are ignored."""
        # Create a mock venv structure
        venv_path = os.path.join(self.temp_dir, "venv")
        site_packages_path = os.path.join(venv_path, "lib", "python3.10", "site-packages")
        os.makedirs(site_packages_path, exist_ok=True)
        
        # Create a test file in venv
        test_file = os.path.join(site_packages_path, "test_library.py")
        with open(test_file, 'w') as f:
            f.write("def test_function():\n    pass\n")
        
        # Test that the file should be ignored
        assert self.code_parser.should_ignore_file(test_file), f"File {test_file} should be ignored"
    
    def test_ignore_node_modules_files(self):
        """Test that files in node_modules are ignored."""
        # Create a mock node_modules structure
        node_modules_path = os.path.join(self.temp_dir, "node_modules")
        os.makedirs(node_modules_path, exist_ok=True)
        
        # Create a test file in node_modules
        test_file = os.path.join(node_modules_path, "test_package", "index.js")
        os.makedirs(os.path.dirname(test_file), exist_ok=True)
        with open(test_file, 'w') as f:
            f.write("function testFunction() {\n    console.log('test');\n}")
        
        # Test that the file should be ignored
        assert self.code_parser.should_ignore_file(test_file), f"File {test_file} should be ignored"
    
    def test_allow_user_code_files(self):
        """Test that user-written code files are NOT ignored."""
        # Create a user code file
        user_file = os.path.join(self.temp_dir, "main.py")
        with open(user_file, 'w') as f:
            f.write("def main():\n    print('Hello, World!')\n")
        
        # Test that the file should NOT be ignored
        assert not self.code_parser.should_ignore_file(user_file), f"File {user_file} should NOT be ignored"
    
    def test_allow_user_code_in_subdirectories(self):
        """Test that user code in subdirectories is NOT ignored."""
        # Create a user code file in a subdirectory
        user_dir = os.path.join(self.temp_dir, "src", "app")
        os.makedirs(user_dir, exist_ok=True)
        user_file = os.path.join(user_dir, "main.py")
        with open(user_file, 'w') as f:
            f.write("def main():\n    print('Hello, World!')\n")
        
        # Test that the file should NOT be ignored
        assert not self.code_parser.should_ignore_file(user_file), f"File {user_file} should NOT be ignored"
    
    def test_ignore_specific_virtual_env_path(self):
        """Test the specific path that was causing issues in the logs."""
        # Recreate the problematic path from the logs
        problematic_path = "/Users/yutosuzuki/code/samurai-agent/backend/samurai-agent/lib/python3.10/site-packages/sympy/plotting/pygletplot/plot_camera.py"
        
        # Test that this path should be ignored
        assert self.code_parser.should_ignore_file(problematic_path), f"Path {problematic_path} should be ignored"
    
    def test_scan_codebase_excludes_virtual_env_files(self):
        """Test that scan_codebase excludes virtual environment files."""
        # Create a mixed structure with both user code and virtual env files
        user_file = os.path.join(self.temp_dir, "main.py")
        with open(user_file, 'w') as f:
            f.write("def main():\n    print('Hello, World!')\n")
        
        # Create a virtual env file
        venv_path = os.path.join(self.temp_dir, "venv", "lib", "python3.10", "site-packages")
        os.makedirs(venv_path, exist_ok=True)
        venv_file = os.path.join(venv_path, "test_library.py")
        with open(venv_file, 'w') as f:
            f.write("def library_function():\n    pass\n")
        
        # Scan the codebase
        file_infos = self.code_parser.scan_codebase(self.temp_dir)
        
        # Check that only user files are included
        file_paths = list(file_infos.keys())
        
        # Resolve paths to handle symlinks (macOS /var/folders/ -> /private/var/folders/)
        resolved_user_file = os.path.realpath(user_file)
        resolved_venv_file = os.path.realpath(venv_file)
        resolved_file_paths = [os.path.realpath(fp) for fp in file_paths]
        
        # Should include the user file (check both original and resolved paths)
        user_file_found = (user_file in file_paths or resolved_user_file in resolved_file_paths)
        assert user_file_found, f"User file {user_file} (resolved: {resolved_user_file}) should be included in {file_paths}"
        
        # Should NOT include the virtual env file (check both original and resolved paths)
        venv_file_found = (venv_file in file_paths or resolved_venv_file in resolved_file_paths)
        assert not venv_file_found, f"Virtual env file {venv_file} (resolved: {resolved_venv_file}) should NOT be included"
        
        # Should only have user files (no virtual env files)
        # Count files that are NOT virtual env files
        user_file_count = 0
        for file_path in file_paths:
            if not self.code_parser.should_ignore_file(file_path):
                user_file_count += 1
        
        assert user_file_count >= 1, f"Should have at least 1 user file, but got {user_file_count}"


if __name__ == "__main__":
    # Run the tests
    test_instance = TestVirtualEnvExclusion()
    
    print("Running virtual environment exclusion tests...")
    
    test_instance.setup_method()
    
    try:
        test_instance.test_ignore_site_packages_files()
        print("✓ test_ignore_site_packages_files passed")
        
        test_instance.test_ignore_dist_packages_files()
        print("✓ test_ignore_dist_packages_files passed")
        
        test_instance.test_ignore_lib64_site_packages_files()
        print("✓ test_ignore_lib64_site_packages_files passed")
        
        test_instance.test_ignore_venv_directory_files()
        print("✓ test_ignore_venv_directory_files passed")
        
        test_instance.test_ignore_node_modules_files()
        print("✓ test_ignore_node_modules_files passed")
        
        test_instance.test_allow_user_code_files()
        print("✓ test_allow_user_code_files passed")
        
        test_instance.test_allow_user_code_in_subdirectories()
        print("✓ test_allow_user_code_in_subdirectories passed")
        
        test_instance.test_ignore_specific_virtual_env_path()
        print("✓ test_ignore_specific_virtual_env_path passed")
        
        test_instance.test_scan_codebase_excludes_virtual_env_files()
        print("✓ test_scan_codebase_excludes_virtual_env_files passed")
        
        print("\n🎉 All tests passed! Virtual environment exclusion is working correctly.")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        raise
    finally:
        test_instance.teardown_method()
