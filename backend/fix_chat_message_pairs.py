#!/usr/bin/env python3
"""
Script to fix chat message pairs by combining user and assistant messages.
This script takes the migrated chat messages and properly pairs them.
"""

import json
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
    """Create a backup of the file before fixing."""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_name = f"{file_path.stem}_pairing_fix_{timestamp}{file_path.suffix}"
    backup_path = Path(BACKUP_DIR) / backup_name
    
    # Ensure backup directory exists
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Copy file to backup
    shutil.copy2(file_path, backup_path)
    logger.info(f"Created backup: {backup_path}")
    return backup_path

def fix_chat_message_pairs(file_path: Path) -> bool:
    """Fix chat message pairs by combining user and assistant messages."""
    try:
        logger.info(f"Fixing chat message pairs in: {file_path}")
        
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
        
        # Fix message pairs
        fixed_data = []
        i = 0
        while i < len(data):
            current_msg = data[i]
            
            # Check if this is a user message with empty response
            if (current_msg.get("message") and not current_msg.get("response") and 
                i + 1 < len(data) and 
                data[i + 1].get("session_id") == current_msg.get("session_id") and
                not data[i + 1].get("message") and data[i + 1].get("response")):
                
                # Combine user and assistant messages
                combined_msg = {
                    "id": current_msg.get("id", ""),
                    "project_id": project_id,
                    "session_id": current_msg.get("session_id", ""),
                    "message": current_msg.get("message", ""),
                    "response": data[i + 1].get("response", ""),
                    "created_at": current_msg.get("created_at", datetime.now().isoformat()),
                    "embedding": None,
                    "embedding_text": None
                }
                fixed_data.append(combined_msg)
                i += 2  # Skip both messages
                
            elif (not current_msg.get("message") and current_msg.get("response") and
                  i > 0 and 
                  data[i - 1].get("session_id") == current_msg.get("session_id") and
                  data[i - 1].get("message") and not data[i - 1].get("response")):
                
                # This assistant message was already handled by the previous iteration
                i += 1
                
            else:
                # Keep the message as is
                fixed_data.append(current_msg)
                i += 1
        
        # Write back to file
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(fixed_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Successfully fixed {len(fixed_data)} message pairs in {file_path}")
        return True
        
    except Exception as e:
        logger.error(f"Error fixing {file_path}: {e}")
        return False

def find_chat_files() -> List[Path]:
    """Find all chat files that need fixing."""
    data_dir = Path(DATA_DIR)
    if not data_dir.exists():
        logger.warning(f"Data directory {DATA_DIR} does not exist")
        return []
    
    chat_files = []
    for file_path in data_dir.glob("project-*-chat.json"):
        chat_files.append(file_path)
    
    return chat_files

def main():
    """Main fixing function."""
    logger.info("🔧 Starting Chat Message Pairing Fix")
    
    # Find chat files
    chat_files = find_chat_files()
    logger.info(f"Found {len(chat_files)} chat files to process")
    
    if not chat_files:
        logger.info("No chat files found to fix")
        return
    
    # Process each file
    successful_fixes = 0
    failed_fixes = 0
    
    for file_path in chat_files:
        if fix_chat_message_pairs(file_path):
            successful_fixes += 1
        else:
            failed_fixes += 1
    
    # Summary
    logger.info("📊 Fixing Summary:")
    logger.info(f"  - Total files processed: {len(chat_files)}")
    logger.info(f"  - Successful fixes: {successful_fixes}")
    logger.info(f"  - Failed fixes: {failed_fixes}")
    
    if failed_fixes == 0:
        logger.info("🎉 All fixes completed successfully!")
    else:
        logger.warning(f"⚠️ {failed_fixes} fixes failed. Check logs for details.")

if __name__ == "__main__":
    main() 