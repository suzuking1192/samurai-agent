#!/usr/bin/env python3
"""
Migration script to convert legacy chat messages to the new format.
This script updates existing chat message files to use the new ChatMessage model structure.
"""

import json
import os
import shutil
from datetime import datetime
from pathlib import Path
import logging
from typing import List, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATA_DIR = "data"
BACKUP_DIR = "data/backups"

def backup_file(file_path: Path) -> Path:
    """Create a backup of the file before migration."""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_name = f"{file_path.stem}_migration_backup_{timestamp}{file_path.suffix}"
    backup_path = Path(BACKUP_DIR) / backup_name
    
    # Ensure backup directory exists
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Copy file to backup
    shutil.copy2(file_path, backup_path)
    logger.info(f"Created backup: {backup_path}")
    return backup_path

def convert_legacy_message(item: Dict[str, Any], project_id: str) -> Dict[str, Any]:
    """Convert a legacy chat message to the new format."""
    if "role" in item and "content" in item:
        # Legacy format - convert to new format
        converted_item = {
            "id": item.get("id", ""),
            "project_id": project_id,
            "session_id": item.get("session_id", ""),
            "message": "",
            "response": "",
            "created_at": item.get("timestamp", datetime.now().isoformat()),
            "embedding": None,
            "embedding_text": None
        }
        
        if item["role"] == "user":
            converted_item["message"] = item["content"]
        elif item["role"] == "assistant":
            converted_item["response"] = item["content"]
        
        return converted_item
    else:
        # Already in new format
        return item

def migrate_chat_file(file_path: Path) -> bool:
    """Migrate a single chat file from legacy to new format with proper message pairing."""
    try:
        logger.info(f"Migrating chat file: {file_path}")
        
        # Create backup
        backup_path = backup_file(file_path)
        
        # Read the file
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not isinstance(data, list):
            logger.warning(f"File {file_path} does not contain a list of messages")
            return False
        
        # Extract project ID from filename
        filename = file_path.stem
        if filename.startswith("project-"):
            parts = filename.split("-")
            if len(parts) >= 2:
                project_id = parts[1]
            else:
                logger.warning(f"Could not extract project ID from filename: {filename}")
                return False
        else:
            logger.warning(f"File {file_path} does not follow project naming convention")
            return False
        
        # Check if migration is needed
        needs_migration = False
        for item in data:
            if "role" in item and "content" in item:
                needs_migration = True
                break
        
        if not needs_migration:
            logger.info(f"File {file_path} already in new format, skipping")
            return True
        
        # Convert messages with proper pairing
        converted_data = []
        i = 0
        while i < len(data):
            item = data[i]
            
            if "role" in item and "content" in item:
                if item["role"] == "user":
                    # Create a new message pair
                    converted_item = {
                        "id": item.get("id", ""),
                        "project_id": project_id,
                        "session_id": item.get("session_id", ""),
                        "message": item["content"],
                        "response": "",
                        "created_at": item.get("timestamp", datetime.now().isoformat()),
                        "embedding": None,
                        "embedding_text": None
                    }
                    
                    # Check if next message is an assistant response
                    if i + 1 < len(data) and data[i + 1].get("role") == "assistant":
                        converted_item["response"] = data[i + 1]["content"]
                        i += 2  # Skip both user and assistant messages
                    else:
                        i += 1  # Skip only user message
                    
                    converted_data.append(converted_item)
                    
                elif item["role"] == "assistant":
                    # Create a message with only response (no user message)
                    converted_item = {
                        "id": item.get("id", ""),
                        "project_id": project_id,
                        "session_id": item.get("session_id", ""),
                        "message": "",
                        "response": item["content"],
                        "created_at": item.get("timestamp", datetime.now().isoformat()),
                        "embedding": None,
                        "embedding_text": None
                    }
                    converted_data.append(converted_item)
                    i += 1
                else:
                    logger.warning(f"Unknown role: {item['role']}, skipping")
                    i += 1
            else:
                # Already in new format, keep as is
                converted_data.append(item)
                i += 1
        
        # Write back to file
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(converted_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Successfully migrated {len(converted_data)} messages in {file_path}")
        return True
        
    except Exception as e:
        logger.error(f"Error migrating {file_path}: {e}")
        return False

def find_chat_files() -> List[Path]:
    """Find all chat files that need migration."""
    data_dir = Path(DATA_DIR)
    if not data_dir.exists():
        logger.warning(f"Data directory {DATA_DIR} does not exist")
        return []
    
    chat_files = []
    for file_path in data_dir.glob("project-*-chat.json"):
        chat_files.append(file_path)
    
    return chat_files

def main():
    """Main migration function."""
    logger.info("🚀 Starting Chat Message Migration")
    
    # Find chat files
    chat_files = find_chat_files()
    logger.info(f"Found {len(chat_files)} chat files to process")
    
    if not chat_files:
        logger.info("No chat files found to migrate")
        return
    
    # Process each file
    successful_migrations = 0
    failed_migrations = 0
    
    for file_path in chat_files:
        if migrate_chat_file(file_path):
            successful_migrations += 1
        else:
            failed_migrations += 1
    
    # Summary
    logger.info("📊 Migration Summary:")
    logger.info(f"  - Total files processed: {len(chat_files)}")
    logger.info(f"  - Successful migrations: {successful_migrations}")
    logger.info(f"  - Failed migrations: {failed_migrations}")
    
    if failed_migrations == 0:
        logger.info("🎉 All migrations completed successfully!")
    else:
        logger.warning(f"⚠️ {failed_migrations} migrations failed. Check logs for details.")

if __name__ == "__main__":
    main() 