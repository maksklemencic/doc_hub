"""
Base agent class providing common functionality for all agents in the system.
"""

import asyncio
import logging
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class AgentStatus(str, Enum):
    """Agent execution status."""
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class AgentState:
    """Represents the current state of an agent."""
    agent_id: str
    agent_type: str
    status: AgentStatus = AgentStatus.IDLE
    current_task: Optional[str] = None
    progress: float = 0.0
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    results: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentMessage:
    """Message format for agent communication."""
    sender_id: str
    recipient_id: str
    message_type: str
    payload: Dict[str, Any]
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    correlation_id: Optional[str] = None


class BaseAgent(ABC):
    """
    Base class for all agents in the system.

    Provides common functionality like:
    - State management
    - Error handling
    - Logging
    - Progress tracking
    - Inter-agent communication
    """

    def __init__(self, agent_type: str, max_retry_attempts: int = 3):
        self.agent_id = str(uuid.uuid4())
        self.agent_type = agent_type
        self.max_retry_attempts = max_retry_attempts
        self.state = AgentState(agent_id=self.agent_id, agent_type=agent_type)
        self.logger = logging.getLogger(f"{__name__}.{agent_type}")
        self.message_queue: List[AgentMessage] = []

    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the agent with retry logic and error handling.

        Args:
            input_data: Input data for the agent

        Returns:
            Dict containing the agent's results
        """
        self._start_execution()

        for attempt in range(self.max_retry_attempts):
            try:
                self.logger.info(
                    f"Starting execution attempt "
                    f"{attempt + 1}/{self.max_retry_attempts}"
                )

                # Execute the main agent logic
                result = await self._execute_main_logic(input_data)

                self._complete_execution(result)
                return result

            except Exception as e:
                self.logger.error(f"Execution attempt {attempt + 1} failed: {str(e)}")

                if attempt == self.max_retry_attempts - 1:
                    # Final attempt failed
                    self._fail_execution(str(e))
                    raise

                # Wait before retry with exponential backoff
                await asyncio.sleep(2 ** attempt)

        # This should never be reached due to the raise in the final attempt
        # but added for type checking
        raise RuntimeError("All retry attempts failed")

    @abstractmethod
    async def _execute_main_logic(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main execution logic to be implemented by each agent.

        Args:
            input_data: Input data for processing

        Returns:
            Dict containing the processing results
        """
        pass

    def _start_execution(self) -> None:
        """Mark the start of agent execution."""
        self.state.status = AgentStatus.RUNNING
        self.state.started_at = datetime.now(timezone.utc)
        self.state.progress = 0.0
        self.logger.info(f"Agent {self.agent_id} ({self.agent_type}) started execution")

    def _complete_execution(self, results: Dict[str, Any]) -> None:
        """Mark successful completion of agent execution."""
        self.state.status = AgentStatus.COMPLETED
        self.state.completed_at = datetime.now(timezone.utc)
        self.state.progress = 100.0
        self.state.results = results
        self.logger.info(f"Agent {self.agent_id} completed successfully")

    def _fail_execution(self, error_message: str) -> None:
        """Mark failed execution with error details."""
        self.state.status = AgentStatus.FAILED
        self.state.completed_at = datetime.now(timezone.utc)
        self.state.error_message = error_message
        self.logger.error(f"Agent {self.agent_id} failed: {error_message}")

    def update_progress(
        self, progress: float, current_task: Optional[str] = None
    ) -> None:
        """
        Update the agent's progress.

        Args:
            progress: Progress percentage (0-100)
            current_task: Optional description of current task
        """
        self.state.progress = max(0.0, min(100.0, progress))
        if current_task:
            self.state.current_task = current_task

        self.logger.debug(
            f"Progress updated to {progress}%: {current_task or 'No task description'}"
        )

    def send_message(
        self, recipient_id: str, message_type: str, payload: Dict[str, Any]
    ) -> None:
        """
        Send a message to another agent.

        Args:
            recipient_id: Target agent ID
            message_type: Type of message
            payload: Message data
        """
        message = AgentMessage(
            sender_id=self.agent_id,
            recipient_id=recipient_id,
            message_type=message_type,
            payload=payload
        )

        # In a real implementation, this would use a message broker
        # For now, we'll store it in the agent's queue
        self.message_queue.append(message)
        self.logger.debug(f"Sent message to {recipient_id}: {message_type}")

    def receive_messages(self) -> List[AgentMessage]:
        """
        Retrieve all pending messages for this agent.

        Returns:
            List of pending messages
        """
        messages = self.message_queue.copy()
        self.message_queue.clear()
        return messages

    def get_state(self) -> Dict[str, Any]:
        """
        Get the current state of the agent.

        Returns:
            Dict representation of agent state
        """
        return {
            "agent_id": self.state.agent_id,
            "agent_type": self.state.agent_type,
            "status": self.state.status.value,
            "current_task": self.state.current_task,
            "progress": self.state.progress,
            "created_at": self.state.created_at.isoformat(),
            "started_at": (
                self.state.started_at.isoformat() if self.state.started_at else None
            ),
            "completed_at": (
                self.state.completed_at.isoformat() if self.state.completed_at else None
            ),
            "error_message": self.state.error_message,
            "metadata": self.state.metadata,
            "has_results": bool(self.state.results)
        }

    def get_execution_duration(self) -> Optional[float]:
        """
        Calculate execution duration in seconds.

        Returns:
            Duration in seconds, or None if not completed
        """
        if not self.state.started_at:
            return None

        end_time = self.state.completed_at or datetime.now(timezone.utc)
        duration = end_time - self.state.started_at
        return duration.total_seconds()

    def cancel(self) -> bool:
        """
        Cancel the agent execution if possible.

        Returns:
            True if cancellation was successful
        """
        if self.state.status in [AgentStatus.IDLE, AgentStatus.RUNNING]:
            self.state.status = AgentStatus.CANCELLED
            self.state.completed_at = datetime.now(timezone.utc)
            self.logger.info(f"Agent {self.agent_id} cancelled")
            return True
        return False