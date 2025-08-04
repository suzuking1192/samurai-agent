#!/usr/bin/env python3
"""
Demo script for the consolidated memory system.

This script demonstrates:
1. Creating consolidated memories for different categories
2. Adding sections to consolidated memories
3. Similarity detection and section updates
4. Migration from fragmented memories
"""

import sys
import os
from datetime import datetime

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.consolidated_memory import ConsolidatedMemoryService
from services.file_service import FileService
from models import Memory

def demo_consolidated_memory():
    """Demonstrate the consolidated memory system."""
    print("🚀 Consolidated Memory System Demo")
    print("=" * 50)
    
    service = ConsolidatedMemoryService()
    project_id = f"demo_project_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    print(f"\n📁 Project: {project_id}")
    
    # Demo 1: Create consolidated memories for different categories
    print("\n1️⃣ Creating consolidated memories for different categories...")
    
    # Frontend knowledge
    result1 = service.add_information_to_consolidated_memory(
        "frontend", project_id,
        "We decided to use React with TypeScript for the frontend. This provides better type safety and developer experience.",
        "React TypeScript Decision"
    )
    print(f"   ✅ {result1['message']}")
    
    result2 = service.add_information_to_consolidated_memory(
        "frontend", project_id,
        "CSS styling will use Tailwind CSS for rapid development and consistent design system.",
        "CSS Framework Choice"
    )
    print(f"   ✅ {result2['message']}")
    
    # Backend knowledge
    result3 = service.add_information_to_consolidated_memory(
        "backend", project_id,
        "We chose Node.js with Express for the backend API. This provides good performance and extensive ecosystem.",
        "Backend Technology Stack"
    )
    print(f"   ✅ {result3['message']}")
    
    # Database knowledge
    result4 = service.add_information_to_consolidated_memory(
        "database", project_id,
        "PostgreSQL will be used for the main database with proper indexing for performance.",
        "Database Choice"
    )
    print(f"   ✅ {result4['message']}")
    
    # Demo 2: Show similarity detection
    print("\n2️⃣ Demonstrating similarity detection...")
    
    # Add similar information to existing backend section
    result5 = service.add_information_to_consolidated_memory(
        "backend", project_id,
        "Express.js will handle routing and middleware. We'll use JWT for authentication.",
        "Backend Technology Stack"
    )
    print(f"   ✅ {result5['message']}")
    
    # Demo 3: Show consolidated memories
    print("\n3️⃣ Displaying consolidated memories...")
    
    frontend_memory = service.get_or_create_consolidated_memory("frontend", project_id)
    backend_memory = service.get_or_create_consolidated_memory("backend", project_id)
    database_memory = service.get_or_create_consolidated_memory("database", project_id)
    
    print(f"\n📚 Frontend Knowledge Base ({len(frontend_memory.sections)} sections):")
    for key, section in frontend_memory.sections.items():
        print(f"   • {section.title}")
    
    print(f"\n⚙️ Backend Knowledge Base ({len(backend_memory.sections)} sections):")
    for key, section in backend_memory.sections.items():
        print(f"   • {section.title}")
    
    print(f"\n🗄️ Database Knowledge Base ({len(database_memory.sections)} sections):")
    for key, section in database_memory.sections.items():
        print(f"   • {section.title}")
    
    # Demo 4: Show full content
    print("\n4️⃣ Sample consolidated content...")
    
    print(f"\n📖 Frontend Knowledge Base Content:")
    print("-" * 40)
    print(frontend_memory.generate_full_content()[:500] + "...")
    
    # Demo 5: Migration simulation
    print("\n5️⃣ Simulating migration from fragmented memories...")
    
    # Create some fragmented memories
    file_service = FileService()
    fragmented_memories = [
        Memory(
            id="frag_1",
            project_id=project_id,
            title="Component Structure",
            content="Components will be organized in a feature-based structure.",
            category="frontend",
            type="decision",
            created_at=datetime.now()
        ),
        Memory(
            id="frag_2",
            project_id=project_id,
            title="State Management",
            content="We'll use React Context for global state management.",
            category="frontend",
            type="decision",
            created_at=datetime.now()
        ),
        Memory(
            id="frag_3",
            project_id=project_id,
            title="API Design",
            content="RESTful API endpoints with proper error handling.",
            category="backend",
            type="decision",
            created_at=datetime.now()
        )
    ]
    
    # Save fragmented memories
    for memory in fragmented_memories:
        file_service.save_memory(project_id, memory)
    
    print(f"   📝 Created {len(fragmented_memories)} fragmented memories")
    
    # Perform migration
    migration_results = service.migrate_to_consolidated_memories(project_id)
    
    print(f"   🔄 Migration results:")
    for category, result in migration_results.items():
        print(f"      • {result['message']}")
    
    print("\n🎉 Demo completed successfully!")
    print(f"\n📊 Summary:")
    print(f"   • Created consolidated memories for 3 categories")
    print(f"   • Added 4 sections across categories")
    print(f"   • Demonstrated similarity detection")
    print(f"   • Simulated migration from fragmented memories")
    print(f"   • All memories are now organized by category")

if __name__ == "__main__":
    demo_consolidated_memory() 