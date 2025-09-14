"""
Code Context Storage Module

This module handles the persistence of extracted code context data,
storing it as JSON files associated with specific project and session IDs.
"""

import json
import os
import logging
from typing import Dict, Any, Optional
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)


class CodeContextStorage:
    """
    Handles storage and retrieval of code context data.
    
    Stores code context as JSON files in the structure:
    data/projects/{project_id}/sessions/{session_id}/code_context.json
    """
    
    def __init__(self, base_data_path: str = "data"):
        self.base_data_path = Path(base_data_path)
        self.projects_path = self.base_data_path / "projects"
        
        # Ensure base directories exist
        self.projects_path.mkdir(parents=True, exist_ok=True)
    
    def _get_session_path(self, project_id: str, session_id: str) -> Path:
        """Get the path for a specific session's data directory."""
        session_path = self.projects_path / project_id / "sessions" / session_id
        session_path.mkdir(parents=True, exist_ok=True)
        return session_path
    
    def _get_code_context_file_path(self, project_id: str, session_id: str) -> Path:
        """Get the file path for code context data."""
        session_path = self._get_session_path(project_id, session_id)
        return session_path / "code_context.json"
    
    def save_code_context(
        self, 
        project_id: str, 
        session_id: str, 
        context_data: Dict[str, Any]
    ) -> bool:
        """
        Save code context data to a JSON file.
        
        Args:
            project_id: The project identifier
            session_id: The chat session identifier
            context_data: The code context data to save
        
        Returns:
            True if successful, False otherwise
        """
        try:
            file_path = self._get_code_context_file_path(project_id, session_id)
            
            # Add metadata
            context_with_metadata = {
                "metadata": {
                    "project_id": project_id,
                    "session_id": session_id,
                    "created_at": datetime.utcnow().isoformat(),
                    "version": "1.0"
                },
                "context_data": context_data
            }
            
            # Write to file
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(context_with_metadata, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Saved code context for project {project_id}, session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving code context for project {project_id}, session {session_id}: {e}")
            return False
    
    def load_code_context(
        self, 
        project_id: str, 
        session_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Load code context data from a JSON file.
        
        Args:
            project_id: The project identifier
            session_id: The chat session identifier
        
        Returns:
            The code context data if found, None otherwise
        """
        try:
            file_path = self._get_code_context_file_path(project_id, session_id)
            
            if not file_path.exists():
                logger.debug(f"No code context file found for project {project_id}, session {session_id}")
                return None
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Validate structure
            if "context_data" not in data:
                logger.warning(f"Invalid code context file structure for project {project_id}, session {session_id}")
                return None
            
            logger.info(f"Loaded code context for project {project_id}, session {session_id}")
            return data["context_data"]
            
        except Exception as e:
            logger.error(f"Error loading code context for project {project_id}, session {session_id}: {e}")
            return None
    
    def delete_code_context(self, project_id: str, session_id: str) -> bool:
        """
        Delete code context data for a specific session.
        
        Args:
            project_id: The project identifier
            session_id: The chat session identifier
        
        Returns:
            True if successful, False otherwise
        """
        try:
            file_path = self._get_code_context_file_path(project_id, session_id)
            
            if file_path.exists():
                file_path.unlink()
                logger.info(f"Deleted code context for project {project_id}, session {session_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error deleting code context for project {project_id}, session {session_id}: {e}")
            return False
    
    def list_sessions_with_context(self, project_id: str) -> list:
        """
        List all sessions that have code context data.
        
        Args:
            project_id: The project identifier
        
        Returns:
            List of session IDs that have code context data
        """
        try:
            project_path = self.projects_path / project_id / "sessions"
            
            if not project_path.exists():
                return []
            
            sessions_with_context = []
            
            for session_dir in project_path.iterdir():
                if session_dir.is_dir():
                    session_id = session_dir.name
                    context_file = session_dir / "code_context.json"
                    
                    if context_file.exists():
                        sessions_with_context.append(session_id)
            
            return sessions_with_context
            
        except Exception as e:
            logger.error(f"Error listing sessions with context for project {project_id}: {e}")
            return []
    
    def get_context_summary(self, project_id: str, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a summary of the code context data without loading the full content.
        
        Args:
            project_id: The project identifier
            session_id: The chat session identifier
        
        Returns:
            Summary information about the code context
        """
        try:
            file_path = self._get_code_context_file_path(project_id, session_id)
            
            if not file_path.exists():
                return None
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            metadata = data.get("metadata", {})
            context_data = data.get("context_data", {})
            
            return {
                "project_id": project_id,
                "session_id": session_id,
                "created_at": metadata.get("created_at"),
                "version": metadata.get("version"),
                "has_context": bool(context_data.get("context")),
                "has_relevant_code": bool(context_data.get("relevant_code")),
                "file_path": context_data.get("file_path"),
                "file_size": file_path.stat().st_size if file_path.exists() else 0
            }
            
        except Exception as e:
            logger.error(f"Error getting context summary for project {project_id}, session {session_id}: {e}")
            return None


# Global instance for reuse
code_context_storage = CodeContextStorage()
