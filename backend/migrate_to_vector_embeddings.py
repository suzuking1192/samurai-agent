"""
Migration script to generate embeddings for existing data.

This script will:
1. Load all existing tasks, memories, and chat messages
2. Generate embeddings for items that don't have them
3. Save the updated data back to files
"""

import asyncio
import logging
from typing import List, Dict, Any
import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.file_service import FileService
from services.embedding_service import embedding_service
from models import Task, Memory, ChatMessage, Project

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class VectorEmbeddingMigration:
    """Migration class for generating embeddings for existing data."""
    
    def __init__(self):
        self.file_service = FileService()
        self.stats = {
            "projects_processed": 0,
            "tasks_processed": 0,
            "tasks_with_embeddings": 0,
            "memories_processed": 0,
            "memories_with_embeddings": 0,
            "chat_messages_processed": 0,
            "chat_messages_with_embeddings": 0,
            "errors": []
        }
    
    async def migrate_all_data(self) -> Dict[str, Any]:
        """
        Migrate all existing data to include embeddings.
        
        Returns:
            Dictionary with migration statistics
        """
        logger.info("Starting vector embedding migration...")
        
        try:
            # Check if embedding model is loaded
            if not embedding_service.is_model_loaded():
                logger.error("Embedding model not loaded. Cannot proceed with migration.")
                return {"error": "Embedding model not loaded"}
            
            # Load all projects
            projects = self.file_service.load_projects()
            logger.info(f"Found {len(projects)} projects to process")
            
            for project in projects:
                await self._migrate_project(project)
            
            logger.info("Vector embedding migration completed successfully!")
            return self.stats
            
        except Exception as e:
            logger.error(f"Error during migration: {e}")
            self.stats["errors"].append(str(e))
            return self.stats
    
    async def _migrate_project(self, project: Project) -> None:
        """
        Migrate a single project's data.
        
        Args:
            project: Project to migrate
        """
        logger.info(f"Processing project: {project.name} ({project.id})")
        self.stats["projects_processed"] += 1
        
        try:
            # Migrate tasks
            await self._migrate_project_tasks(project.id)
            
            # Migrate memories
            await self._migrate_project_memories(project.id)
            
            # Migrate chat messages
            await self._migrate_project_chat_messages(project.id)
            
        except Exception as e:
            error_msg = f"Error processing project {project.id}: {e}"
            logger.error(error_msg)
            self.stats["errors"].append(error_msg)
    
    async def _migrate_project_tasks(self, project_id: str) -> None:
        """
        Migrate tasks for a project.
        
        Args:
            project_id: Project identifier
        """
        try:
            tasks = self.file_service.load_tasks(project_id)
            logger.info(f"Processing {len(tasks)} tasks for project {project_id}")
            
            tasks_updated = []
            for task in tasks:
                self.stats["tasks_processed"] += 1
                
                if task.embedding:
                    self.stats["tasks_with_embeddings"] += 1
                    tasks_updated.append(task)
                    continue
                
                # Generate embedding for task
                try:
                    # Prepare text for embedding
                    embedding_text = f"{task.title} {task.description}"
                    embedding_text = embedding_service.prepare_text_for_embedding(embedding_text)
                    
                    # Generate embedding
                    embedding = embedding_service.generate_embedding(embedding_text)
                    
                    if embedding:
                        task.embedding = embedding
                        task.embedding_text = embedding_text
                        self.stats["tasks_with_embeddings"] += 1
                        logger.debug(f"Generated embedding for task: {task.title}")
                    else:
                        logger.warning(f"Failed to generate embedding for task: {task.title}")
                    
                    tasks_updated.append(task)
                    
                except Exception as e:
                    logger.error(f"Error generating embedding for task {task.id}: {e}")
                    tasks_updated.append(task)  # Keep task even if embedding fails
            
            # Save updated tasks
            if tasks_updated:
                self.file_service.save_tasks(project_id, tasks_updated)
                logger.info(f"Saved {len(tasks_updated)} tasks with embeddings for project {project_id}")
            
        except Exception as e:
            error_msg = f"Error migrating tasks for project {project_id}: {e}"
            logger.error(error_msg)
            self.stats["errors"].append(error_msg)
    
    async def _migrate_project_memories(self, project_id: str) -> None:
        """
        Migrate memories for a project.
        
        Args:
            project_id: Project identifier
        """
        try:
            memories = self.file_service.load_memories(project_id)
            logger.info(f"Processing {len(memories)} memories for project {project_id}")
            
            memories_updated = []
            for memory in memories:
                self.stats["memories_processed"] += 1
                
                if memory.embedding:
                    self.stats["memories_with_embeddings"] += 1
                    memories_updated.append(memory)
                    continue
                
                # Generate embedding for memory
                try:
                    # Prepare text for embedding
                    embedding_text = f"{memory.title} {memory.content}"
                    embedding_text = embedding_service.prepare_text_for_embedding(embedding_text)
                    
                    # Generate embedding
                    embedding = embedding_service.generate_embedding(embedding_text)
                    
                    if embedding:
                        memory.embedding = embedding
                        memory.embedding_text = embedding_text
                        self.stats["memories_with_embeddings"] += 1
                        logger.debug(f"Generated embedding for memory: {memory.title}")
                    else:
                        logger.warning(f"Failed to generate embedding for memory: {memory.title}")
                    
                    memories_updated.append(memory)
                    
                except Exception as e:
                    logger.error(f"Error generating embedding for memory {memory.id}: {e}")
                    memories_updated.append(memory)  # Keep memory even if embedding fails
            
            # Save updated memories
            if memories_updated:
                self.file_service.save_memories(project_id, memories_updated)
                logger.info(f"Saved {len(memories_updated)} memories with embeddings for project {project_id}")
            
        except Exception as e:
            error_msg = f"Error migrating memories for project {project_id}: {e}"
            logger.error(error_msg)
            self.stats["errors"].append(error_msg)
    
    async def _migrate_project_chat_messages(self, project_id: str) -> None:
        """
        Migrate chat messages for a project.
        
        Args:
            project_id: Project identifier
        """
        try:
            chat_messages = self.file_service.load_chat_history(project_id)
            logger.info(f"Processing {len(chat_messages)} chat messages for project {project_id}")
            
            messages_updated = []
            for message in chat_messages:
                self.stats["chat_messages_processed"] += 1
                
                if message.embedding:
                    self.stats["chat_messages_with_embeddings"] += 1
                    messages_updated.append(message)
                    continue
                
                # Generate embedding for chat message
                try:
                    # Prepare text for embedding (combine user message and AI response)
                    content_parts = []
                    if message.message:
                        content_parts.append(f"User: {message.message}")
                    if message.response:
                        content_parts.append(f"Agent: {message.response}")
                    
                    embedding_text = " ".join(content_parts)
                    embedding_text = embedding_service.prepare_text_for_embedding(embedding_text)
                    
                    # Generate embedding
                    embedding = embedding_service.generate_embedding(embedding_text)
                    
                    if embedding:
                        message.embedding = embedding
                        message.embedding_text = embedding_text
                        self.stats["chat_messages_with_embeddings"] += 1
                        logger.debug(f"Generated embedding for chat message: {message.id}")
                    else:
                        logger.warning(f"Failed to generate embedding for chat message: {message.id}")
                    
                    messages_updated.append(message)
                    
                except Exception as e:
                    logger.error(f"Error generating embedding for chat message {message.id}: {e}")
                    messages_updated.append(message)  # Keep message even if embedding fails
            
            # Save updated chat messages
            if messages_updated:
                self.file_service.save_chat_history(project_id, messages_updated)
                logger.info(f"Saved {len(messages_updated)} chat messages with embeddings for project {project_id}")
            
        except Exception as e:
            error_msg = f"Error migrating chat messages for project {project_id}: {e}"
            logger.error(error_msg)
            self.stats["errors"].append(error_msg)
    
    def print_migration_summary(self) -> None:
        """Print a summary of the migration results."""
        print("\n" + "="*60)
        print("VECTOR EMBEDDING MIGRATION SUMMARY")
        print("="*60)
        print(f"Projects processed: {self.stats['projects_processed']}")
        print(f"Tasks processed: {self.stats['tasks_processed']}")
        print(f"Tasks with embeddings: {self.stats['tasks_with_embeddings']}")
        print(f"Memories processed: {self.stats['memories_processed']}")
        print(f"Memories with embeddings: {self.stats['memories_with_embeddings']}")
        print(f"Chat messages processed: {self.stats['chat_messages_processed']}")
        print(f"Chat messages with embeddings: {self.stats['chat_messages_with_embeddings']}")
        
        if self.stats["errors"]:
            print(f"\nErrors encountered: {len(self.stats['errors'])}")
            for error in self.stats["errors"]:
                print(f"  - {error}")
        
        print("="*60)


async def main():
    """Main function to run the migration."""
    migration = VectorEmbeddingMigration()
    
    try:
        # Run the migration
        result = await migration.migrate_all_data()
        
        # Print summary
        migration.print_migration_summary()
        
        if "error" in result:
            print(f"\nMigration failed: {result['error']}")
            return 1
        else:
            print("\nMigration completed successfully!")
            return 0
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        print(f"\nMigration failed: {e}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code) 