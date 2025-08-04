#!/usr/bin/env python3
"""
Migration script to add session_id to existing chat messages.
This script will:
1. Create a default session for each project that has chat messages
2. Add session_id to all existing chat messages
3. Preserve all existing data
"""

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
DATA_DIR = "data"

def load_json_file(file_path: Path) -> List[Dict[str, Any]]:
    """Load JSON data from file."""
    if not file_path.exists():
        return []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading {file_path}: {e}")
        return []

def save_json_file(file_path: Path, data: List[Dict[str, Any]]) -> None:
    """Save JSON data to file."""
    try:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logger.info(f"Saved {file_path}")
    except Exception as e:
        logger.error(f"Error saving {file_path}: {e}")

def create_default_session(project_id: str) -> Dict[str, Any]:
    """Create a default session for a project."""
    return {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "name": "Default Session",
        "created_at": datetime.now().isoformat(),
        "last_activity": datetime.now().isoformat()
    }

def migrate_project_chat_messages(project_id: str) -> bool:
    """Migrate chat messages for a specific project."""
    data_dir = Path(DATA_DIR)
    chat_file = data_dir / f"project-{project_id}-chat.json"
    sessions_file = data_dir / f"project-{project_id}-sessions.json"
    
    # Load existing chat messages
    chat_messages = load_json_file(chat_file)
    
    if not chat_messages:
        logger.info(f"No chat messages found for project {project_id}")
        return True
    
    # Find existing session_id from messages
    existing_session_ids = set()
    for message in chat_messages:
        if "session_id" in message:
            existing_session_ids.add(message["session_id"])
    
    # If no existing session_id, create a default session
    if not existing_session_ids:
        default_session = create_default_session(project_id)
        session_id = default_session["id"]
        
        # Add session_id to all existing chat messages
        migrated_messages = []
        for message in chat_messages:
            if "session_id" not in message:
                message["session_id"] = session_id
            migrated_messages.append(message)
        
        # Save migrated chat messages
        save_json_file(chat_file, migrated_messages)
        
        # Save default session
        save_json_file(sessions_file, [default_session])
        
        logger.info(f"Migrated {len(migrated_messages)} chat messages for project {project_id} with new session {session_id}")
    else:
        # Use existing session_id
        session_id = list(existing_session_ids)[0]  # Use the first one found
        
        # Create session record for existing session_id
        existing_session = {
            "id": session_id,
            "project_id": project_id,
            "name": "Default Session",
            "created_at": datetime.now().isoformat(),
            "last_activity": datetime.now().isoformat()
        }
        
        # Ensure all messages have session_id
        migrated_messages = []
        for message in chat_messages:
            if "session_id" not in message:
                message["session_id"] = session_id
            migrated_messages.append(message)
        
        # Save migrated chat messages
        save_json_file(chat_file, migrated_messages)
        
        # Save existing session
        save_json_file(sessions_file, [existing_session])
        
        logger.info(f"Migrated {len(migrated_messages)} chat messages for project {project_id} with existing session {session_id}")
    
    return True

def find_projects_with_chat() -> List[str]:
    """Find all projects that have chat message files."""
    data_dir = Path(DATA_DIR)
    project_ids = set()
    
    for chat_file in data_dir.glob("project-*-chat.json"):
        # Extract project ID from filename
        filename = chat_file.stem
        if filename.startswith("project-") and filename.endswith("-chat"):
            project_id = filename[8:-5]  # Remove "project-" prefix and "-chat" suffix
            project_ids.add(project_id)
    
    return list(project_ids)

def main():
    """Main migration function."""
    logger.info("Starting session migration...")
    
    # Find all projects with chat messages
    project_ids = find_projects_with_chat()
    logger.info(f"Found {len(project_ids)} projects with chat messages")
    
    # Migrate each project
    success_count = 0
    for project_id in project_ids:
        try:
            if migrate_project_chat_messages(project_id):
                success_count += 1
        except Exception as e:
            logger.error(f"Error migrating project {project_id}: {e}")
    
    logger.info(f"Migration completed: {success_count}/{len(project_ids)} projects migrated successfully")

if __name__ == "__main__":
    main() 