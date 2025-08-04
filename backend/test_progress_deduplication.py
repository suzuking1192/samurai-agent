import asyncio
import pytest
from services.progress_tracker import ProgressTracker, PlanningStep, ProgressUpdate


class TestProgressDeduplication:
    """Test progress deduplication functionality"""
    
    def test_progress_update_unique_key(self):
        """Test that progress updates generate unique keys"""
        progress1 = ProgressUpdate(PlanningStep.ANALYZING_REQUEST, "Analyzing request", {"test": "data"})
        progress2 = ProgressUpdate(PlanningStep.ANALYZING_REQUEST, "Analyzing request", {"test": "data"})
        
        # Keys should be the same since we're using step + message only
        key1 = progress1.get_unique_key()
        key2 = progress2.get_unique_key()
        
        assert key1 == key2  # Same step and message should have same key
        assert "analyzing_request" in key1
        assert "Analyzing request" in key1
    
    @pytest.mark.asyncio
    async def test_progress_tracker_deduplication(self):
        """Test that ProgressTracker prevents duplicate progress updates"""
        progress_calls = []
        
        async def mock_callback(progress_data):
            progress_calls.append(progress_data)
        
        tracker = ProgressTracker(mock_callback)
        
        # Send the same progress update multiple times
        for _ in range(3):
            await tracker.update_progress(
                PlanningStep.ANALYZING_REQUEST,
                "Analyzing request",
                {"test": "data"}
            )
        
        # Should only have one call due to deduplication
        assert len(progress_calls) == 1
        assert progress_calls[0]["step"] == "analyzing_request"
        assert progress_calls[0]["message"] == "Analyzing request"
    
    @pytest.mark.asyncio
    async def test_progress_tracker_different_updates(self):
        """Test that different progress updates are not deduplicated"""
        progress_calls = []
        
        async def mock_callback(progress_data):
            progress_calls.append(progress_data)
        
        tracker = ProgressTracker(mock_callback)
        
        # Send different progress updates
        await tracker.update_progress(
            PlanningStep.ANALYZING_REQUEST,
            "Analyzing request",
            {"test": "data1"}
        )
        
        await tracker.update_progress(
            PlanningStep.DETECTING_INTENT,
            "Detecting intent",
            {"test": "data2"}
        )
        
        # Should have two calls
        assert len(progress_calls) == 2
        assert progress_calls[0]["step"] == "analyzing_request"
        assert progress_calls[1]["step"] == "detecting_intent"
    
    def test_progress_tracker_reset(self):
        """Test that reset clears the deduplication tracking"""
        tracker = ProgressTracker()
        
        # Add some progress
        progress = ProgressUpdate(PlanningStep.ANALYZING_REQUEST, "Test", {})
        tracker.sent_progress_keys.add(progress.get_unique_key())
        
        # Reset should clear the tracking
        tracker.reset()
        assert len(tracker.sent_progress_keys) == 0
        assert len(tracker.steps) == 0
        assert tracker.current_step is None


if __name__ == "__main__":
    # Run tests
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    # Simple test runner
    async def run_tests():
        print("🧪 Running Progress Deduplication Tests...")
        
        # Test 1: Unique key generation
        print("Test 1: Progress update unique key generation...")
        progress1 = ProgressUpdate(PlanningStep.ANALYZING_REQUEST, "Analyzing request", {"test": "data"})
        progress2 = ProgressUpdate(PlanningStep.ANALYZING_REQUEST, "Analyzing request", {"test": "data"})
        
        key1 = progress1.get_unique_key()
        key2 = progress2.get_unique_key()
        
        if key1 == key2:
            print("✅ Unique key generation works correctly (same step/message = same key)")
        else:
            print("❌ Unique key generation failed")
        
        # Test 2: Deduplication
        print("Test 2: Progress tracker deduplication...")
        progress_calls = []
        
        async def mock_callback(progress_data):
            progress_calls.append(progress_data)
        
        tracker = ProgressTracker(mock_callback)
        
        # Send the same progress update multiple times
        for i in range(3):
            await tracker.update_progress(
                PlanningStep.ANALYZING_REQUEST,
                "Analyzing request",
                {"test": "data"}
            )
        
        if len(progress_calls) == 1:
            print("✅ Progress deduplication works correctly")
        else:
            print(f"❌ Progress deduplication failed - got {len(progress_calls)} calls instead of 1")
        
        # Test 3: Different updates
        print("Test 3: Different progress updates...")
        progress_calls.clear()
        tracker.reset()
        
        await tracker.update_progress(
            PlanningStep.ANALYZING_REQUEST,
            "Analyzing request",
            {"test": "data1"}
        )
        
        await tracker.update_progress(
            PlanningStep.DETECTING_INTENT,
            "Detecting intent",
            {"test": "data2"}
        )
        
        if len(progress_calls) == 2:
            print("✅ Different progress updates are not deduplicated")
        else:
            print(f"❌ Different progress updates failed - got {len(progress_calls)} calls instead of 2")
        
        print("🎉 All tests completed!")
    
    asyncio.run(run_tests()) 