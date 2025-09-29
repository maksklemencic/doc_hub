"""
LangGraph-based workflow orchestrator for managing agent interactions.

This module provides workflow orchestration capabilities using LangGraph,
enabling complex multi-agent workflows for document processing.
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

from langgraph.graph import Graph, StateGraph
from langgraph.graph.graph import CompiledGraph

from .base_agent import BaseAgent

logger = logging.getLogger(__name__)


class WorkflowStatus(str, Enum):
    """Workflow execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class WorkflowState:
    """State that flows through the workflow graph."""
    workflow_id: str
    input_data: Dict[str, Any] = field(default_factory=dict)
    intermediate_results: Dict[str, Any] = field(default_factory=dict)
    final_results: Dict[str, Any] = field(default_factory=dict)
    current_step: Optional[str] = None
    progress: float = 0.0
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WorkflowExecution:
    """Represents a workflow execution instance."""
    workflow_id: str
    workflow_type: str
    status: WorkflowStatus = WorkflowStatus.PENDING
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    state: Optional[WorkflowState] = None
    agents_used: List[str] = field(default_factory=list)


class WorkflowOrchestrator:
    """
    LangGraph-based workflow orchestrator for managing multi-agent processes.

    Provides:
    - Workflow definition and execution
    - Agent coordination
    - State management
    - Error handling and recovery
    - Progress tracking
    """

    def __init__(self):
        self.workflows: Dict[str, CompiledGraph] = {}
        self.executions: Dict[str, WorkflowExecution] = {}
        self.agents: Dict[str, BaseAgent] = {}
        self.logger = logging.getLogger(f"{__name__}")

    def register_agent(self, agent: BaseAgent) -> None:
        """
        Register an agent with the orchestrator.

        Args:
            agent: Agent instance to register
        """
        self.agents[agent.agent_type] = agent
        self.logger.info(f"Registered agent: {agent.agent_type} ({agent.agent_id})")

    def create_document_processing_workflow(self) -> CompiledGraph:
        """
        Create the document processing workflow graph.

        Workflow: Document Processing -> Indexing -> Optional Query
        """
        # Define the workflow state graph
        workflow = StateGraph(WorkflowState)

        # Add nodes for each agent
        workflow.add_node("document_processing", self._document_processing_node)
        workflow.add_node("indexing", self._indexing_node)
        workflow.add_node("finalize", self._finalize_node)

        # Define edges (workflow flow)
        workflow.set_entry_point("document_processing")
        workflow.add_edge("document_processing", "indexing")
        workflow.add_edge("indexing", "finalize")

        # Compile the graph
        compiled_workflow = workflow.compile()
        self.workflows["document_processing"] = compiled_workflow

        self.logger.info("Created document processing workflow")
        return compiled_workflow

    def create_rag_query_workflow(self) -> CompiledGraph:
        """
        Create the RAG query workflow graph.

        Workflow: Query Processing -> Retrieval -> Response Generation
        """
        workflow = StateGraph(WorkflowState)

        # Add nodes
        workflow.add_node("rag_query", self._rag_query_node)
        workflow.add_node("finalize", self._finalize_node)

        # Define flow
        workflow.set_entry_point("rag_query")
        workflow.add_edge("rag_query", "finalize")

        compiled_workflow = workflow.compile()
        self.workflows["rag_query"] = compiled_workflow

        self.logger.info("Created RAG query workflow")
        return compiled_workflow

    async def execute_workflow(
        self,
        workflow_type: str,
        input_data: Dict[str, Any],
        workflow_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute a workflow with the given input data.

        Args:
            workflow_type: Type of workflow to execute
            input_data: Input data for the workflow
            workflow_id: Optional workflow ID (generated if not provided)

        Returns:
            Final results from workflow execution
        """
        if workflow_type not in self.workflows:
            raise ValueError(f"Unknown workflow type: {workflow_type}")

        # Create execution tracking
        if not workflow_id:
            workflow_id = f"{workflow_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        execution = WorkflowExecution(
            workflow_id=workflow_id,
            workflow_type=workflow_type,
            status=WorkflowStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
            state=WorkflowState(
                workflow_id=workflow_id,
                input_data=input_data
            )
        )

        self.executions[workflow_id] = execution
        self.logger.info(f"Starting workflow execution: {workflow_id}")

        try:
            # Execute the workflow
            workflow_graph = self.workflows[workflow_type]
            final_state = await workflow_graph.ainvoke(execution.state)

            # Update execution status
            execution.status = WorkflowStatus.COMPLETED
            execution.completed_at = datetime.now(timezone.utc)
            execution.state = final_state

            self.logger.info(f"Workflow execution completed: {workflow_id}")
            return final_state.final_results

        except Exception as e:
            # Handle workflow failure
            execution.status = WorkflowStatus.FAILED
            execution.completed_at = datetime.now(timezone.utc)
            if execution.state:
                execution.state.error_message = str(e)

            self.logger.error(f"Workflow execution failed: {workflow_id} - {str(e)}")
            raise

    async def _document_processing_node(self, state: WorkflowState) -> WorkflowState:
        """
        Execute document processing agent.

        Args:
            state: Current workflow state

        Returns:
            Updated workflow state
        """
        state.current_step = "document_processing"
        state.progress = 10.0

        agent = self.agents.get("document_processing")
        if not agent:
            raise ValueError("Document processing agent not registered")

        self.logger.info(
            f"Executing document processing for workflow: {state.workflow_id}"
        )

        try:
            # Execute the document processing agent
            agent_input = {
                "file_bytes": state.input_data.get("file_bytes"),
                "mime_type": state.input_data.get("mime_type"),
                "filename": state.input_data.get("filename", "unknown")
            }

            results = await agent.execute(agent_input)

            # Store results for next step
            state.intermediate_results["processed_text"] = results.get("processed_text")
            state.intermediate_results["language"] = results.get("language")
            state.intermediate_results["markdown_structure"] = results.get(
                "markdown_structure"
            )
            state.intermediate_results["quality_score"] = results.get("quality_score")

            state.progress = 40.0

        except Exception as e:
            self.logger.error(f"Document processing failed: {str(e)}")
            state.error_message = f"Document processing failed: {str(e)}"
            raise

        return state

    async def _indexing_node(self, state: WorkflowState) -> WorkflowState:
        """
        Execute indexing agent.

        Args:
            state: Current workflow state

        Returns:
            Updated workflow state
        """
        state.current_step = "indexing"
        state.progress = 50.0

        agent = self.agents.get("indexing")
        if not agent:
            raise ValueError("Indexing agent not registered")

        self.logger.info(
            f"Executing indexing for workflow: {state.workflow_id}"
        )

        try:
            # Prepare input for indexing agent
            agent_input = {
                "processed_text": state.intermediate_results.get("processed_text"),
                "language": state.intermediate_results.get("language"),
                "markdown_structure": state.intermediate_results.get(
                    "markdown_structure"
                ),
                "document_metadata": state.input_data.get("metadata", {})
            }

            results = await agent.execute(agent_input)

            # Store indexing results
            state.intermediate_results["chunks"] = results.get("chunks")
            state.intermediate_results["embeddings"] = results.get("embeddings")
            state.intermediate_results["chunk_metadata"] = results.get(
                "chunk_metadata"
            )
            state.intermediate_results["stored_successfully"] = results.get(
                "stored_successfully"
            )

            state.progress = 90.0

        except Exception as e:
            self.logger.error(f"Indexing failed: {str(e)}")
            state.error_message = f"Indexing failed: {str(e)}"
            raise

        return state

    async def _rag_query_node(self, state: WorkflowState) -> WorkflowState:
        """
        Execute RAG query agent.

        Args:
            state: Current workflow state

        Returns:
            Updated workflow state
        """
        state.current_step = "rag_query"
        state.progress = 20.0

        agent = self.agents.get("rag_query")
        if not agent:
            raise ValueError("RAG query agent not registered")

        self.logger.info(f"Executing RAG query for workflow: {state.workflow_id}")

        try:
            agent_input = {
                "query": state.input_data.get("query"),
                "user_id": state.input_data.get("user_id"),
                "space_id": state.input_data.get("space_id"),
                "top_k": state.input_data.get("top_k", 5),
                "only_space_documents": state.input_data.get(
                    "only_space_documents", True
                )
            }

            results = await agent.execute(agent_input)

            # Store RAG results
            state.intermediate_results["retrieved_chunks"] = results.get(
                "retrieved_chunks"
            )
            state.intermediate_results["context"] = results.get("context")
            state.intermediate_results["response"] = results.get("response")

            state.progress = 90.0

        except Exception as e:
            self.logger.error(f"RAG query failed: {str(e)}")
            state.error_message = f"RAG query failed: {str(e)}"
            raise

        return state

    async def _finalize_node(self, state: WorkflowState) -> WorkflowState:
        """
        Finalize workflow execution.

        Args:
            state: Current workflow state

        Returns:
            Final workflow state
        """
        state.current_step = "finalize"
        state.progress = 100.0

        # Move intermediate results to final results
        state.final_results = state.intermediate_results.copy()

        # Add workflow metadata
        state.final_results["workflow_id"] = state.workflow_id
        state.final_results["completed_at"] = datetime.now(timezone.utc).isoformat()

        self.logger.info(f"Workflow finalized: {state.workflow_id}")
        return state

    def get_workflow_status(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the current status of a workflow execution.

        Args:
            workflow_id: Workflow execution ID

        Returns:
            Workflow status information or None if not found
        """
        execution = self.executions.get(workflow_id)
        if not execution:
            return None

        return {
            "workflow_id": execution.workflow_id,
            "workflow_type": execution.workflow_type,
            "status": execution.status.value,
            "created_at": execution.created_at.isoformat(),
            "started_at": (
                execution.started_at.isoformat() if execution.started_at else None
            ),
            "completed_at": (
                execution.completed_at.isoformat() if execution.completed_at else None
            ),
            "current_step": execution.state.current_step if execution.state else None,
            "progress": execution.state.progress if execution.state else 0.0,
            "error_message": execution.state.error_message if execution.state else None,
            "agents_used": execution.agents_used
        }

    def cancel_workflow(self, workflow_id: str) -> bool:
        """
        Cancel a running workflow.

        Args:
            workflow_id: Workflow execution ID

        Returns:
            True if cancellation was successful
        """
        execution = self.executions.get(workflow_id)
        if not execution or execution.status != WorkflowStatus.RUNNING:
            return False

        execution.status = WorkflowStatus.CANCELLED
        execution.completed_at = datetime.now(timezone.utc)

        self.logger.info(f"Workflow cancelled: {workflow_id}")
        return True

    def cleanup_old_executions(self, max_age_hours: int = 24) -> None:
        """
        Clean up old workflow executions.

        Args:
            max_age_hours: Maximum age in hours before cleanup
        """
        cutoff_time = datetime.now(timezone.utc).timestamp() - (max_age_hours * 3600)

        executions_to_remove = [
            workflow_id for workflow_id, execution in self.executions.items()
            if (execution.completed_at and
                execution.completed_at.timestamp() < cutoff_time)
        ]

        for workflow_id in executions_to_remove:
            del self.executions[workflow_id]

        if executions_to_remove:
            self.logger.info(
                f"Cleaned up {len(executions_to_remove)} old workflow executions"
            )