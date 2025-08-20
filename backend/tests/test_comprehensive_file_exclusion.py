"""
Comprehensive tests to verify that non-functional files (documentation, images, PDFs, etc.) 
are properly excluded from code context extraction.
"""

import os
import tempfile
import shutil
from pathlib import Path
import pytest

# Import the code parser
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.code_parser import CodeParser


class TestComprehensiveFileExclusion:
    """Test that non-functional files are properly excluded while functional code is included."""
    
    def setup_method(self):
        """Set up test environment."""
        self.code_parser = CodeParser()
        self.temp_dir = tempfile.mkdtemp()
        
    def teardown_method(self):
        """Clean up test environment."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_ignore_documentation_files(self):
        """Test that documentation files are ignored."""
        doc_files = [
            "README.md",
            "readme.md", 
            "CHANGELOG.md",
            "HISTORY.md",
            "CONTRIBUTING.md",
            "CODE_OF_CONDUCT.md",
            "LICENSE",
            "LICENSE.md",
            "docs.txt",
            "manual.pdf",
            "guide.doc",
            "spec.docx",
            "notes.rtf",
            "paper.tex"
        ]
        
        for filename in doc_files:
            file_path = os.path.join(self.temp_dir, filename)
            with open(file_path, 'w') as f:
                f.write("This is documentation content.")
            
            assert self.code_parser.should_ignore_file(file_path), f"Documentation file {filename} should be ignored"
            assert not self.code_parser.is_functional_code_file(file_path), f"Documentation file {filename} should not be considered functional code"
    
    def test_ignore_image_files(self):
        """Test that image files are ignored."""
        image_files = [
            "logo.png",
            "screenshot.jpg",
            "diagram.jpeg",
            "icon.gif",
            "banner.bmp",
            "chart.tiff",
            "photo.webp",
            "favicon.ico",
            "app-icon.icns"
        ]
        
        for filename in image_files:
            file_path = os.path.join(self.temp_dir, filename)
            # Create a dummy file
            with open(file_path, 'wb') as f:
                f.write(b"fake image data")
            
            assert self.code_parser.should_ignore_file(file_path), f"Image file {filename} should be ignored"
            assert not self.code_parser.is_functional_code_file(file_path), f"Image file {filename} should not be considered functional code"
    
    def test_ignore_font_files(self):
        """Test that font files are ignored."""
        font_files = [
            "arial.woff",
            "roboto.woff2",
            "opensans.ttf",
            "helvetica.otf",
            "icon-font.eot"
        ]
        
        for filename in font_files:
            file_path = os.path.join(self.temp_dir, filename)
            with open(file_path, 'wb') as f:
                f.write(b"fake font data")
            
            assert self.code_parser.should_ignore_file(file_path), f"Font file {filename} should be ignored"
            assert not self.code_parser.is_functional_code_file(file_path), f"Font file {filename} should not be considered functional code"
    
    def test_ignore_media_files(self):
        """Test that audio and video files are ignored."""
        media_files = [
            "demo.mp4",
            "tutorial.avi",
            "presentation.mov",
            "background.mp3",
            "sound.wav",
            "music.flac",
            "voice.aac",
            "podcast.ogg"
        ]
        
        for filename in media_files:
            file_path = os.path.join(self.temp_dir, filename)
            with open(file_path, 'wb') as f:
                f.write(b"fake media data")
            
            assert self.code_parser.should_ignore_file(file_path), f"Media file {filename} should be ignored"
            assert not self.code_parser.is_functional_code_file(file_path), f"Media file {filename} should not be considered functional code"
    
    def test_ignore_archive_files(self):
        """Test that archive files are ignored."""
        archive_files = [
            "backup.zip",
            "source.tar",
            "data.gz",
            "assets.rar",
            "installer.7z",
            "disk.dmg",
            "system.iso"
        ]
        
        for filename in archive_files:
            file_path = os.path.join(self.temp_dir, filename)
            with open(file_path, 'wb') as f:
                f.write(b"fake archive data")
            
            assert self.code_parser.should_ignore_file(file_path), f"Archive file {filename} should be ignored"
            assert not self.code_parser.is_functional_code_file(file_path), f"Archive file {filename} should not be considered functional code"
    
    def test_ignore_database_and_data_files(self):
        """Test that database and data files are ignored."""
        data_files = [
            "data.db",
            "users.sqlite",
            "cache.sqlite3",
            "export.csv",
            "report.xlsx",
            "spreadsheet.xls",
            "presentation.ppt",
            "slides.pptx"
        ]
        
        for filename in data_files:
            file_path = os.path.join(self.temp_dir, filename)
            with open(file_path, 'wb') as f:
                f.write(b"fake data")
            
            assert self.code_parser.should_ignore_file(file_path), f"Data file {filename} should be ignored"
            assert not self.code_parser.is_functional_code_file(file_path), f"Data file {filename} should not be considered functional code"
    
    def test_ignore_executable_files(self):
        """Test that executable and binary files are ignored."""
        executable_files = [
            "app.exe",
            "library.dll",
            "libmath.so",
            "framework.dylib",
            "program.bin",
            "MyApp.app",
            "package.deb",
            "installer.msi"
        ]
        
        for filename in executable_files:
            file_path = os.path.join(self.temp_dir, filename)
            with open(file_path, 'wb') as f:
                f.write(b"fake binary data")
            
            assert self.code_parser.should_ignore_file(file_path), f"Executable file {filename} should be ignored"
            assert not self.code_parser.is_functional_code_file(file_path), f"Executable file {filename} should not be considered functional code"
    
    def test_ignore_temporary_files(self):
        """Test that temporary and cache files are ignored."""
        temp_files = [
            "temp.cache",
            "data.tmp",
            "session.temp",
            "process.lock",
            "app.pid",
            "backup~",
            "conflict.orig",
            "failed.rej"
        ]
        
        for filename in temp_files:
            file_path = os.path.join(self.temp_dir, filename)
            with open(file_path, 'w') as f:
                f.write("temporary data")
            
            assert self.code_parser.should_ignore_file(file_path), f"Temporary file {filename} should be ignored"
            assert not self.code_parser.is_functional_code_file(file_path), f"Temporary file {filename} should not be considered functional code"
    
    def test_include_functional_code_files(self):
        """Test that functional code files are NOT ignored."""
        code_files = {
            # Core programming languages
            "main.py": "def main():\n    print('Hello, World!')",
            "app.js": "function main() { console.log('Hello'); }",
            "component.tsx": "export const Component = () => <div>Hello</div>;",
            "service.java": "public class Service { public void run() {} }",
            "utils.cpp": "#include <iostream>\nint main() { return 0; }",
            "config.h": "#ifndef CONFIG_H\n#define CONFIG_H\n#endif",
            "program.cs": "using System; class Program { static void Main() {} }",
            "server.go": "package main\nfunc main() { fmt.Println(\"Hello\") }",
            "lib.rs": "fn main() { println!(\"Hello, world!\"); }",
            "api.php": "<?php echo 'Hello World'; ?>",
            "script.rb": "puts 'Hello, World!'",
            
            # Web technologies
            "index.html": "<html><body>Hello</body></html>",
            "styles.css": "body { margin: 0; }",
            "theme.scss": "$primary: #007bff; body { color: $primary; }",
            
            # Scripts and configuration
            "deploy.sh": "#!/bin/bash\necho 'Deploying...'",
            "setup.bat": "@echo off\necho Setting up...",
            "build.ps1": "Write-Host 'Building project...'",
            "schema.sql": "CREATE TABLE users (id INT PRIMARY KEY);",
            "api.graphql": "type User { id: ID! name: String! }",
            
            # Essential config files
            "package.json": '{"name": "test", "version": "1.0.0"}',
            "tsconfig.json": '{"compilerOptions": {"target": "es5"}}',
            "webpack.config.js": "module.exports = { entry: './src/index.js' };",
            "requirements.txt": "flask==2.0.1\nrequests==2.25.1",
            "Cargo.toml": "[package]\nname = \"test\"\nversion = \"0.1.0\"",
            "Dockerfile": "FROM node:14\nWORKDIR /app\nCOPY . .",
        }
        
        for filename, content in code_files.items():
            file_path = os.path.join(self.temp_dir, filename)
            with open(file_path, 'w') as f:
                f.write(content)
            
            assert not self.code_parser.should_ignore_file(file_path), f"Code file {filename} should NOT be ignored"
            assert self.code_parser.is_functional_code_file(file_path), f"Code file {filename} should be considered functional code"
    
    def test_scan_codebase_excludes_non_functional_files(self):
        """Test that scan_codebase excludes non-functional files and includes only functional code."""
        # Create functional code files
        functional_files = {
            "src/main.py": "def main():\n    print('Hello, World!')",
            "src/utils.js": "export function helper() { return 'help'; }",
            "package.json": '{"name": "test", "version": "1.0.0"}',
            "tsconfig.json": '{"compilerOptions": {"target": "es5"}}',
        }
        
        # Create non-functional files
        non_functional_files = {
            "README.md": "# Project Documentation",
            "docs/api.md": "## API Documentation",
            "images/logo.png": "fake image data",
            "assets/video.mp4": "fake video data",
            "data/export.csv": "name,email\nJohn,john@example.com",
            "backup.zip": "fake archive data",
            "temp/cache.tmp": "temporary data",
        }
        
        # Create all files
        all_files = {**functional_files, **non_functional_files}
        for filepath, content in all_files.items():
            full_path = os.path.join(self.temp_dir, filepath)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            
            if filepath in non_functional_files:
                # Write binary data for some non-functional files
                if filepath.endswith(('.png', '.mp4', '.zip')):
                    with open(full_path, 'wb') as f:
                        f.write(content.encode() if isinstance(content, str) else content)
                else:
                    with open(full_path, 'w') as f:
                        f.write(content)
            else:
                with open(full_path, 'w') as f:
                    f.write(content)
        
        # Scan the codebase
        file_infos = self.code_parser.scan_codebase(self.temp_dir)
        scanned_file_paths = list(file_infos.keys())
        scanned_file_names = [os.path.basename(path) for path in scanned_file_paths]
        
        # Check that functional files are included
        for filename in functional_files.keys():
            basename = os.path.basename(filename)
            assert basename in scanned_file_names, f"Functional file {basename} should be included in scan results"
        
        # Check that non-functional files are excluded
        for filename in non_functional_files.keys():
            basename = os.path.basename(filename)
            assert basename not in scanned_file_names, f"Non-functional file {basename} should be excluded from scan results"
        
        # Verify we have only functional files (allow more than expected due to improved detection)
        expected_functional_count = len(functional_files)
        actual_count = len(file_infos)
        assert actual_count >= expected_functional_count, f"Expected at least {expected_functional_count} functional files, but got {actual_count}"
        
        # Verify all scanned files are functional
        for file_path in scanned_file_paths:
            assert self.code_parser.is_functional_code_file(file_path), f"Scanned file {file_path} should be functional code"
        
        print(f"✓ Successfully scanned {actual_count} functional files and excluded {len(non_functional_files)} non-functional files")
        print(f"✓ Included files: {scanned_file_names}")
    
    def test_specific_file_types_edge_cases(self):
        """Test edge cases for specific file types."""
        edge_cases = [
            # Should be ignored
            ("docs/README.MD", False),  # Uppercase .MD
            ("DOCS.TXT", False),        # Uppercase .TXT
            ("Image.PNG", False),       # Uppercase .PNG
            ("Video.MP4", False),       # Uppercase .MP4
            ("Archive.ZIP", False),     # Uppercase .ZIP
            
            # Should be included
            ("script.JS", True),        # Uppercase .JS
            ("Component.TSX", True),    # Uppercase .TSX
            ("Service.PY", True),       # Uppercase .PY
            ("Makefile", True),         # No extension
            ("dockerfile", True),       # No extension, lowercase
        ]
        
        for filename, should_be_functional in edge_cases:
            file_path = os.path.join(self.temp_dir, filename)
            with open(file_path, 'w') as f:
                f.write("test content")
            
            is_functional = self.code_parser.is_functional_code_file(file_path)
            should_ignore = self.code_parser.should_ignore_file(file_path)
            
            if should_be_functional:
                assert is_functional, f"File {filename} should be considered functional code"
                assert not should_ignore, f"File {filename} should NOT be ignored"
            else:
                assert not is_functional, f"File {filename} should NOT be considered functional code"
                # Note: should_ignore might be False if it's not in ignore patterns but still not functional


if __name__ == "__main__":
    # Run the tests
    test_instance = TestComprehensiveFileExclusion()
    
    print("Running comprehensive file exclusion tests...")
    
    test_instance.setup_method()
    
    try:
        test_instance.test_ignore_documentation_files()
        print("✓ test_ignore_documentation_files passed")
        
        test_instance.test_ignore_image_files()
        print("✓ test_ignore_image_files passed")
        
        test_instance.test_ignore_font_files()
        print("✓ test_ignore_font_files passed")
        
        test_instance.test_ignore_media_files()
        print("✓ test_ignore_media_files passed")
        
        test_instance.test_ignore_archive_files()
        print("✓ test_ignore_archive_files passed")
        
        test_instance.test_ignore_database_and_data_files()
        print("✓ test_ignore_database_and_data_files passed")
        
        test_instance.test_ignore_executable_files()
        print("✓ test_ignore_executable_files passed")
        
        test_instance.test_ignore_temporary_files()
        print("✓ test_ignore_temporary_files passed")
        
        test_instance.test_include_functional_code_files()
        print("✓ test_include_functional_code_files passed")
        
        test_instance.test_scan_codebase_excludes_non_functional_files()
        print("✓ test_scan_codebase_excludes_non_functional_files passed")
        
        test_instance.test_specific_file_types_edge_cases()
        print("✓ test_specific_file_types_edge_cases passed")
        
        print("\n🎉 All comprehensive file exclusion tests passed!")
        print("📂 Documentation files, images, PDFs, and other non-functional files are properly excluded")
        print("💻 Only functional code files are processed for code context extraction")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        raise
    finally:
        test_instance.teardown_method()
