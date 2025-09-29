"""
Agent communication protocols and message handling.

This module provides standardized communication patterns between agents,
including message queuing, event handling, and data serialization.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Callable
from uuid import uuid4

logger = logging.getLogger(__name__)


class MessageType(str, Enum):
    """Standard message types for inter-agent communication."""
    # Data transfer messages
    DATA_TRANSFER = "data_transfer"
    PROCESSING_REQUEST = "processing_request"
    PROCESSING_RESPONSE = "processing_response"

    # Status messages
    STATUS_UPDATE = "status_update"
    PROGRESS_UPDATE = "progress_update"
    ERROR_NOTIFICATION = "error_notification"

    # Control messages
    START_PROCESSING = "start_processing"
    STOP_PROCESSING = "stop_processing"
    RESET_AGENT = "reset_agent"

    # Workflow messages
    WORKFLOW_START = "workflow_start"
    WORKFLOW_COMPLETE = "workflow_complete"
    WORKFLOW_FAILED = "workflow_failed"


class MessagePriority(int, Enum):
    """Message priority levels."""
    LOW = 1
    NORMAL = 5
    HIGH = 8
    CRITICAL = 10


@dataclass
class AgentMessage:
    """
    Standard message format for inter-agent communication.
    """
    id: str = field(default_factory=lambda: str(uuid4()))
    sender_id: str = ""
    recipient_id: str = ""
    message_type: MessageType = MessageType.DATA_TRANSFER
    priority: MessagePriority = MessagePriority.NORMAL
    payload: Dict[str, Any] = field(default_factory=dict)
    correlation_id: Optional[str] = None
    reply_to: Optional[str] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 3
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary for serialization."""
        return {
            "id": self.id,
            "sender_id": self.sender_id,
            "recipient_id": self.recipient_id,
            "message_type": self.message_type.value,
            "priority": self.priority.value,
            "payload": self.payload,
            "correlation_id": self.correlation_id,
            "reply_to": self.reply_to,
            "timestamp": self.timestamp.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgentMessage":
        """Create message from dictionary."""
        # Parse timestamp
        timestamp = datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))
        expires_at = None
        if data.get("expires_at"):
            expires_at = datetime.fromisoformat(
                data["expires_at"].replace("Z", "+00:00")
            )

        return cls(
            id=data["id"],
            sender_id=data["sender_id"],
            recipient_id=data["recipient_id"],
            message_type=MessageType(data["message_type"]),
            priority=MessagePriority(data["priority"]),
            payload=data["payload"],
            correlation_id=data.get("correlation_id"),
            reply_to=data.get("reply_to"),
            timestamp=timestamp,
            expires_at=expires_at,
            retry_count=data.get("retry_count", 0),
            max_retries=data.get("max_retries", 3),
            metadata=data.get("metadata", {})
        )

    def is_expired(self) -> bool:
        """Check if message has expired."""
        if not self.expires_at:
            return False
        return datetime.now(timezone.utc) > self.expires_at

    def can_retry(self) -> bool:
        """Check if message can be retried."""
        return self.retry_count < self.max_retries


class MessageHandler(ABC):
    """Abstract base class for message handlers."""

    @abstractmethod
    async def handle_message(self, message: AgentMessage) -> Optional[AgentMessage]:
        """
        Handle an incoming message.

        Args:
            message: The message to handle

        Returns:
            Optional response message
        """
        pass

    @abstractmethod
    def can_handle(self, message_type: MessageType) -> bool:
        """
        Check if this handler can process the given message type.

        Args:
            message_type: Type of message

        Returns:
            True if handler can process this message type
        """
        pass


class CommunicationBus:
    """
    Central communication bus for agent message routing.

    Provides:
    - Message routing between agents
    - Message queuing and delivery
    - Priority handling
    - Retry mechanisms
    - Event subscriptions
    """

    def __init__(self):
        self.message_queues: Dict[str, List[AgentMessage]] = {}
        self.message_handlers: Dict[str, List[MessageHandler]] = {}
        self.event_subscribers: Dict[MessageType, List[Callable]] = {}
        self.running = False
        self.processing_task: Optional[asyncio.Task] = None
        self.logger = logging.getLogger(f"{__name__}.CommunicationBus")

    def register_agent(self, agent_id: str) -> None:
        """
        Register an agent with the communication bus.

        Args:
            agent_id: Unique agent identifier
        """
        if agent_id not in self.message_queues:
            self.message_queues[agent_id] = []
            self.message_handlers[agent_id] = []
            self.logger.info(f"Registered agent: {agent_id}")

    def register_handler(self, agent_id: str, handler: MessageHandler) -> None:
        """
        Register a message handler for an agent.

        Args:
            agent_id: Agent identifier
            handler: Message handler instance
        """
        if agent_id not in self.message_handlers:
            self.message_handlers[agent_id] = []

        self.message_handlers[agent_id].append(handler)
        self.logger.debug(f"Registered handler for agent: {agent_id}")

    def subscribe_to_events(
        self, message_type: MessageType, callback: Callable
    ) -> None:
        """
        Subscribe to specific message type events.

        Args:
            message_type: Type of message to subscribe to
            callback: Callback function to execute
        """
        if message_type not in self.event_subscribers:
            self.event_subscribers[message_type] = []

        self.event_subscribers[message_type].append(callback)
        self.logger.debug(f"Subscribed to events: {message_type.value}")

    async def send_message(self, message: AgentMessage) -> bool:
        """
        Send a message to the specified recipient.

        Args:
            message: Message to send

        Returns:
            True if message was queued successfully
        """
        if message.is_expired():
            self.logger.warning(f"Message {message.id} has expired, not sending")
            return False

        recipient_id = message.recipient_id
        if recipient_id not in self.message_queues:
            self.logger.error(f"Unknown recipient: {recipient_id}")
            return False

        # Insert message based on priority (higher priority first)
        queue = self.message_queues[recipient_id]
        inserted = False

        for i, queued_msg in enumerate(queue):
            if message.priority.value > queued_msg.priority.value:
                queue.insert(i, message)
                inserted = True
                break

        if not inserted:
            queue.append(message)

        self.logger.debug(
            f"Queued message {message.id} for {recipient_id} "
            f"(type: {message.message_type.value}, "
            f"priority: {message.priority.value})"
        )

        # Notify event subscribers
        await self._notify_subscribers(message)

        return True

    async def get_messages(
        self, agent_id: str, limit: Optional[int] = None
    ) -> List[AgentMessage]:
        """
        Retrieve messages for an agent.

        Args:
            agent_id: Agent identifier
            limit: Maximum number of messages to retrieve

        Returns:
            List of messages for the agent
        """
        if agent_id not in self.message_queues:
            return []

        queue = self.message_queues[agent_id]

        # Remove expired messages
        valid_messages = [msg for msg in queue if not msg.is_expired()]
        self.message_queues[agent_id] = valid_messages

        if limit:
            messages = valid_messages[:limit]
            self.message_queues[agent_id] = valid_messages[limit:]
        else:
            messages = valid_messages.copy()
            self.message_queues[agent_id].clear()

        return messages

    async def process_messages(self, agent_id: str) -> None:
        """
        Process all pending messages for an agent.

        Args:
            agent_id: Agent identifier
        """
        messages = await self.get_messages(agent_id)
        handlers = self.message_handlers.get(agent_id, [])

        for message in messages:
            try:
                # Find appropriate handler
                handler = None
                for h in handlers:
                    if h.can_handle(message.message_type):
                        handler = h
                        break

                if handler:
                    response = await handler.handle_message(message)
                    if response:
                        await self.send_message(response)
                else:
                    self.logger.warning(
                        f"No handler found for message type: "
                        f"{message.message_type.value} for agent: {agent_id}"
                    )

            except Exception as e:
                self.logger.error(f"Error processing message {message.id}: {str(e)}")

                # Handle retry logic
                if message.can_retry():
                    message.retry_count += 1
                    await self.send_message(message)
                else:
                    self.logger.error(f"Message {message.id} exceeded max retries")

    async def _notify_subscribers(self, message: AgentMessage) -> None:
        """Notify event subscribers about a message."""
        subscribers = self.event_subscribers.get(message.message_type, [])

        for subscriber in subscribers:
            try:
                if asyncio.iscoroutinefunction(subscriber):
                    await subscriber(message)
                else:
                    subscriber(message)
            except Exception as e:
                self.logger.error(f"Error in event subscriber: {str(e)}")

    def start_processing(self) -> None:
        """Start background message processing."""
        if not self.running:
            self.running = True
            self.processing_task = asyncio.create_task(self._background_processor())
            self.logger.info("Started background message processing")

    def stop_processing(self) -> None:
        """Stop background message processing."""
        self.running = False
        if self.processing_task:
            self.processing_task.cancel()
            self.processing_task = None
            self.logger.info("Stopped background message processing")

    async def _background_processor(self) -> None:
        """Background task for processing messages."""
        while self.running:
            try:
                # Process messages for all registered agents
                for agent_id in self.message_queues.keys():
                    await self.process_messages(agent_id)

                # Wait before next processing cycle
                await asyncio.sleep(0.1)  # 100ms processing cycle

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Error in background processor: {str(e)}")
                await asyncio.sleep(1.0)  # Wait longer on error

    def get_queue_status(self) -> Dict[str, Dict[str, Any]]:
        """
        Get status of all message queues.

        Returns:
            Dictionary with queue status for each agent
        """
        status = {}

        for agent_id, queue in self.message_queues.items():
            # Count messages by priority
            priority_counts = {p.name: 0 for p in MessagePriority}
            for msg in queue:
                priority_counts[msg.priority.name] += 1

            status[agent_id] = {
                "total_messages": len(queue),
                "priority_breakdown": priority_counts,
                "oldest_message": queue[0].timestamp.isoformat() if queue else None,
                "handlers_registered": len(self.message_handlers.get(agent_id, []))
            }

        return status


# Global communication bus instance
communication_bus = CommunicationBus()