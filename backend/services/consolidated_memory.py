"""
Consolidated Memory System

This module implements a consolidated category-based memory system that maintains
one comprehensive memory per category instead of many small fragmented memories.
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import json
import re

from models import MemoryCategory, CATEGORY_CONFIG
from .file_service import FileService

logger = logging.getLogger(__name__)


@dataclass
class MemorySection:
    """Represents a section within a consolidated memory."""
    title: str
    content: str
    created_at: str
    updated_at: str
    version: int = 1
    migrated_from: Optional[str] = None


class ConsolidatedMemory:
    """
    A single, comprehensive memory document for each category.
    """
    
    def __init__(self, category: str, project_id: str):
        self.category = category
        self.project_id = project_id
        self.sections: Dict[str, MemorySection] = {}
        self.last_updated = datetime.now()
        self.version = 1
    
    @property
    def structure(self) -> Dict[str, Any]:
        """Generate the complete memory structure for storage."""
        return {
            "id": f"{self.project_id}_{self.category}_consolidated",
            "title": f"{CATEGORY_CONFIG.get(self.category, {}).get('label', self.category.title())} Knowledge Base",
            "category": self.category,
            "project_id": self.project_id,
            "content": self.generate_full_content(),
            "sections": {k: asdict(v) for k, v in self.sections.items()},
            "metadata": {
                "type": "consolidated",
                "section_count": len(self.sections),
                "total_length": len(self.generate_full_content()),
                "last_updated": self.last_updated.isoformat(),
                "version": self.version
            }
        }
    
    def generate_full_content(self) -> str:
        """
        Generate the complete memory content from all sections.
        """
        category_label = CATEGORY_CONFIG.get(self.category, {}).get('label', self.category.title())
        
        content_parts = [
            f"# {category_label} Knowledge Base",
            f"*Last updated: {self.last_updated.strftime('%Y-%m-%d %H:%M')}*",
            "",
            f"## Overview",
            f"This document contains all {self.category} related decisions, patterns, and knowledge for this project.",
            ""
        ]
        
        # Sort sections by creation date
        sorted_sections = sorted(
            self.sections.items(),
            key=lambda x: x[1].created_at
        )
        
        for section_key, section_data in sorted_sections:
            content_parts.extend([
                f"## {section_data.title}",
                f"*Added: {section_data.created_at} | Updated: {section_data.updated_at}*",
                "",
                section_data.content,
                ""
            ])
        
        return "\n".join(content_parts)
    
    def add_section(self, title: str, content: str, section_key: Optional[str] = None) -> str:
        """
        Add a new section to the consolidated memory.
        """
        if not section_key:
            section_key = f"section_{len(self.sections) + 1}_{datetime.now().strftime('%Y%m%d_%H%M')}"
        
        now = datetime.now().strftime('%Y-%m-%d %H:%M')
        
        self.sections[section_key] = MemorySection(
            title=title,
            content=content,
            created_at=now,
            updated_at=now,
            version=1
        )
        
        self.last_updated = datetime.now()
        self.version += 1
        
        return section_key
    
    def update_section(self, section_key: str, new_content: str, new_title: Optional[str] = None) -> bool:
        """
        Update an existing section with new content.
        """
        if section_key not in self.sections:
            return False
        
        section = self.sections[section_key]
        section.content = new_content
        if new_title:
            section.title = new_title
        section.updated_at = datetime.now().strftime('%Y-%m-%d %H:%M')
        section.version += 1
        
        self.last_updated = datetime.now()
        self.version += 1
        
        return True


class ConsolidatedMemoryService:
    """
    Service for managing consolidated memories.
    """
    
    def __init__(self):
        self.file_service = FileService()
    
    def get_or_create_consolidated_memory(self, category: str, project_id: str) -> ConsolidatedMemory:
        """
        Get existing consolidated memory or create new one for category.
        """
        memory_id = f"{project_id}_{category}_consolidated"
        
        # Try to get existing consolidated memory
        existing = self._get_memory_by_id(memory_id)
        
        if existing:
            consolidated = ConsolidatedMemory(category, project_id)
            consolidated.sections = self._load_sections_from_structure(existing)
            consolidated.version = existing.get('metadata', {}).get('version', 1)
            consolidated.last_updated = datetime.fromisoformat(
                existing.get('metadata', {}).get('last_updated', datetime.now().isoformat())
            )
            return consolidated
        else:
            # Create new consolidated memory
            consolidated = ConsolidatedMemory(category, project_id)
            self._save_consolidated_memory(consolidated)
            return consolidated
    
    def add_information_to_consolidated_memory(self, category: str, project_id: str, 
                                             new_info: str, title: str = None) -> Dict[str, Any]:
        """
        Add new information to the consolidated memory for a category.
        """
        consolidated = self.get_or_create_consolidated_memory(category, project_id)
        
        # Generate section title if not provided
        if not title:
            title = self._generate_section_title(new_info, category)
        
        # Check if similar section exists
        existing_section_key = self._find_similar_section(consolidated.sections, new_info, title)
        
        if existing_section_key:
            # Update existing section
            return self._update_existing_section(consolidated, existing_section_key, new_info, title)
        else:
            # Create new section
            return self._create_new_section(consolidated, new_info, title)
    
    def _find_similar_section(self, sections: Dict[str, MemorySection], 
                             new_info: str, title: str) -> Optional[str]:
        """
        Find if there's an existing section that should be updated instead of creating new.
        """
        if not sections:
            return None
        
        # Simple text similarity check (can be enhanced with embeddings later)
        new_text = f"{title} {new_info}".lower()
        
        best_match = None
        best_similarity = 0.0
        
        logger.debug(f"Looking for similar sections. New text: '{new_text[:100]}...'")
        
        for section_key, section_data in sections.items():
            existing_text = f"{section_data.title} {section_data.content}".lower()
            
            # Calculate simple similarity based on common words
            new_words = set(new_text.split())
            existing_words = set(existing_text.split())
            
            if len(new_words) == 0 or len(existing_words) == 0:
                continue
            
            common_words = new_words.intersection(existing_words)
            similarity = len(common_words) / max(len(new_words), len(existing_words))
            
            logger.debug(f"Section '{section_data.title}': similarity = {similarity:.2f}")
            
            if similarity > best_similarity and similarity > 0.3:  # 30% similarity threshold
                best_similarity = similarity
                best_match = section_key
        
        logger.debug(f"Best match: {best_match} (similarity: {best_similarity:.2f})")
        return best_match
    
    def _update_existing_section(self, consolidated: ConsolidatedMemory, section_key: str, 
                                new_info: str, title: str) -> Dict[str, Any]:
        """
        Update an existing section with new information.
        """
        existing_section = consolidated.sections[section_key]
        
        # Simple merge strategy (can be enhanced with LLM later)
        merged_content = self._merge_content(existing_section.content, new_info)
        
        # Update the section
        consolidated.update_section(section_key, merged_content, title)
        self._save_consolidated_memory(consolidated)
        
        return {
            "action": "updated_existing_section",
            "section_key": section_key,
            "section_title": existing_section.title,
            "message": f"✅ Updated existing section '{existing_section.title}' with new information"
        }
    
    def _create_new_section(self, consolidated: ConsolidatedMemory, new_info: str, title: str) -> Dict[str, Any]:
        """
        Create a new section in the consolidated memory.
        """
        section_key = consolidated.add_section(title, new_info)
        self._save_consolidated_memory(consolidated)
        
        return {
            "action": "created_new_section", 
            "section_key": section_key,
            "section_title": title,
            "message": f"✅ Added new section '{title}' to {consolidated.category} knowledge base"
        }
    
    def _merge_content(self, existing_content: str, new_content: str) -> str:
        """
        Merge new content with existing content intelligently.
        """
        # Simple merge strategy - append with separator
        # This can be enhanced with LLM-based merging later
        return f"{existing_content}\n\n---\n\n{new_content}"
    
    def _generate_section_title(self, content: str, category: str) -> str:
        """
        Generate an appropriate section title for the content.
        """
        category_config = CATEGORY_CONFIG.get(category, {})
        
        # Extract first sentence or first few words as title
        sentences = re.split(r'[.!?]+', content.strip())
        if sentences and sentences[0].strip():
            title = sentences[0].strip()
            # Limit title length
            if len(title) > 50:
                title = title[:47] + "..."
            return title
        
        # Fallback: use category-specific default
        return f"{category_config.get('label', category.title())} Information"
    
    def _get_memory_by_id(self, memory_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a consolidated memory by its ID.
        """
        try:
            # Extract project_id from memory_id
            if memory_id.endswith('_consolidated'):
                # Extract category from memory_id
                parts = memory_id.split('_')
                if len(parts) >= 3:
                    category = parts[-2]  # Second to last part is category
                    project_id = '_'.join(parts[:-2])  # Everything before category
                else:
                    category = "general"
                    project_id = memory_id.replace('_consolidated', '')
            else:
                return None
            
            # Load the memory
            memories = self.file_service.load_memories(project_id)
            for memory in memories:
                if memory.id == memory_id:
                    memory_dict = memory.dict()
                    
                    # Try to load sections metadata
                    sections_file = self.file_service.data_dir / f"memory-{memory_id}-sections.json"
                    if sections_file.exists():
                        try:
                            import json
                            with open(sections_file, 'r') as f:
                                sections_data = json.load(f)
                                if sections_data.get("memory_id") == memory_id:
                                    memory_dict["sections"] = sections_data.get("sections", {})
                                    memory_dict["metadata"] = sections_data.get("metadata", {})
                                    logger.debug(f"Loaded {len(sections_data.get('sections', {}))} sections for {memory_id}")
                        except Exception as e:
                            logger.warning(f"Error loading sections for {memory_id}: {e}")
                    else:
                        logger.debug(f"No sections file found for {memory_id}")
                    
                    return memory_dict
            
            return None
        except Exception as e:
            logger.error(f"Error getting memory by ID {memory_id}: {e}")
            return None
    
    def _save_consolidated_memory(self, consolidated: ConsolidatedMemory) -> None:
        """
        Save a consolidated memory to storage.
        """
        try:
            # Convert to Memory model for storage
            from models import Memory
            
            memory_data = consolidated.structure
            memory = Memory(
                id=memory_data["id"],
                project_id=consolidated.project_id,
                title=memory_data["title"],
                content=memory_data["content"],
                category=consolidated.category,
                type="note",  # Consolidated memories are stored as notes
                created_at=datetime.fromisoformat(memory_data["metadata"]["last_updated"])
            )
            
            # Save using existing file service
            self.file_service.save_memory(consolidated.project_id, memory)
            
            # Also save the sections metadata separately for proper restoration
            sections_file = self.file_service.data_dir / f"memory-{memory_data['id']}-sections.json"
            sections_data = {
                "memory_id": memory_data["id"],
                "sections": memory_data["sections"],
                "metadata": memory_data["metadata"]
            }
            
            with open(sections_file, 'w') as f:
                import json
                json.dump(sections_data, f, indent=2)
            
        except Exception as e:
            logger.error(f"Error saving consolidated memory: {e}")
            raise
    
    def _load_sections_from_structure(self, memory_structure: Dict[str, Any]) -> Dict[str, MemorySection]:
        """
        Load sections from a memory structure.
        """
        sections = {}
        sections_data = memory_structure.get('sections', {})
        
        for key, section_data in sections_data.items():
            sections[key] = MemorySection(
                title=section_data.get('title', ''),
                content=section_data.get('content', ''),
                created_at=section_data.get('created_at', ''),
                updated_at=section_data.get('updated_at', ''),
                version=section_data.get('version', 1),
                migrated_from=section_data.get('migrated_from')
            )
        
        return sections
    
    def migrate_to_consolidated_memories(self, project_id: str) -> Dict[str, Any]:
        """
        Migrate existing fragmented memories to consolidated category-based memories.
        """
        # Get all existing memories
        existing_memories = self.file_service.load_memories(project_id)
        
        # Group by category
        memories_by_category = {}
        for memory in existing_memories:
            category = memory.category
            if category not in memories_by_category:
                memories_by_category[category] = []
            memories_by_category[category].append(memory)
        
        migration_results = {}
        
        for category, memories in memories_by_category.items():
            if len(memories) <= 1:
                continue  # Skip categories with only one memory
            
            # Create consolidated memory for this category
            consolidated = ConsolidatedMemory(category, project_id)
            
            # Add each existing memory as a section
            for memory in memories:
                section_key = f"migrated_{memory.id}"
                consolidated.sections[section_key] = MemorySection(
                    title=memory.title,
                    content=memory.content,
                    created_at=memory.created_at.strftime('%Y-%m-%d %H:%M'),
                    updated_at=memory.updated_at.strftime('%Y-%m-%d %H:%M') if hasattr(memory, 'updated_at') else memory.created_at.strftime('%Y-%m-%d %H:%M'),
                    version=1,
                    migrated_from=memory.id
                )
            
            # Save consolidated memory
            self._save_consolidated_memory(consolidated)
            
            # Archive old memories (don't delete, for safety)
            for memory in memories:
                self._archive_memory(memory.id, project_id)
            
            migration_results[category] = {
                'consolidated_id': consolidated.structure['id'],
                'migrated_count': len(memories),
                'message': f"Consolidated {len(memories)} {category} memories into one knowledge base"
            }
        
        return migration_results
    
    def _archive_memory(self, memory_id: str, project_id: str) -> None:
        """
        Archive a memory instead of deleting it.
        """
        try:
            memories = self.file_service.load_memories(project_id)
            for memory in memories:
                if memory.id == memory_id:
                    # Mark as archived by changing the title
                    memory.title = f"[ARCHIVED] {memory.title}"
                    self.file_service.save_memory(project_id, memory)
                    break
        except Exception as e:
            logger.error(f"Error archiving memory {memory_id}: {e}")
    
    def get_consolidated_memories(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Get all consolidated memories for a project.
        """
        memories = self.file_service.load_memories(project_id)
        consolidated_memories = []
        
        for memory in memories:
            if memory.id.endswith('_consolidated'):
                consolidated_memories.append(memory.dict())
        
        return consolidated_memories 