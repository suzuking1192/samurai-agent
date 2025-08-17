"""
Code Parser Utility for Multi-Language File Analysis

This module provides utilities for efficiently scanning codebases and extracting
file/method names from various programming languages.
"""

import os
import re
import logging
import time
from typing import List, Dict, Set, Optional, Tuple, Any
from pathlib import Path
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class CodeElement:
    """Represents a code element (function, class, method, etc.)"""
    name: str
    type: str  # 'function', 'class', 'method', 'variable', etc.
    line_number: int
    file_path: str
    signature: Optional[str] = None


@dataclass
class FileInfo:
    """Represents information about a file in the codebase"""
    path: str
    name: str
    extension: str
    language: str
    size: int
    elements: List[CodeElement]
    last_modified: float


class CodeParser:
    """
    Efficient multi-language code parser for extracting file and method information.
    
    Supports: Python, JavaScript, TypeScript, Java, C++, C#, Go, Rust, PHP, Ruby
    """
    
    def __init__(self):
        # Language detection patterns
        self.language_patterns = {
            'python': r'\.(py|pyw)$',
            'javascript': r'\.(js|jsx)$',
            'typescript': r'\.(ts|tsx)$',
            'java': r'\.(java)$',
            'cpp': r'\.(cpp|cc|cxx|h|hpp|hxx)$',
            'csharp': r'\.(cs)$',
            'go': r'\.(go)$',
            'rust': r'\.(rs)$',
            'php': r'\.(php)$',
            'ruby': r'\.(rb)$',
            'html': r'\.(html|htm)$',
            'css': r'\.(css|scss|sass|less)$',
            'json': r'\.(json)$',
            'yaml': r'\.(yaml|yml)$',
            'markdown': r'\.(md|markdown)$',
        }
        
        # Function/class detection patterns for each language
        self.element_patterns = {
            'python': {
                'function': r'^\s*(?:async\s+)?def\s+(\w+)\s*\(',
                'class': r'^\s*class\s+(\w+)',
            },
            'javascript': {
                'function': r'^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(',
                'class': r'^\s*(?:export\s+)?class\s+(\w+)',
                'method': r'^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*{',
                'arrow_function': r'^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>',
            },
            'typescript': {
                'function': r'^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(',
                'class': r'^\s*(?:export\s+)?class\s+(\w+)',
                'method': r'^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*{',
                'arrow_function': r'^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>',
                'interface': r'^\s*(?:export\s+)?interface\s+(\w+)',
            },
            'java': {
                'class': r'^\s*(?:public\s+)?(?:abstract\s+)?(?:final\s+)?class\s+(\w+)',
                'method': r'^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:abstract\s+)?(?:synchronized\s+)?(?:native\s+)?(?:strictfp\s+)?(?:<[^>]+>\s+)?(?:[\w<>\[\]]+\s+)?(\w+)\s*\(',
                'interface': r'^\s*(?:public\s+)?interface\s+(\w+)',
            },
            'cpp': {
                'class': r'^\s*(?:class|struct)\s+(\w+)',
                'function': r'^\s*(?:[\w<>\[\]]+\s+)?(\w+)\s*\([^)]*\)\s*{?',
            },
            'csharp': {
                'class': r'^\s*(?:public\s+)?(?:abstract\s+)?(?:sealed\s+)?(?:partial\s+)?class\s+(\w+)',
                'method': r'^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(?:virtual\s+)?(?:abstract\s+)?(?:override\s+)?(?:sealed\s+)?(?:async\s+)?(?:<[^>]+>\s+)?(?:[\w<>\[\]]+\s+)?(\w+)\s*\(',
                'interface': r'^\s*(?:public\s+)?interface\s+(\w+)',
            },
            'go': {
                'function': r'^\s*func\s+(\w+)\s*\(',
                'method': r'^\s*func\s*\([^)]+\)\s+(\w+)\s*\(',
                'struct': r'^\s*type\s+(\w+)\s+struct',
                'interface': r'^\s*type\s+(\w+)\s+interface',
            },
            'rust': {
                'function': r'^\s*(?:pub\s+)?fn\s+(\w+)\s*\(',
                'struct': r'^\s*(?:pub\s+)?struct\s+(\w+)',
                'impl': r'^\s*impl\s+(\w+)',
                'trait': r'^\s*(?:pub\s+)?trait\s+(\w+)',
            },
            'php': {
                'function': r'^\s*(?:public|private|protected)?\s*(?:static\s+)?function\s+(\w+)\s*\(',
                'class': r'^\s*class\s+(\w+)',
                'interface': r'^\s*interface\s+(\w+)',
            },
            'ruby': {
                'method': r'^\s*def\s+(\w+)',
                'class': r'^\s*class\s+(\w+)',
                'module': r'^\s*module\s+(\w+)',
            },
        }
        
        # Files/directories to ignore - Balanced approach to focus on functional code
        self.ignore_patterns = [
            # Version control
            r'\.git',
            r'\.svn',
            r'\.hg',
            
            # Dependencies and virtual environments
            r'node_modules',
            r'__pycache__',
            r'\.pytest_cache',
            r'\.venv',
            r'venv',
            r'env',
            r'\.env',
            r'\.env\..*',
            r'pip.*\.log',
            
            # IDE and editor files
            r'\.DS_Store',
            r'\.idea',
            r'\.vscode',
            r'\.sublime',
            r'\.vim',
            r'\.emacs',
            
            # Build and cache directories
            r'\.cache',
            r'\.build',
            r'dist',
            r'build',
            r'target',
            r'bin',
            r'obj',
            r'out',
            r'\.next',
            r'\.nuxt',
            r'\.output',
            r'\.parcel-cache',
            r'\.webpack',
            
            # Test coverage and reports
            r'coverage',
            r'\.coverage',
            r'\.nyc_output',
            r'\.lcov',
            r'htmlcov',
            r'\.tox',
            
            # Logs and temporary files
            r'\.log',
            r'\.tmp',
            r'\.temp',
            r'\.swp',
            r'\.swo',
            r'\.bak',
            r'\.backup',
            
            # Package manager files
            r'package-lock\.json',
            r'yarn\.lock',
            r'pnpm-lock\.yaml',
            r'poetry\.lock',
            r'Pipfile\.lock',
            
            # Documentation files (but keep some important ones)
            r'CHANGELOG\.md',
            r'LICENSE',
            r'\.rst$',
            
            # Configuration files (keep only essential ones)
            r'\.eslintrc',
            r'\.prettierrc',
            r'\.babelrc',
            r'\.browserslistrc',
            r'\.editorconfig',
            r'\.gitignore',
            r'\.gitattributes',
            r'\.dockerignore',
            r'\.npmignore',
            
            # Generated files
            r'\.min\.js',
            r'\.min\.css',
            r'\.bundle\.js',
            r'\.chunk\.js',
            
            # Large binary files and assets
            r'\.png$',
            r'\.jpg$',
            r'\.jpeg$',
            r'\.gif$',
            r'\.svg$',
            r'\.ico$',
            r'\.woff$',
            r'\.woff2$',
            r'\.ttf$',
            r'\.eot$',
            r'\.mp4$',
            r'\.mp3$',
            r'\.wav$',
            r'\.avi$',
            r'\.mov$',
            r'\.zip$',
            r'\.tar$',
            r'\.gz$',
            r'\.rar$',
            r'\.7z$',
            
            # Database and data files
            r'\.db$',
            r'\.sqlite$',
            r'\.sqlite3$',
            r'\.csv$',
            r'\.xlsx$',
            r'\.xls$',
            
            # OS and system files
            r'Thumbs\.db',
            r'\.DS_Store',
            r'\.Trashes',
            r'\.Spotlight-V100',
            r'\.fseventsd',
            
            # Docker and container files
            r'Dockerfile',
            r'\.dockerignore',
            r'docker-compose\.yml',
            r'docker-compose\.yaml',
            
            # CI/CD files
            r'\.github',
            r'\.gitlab-ci\.yml',
            r'\.travis\.yml',
            r'\.circleci',
            r'\.jenkins',
            
            # Security and certificates
            r'\.pem$',
            r'\.key$',
            r'\.crt$',
            r'\.cer$',
            r'\.p12$',
            r'\.pfx$',
        ]
    
    def detect_language(self, file_path: str) -> Optional[str]:
        """Detect the programming language of a file based on its extension."""
        for language, pattern in self.language_patterns.items():
            if re.search(pattern, file_path, re.IGNORECASE):
                return language
        return None
    
    def should_ignore_file(self, file_path: str) -> bool:
        """Check if a file should be ignored based on ignore patterns."""
        for pattern in self.ignore_patterns:
            if re.search(pattern, file_path, re.IGNORECASE):
                return True
        return False
    
    def is_functional_code_file(self, file_path: str) -> bool:
        """Check if a file is likely to contain functional code (not just data/config)."""
        # Get file extension
        ext = Path(file_path).suffix.lower()
        
        # Priority functional code extensions
        priority_extensions = {'.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.cc', '.cxx', 
                             '.h', '.hpp', '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt'}
        
        # Secondary functional code extensions
        secondary_extensions = {'.vue', '.svelte', '.r', '.scala', '.clj', '.hs', '.ml', '.fs', '.dart'}
        
        # Configuration files that might contain logic
        config_extensions = {'.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf'}
        
        # Documentation files that might contain important information
        doc_extensions = {'.md', '.txt'}
        
        # Check if it's a priority functional code file
        if ext in priority_extensions:
            return True
        
        # Check if it's a secondary functional code file
        if ext in secondary_extensions:
            return True
        
        # For config files, check if they might contain logic (like package.json with scripts)
        if ext in config_extensions:
            # Allow package.json, tsconfig.json, etc. but ignore most other config files
            filename = Path(file_path).name.lower()
            if filename in {'package.json', 'tsconfig.json', 'webpack.config.js', 'vite.config.ts', 
                           'rollup.config.js', 'jest.config.js', 'babel.config.js'}:
                return True
            return False
        
        # For documentation files, allow README files and other important docs
        if ext in doc_extensions:
            filename = Path(file_path).name.lower()
            if filename in {'readme.md', 'readme.txt', 'api.md', 'architecture.md', 'design.md'}:
                return True
            return False
        
        return False
    
    def extract_elements_from_file(self, file_path: str, language: str) -> List[CodeElement]:
        """Extract code elements from a single file."""
        elements = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            patterns = self.element_patterns.get(language, {})
            
            # For Python, we need special handling to distinguish functions from methods
            if language == 'python':
                elements = self._extract_python_elements(lines, file_path)
            else:
                # For other languages, use the standard pattern matching
                for line_num, line in enumerate(lines, 1):
                    for element_type, pattern in patterns.items():
                        match = re.search(pattern, line.strip())
                        if match:
                            name = match.group(1)
                            # Skip common false positives
                            if name in ['if', 'for', 'while', 'try', 'catch', 'finally', 'switch', 'case']:
                                continue
                            
                            elements.append(CodeElement(
                                name=name,
                                type=element_type,
                                line_number=line_num,
                                file_path=file_path,
                                signature=line.strip()
                            ))
        
        except Exception as e:
            logger.warning(f"Error parsing file {file_path}: {e}")
        
        return elements
    
    def _extract_python_elements(self, lines: List[str], file_path: str) -> List[CodeElement]:
        """Extract Python code elements with proper function/method distinction."""
        elements = []
        current_class = None
        current_indentation = 0
        
        for line_num, line in enumerate(lines, 1):
            stripped_line = line.strip()
            if not stripped_line or stripped_line.startswith('#'):
                continue
            
            # Calculate indentation level
            indentation = len(line) - len(line.lstrip())
            
            # Check for class definition
            class_match = re.search(r'^\s*class\s+(\w+)', stripped_line)
            if class_match:
                current_class = class_match.group(1)
                current_indentation = indentation
                elements.append(CodeElement(
                    name=current_class,
                    type='class',
                    line_number=line_num,
                    file_path=file_path,
                    signature=stripped_line
                ))
                continue
            
            # Check for function/method definition
            func_match = re.search(r'^\s*(?:async\s+)?def\s+(\w+)\s*\(', stripped_line)
            if func_match:
                name = func_match.group(1)
                # Skip common false positives
                if name in ['if', 'for', 'while', 'try', 'catch', 'finally', 'switch', 'case']:
                    continue
                
                # Determine if this is a method or function based on context
                if current_class and indentation > current_indentation:
                    # This is a method within a class
                    element_type = 'method'
                else:
                    # This is a standalone function
                    element_type = 'function'
                    # Reset class context if we're at module level
                    if indentation <= current_indentation:
                        current_class = None
                
                elements.append(CodeElement(
                    name=name,
                    type=element_type,
                    line_number=line_num,
                    file_path=file_path,
                    signature=stripped_line
                ))
        
        return elements
    
    def scan_codebase(self, root_path: str, max_files: int = 5000) -> Dict[str, FileInfo]:
        """
        Efficiently scan a codebase and extract file information.
        
        Args:
            root_path: Root directory to scan
            max_files: Maximum number of files to process (for performance)
        
        Returns:
            Dictionary mapping file paths to FileInfo objects
        """
        start_time = time.time()
        file_infos = {}
        processed_files = 0
        
        try:
            root_path = Path(root_path).resolve()
            
            for file_path in root_path.rglob('*'):
                if processed_files >= max_files:
                    logger.warning(f"Reached maximum file limit ({max_files})")
                    break
                
                if not file_path.is_file():
                    continue
                
                file_path_str = str(file_path)
                
                # Check if file should be ignored
                if self.should_ignore_file(file_path_str):
                    continue
                
                # Check if it's a functional code file
                if not self.is_functional_code_file(file_path_str):
                    continue
                
                # Detect language
                language = self.detect_language(file_path_str)
                if not language:
                    continue
                
                try:
                    # Get file stats
                    stat = file_path.stat()
                    
                    # Extract code elements
                    elements = self.extract_elements_from_file(file_path_str, language)
                    
                    file_infos[file_path_str] = FileInfo(
                        path=file_path_str,
                        name=file_path.name,
                        extension=file_path.suffix,
                        language=language,
                        size=stat.st_size,
                        elements=elements,
                        last_modified=stat.st_mtime
                    )
                    
                    processed_files += 1
                    
                except Exception as e:
                    logger.warning(f"Error processing file {file_path_str}: {e}")
                    continue
        
        except Exception as e:
            logger.error(f"Error scanning codebase {root_path}: {e}")
        
        scan_time = time.time() - start_time
        logger.info(f"Scanned {processed_files} files in {scan_time:.2f} seconds")
        
        return file_infos
    
    def get_file_summary(self, file_infos: Dict[str, FileInfo]) -> Dict[str, Any]:
        """Generate a summary of the scanned codebase."""
        total_files = len(file_infos)
        total_elements = sum(len(fi.elements) for fi in file_infos.values())
        
        language_stats = {}
        for fi in file_infos.values():
            lang = fi.language
            if lang not in language_stats:
                language_stats[lang] = {'files': 0, 'elements': 0}
            language_stats[lang]['files'] += 1
            language_stats[lang]['elements'] += len(fi.elements)
        
        return {
            'total_files': total_files,
            'total_elements': total_elements,
            'language_stats': language_stats,
            'file_paths': list(file_infos.keys())
        }
    
    def get_relevant_files(self, file_infos: Dict[str, FileInfo], 
                          query: str, max_results: int = 10) -> List[str]:
        """
        Get a list of potentially relevant files based on a query.
        This is a simple keyword-based approach - more sophisticated
        relevance scoring would be implemented in the LLM-based selection.
        """
        query_lower = query.lower()
        relevant_files = []
        
        for file_path, file_info in file_infos.items():
            score = 0
            
            # Check file name
            if query_lower in file_info.name.lower():
                score += 3
            
            # Check element names
            for element in file_info.elements:
                if query_lower in element.name.lower():
                    score += 2
            
            # Check file path
            if query_lower in file_path.lower():
                score += 1
            
            if score > 0:
                relevant_files.append((file_path, score))
        
        # Sort by score and return top results
        relevant_files.sort(key=lambda x: x[1], reverse=True)
        return [file_path for file_path, _ in relevant_files[:max_results]]


# Global instance for reuse
code_parser = CodeParser()
