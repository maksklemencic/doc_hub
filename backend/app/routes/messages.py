import json
import logging
import uuid
from typing import AsyncGenerator, Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from ..dependencies.auth import get_current_user
from ..errors.database_errors import DatabaseError, NotFoundError, PermissionError
from ..errors.embedding_errors import EmbeddingError, InvalidInputError
from ..errors.qdrant_errors import VectorStoreError
from ..errors.llm_errors import LLMError
from ..models.messages import (
    CreateMessageRequest,
    GetMessagesRequest,
    GetMessagesResponseWrapper,
    MessageResponse,
    UpdateMessageRequest,
    MessageResponseWrapper
)
from ..services import db_handler, embedding, qdrant_client
from ..agents import RAGQueryAgent

router = APIRouter()

logger = logging.getLogger(__name__)


async def stream_message_response(
    space_id: uuid.UUID,
    user_id: uuid.UUID,
    content: str,
    use_context: bool = True,
    document_ids: Optional[List[uuid.UUID]] = None,
    top_k: int = 5,
    only_space_documents: bool = True
) -> AsyncGenerator[str, None]:
    """
    Stream message response using Server-Sent Events format.
    """
    full_response = ""
    message_id = None
    rate_limit_info = None
    context = ""

    try:
        # Create message record in database
        db_message = db_handler.create_message(content, None, space_id, user_id)
        message_id = db_message.id

        # Send initial SSE event with message metadata
        event_data = {
            'type': 'message_start',
            'message_id': str(message_id),
            'content': content
        }
        yield f"data: {json.dumps(event_data)}\n\n"

        # Get streaming response using Groq
        chunk_count = 0

        # Use RAG Query Agent for streaming response
        rag_agent = RAGQueryAgent()

        # Prepare agent input with all RAG parameters
        agent_input = {
            "query": content,
            "user_id": str(user_id),
            "space_id": str(space_id) if space_id else None,
            "document_ids": [str(doc_id) for doc_id in document_ids] if document_ids else None,
            "top_k": top_k,
            "only_space_documents": only_space_documents,
            "stream_response": True
        }

        # Execute RAG query
        result = await rag_agent.execute(agent_input)
        response_stream = result.get("response_stream")
        context = result.get("context", "")  # Get the context from RAG agent

        # Check if response_stream exists and is not None
        if not response_stream:
            raise Exception("No response stream available")

        async for chunk, rate_limits in response_stream:
            # Capture rate limit info when available (final chunk)
            if rate_limits:
                rate_limit_info = rate_limits

            # Only send chunk if there's content
            if chunk:
                chunk_count += 1
                full_response += chunk

                # Send chunk as SSE event
                chunk_data = {
                    'type': 'chunk',
                    'content': chunk,
                    'chunk_number': chunk_count
                }
                yield f"data: {json.dumps(chunk_data)}\n\n"

        # Update database with final response
        db_handler.update_message(message_id, space_id, user_id, content, full_response)

        # Send final SSE event with rate limit info
        final_data = {
            'type': 'message_complete',
            'message_id': str(message_id),
            'final_response': full_response,
            'context': context,
            'total_chunks': chunk_count,
            'rate_limits': rate_limit_info
        }
        yield f"data: {json.dumps(final_data)}\n\n"

    except Exception as e:
        logger.error(f"Error in streaming response: {str(e)}")

        # Save partial response if we have any content and a valid message_id
        if message_id and full_response.strip():
            logger.info(f"Saving partial response due to interruption: {len(full_response)} characters")
            try:
                db_handler.update_message(message_id, space_id, user_id, content, full_response)
            except Exception as save_error:
                logger.error(f"Failed to save partial response: {str(save_error)}")

        # Send error event
        error_data = {
            'type': 'error',
            'error': str(e),
            'partial_response': full_response if full_response.strip() else None
        }
        yield f"data: {json.dumps(error_data)}\n\n"


tags_metadata = [
    {
        "name": "messages",
        "description": "Operations related to managing messages within a space."
    }
]


@router.post(
    "/{space_id}/messages",
    tags=["messages"],
    summary="Create a new message with streaming response",
    description="Creates a new message in the specified space and returns a streaming AI response using Server-Sent Events.",
    response_description="Streaming response with AI-generated content.",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Streaming response started", "content": {"text/event-stream": {"schema": {"type": "string"}}}},
        401: {"description": "Authentication required"},
        404: {"description": "Space not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
        503: {"description": "Database unavailable"}
    }
)
async def create_message(
    space_id: uuid.UUID,
    request: CreateMessageRequest,
    current_user_id: uuid.UUID = Depends(get_current_user)
):
    try:
        # FIRST: Validate space ownership before any processing
        logger.debug(f"Validating space {space_id} ownership for user {current_user_id}")
        db_handler.validate_space_ownership(space_id, current_user_id)

        logger.info(f"Creating message with document_ids filter: {request.document_ids}")

        # Always return streaming response (RAG agent will handle context retrieval)
        return StreamingResponse(
            stream_message_response(
                space_id=space_id,
                user_id=current_user_id,
                content=request.content,
                use_context=request.use_context,
                document_ids=request.document_ids,
                top_k=request.top_k,
                only_space_documents=request.only_space_documents
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            }
        )
    
    except PermissionError as e:
        logger.warning(f"Permission denied for user {current_user_id} to create message in space {space_id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except NotFoundError as e:
        logger.warning(f"Space {space_id} not found for user {current_user_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except DatabaseError as e:
        logger.error(f"Database error creating message in space {space_id} for user {current_user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except InvalidInputError as e:
        logger.warning(f"Invalid input creating message in space {space_id} for user {current_user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=e.message)
    except EmbeddingError as e:
        logger.error(f"Embedding error creating message in space {space_id} for user {current_user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Embedding error: {e.message}")
    except LLMError as e:
        logger.error(f"LLM error creating message in space {space_id} for user {current_user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"LLM error: {e.message}")
    except VectorStoreError as e:
        logger.error(f"Vector store error creating message in space {space_id} for user {current_user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Vector error: {e.message}")
    except Exception as e:
        logger.error(f"Unexpected error creating message in space {space_id} for user {current_user_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")



@router.get(
    "/{space_id}/messages",
    response_model=GetMessagesResponseWrapper,
    tags=["messages"],
    summary="Retrieve paginated messages",
    description="Fetches a paginated list of recent messages for the specified space.",
    response_description="A list of messages with pagination metadata.",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "List of messages successfully retrieved"},
        401: {"description": "Authentication required"},
        404: {"description": "Space not found"},
        500: {"description": "Internal server error"},
        503: {"description": "Database unavailable"}
    }
)
def get_messages(
    space_id: uuid.UUID,
    request: GetMessagesRequest = Depends(),
    current_user_id: uuid.UUID = Depends(get_current_user)
):
    try:
        # FIRST: Validate space ownership before any processing
        logger.debug(f"Validating space {space_id} ownership for user {current_user_id}")
        db_handler.validate_space_ownership(space_id, current_user_id)
        
        messages, total_count = db_handler.get_paginated_messages(current_user_id, space_id, request.limit, request.offset)
        return {
            "messages": messages,
            "pagination": {
                "limit": request.limit,
                "offset": request.offset,
                "total_count": total_count
            }
        }
    except NotFoundError as e:
        logger.warning(f"Space {space_id} not found for user {current_user_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except PermissionError as e:
        logger.warning(f"Permission denied for user {current_user_id} on space {space_id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except DatabaseError as e:
        logger.error(f"Database error fetching messages in space {space_id} for user {current_user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected error fetching messages in space {space_id} for user {current_user_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")


@router.patch(
    "/{space_id}/messages/{message_id}",
    response_model=MessageResponse,
    tags=["messages"],
    summary="Update a message",
    description="Update the content of an existing message in a space.",
    response_description="The updated message object.",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Message successfully updated"},
        401: {"description": "Authentication required"},
        403: {"description": "Permission denied"},
        404: {"description": "Message or space not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
        503: {"description": "Database unavailable"}
    }
)
def update_message(
    space_id: uuid.UUID,
    message_id: uuid.UUID,
    request: UpdateMessageRequest,
    current_user_id: uuid.UUID = Depends(get_current_user)
):
    try:
        # FIRST: Validate space ownership before any processing
        logger.debug(f"Validating space {space_id} ownership for user {current_user_id}")
        db_handler.validate_space_ownership(space_id, current_user_id)
        
        message = db_handler.update_message(message_id, space_id, current_user_id, request.content, request.response)
        return message
    except PermissionError as e:
        logger.warning(f"Permission denied for user {current_user_id} to update message {message_id} in space {space_id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except NotFoundError as e:
        logger.warning(f"Message {message_id} or space {space_id} not found for user {current_user_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except DatabaseError as e:
        logger.error(f"Database error updating message {message_id} in space {space_id} for user {current_user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected error updating message {message_id} in space {space_id} for user {current_user_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")


@router.delete(
    "/{space_id}/messages/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["messages"],
    summary="Delete a message",
    description="Deletes a message from a space.",
    response_description="No content returned on successful deletion.",
    responses={
        204: {"description": "Message successfully deleted"},
        401: {"description": "Authentication required"},
        403: {"description": "Permission denied"},
        404: {"description": "Message not found"},
        500: {"description": "Internal server error"},
        503: {"description": "Database unavailable"}
    }
)
def delete_message(
    space_id: uuid.UUID,
    message_id: uuid.UUID,
    current_user_id: uuid.UUID = Depends(get_current_user)
):
    try:
        # FIRST: Validate space ownership before any processing
        logger.debug(f"Validating space {space_id} ownership for user {current_user_id}")
        db_handler.validate_space_ownership(space_id, current_user_id)
        
        db_handler.delete_message(message_id, space_id, current_user_id)
    except PermissionError as e:
        logger.warning(f"Permission denied for user {current_user_id} to delete message {message_id} in space {space_id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except NotFoundError as e:
        logger.warning(f"Message {message_id} not found in space {space_id} for user {current_user_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except DatabaseError as e:
        logger.error(f"Database error deleting message {message_id} in space {space_id} for user {current_user_id}: {e.message}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected error deleting message {message_id} in space {space_id} for user {current_user_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")