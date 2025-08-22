import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies.auth import get_current_user
from ..errors.database_errors import DatabaseError, NotFoundError, PermissionError
from ..errors.embedding_errors import EmbeddingError, InvalidInputError
from ..errors.ollama_errors import LLMError
from ..errors.qdrant_errors import VectorStoreError
from ..models.messages import CreateMessageRequest, GetMessagesRequest, GetMessagesResponseWrapper, MessageResponse, UpdateMessageRequest, MessageResponseWrapper
from ..services import db_handler, embedding, ollama_client, qdrant_client

router = APIRouter()

logger = logging.getLogger(__name__)

tags_metadata = [
    {
        "name": "messages",
        "description": "Operations related to managing messages within a space."
    }
]


@router.post(
    "/{space_id}/messages",
    response_model=MessageResponseWrapper,
    tags=["messages"],
    summary="Create a new message",
    description="Creates a new message in the specified space.",
    response_description="The created message object.",
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {"description": "Message successfully created"},
        401: {"description": "Authentication required"},
        404: {"description": "Space not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
        503: {"description": "Database unavailable"}
    }
)
def create_message(
    space_id: uuid.UUID,
    request: CreateMessageRequest,
    current_user_id: uuid.UUID = Depends(get_current_user)
):
    try:
        if request.use_context is True:
            query_embedding = embedding.get_embeddings([request.content])[0]

            top_k_chunks = qdrant_client.query_top_k(
                query_embedding, 
                user_id=current_user_id, 
                k=request.top_k
            )
            
            context = "\n".join([res.payload["text"] for res in top_k_chunks])
        
        else:
            context = "/"
        
        response, context = ollama_client.generate_response(
            query=request.content, 
            context=context, 
            stream=request.stream
        )

        
        db_message = db_handler.create_message(request.content, space_id, current_user_id)
        
        return {
            "data": {
                "query": request.content,
                "response": response,
                "context": context
            },
            "message": {
                "id": db_message.id,
                "space_id": db_message.space_id,
                "user_id": db_message.user_id,
                "content": request.content,
                "created_at": db_message.created_at
            }
        }
    
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
        message = db_handler.update_message(message_id, space_id, current_user_id, request.content)
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