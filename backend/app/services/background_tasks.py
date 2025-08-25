import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, Optional, Any, Callable
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running" 
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class BackgroundTask:
    task_id: str
    task_type: str
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress: float = 0.0
    result: Optional[Any] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class BackgroundTaskManager:
    
    def __init__(self):
        self.tasks: Dict[str, BackgroundTask] = {}
        self.task_handlers: Dict[str, Callable] = {}
        self._cleanup_task: Optional[asyncio.Task] = None
        self._register_default_handlers()
    
    def _register_default_handlers(self):
        from . import embedding, ollama_client, document_processor, metadata_extractor
        
        self.task_handlers.update({
            "generate_embeddings": self._handle_generate_embeddings,
            "generate_llm_response": self._handle_generate_llm_response, 
            "process_document": self._handle_process_document,
            "extract_metadata": self._handle_extract_metadata,
        })
    
    def create_task(self, task_type: str, task_data: Dict[str, Any]) -> str:
        task_id = str(uuid.uuid4())
        task = BackgroundTask(
            task_id=task_id,
            task_type=task_type,
            metadata=task_data
        )
        self.tasks[task_id] = task
        
        # Start the task asynchronously
        asyncio.create_task(self._execute_task(task_id))
        
        logger.info(f"Created background task {task_id} of type {task_type}")
        return task_id
    
    def get_task_status(self, task_id: str) -> Optional[BackgroundTask]:
        return self.tasks.get(task_id)
    
    def cancel_task(self, task_id: str) -> bool:
        task = self.tasks.get(task_id)
        if task and task.status in [TaskStatus.PENDING, TaskStatus.RUNNING]:
            task.status = TaskStatus.CANCELLED
            task.completed_at = datetime.utcnow()
            logger.info(f"Cancelled task {task_id}")
            return True
        return False
    
    async def _execute_task(self, task_id: str):
        task = self.tasks.get(task_id)
        if not task:
            return
        
        try:
            task.status = TaskStatus.RUNNING
            task.started_at = datetime.utcnow()
            
            handler = self.task_handlers.get(task.task_type)
            if not handler:
                raise ValueError(f"No handler found for task type: {task.task_type}")
            
            logger.info(f"Starting execution of task {task_id}")
            result = await handler(task.metadata, task_id)
            
            task.result = result
            task.status = TaskStatus.COMPLETED
            task.progress = 100.0
            task.completed_at = datetime.utcnow()
            
            logger.info(f"Task {task_id} completed successfully")
            
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.completed_at = datetime.utcnow()
            logger.error(f"Task {task_id} failed: {str(e)}", exc_info=True)
    
    def update_task_progress(self, task_id: str, progress: float):
        task = self.tasks.get(task_id)
        if task:
            task.progress = min(100.0, max(0.0, progress))
    
    async def _handle_generate_embeddings(self, data: Dict[str, Any], task_id: str) -> Any:
        from . import embedding
        
        chunks = data.get("chunks", [])
        if not chunks:
            raise ValueError("No chunks provided for embedding generation")
        
        # Update progress as we process
        embeddings = []
        total_chunks = len(chunks)
        
        for i, chunk in enumerate(chunks):
            chunk_embeddings = embedding.get_embeddings([chunk])
            embeddings.extend(chunk_embeddings)
            
            # Update progress
            progress = ((i + 1) / total_chunks) * 100
            self.update_task_progress(task_id, progress)
            
            # Allow other tasks to run
            await asyncio.sleep(0.01)
        
        return embeddings
    
    async def _handle_generate_llm_response(self, data: Dict[str, Any], task_id: str) -> Any:
        from . import ollama_client
        
        query = data.get("query")
        context = data.get("context", "")
        stream = data.get("stream", False)
        
        if not query:
            raise ValueError("No query provided for LLM response generation")
        
        self.update_task_progress(task_id, 50.0)
        
        # Generate response (this is typically the longest operation)
        response, final_context = ollama_client.generate_response(
            query=query,
            context=context,
            stream=stream
        )
        
        return {
            "response": response,
            "context": final_context,
            "query": query
        }
    
    async def _handle_process_document(self, data: Dict[str, Any], task_id: str) -> Any:
        from . import document_processor
        
        content_base64 = data.get("content_base64")
        mime_type = data.get("mime_type")
        
        if not content_base64 or not mime_type:
            raise ValueError("Missing content or mime_type for document processing")
        
        self.update_task_progress(task_id, 25.0)
        
        # Process document
        pages = document_processor.base64_to_text(
            base64_text=content_base64,
            mime_type=mime_type
        )
        
        self.update_task_progress(task_id, 100.0)
        return pages
    
    async def _handle_extract_metadata(self, data: Dict[str, Any], task_id: str) -> Any:
        from . import metadata_extractor
        
        chunks = data.get("chunks", [])
        page_numbers = data.get("page_numbers", [])
        init_metadata = data.get("init_metadata", {})
        
        if not chunks or not page_numbers or not init_metadata:
            raise ValueError("Missing required data for metadata extraction")
        
        self.update_task_progress(task_id, 50.0)
        
        metadata = metadata_extractor.create_metadata(
            chunks=chunks,
            page_numbers=page_numbers,
            init_metadata=init_metadata
        )
        
        return metadata
    
    async def cleanup_old_tasks(self, max_age_hours: int = 24):
        cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)
        
        tasks_to_remove = [
            task_id for task_id, task in self.tasks.items()
            if task.completed_at and task.completed_at < cutoff_time
        ]
        
        for task_id in tasks_to_remove:
            del self.tasks[task_id]
        
        if tasks_to_remove:
            logger.info(f"Cleaned up {len(tasks_to_remove)} old tasks")
    
    def start_cleanup_task(self):
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())
    
    async def _periodic_cleanup(self):
        while True:
            try:
                await self.cleanup_old_tasks()
                await asyncio.sleep(3600)  # Clean up every hour
            except Exception as e:
                logger.error(f"Error during task cleanup: {str(e)}")
                await asyncio.sleep(600)  # Wait 10 minutes on error


task_manager = BackgroundTaskManager()