import json
import os
import logging
from typing import Optional, Dict, Any
from pathlib import Path
from models import CodeContextMode

logger = logging.getLogger(__name__)

class ProjectSettingsService:
    """
    Service for managing project-specific settings with file-based persistence.
    """
    
    def __init__(self, data_dir: str = "data"):
        """
        Initialize the project settings service.
        
        Args:
            data_dir: Directory where project data is stored
        """
        self.data_dir = Path(data_dir)
        self.settings_dir = self.data_dir / "projects"
        self.settings_dir.mkdir(exist_ok=True)
    
    def _get_settings_file_path(self, project_id: str) -> Path:
        """
        Get the path to the settings file for a specific project.
        
        Args:
            project_id: The project ID
            
        Returns:
            Path to the settings file
        """
        return self.settings_dir / f"{project_id}-settings.json"
    
    def get_code_context_mode(self, project_id: str) -> CodeContextMode:
        """
        Get the code context mode for a project.
        
        Args:
            project_id: The project ID
            
        Returns:
            The code context mode, defaults to AUTO if not found
        """
        try:
            settings_file = self._get_settings_file_path(project_id)
            
            if not settings_file.exists():
                logger.info(f"No settings file found for project {project_id}, using default AUTO mode")
                return CodeContextMode.AUTO
            
            with open(settings_file, 'r', encoding='utf-8') as f:
                settings = json.load(f)
            
            mode_str = settings.get('code_context_mode', 'auto')
            
            # Validate the mode string
            try:
                mode = CodeContextMode(mode_str)
                logger.info(f"Retrieved code context mode '{mode.value}' for project {project_id}")
                return mode
            except ValueError:
                logger.warning(f"Invalid code context mode '{mode_str}' for project {project_id}, using default AUTO")
                return CodeContextMode.AUTO
                
        except Exception as e:
            logger.error(f"Error reading code context mode for project {project_id}: {e}")
            return CodeContextMode.AUTO
    
    def set_code_context_mode(self, project_id: str, mode: CodeContextMode) -> bool:
        """
        Set the code context mode for a project.
        
        Args:
            project_id: The project ID
            mode: The code context mode to set
            
        Returns:
            True if successful, False otherwise
        """
        try:
            settings_file = self._get_settings_file_path(project_id)
            
            # Load existing settings if file exists
            settings = {}
            if settings_file.exists():
                try:
                    with open(settings_file, 'r', encoding='utf-8') as f:
                        settings = json.load(f)
                except json.JSONDecodeError:
                    logger.warning(f"Corrupted settings file for project {project_id}, creating new one")
                    settings = {}
            
            # Update the code context mode
            settings['code_context_mode'] = mode.value
            
            # Write the updated settings
            with open(settings_file, 'w', encoding='utf-8') as f:
                json.dump(settings, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Successfully set code context mode to '{mode.value}' for project {project_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error setting code context mode for project {project_id}: {e}")
            return False
    
    def get_all_settings(self, project_id: str) -> Dict[str, Any]:
        """
        Get all settings for a project.
        
        Args:
            project_id: The project ID
            
        Returns:
            Dictionary containing all project settings
        """
        try:
            settings_file = self._get_settings_file_path(project_id)
            
            if not settings_file.exists():
                return {'code_context_mode': CodeContextMode.AUTO.value}
            
            with open(settings_file, 'r', encoding='utf-8') as f:
                settings = json.load(f)
            
            # Ensure code_context_mode is always present
            if 'code_context_mode' not in settings:
                settings['code_context_mode'] = CodeContextMode.AUTO.value
            
            return settings
            
        except Exception as e:
            logger.error(f"Error reading settings for project {project_id}: {e}")
            return {'code_context_mode': CodeContextMode.AUTO.value}
    
    def delete_project_settings(self, project_id: str) -> bool:
        """
        Delete all settings for a project.
        
        Args:
            project_id: The project ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            settings_file = self._get_settings_file_path(project_id)
            
            if settings_file.exists():
                settings_file.unlink()
                logger.info(f"Deleted settings file for project {project_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error deleting settings for project {project_id}: {e}")
            return False
