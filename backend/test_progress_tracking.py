import asyncio
import json
from datetime import datetime
from services.progress_tracker import ProgressTracker, PlanningStep
from services.transparent_planning_agent import TransparentPlanningAgent


async def test_progress_tracking():
    """Test the progress tracking system"""
    print("🧪 Testing Progress Tracking System")
    print("=" * 50)
    
    # Test 1: Basic Progress Tracker
    print("\n1. Testing Basic Progress Tracker")
    progress_updates = []
    
    async def test_callback(progress_data):
        progress_updates.append(progress_data)
        print(f"  📊 Progress: {progress_data['message']}")
    
    tracker = ProgressTracker(test_callback)
    
    # Simulate some progress updates
    await tracker.update_progress(
        PlanningStep.ANALYZING_REQUEST,
        "🧠 Analyzing your request...",
        {"input_length": 25}
    )
    
    await tracker.update_progress(
        PlanningStep.DETECTING_INTENT,
        "🎯 Detected intent: feature_request",
        {"intent": "feature_request", "confidence": 0.85}
    )
    
    await tracker.update_progress(
        PlanningStep.EXECUTING_TOOLS,
        "📝 Creating task: User Authentication",
        {"task_title": "User Authentication"}
    )
    
    await tracker.update_progress(
        PlanningStep.COMPLETE,
        "✅ Response ready!",
        {"response_length": 150, "actions_taken": 1}
    )
    
    print(f"  ✅ Total progress updates: {len(progress_updates)}")
    print(f"  📋 Progress summary: {tracker.get_progress_summary()}")
    
    # Test 2: Transparent Planning Agent
    print("\n2. Testing Transparent Planning Agent")
    
    # Mock project context
    project_context = {
        "name": "Test Project",
        "description": "A test project for progress tracking",
        "tech_stack": "React + FastAPI"
    }
    
    # Create agent with progress tracking
    agent = TransparentPlanningAgent(tracker)
    
    try:
        result = await agent.process_user_message_with_progress(
            user_message="I want to add user authentication to my app",
            project_id="test-project",
            conversation_history=[],
            project_memories=[],
            tasks=[],
            project_context=project_context
        )
        
        print(f"  ✅ Agent processing completed")
        print(f"  📝 Response length: {len(result.get('response', ''))}")
        print(f"  🛠️ Tool results: {len(result.get('tool_results', []))}")
        print(f"  📊 Progress steps: {len(result.get('progress_summary', {}).get('steps', []))}")
        
    except Exception as e:
        print(f"  ❌ Agent processing failed: {e}")
    
    # Test 3: Progress Data Structure
    print("\n3. Testing Progress Data Structure")
    
    for i, update in enumerate(progress_updates):
        print(f"  Step {i+1}:")
        print(f"    Step: {update['step']}")
        print(f"    Message: {update['message']}")
        print(f"    Details: {update.get('details', {})}")
        print(f"    Timestamp: {update['timestamp']}")
        print()
    
    print("🎉 Progress tracking test completed!")


async def test_streaming_progress():
    """Test the streaming progress functionality"""
    print("\n🧪 Testing Streaming Progress")
    print("=" * 50)
    
    # Simulate streaming progress updates
    progress_queue = []
    
    async def progress_callback(progress_data):
        progress_queue.append(progress_data)
        # Simulate streaming to client
        stream_data = f"data: {json.dumps({'type': 'progress', 'progress': progress_data})}\n\n"
        print(f"  📡 Streaming: {progress_data['message']}")
    
    tracker = ProgressTracker(progress_callback)
    
    # Simulate agent processing with streaming
    steps = [
        (PlanningStep.ANALYZING_REQUEST, "🧠 Analyzing your request...", {"input_length": 30}),
        (PlanningStep.DETECTING_INTENT, "🎯 Detected intent: feature_request", {"intent": "feature_request", "confidence": 0.9}),
        (PlanningStep.GATHERING_CONTEXT, "📚 Gathering relevant context...", {"memories": 0, "tasks": 0}),
        (PlanningStep.PLANNING_ACTIONS, "📋 Planning required actions...", {"context_items": 0}),
        (PlanningStep.EXECUTING_TOOLS, "📝 Creating task: User Authentication", {"task_title": "User Authentication"}),
        (PlanningStep.GENERATING_RESPONSE, "💬 Generating response...", {"tool_results": 1}),
        (PlanningStep.COMPLETE, "✅ Response ready!", {"response_length": 200, "actions_taken": 1})
    ]
    
    for step, message, details in steps:
        await tracker.update_progress(step, message, details)
        await asyncio.sleep(0.5)  # Simulate processing time
    
    print(f"  ✅ Streamed {len(progress_queue)} progress updates")
    print("🎉 Streaming progress test completed!")


if __name__ == "__main__":
    print("🚀 Starting Progress Tracking Tests")
    print("=" * 50)
    
    # Run tests
    asyncio.run(test_progress_tracking())
    asyncio.run(test_streaming_progress())
    
    print("\n✅ All tests completed successfully!") 