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
    DATA_TRANSFER = "data_transfer"
    PROCESSING_REQUEST = "processing_request"
    PROCESSING_RESPONSE = "processing_response"

    STATUS_UPDATE = "status_update"
    PROGRESS_UPDATE = "progress_update"
    ERROR_NOTIFICATION = "error_notification"

    START_PROCESSING = "start_processing"
    STOP_PROCESSING = "stop_processing"
    RESET_AGENT = "reset_agent"

    WORKFLOW_START = "workflow_start"
    WORKFLOW_COMPLETE = "workflow_complete"
    WORKFLOW_FAILED = "workflow_failed"


class MessagePriority(int, Enum):
    LOW = 1
    NORMAL = 5
    HIGH = 8
    CRITICAL = 10


@dataclass
class AgentMessage:

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
        if not self.expires_at:
            return False
        return datetime.now(timezone.utc) > self.expires_at

    def can_retry(self) -> bool:
        return self.retry_count < self.max_retries


class MessageHandler(ABC):

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

    def __init__(self):
        self.message_queues: Dict[str, List[AgentMessage]] = {}
        self.message_handlers: Dict[str, List[MessageHandler]] = {}
        self.event_subscribers: Dict[MessageType, List[Callable]] = {}
        self.running = False
        self.processing_task: Optional[asyncio.Task] = None
        self.logger = logging.getLogger(f"{__name__}.CommunicationBus")

    def register_agent(self, agent_id: str) -> None:
        
        if agent_id not in self.message_queues:
            self.message_queues[agent_id] = []
            self.message_handlers[agent_id] = []
            self.logger.info(f"Registered agent: {agent_id}")

    def register_handler(self, agent_id: str, handler: MessageHandler) -> None:
        
        if agent_id not in self.message_handlers:
            self.message_handlers[agent_id] = []

        self.message_handlers[agent_id].append(handler)
        self.logger.debug(f"Registered handler for agent: {agent_id}")

    def subscribe_to_events(
        self, message_type: MessageType, callback: Callable
    ) -> None:
        
        if message_type not in self.event_subscribers:
            self.event_subscribers[message_type] = []

        self.event_subscribers[message_type].append(callback)
        self.logger.debug(f"Subscribed to events: {message_type.value}")

    async def send_message(self, message: AgentMessage) -> bool:
       
        if message.is_expired():
            self.logger.warning(f"Message {message.id} has expired, not sending")
            return False

        recipient_id = message.recipient_id
        if recipient_id not in self.message_queues:
            self.logger.error(f"Unknown recipient: {recipient_id}")
            return False

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

        await self._notify_subscribers(message)

        return True

    async def get_messages(
        self, agent_id: str, limit: Optional[int] = None
    ) -> List[AgentMessage]:
       
        if agent_id not in self.message_queues:
            return []

        queue = self.message_queues[agent_id]

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
       
        messages = await self.get_messages(agent_id)
        handlers = self.message_handlers.get(agent_id, [])

        for message in messages:
            try:
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

                if message.can_retry():
                    message.retry_count += 1
                    await self.send_message(message)
                else:
                    self.logger.error(f"Message {message.id} exceeded max retries")

    async def _notify_subscribers(self, message: AgentMessage) -> None:
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
        if not self.running:
            self.running = True
            self.processing_task = asyncio.create_task(self._background_processor())
            self.logger.info("Started background message processing")

    def stop_processing(self) -> None:
        self.running = False
        if self.processing_task:
            self.processing_task.cancel()
            self.processing_task = None
            self.logger.info("Stopped background message processing")

    async def _background_processor(self) -> None:
        while self.running:
            try:
                for agent_id in self.message_queues.keys():
                    await self.process_messages(agent_id)

                await asyncio.sleep(0.1)

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Error in background processor: {str(e)}")
                await asyncio.sleep(1.0)  # Wait longer on error

    def get_queue_status(self) -> Dict[str, Dict[str, Any]]:
       
        status = {}

        for agent_id, queue in self.message_queues.items():

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


communication_bus = CommunicationBus()