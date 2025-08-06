"""
Progress Streaming Service

This module provides real-time progress streaming capabilities for the planning-first agent.
It allows the agent to send progress updates as they occur during processing.
"""

import asyncio
import json
from datetime import datetime
from typing import AsyncGenerator, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class ProgressStreamer:
    """
    Handles real-time progress streaming for agent processing.
    """
    
    def __init__(self):
        self.progress_queue = asyncio.Queue()
        self.is_streaming = False
    
    async def send_progress_update(
        self, 
        step: str, 
        message: str, 
        details: str = "", 
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Send a progress update to the stream.
        
        Args:
            step: The processing step (e.g., 'analyzing', 'planning', 'execution')
            message: Human-readable message for the user
            details: Additional details about what's happening
            metadata: Optional metadata about the step
        """
        if not self.is_streaming:
            logger.warning("Progress streamer is not active, skipping update")
            return
        
        progress_data = {
            'type': 'progress',
            'progress': {
                'step': step,
                'message': message,
                'details': details,
                'timestamp': datetime.now().isoformat(),
                'metadata': metadata or {}
            }
        }
        
        try:
            await self.progress_queue.put(progress_data)
            logger.debug(f"Progress update queued: {step} - {message}")
        except Exception as e:
            logger.error(f"Failed to queue progress update: {e}")
    
    async def start_streaming(self) -> None:
        """Start the progress streaming."""
        self.is_streaming = True
        logger.info("Progress streaming started")
    
    async def stop_streaming(self) -> None:
        """Stop the progress streaming."""
        self.is_streaming = False
        logger.info("Progress streaming stopped")
    
    async def get_progress_updates(self) -> AsyncGenerator[str, None]:
        """
        Generator that yields progress updates as they occur.
        
        Yields:
            JSON-formatted progress update strings
        """
        await self.start_streaming()
        
        try:
            while self.is_streaming:
                try:
                    # Wait for progress updates with timeout
                    progress_data = await asyncio.wait_for(
                        self.progress_queue.get(), 
                        timeout=0.1
                    )
                    
                    # Yield the progress update
                    yield f"data: {json.dumps(progress_data)}\n\n"
                    
                    # Mark the task as done
                    self.progress_queue.task_done()
                    
                except asyncio.TimeoutError:
                    # No progress updates available, continue
                    continue
                except Exception as e:
                    logger.error(f"Error in progress streaming: {e}")
                    break
                    
        finally:
            await self.stop_streaming()


class PlanningProgressTracker:
    """
    Tracks progress for planning-first agent processing.
    """
    
    def __init__(self, streamer: ProgressStreamer):
        self.streamer = streamer
        self.current_step = None
        self.step_start_time = None
    
    async def start_step(self, step: str, message: str, details: str = "") -> None:
        """Start a new processing step."""
        self.current_step = step
        self.step_start_time = datetime.now()
        
        await self.streamer.send_progress_update(
            step=step,
            message=message,
            details=details,
            metadata={'action': 'start', 'step': step}
        )
        
        logger.info(f"Started step: {step} - {message}")
    
    async def update_step(self, message: str, details: str = "", metadata: Optional[Dict[str, Any]] = None) -> None:
        """Update the current step with new information."""
        if not self.current_step:
            logger.warning("No current step to update")
            return
        
        await self.streamer.send_progress_update(
            step=self.current_step,
            message=message,
            details=details,
            metadata=metadata or {}
        )
        
        logger.debug(f"Updated step {self.current_step}: {message}")
    
    async def complete_step(self, message: str = None, details: str = "", metadata: Optional[Dict[str, Any]] = None) -> None:
        """Complete the current step."""
        if not self.current_step:
            logger.warning("No current step to complete")
            return
        
        completion_message = message or f"Completed {self.current_step}"
        
        await self.streamer.send_progress_update(
            step=self.current_step,
            message=completion_message,
            details=details,
            metadata={
                'action': 'complete',
                'step': self.current_step,
                'duration': (datetime.now() - self.step_start_time).total_seconds() if self.step_start_time else None,
                **(metadata or {})
            }
        )
        
        logger.info(f"Completed step: {self.current_step} - {completion_message}")
        
        # Reset current step
        self.current_step = None
        self.step_start_time = None
    
    async def error_step(self, error_message: str, details: str = "") -> None:
        """Report an error in the current step."""
        if not self.current_step:
            logger.warning("No current step to report error for")
            return
        
        await self.streamer.send_progress_update(
            step=self.current_step,
            message=f"Error: {error_message}",
            details=details,
            metadata={
                'action': 'error',
                'step': self.current_step,
                'error': True
            }
        )
        
        logger.error(f"Error in step {self.current_step}: {error_message}")
        
        # Reset current step
        self.current_step = None
        self.step_start_time = None


# Predefined progress steps for planning-first agent
PLANNING_PROGRESS_STEPS = {
    'analyzing': {
        'message': '🧠 Analyzing your request...',
        'details': 'Understanding your intent and requirements'
    },
    'context': {
        'message': '📚 Gathering conversation context...',
        'details': 'Loading previous messages and project context'
    },
    'planning': {
        'message': '📋 Creating execution plan...',
        'details': 'Planning the best approach for your request'
    },
    'validation': {
        'message': '✅ Validating plan...',
        'details': 'Ensuring the plan is feasible and optimal'
    },
    'execution': {
        'message': '⚙️ Executing plan...',
        'details': 'Carrying out the planned actions'
    },
    'memory': {
        'message': '💾 Updating memory...',
        'details': 'Saving important information for future reference'
    },
    'completion': {
        'message': '🎉 Processing complete!',
        'details': 'All tasks completed successfully'
    }
}


async def create_planning_progress_tracker() -> tuple[ProgressStreamer, PlanningProgressTracker]:
    """
    Create a progress streamer and tracker for planning-first agent.
    
    Returns:
        Tuple of (ProgressStreamer, PlanningProgressTracker)
    """
    streamer = ProgressStreamer()
    tracker = PlanningProgressTracker(streamer)
    return streamer, tracker


async def simulate_planning_progress(streamer: ProgressStreamer, tracker: PlanningProgressTracker) -> None:
    """
    Simulate planning-first agent progress for testing.
    """
    for step_name, step_info in PLANNING_PROGRESS_STEPS.items():
        if step_name == 'completion':
            # Skip completion step in simulation
            continue
            
        await tracker.start_step(
            step=step_name,
            message=step_info['message'],
            details=step_info['details']
        )
        
        # Simulate processing time
        await asyncio.sleep(0.5)
        
        await tracker.complete_step(
            message=f"✅ {step_info['message']}",
            details=f"Completed: {step_info['details']}"
        )
    
    # Send completion message
    await streamer.send_progress_update(
        step='completion',
        message=PLANNING_PROGRESS_STEPS['completion']['message'],
        details=PLANNING_PROGRESS_STEPS['completion']['details']
    ) 