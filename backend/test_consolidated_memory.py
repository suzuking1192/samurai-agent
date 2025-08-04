#!/usr/bin/env python3
"""
Test script for the consolidated memory system.

This script tests:
1. Creating consolidated memories
2. Adding sections to consolidated memories
3. Updating existing sections
4. Similarity detection
5. Migration functionality
"""

import sys
import os
import logging
from datetime import datetime
from typing import Dict, Any

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.consolidated_memory import ConsolidatedMemoryService, ConsolidatedMemory
from services.file_service import FileService
from models import Memory, MemoryCategory

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def test_consolidated_memory_creation():
    """Test creating a new consolidated memory."""
    logger.info("=== Testing Consolidated Memory Creation ===")
    
    service = ConsolidatedMemoryService()
    project_id = "test_project_consolidated"
    
    # Create a new consolidated memory
    consolidated = service.get_or_create_consolidated_memory("frontend", project_id)
    
    assert consolidated.category == "frontend"
    assert consolidated.project_id == project_id
    assert len(consolidated.sections) == 0
    assert consolidated.version == 1
    
    logger.info("✅ Consolidated memory creation test passed")


def test_adding_sections():
    """Test adding sections to a consolidated memory."""
    logger.info("=== Testing Adding Sections ===")
    
    service = ConsolidatedMemoryService()
    project_id = f"test_project_sections_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    # Add first section
    result1 = service.add_information_to_consolidated_memory(
        "frontend", project_id,
        "We decided to use React with TypeScript for the frontend. This provides better type safety and developer experience.",
        "React TypeScript Decision"
    )
    
    assert result1["action"] == "created_new_section"
    assert "React TypeScript Decision" in result1["section_title"]
    
    # Add second section
    result2 = service.add_information_to_consolidated_memory(
        "frontend", project_id,
        "CSS styling will use Tailwind CSS for rapid development and consistent design system.",
        "CSS Framework Choice"
    )
    
    assert result2["action"] == "created_new_section"
    assert "CSS Framework Choice" in result2["section_title"]
    
    # Verify consolidated memory has both sections
    consolidated = service.get_or_create_consolidated_memory("frontend", project_id)
    assert len(consolidated.sections) == 2
    
    logger.info("✅ Adding sections test passed")


def test_similarity_detection():
    """Test similarity detection for updating existing sections."""
    logger.info("=== Testing Similarity Detection ===")
    
    service = ConsolidatedMemoryService()
    project_id = f"test_project_similarity_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    # Add initial section
    result1 = service.add_information_to_consolidated_memory(
        "backend", project_id,
        "We chose Node.js with Express for the backend API. This provides good performance and extensive ecosystem.",
        "Backend Technology Stack"
    )
    logger.info(f"First addition result: {result1}")
    
    # Add very similar information (should update existing section)
    result2 = service.add_information_to_consolidated_memory(
        "backend", project_id,
        "We chose Node.js with Express for the backend API. This provides good performance and extensive ecosystem. We'll also use JWT for authentication.",
        "Backend Technology Stack"
    )
    logger.info(f"Second addition result: {result2}")
    
    assert result2["action"] == "updated_existing_section"
    
    # Verify the section was updated
    consolidated = service.get_or_create_consolidated_memory("backend", project_id)
    assert len(consolidated.sections) == 1  # Should still be one section
    
    logger.info("✅ Similarity detection test passed")


def test_different_categories():
    """Test that different categories create separate consolidated memories."""
    logger.info("=== Testing Different Categories ===")
    
    service = ConsolidatedMemoryService()
    project_id = f"test_project_categories_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    # Add frontend information
    service.add_information_to_consolidated_memory(
        "frontend", project_id,
        "React components will be organized in a feature-based structure.",
        "Component Architecture"
    )
    
    # Add backend information
    service.add_information_to_consolidated_memory(
        "backend", project_id,
        "API endpoints will follow RESTful conventions with proper error handling.",
        "API Design"
    )
    
    # Add database information
    service.add_information_to_consolidated_memory(
        "database", project_id,
        "PostgreSQL will be used for the main database with proper indexing.",
        "Database Choice"
    )
    
    # Verify we have three separate consolidated memories
    frontend_memory = service.get_or_create_consolidated_memory("frontend", project_id)
    backend_memory = service.get_or_create_consolidated_memory("backend", project_id)
    database_memory = service.get_or_create_consolidated_memory("database", project_id)
    
    assert frontend_memory.category == "frontend"
    assert backend_memory.category == "backend"
    assert database_memory.category == "database"
    
    # Each should have one section
    assert len(frontend_memory.sections) == 1
    assert len(backend_memory.sections) == 1
    assert len(database_memory.sections) == 1
    
    logger.info("✅ Different categories test passed")


def test_migration_simulation():
    """Test the migration functionality with simulated existing memories."""
    logger.info("=== Testing Migration Simulation ===")
    
    service = ConsolidatedMemoryService()
    file_service = FileService()
    project_id = f"test_project_migration_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    # Create some test memories to simulate existing fragmented memories
    test_memories = [
        Memory(
            id="memory_1",
            project_id=project_id,
            title="React Component Structure",
            content="Components will be organized in a feature-based structure with shared components in a common folder.",
            category="frontend",
            type="decision",
            created_at=datetime.now()
        ),
        Memory(
            id="memory_2",
            project_id=project_id,
            title="CSS Styling Approach",
            content="Using Tailwind CSS for rapid development and consistent design system across the application.",
            category="frontend",
            type="decision",
            created_at=datetime.now()
        ),
        Memory(
            id="memory_3",
            project_id=project_id,
            title="API Authentication",
            content="JWT tokens will be used for API authentication with refresh token rotation.",
            category="backend",
            type="decision",
            created_at=datetime.now()
        ),
        Memory(
            id="memory_4",
            project_id=project_id,
            title="Database Schema Design",
            content="User table will include email, password_hash, created_at, and updated_at fields.",
            category="database",
            type="decision",
            created_at=datetime.now()
        )
    ]
    
    # Save test memories
    for memory in test_memories:
        file_service.save_memory(project_id, memory)
    
    # Perform migration
    migration_results = service.migrate_to_consolidated_memories(project_id)
    
    # Verify migration results
    assert len(migration_results) == 1  # Only frontend has multiple memories
    assert "frontend" in migration_results
    
    # Verify consolidated memories were created
    frontend_consolidated = service.get_or_create_consolidated_memory("frontend", project_id)
    
    assert len(frontend_consolidated.sections) == 2  # Two frontend memories
    
    logger.info("✅ Migration simulation test passed")


def test_content_generation():
    """Test that consolidated memories generate proper content."""
    logger.info("=== Testing Content Generation ===")
    
    service = ConsolidatedMemoryService()
    project_id = f"test_project_content_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    # Add multiple sections
    service.add_information_to_consolidated_memory(
        "frontend", project_id,
        "React with TypeScript provides better type safety and developer experience.",
        "Technology Stack"
    )
    
    service.add_information_to_consolidated_memory(
        "frontend", project_id,
        "Components will be organized in a feature-based structure.",
        "Component Architecture"
    )
    
    # Get the consolidated memory and check content
    consolidated = service.get_or_create_consolidated_memory("frontend", project_id)
    content = consolidated.generate_full_content()
    
    # Verify content structure
    assert "Frontend Knowledge Base" in content
    assert "Technology Stack" in content
    assert "Component Architecture" in content
    assert "React with TypeScript" in content
    assert "feature-based structure" in content
    
    logger.info("✅ Content generation test passed")


def run_all_tests():
    """Run all tests for the consolidated memory system."""
    logger.info("Starting consolidated memory system tests...")
    
    try:
        test_consolidated_memory_creation()
        test_adding_sections()
        test_similarity_detection()
        test_different_categories()
        test_migration_simulation()
        test_content_generation()
        
        logger.info("🎉 All tests passed! Consolidated memory system is working correctly.")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        raise


if __name__ == "__main__":
    run_all_tests() 