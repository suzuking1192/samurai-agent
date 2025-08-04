#!/usr/bin/env python3
"""
Migration script to convert existing fragmented memories to consolidated category-based memories.

This script will:
1. Load all existing memories for each project
2. Group them by category
3. Create consolidated memories for each category
4. Archive the original memories
5. Provide a summary of the migration
"""

import sys
import os
import logging
from typing import Dict, List, Any
from datetime import datetime

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.consolidated_memory import ConsolidatedMemoryService
from services.file_service import FileService
from models import Memory

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def get_all_projects() -> List[str]:
    """Get all project IDs from the data directory."""
    file_service = FileService()
    projects = file_service.load_projects()
    return [project.id for project in projects]


def analyze_memory_distribution(project_id: str) -> Dict[str, Any]:
    """Analyze the current memory distribution for a project."""
    file_service = FileService()
    memories = file_service.load_memories(project_id)
    
    # Group by category
    memories_by_category = {}
    for memory in memories:
        category = memory.category
        if category not in memories_by_category:
            memories_by_category[category] = []
        memories_by_category[category].append(memory)
    
    # Calculate statistics
    total_memories = len(memories)
    categories_with_multiple = {cat: mems for cat, mems in memories_by_category.items() if len(mems) > 1}
    
    return {
        'project_id': project_id,
        'total_memories': total_memories,
        'categories': len(memories_by_category),
        'categories_with_multiple': len(categories_with_multiple),
        'memory_distribution': {cat: len(mems) for cat, mems in memories_by_category.items()},
        'consolidation_opportunities': categories_with_multiple
    }


def migrate_project_memories(project_id: str, dry_run: bool = True) -> Dict[str, Any]:
    """Migrate memories for a specific project to consolidated format."""
    logger.info(f"Starting migration for project {project_id}")
    
    # Analyze current state
    analysis = analyze_memory_distribution(project_id)
    logger.info(f"Project {project_id}: {analysis['total_memories']} total memories across {analysis['categories']} categories")
    
    if analysis['categories_with_multiple'] == 0:
        logger.info(f"No consolidation opportunities for project {project_id}")
        return {
            'project_id': project_id,
            'status': 'no_consolidation_needed',
            'message': 'No categories with multiple memories found'
        }
    
    if dry_run:
        logger.info("DRY RUN - No actual changes will be made")
        return {
            'project_id': project_id,
            'status': 'dry_run',
            'consolidation_opportunities': analysis['consolidation_opportunities'],
            'message': f"Would consolidate {analysis['categories_with_multiple']} categories"
        }
    
    # Perform actual migration
    try:
        consolidated_service = ConsolidatedMemoryService()
        migration_results = consolidated_service.migrate_to_consolidated_memories(project_id)
        
        logger.info(f"Migration completed for project {project_id}")
        return {
            'project_id': project_id,
            'status': 'success',
            'migration_results': migration_results,
            'message': f"Successfully migrated {len(migration_results)} categories"
        }
        
    except Exception as e:
        logger.error(f"Migration failed for project {project_id}: {e}")
        return {
            'project_id': project_id,
            'status': 'error',
            'error': str(e),
            'message': f"Migration failed: {e}"
        }


def main():
    """Main migration function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate memories to consolidated format')
    parser.add_argument('--project-id', help='Migrate specific project only')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    parser.add_argument('--analyze-only', action='store_true', help='Only analyze current state, no migration')
    parser.add_argument('--verbose', action='store_true', help='Verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Get projects to migrate
    if args.project_id:
        projects = [args.project_id]
    else:
        projects = get_all_projects()
    
    if not projects:
        logger.warning("No projects found to migrate")
        return
    
    logger.info(f"Found {len(projects)} projects to process")
    
    # Analyze all projects first
    logger.info("=== ANALYZING CURRENT STATE ===")
    all_analysis = {}
    total_memories = 0
    total_consolidation_opportunities = 0
    
    for project_id in projects:
        analysis = analyze_memory_distribution(project_id)
        all_analysis[project_id] = analysis
        total_memories += analysis['total_memories']
        total_consolidation_opportunities += analysis['categories_with_multiple']
        
        logger.info(f"Project {project_id}: {analysis['total_memories']} memories, "
                   f"{analysis['categories_with_multiple']} consolidation opportunities")
    
    logger.info(f"=== SUMMARY ===")
    logger.info(f"Total projects: {len(projects)}")
    logger.info(f"Total memories: {total_memories}")
    logger.info(f"Total consolidation opportunities: {total_consolidation_opportunities}")
    
    if args.analyze_only:
        logger.info("Analysis complete. Use --dry-run to see what would be migrated.")
        return
    
    # Perform migration
    logger.info("=== STARTING MIGRATION ===")
    migration_results = {}
    
    for project_id in projects:
        result = migrate_project_memories(project_id, dry_run=args.dry_run)
        migration_results[project_id] = result
        
        if result['status'] == 'success':
            logger.info(f"✅ {project_id}: {result['message']}")
        elif result['status'] == 'dry_run':
            logger.info(f"🔍 {project_id}: {result['message']}")
        elif result['status'] == 'no_consolidation_needed':
            logger.info(f"⏭️  {project_id}: {result['message']}")
        else:
            logger.error(f"❌ {project_id}: {result['message']}")
    
    # Final summary
    logger.info("=== MIGRATION SUMMARY ===")
    successful = sum(1 for r in migration_results.values() if r['status'] == 'success')
    dry_run_count = sum(1 for r in migration_results.values() if r['status'] == 'dry_run')
    no_consolidation = sum(1 for r in migration_results.values() if r['status'] == 'no_consolidation_needed')
    errors = sum(1 for r in migration_results.values() if r['status'] == 'error')
    
    logger.info(f"Projects processed: {len(migration_results)}")
    logger.info(f"Successful migrations: {successful}")
    logger.info(f"Dry run results: {dry_run_count}")
    logger.info(f"No consolidation needed: {no_consolidation}")
    logger.info(f"Errors: {errors}")
    
    if args.dry_run:
        logger.info("DRY RUN COMPLETE - No changes were made")
        logger.info("Run without --dry-run to perform actual migration")
    else:
        logger.info("MIGRATION COMPLETE")


if __name__ == "__main__":
    main() 