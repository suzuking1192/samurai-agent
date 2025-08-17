#!/usr/bin/env python3
"""
Debug script to check what elements are extracted from models.py
"""

import os
import sys

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.code_parser import code_parser

def debug_models_elements():
    """Debug what elements are extracted from models.py"""
    
    models_file = "models.py"
    
    if not os.path.exists(models_file):
        print(f"Error: {models_file} not found in current directory")
        return
    
    print(f"Extracting elements from {models_file}...")
    
    # Extract elements
    elements = code_parser.extract_elements_from_file(models_file, "python")
    
    print(f"Found {len(elements)} elements:")
    for i, element in enumerate(elements):
        print(f"  {i+1}. {element.type}: {element.name} (line {element.line_number})")
    
    # Check specifically for Task class
    task_elements = [e for e in elements if e.name.lower() == "task"]
    print(f"\nTask-related elements: {len(task_elements)}")
    for element in task_elements:
        print(f"  - {element.type}: {element.name} (line {element.line_number})")

if __name__ == "__main__":
    debug_models_elements()
