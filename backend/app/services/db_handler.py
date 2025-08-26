import logging
import os
import uuid
from typing import List, Optional

from sqlalchemy import create_engine, exc, or_
from sqlalchemy.orm import sessionmaker

from ..errors.database_errors import ConflictError, DatabaseError, NotFoundError, PermissionError
from ...db_init.db_init import Document, Message, Space, User

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in environment")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

logger = logging.getLogger(__name__)


# Documents CRUD operations
def get_user_document_by_id(doc_id: uuid.UUID, user_id: uuid.UUID) -> Document | None:
    """Get document if user uploaded it OR owns the space it's in."""
    logger.info(f"Fetching document {doc_id} for user {user_id}")
    with SessionLocal() as session:
        try:
            # Try to get document with two-tier authorization:
            # 1. User uploaded the document, OR
            # 2. User owns the space containing the document
            # First check if document exists at all
            doc_exists = session.query(Document).filter(Document.id == doc_id).first()
            if not doc_exists:
                logger.warning(f"Document {doc_id} does not exist.")
                raise NotFoundError("Document", str(doc_id))
            
            # Then check authorization
            doc = session.query(Document)\
                .join(Space, Document.space_id == Space.id)\
                .filter(
                    Document.id == doc_id,
                    or_(
                        Document.uploaded_by == user_id,  # User uploaded it
                        Space.user_id == user_id          # User owns the space
                    )
                ).first()
                
            if not doc:
                logger.warning(f"User {user_id} not authorized to access document {doc_id}.")
                raise PermissionError("Not authorized to access this document")
                
            return doc
        except exc.OperationalError as e:
            logger.error(f"Database unavailable while fetching document {doc_id} for user {user_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            logger.error(f"Unexpected database error while fetching document {doc_id} for user {user_id}: {str(e)}")
            raise DatabaseError(f"Error fetching document: {str(e)}")


def get_paginated_documents(user_id: uuid.UUID, space_id: uuid.UUID, limit: int, offset: int) -> tuple[List[Document], int]:
    logger.info(f"Fetching documents for user {user_id} in space {space_id} with limit {limit} and offset {offset}")
    with SessionLocal() as session:
        try:
            space = session.query(Space).filter(Space.id == space_id, Space.user_id == user_id).first()
            if not space:
                logger.warning(f"Space {space_id} not found or user {user_id} not authorized.")
                raise NotFoundError("Space", str(space_id))

            query = session.query(Document).filter(Document.space_id == space_id)
            total_count = query.count()
            documents = query.offset(offset).limit(limit).all()
            
            logger.info(f"Successfully fetched {len(documents)} documents for user {user_id} in space {space_id}")
            return documents, total_count
        except exc.OperationalError as e:
            logger.error(f"Database unavailable for user {user_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            logger.error(f"Unexpected database error for user {user_id}: {str(e)}")
            raise DatabaseError(f"Error fetching documents: {str(e)}")
        

def add_document(
    filename: str, 
    file_path: str, 
    mime_type: str, 
    uploaded_by: uuid.UUID, 
    space_id: uuid.UUID) -> uuid.UUID:
    
    logger.info(f"Adding document {filename} to space {space_id} for user {uploaded_by}")
    with SessionLocal() as session:
        try:
            doc = Document(
                filename=filename,
                file_path=file_path,
                mime_type=mime_type,
                uploaded_by=uploaded_by,
                space_id=space_id
            )
            session.add(doc)
            session.commit()
            session.refresh(doc)
            logger.info(f"Successfully added document {doc.id} to database")
            return doc.id
        except exc.IntegrityError as e:
            session.rollback()
            logger.error(f"Integrity error adding document {filename}: {str(e)}")
            if "documents_space_id_fkey" in str(e):
                raise NotFoundError("Space", str(space_id))
            elif "unique" in str(e).lower():
                raise ConflictError(f"Document with filename '{filename}' already exists in this space")
            else:
                raise DatabaseError(f"Database constraint violation: {str(e)}")
        except exc.OperationalError as e:
            session.rollback()
            logger.error(f"Database unavailable while adding document {filename}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Database error adding document {filename}: {str(e)}")
            raise DatabaseError(f"Error adding document: {str(e)}")
        

def update_document(doc_id: uuid.UUID, user_id: uuid.UUID, **kwargs) -> Document:
    """Update document with proper authorization and error handling."""
    logger.info(f"Updating document {doc_id} for user {user_id}")
    with SessionLocal() as session:
        try:
            # First check if document exists
            doc = session.get(Document, doc_id)
            if not doc:
                logger.warning(f"Document {doc_id} not found")
                raise NotFoundError("Document", str(doc_id))
            
            # Check authorization: user must be the uploader or own the space
            space = session.get(Space, doc.space_id)
            if doc.uploaded_by != user_id and (not space or space.user_id != user_id):
                logger.warning(f"User {user_id} not authorized to update document {doc_id}")
                raise PermissionError("Not authorized to update this document")
            
            # Update document
            for key, value in kwargs.items():
                if hasattr(doc, key):
                    setattr(doc, key, value)
            session.commit()
            session.refresh(doc)
            logger.info(f"Successfully updated document {doc_id}")
            return doc
        except exc.OperationalError as e:
            session.rollback()
            logger.error(f"Database unavailable while updating document {doc_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Database error updating document {doc_id}: {str(e)}")
            raise DatabaseError(f"Error updating document: {str(e)}")
        

def delete_document(doc_id: uuid.UUID, user_id: uuid.UUID = None) -> bool:
    """Delete document with proper authorization and error handling."""
    logger.info(f"Deleting document {doc_id}" + (f" for user {user_id}" if user_id else ""))
    with SessionLocal() as session:
        try:
            # First check if document exists
            doc = session.get(Document, doc_id)
            if not doc:
                logger.warning(f"Document {doc_id} not found")
                raise NotFoundError("Document", str(doc_id))
            
            # Check authorization if user_id provided
            if user_id:
                space = session.get(Space, doc.space_id)
                if doc.uploaded_by != user_id and (not space or space.user_id != user_id):
                    logger.warning(f"User {user_id} not authorized to delete document {doc_id}")
                    raise PermissionError("Not authorized to delete this document")
            
            session.delete(doc)
            session.commit()
            logger.info(f"Successfully deleted document {doc_id}")
            return True
        except exc.OperationalError as e:
            session.rollback()
            logger.error(f"Database unavailable while deleting document {doc_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Database error deleting document {doc_id}: {str(e)}")
            raise DatabaseError(f"Error deleting document: {str(e)}")

# Spaces CRUD operations
def validate_space_ownership(space_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Validate that a space exists and belongs to the user."""
    logger.debug(f"Validating space {space_id} ownership for user {user_id}")
    with SessionLocal() as session:
        try:
            space = session.query(Space).filter(Space.id == space_id).first()
            if not space:
                logger.warning(f"Space {space_id} not found")
                raise NotFoundError("Space", str(space_id))
            
            if space.user_id != user_id:
                logger.warning(f"Permission denied for user {user_id} on space {space_id}")
                raise PermissionError("Not authorized to access this space")
                
            logger.debug(f"Space {space_id} ownership validated for user {user_id}")
        except exc.OperationalError as e:
            logger.error(f"Database unavailable while validating space {space_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            logger.error(f"Database error validating space {space_id}: {str(e)}")
            raise DatabaseError(f"Error validating space: {str(e)}")

def create_space(user_id: uuid.UUID, name: str) -> Space:
    logger.info(f"Creating space '{name}' for user {user_id}")
    with SessionLocal() as session:
        try:
            space = Space(name=name, user_id=user_id)            
            session.add(space)
            session.commit()
            session.refresh(space)
            logger.info(f"Successfully created space with name '{name}' for user {user_id}")
            return space
        except exc.IntegrityError as e:
            session.rollback()
            logger.error(f"Conflict error while creating space '{name}' for user {user_id}: {str(e)}")
            raise ConflictError("Space with this name already exists")
        except exc.OperationalError as e:
            session.rollback()
            logger.error(f"Database unavailable for user {user_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Unexpected database error for user {user_id}: {str(e)}")
            raise DatabaseError(f"Error creating space: {str(e)}")

def get_paginated_spaces(user_id: uuid.UUID, limit: int, offset: int) -> List[Space]:
    logger.info(f"Fetching spaces for user {user_id} with limit {limit} and offset {offset}")
    with SessionLocal() as session:
        try:
            query = session.query(Space).filter(Space.user_id == user_id)
            total_count = query.count()
            
            if total_count == 0:
                logger.info(f"No spaces found for user {user_id}")
                return [], 0

            spaces = query.offset(offset).limit(limit).all()
            logger.info(f"Successfully fetched {len(spaces)} spaces for user {user_id}")
            return spaces, total_count
        except exc.OperationalError as e:
            logger.error(f"Database unavailable for user {user_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            logger.error(f"Unexpected database error for user {user_id}: {str(e)}")
            raise DatabaseError(f"Error fetching spaces: {str(e)}")
    

def update_space(user_id: uuid.UUID, space_id: uuid.UUID, new_name: str) -> Optional[Space]:
    logger.info(f"Updating space {space_id} for user {user_id} to new name '{new_name}'")
    with SessionLocal() as session:  
        try:
            # First check if space exists at all
            space = session.query(Space).filter(Space.id == space_id).first()
            if not space:
                logger.warning(f"Space {space_id} not found")
                raise NotFoundError("Space", str(space_id))
            
            # Then check if user has permission to update it
            if space.user_id != user_id:
                logger.warning(f"Permission denied for user {user_id} on space {space_id}")
                raise PermissionError("Not authorized to update this space")
            
            if space:
                space.name = new_name
                session.commit()
                session.refresh(space)
                logger.info(f"Successfully updated space {space_id} for user {user_id}")
            return space
        
        except exc.OperationalError as e:
            session.rollback()
            logger.error(f"Database unavailable for user {user_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Unexpected database error for user {user_id}: {str(e)}")
            raise DatabaseError(f"Error updating space: {str(e)}")


def get_space_by_id(space_id: uuid.UUID) -> Optional[Space]:
    """Get a space by its ID without user authorization check."""
    logger.info(f"Fetching space {space_id}")
    with SessionLocal() as session:
        try:
            space = session.query(Space).filter(Space.id == space_id).first()
            if space:
                logger.info(f"Successfully fetched space {space_id}")
            else:
                logger.warning(f"Space {space_id} not found")
            return space
        except exc.OperationalError as e:
            logger.error(f"Database unavailable while fetching space {space_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            logger.error(f"Unexpected database error while fetching space {space_id}: {str(e)}")
            raise DatabaseError(f"Error fetching space: {str(e)}")


def delete_space(user_id: uuid.UUID, space_id: uuid.UUID):
    logger.info(f"Deleting space {space_id} for user {user_id}")
    with SessionLocal() as session:
        try:
            # First check if space exists at all
            space = session.query(Space).filter(Space.id == space_id).first()
            if not space:
                logger.warning(f"Space {space_id} not found")
                raise NotFoundError("Space", str(space_id))
            
            # Then check if user has permission to delete it
            if space.user_id != user_id:
                logger.warning(f"Permission denied for user {user_id} on space {space_id}")
                raise PermissionError("Not authorized to delete this space")
            
            session.delete(space)
            session.commit()
            logger.info(f"Successfully deleted space {space_id} for user {user_id}")
            
        except exc.OperationalError as e:
            session.rollback()
            logger.error(f"Database unavailable for user {user_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Unexpected database error for user {user_id}: {str(e)}")
            raise DatabaseError(f"Error updating space: {str(e)}")

# Messages CRUD Operaions
def create_message(content: str, response: str, space_id: uuid.UUID, user_id: uuid.UUID) -> Message:
    logger.info(f"Creating message in space {space_id} for user {user_id}")
    with SessionLocal() as session:
        try:
            # Check if space exists
            space_exists = session.query(Space).filter(Space.id == space_id).first()
            if not space_exists:
                logger.warning(f"Space {space_id} does not exist.")
                raise NotFoundError("Space", str(space_id))
            
            # Check if user owns the space
            if space_exists.user_id != user_id:
                logger.warning(f"User {user_id} not authorized to create message in space {space_id}.")
                raise PermissionError("Not authorized to create messages in this space")

            message = Message(content=content, response=response, space_id=space_id, user_id=user_id)
            session.add(message)
            session.commit()
            session.refresh(message)
            logger.info(f"Successfully created message in space {space_id} for user {user_id}")
            return message
        except exc.OperationalError as e:
            session.rollback()
            logger.error(f"Database unavailable for user {user_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Unexpected database error for user {user_id}: {str(e)}")
            raise DatabaseError(f"Error creating message: {str(e)}")

def get_paginated_messages(user_id: uuid.UUID, space_id: uuid.UUID, limit: int, offset: int) -> List[Message]:
    logger.info(f"Fetching messages for user {user_id} in space {space_id} with limit {limit} and offset {offset}")
    with SessionLocal() as session:
        try:
            space = session.query(Space) \
                .filter(Space.id == space_id, Space.user_id == user_id) \
                .order_by(Space.created_at.desc()) \
                .first()
            if not space:
                logger.warning(f"Space {space_id} not found or user {user_id} not authorized.")
                raise NotFoundError("Space", str(space_id))

            query = session.query(Message).filter(Message.space_id == space_id, Message.user_id == user_id)
            total_count = query.count()
            messages = query.offset(offset).limit(limit).all()
            logger.info(f"Successfully fetched {len(messages)} messages for user {user_id} in space {space_id}")
            return messages, total_count
        except exc.OperationalError as e:
            logger.error(f"Database unavailable for user {user_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            logger.error(f"Unexpected database error for user {user_id}: {str(e)}")
            raise DatabaseError(f"Error fetching messages: {str(e)}")


def update_message(message_id: uuid.UUID, space_id: uuid.UUID, user_id: uuid.UUID, content: str, response: str = None) -> Message:
    """Update message content. Users can update any message in spaces they own."""
    logger.info(f"Updating message {message_id} in space {space_id} for user {user_id}")
    with SessionLocal() as session:
        try:
            # Verify space ownership
            space = session.query(Space).filter(Space.id == space_id, Space.user_id == user_id).first()
            if not space:
                logger.warning(f"Space {space_id} not found or user {user_id} not authorized.")
                raise NotFoundError("Space", str(space_id))
            
            # Get message in the owned space (regardless of message author)
            message = session.query(Message).filter(
                Message.id == message_id,
                Message.space_id == space_id
            ).first()
            if not message:
                logger.warning(f"Message {message_id} not found in space {space_id}")
                raise NotFoundError("Message", str(message_id))

            # Update message content
            message.content = content
            if response is not None:
                message.response = response
            session.commit()
            session.refresh(message)
            logger.info(f"Successfully updated message {message_id} for user {user_id}")
            return message
        except exc.OperationalError as e:
            session.rollback()
            logger.error(f"Database unavailable for user {user_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Unexpected database error for user {user_id}: {str(e)}")
            raise DatabaseError(f"Error updating message: {str(e)}")


def delete_message(message_id: uuid.UUID, space_id: uuid.UUID, user_id: uuid.UUID):
    """Delete message. Users can delete any message in spaces they own."""
    logger.info(f"Deleting message {message_id} in space {space_id} for user {user_id}")
    with SessionLocal() as session:
        try:
            # Verify space ownership
            space = session.query(Space).filter(Space.id == space_id, Space.user_id == user_id).first()
            if not space:
                logger.warning(f"Space {space_id} not found or user {user_id} not authorized.")
                raise NotFoundError("Space", str(space_id))
            
            # Get message in the owned space (regardless of message author)
            message = session.query(Message).filter(
                Message.id == message_id,
                Message.space_id == space_id
            ).first()
            if not message:
                logger.warning(f"Message {message_id} not found in space {space_id}")
                raise NotFoundError("Message", str(message_id))

            session.delete(message)
            session.commit()
            logger.info(f"Successfully deleted message {message_id} for user {user_id}")
        except exc.OperationalError as e:
            session.rollback()
            logger.error(f"Database unavailable for user {user_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Unexpected database error for user {user_id}: {str(e)}")
            raise DatabaseError(f"Error deleting message: {str(e)}")
        
        

# Users CRUD Operaions
def create_user(email: str, first_name: str, last_name: str) -> User:
    logger.info(f"Creating user with email '{email}'")
    with SessionLocal() as session:
        try:
            user = User(email=email, first_name=first_name, last_name=last_name)
            session.add(user)
            session.commit()
            session.refresh(user)
            logger.info(f"Successfully created user with email '{email}'")
            return user
        except exc.IntegrityError as e:
            session.rollback()
            logger.error(f"Conflict error while creating user with email '{email}': {str(e)}")
            raise ConflictError("User with this email already exists")
        except exc.OperationalError as e:
            session.rollback()
            logger.error(f"Database unavailable while creating user with email '{email}': {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Unexpected database error while creating user with email '{email}': {str(e)}")
            raise DatabaseError(f"Error creating user: {str(e)}")
        
        
def get_user_by_id(user_id: uuid.UUID, current_user_id: uuid.UUID) -> Optional[User]:
    logger.info(f"Fetching user {user_id} for current user {current_user_id}")
    with SessionLocal() as session:
        try:
            if user_id != current_user_id:
                logger.warning(f"Permission denied for user {current_user_id} to view user {user_id}")
                raise PermissionError("Not authorized to view this user")
            
            user = session.query(User).filter(User.id == user_id).first()
            if not user:
                logger.warning(f"User {user_id} not found")
                raise NotFoundError("User", str(user_id))
            logger.info(f"Successfully fetched user {user_id}")
            return user
        except exc.OperationalError as e:
            logger.error(f"Database unavailable while fetching user {user_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            logger.error(f"Unexpected database error while fetching user {user_id}: {str(e)}")
            raise DatabaseError(f"Error fetching user: {str(e)}")
        


def update_user(user_id: uuid.UUID, current_user_id: uuid.UUID, email: Optional[str] = None, first_name: Optional[str] = None, last_name: Optional[str] = None) -> User:
    """Update user information. Users can only update their own profile."""
    logger.info(f"Updating user {user_id} by current user {current_user_id}")
    with SessionLocal() as session:
        try:
            if user_id != current_user_id:
                logger.warning(f"Permission denied for user {current_user_id} to update user {user_id}")
                raise PermissionError("Not authorized to update this user")
            
            user = session.get(User, user_id)
            if not user:
                logger.warning(f"User {user_id} not found")
                raise NotFoundError("User", str(user_id))
            
            # Update only provided fields
            if email is not None:
                user.email = email
            if first_name is not None:
                user.first_name = first_name
            if last_name is not None:
                user.last_name = last_name
            
            session.commit()
            session.refresh(user)
            logger.info(f"Successfully updated user {user_id}")
            return user
        except exc.IntegrityError as e:
            session.rollback()
            logger.error(f"Conflict error while updating user {user_id}: {str(e)}")
            raise ConflictError("User with this email already exists")
        except exc.OperationalError as e:
            session.rollback()
            logger.error(f"Database unavailable while updating user {user_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Unexpected database error while updating user {user_id}: {str(e)}")
            raise DatabaseError(f"Error updating user: {str(e)}")


def delete_user(user_id: uuid.UUID, current_user_id: uuid.UUID) -> Optional[User]:
    logger.info(f"Deleting user {user_id} by current user {current_user_id}")
    with SessionLocal() as session:
        try:
            if user_id != current_user_id:
                logger.warning(f"Permission denied for user {current_user_id} to delete user {user_id}")
                raise PermissionError("Not authorized to delete this user")
            
            user = session.get(User, user_id)
            if not user:
                logger.warning(f"User {user_id} not found")
                raise NotFoundError("User", str(user_id))
            
            session.delete(user)
            session.commit()
            logger.info(f"Successfully deleted user {user_id}")
            return user
        except exc.SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Unexpected database error while deleting user {user_id}: {str(e)}")
            raise DatabaseError(f"Error deleting user: {str(e)}")
        except exc.OperationalError as e:
            session.rollback()
            logger.error(f"Database unavailable while deleting user {user_id}: {str(e)}")
            raise DatabaseError("Database unavailable")


# OAuth-related user methods
def get_user_by_email(email: str) -> Optional[User]:
    """Get user by email address (used for OAuth login)."""
    logger.info(f"Fetching user by email: {email}")
    with SessionLocal() as session:
        try:
            user = session.query(User).filter(User.email == email).first()
            if user:
                logger.info(f"Successfully fetched user by email: {email}")
            else:
                logger.info(f"No user found with email: {email}")
            return user
        except exc.OperationalError as e:
            logger.error(f"Database unavailable while fetching user by email {email}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            logger.error(f"Unexpected database error while fetching user by email {email}: {str(e)}")
            raise DatabaseError(f"Error fetching user: {str(e)}")


def create_user_from_oauth(email: str, name: str, picture: str = None, google_id: str = None) -> User:
    """Create a new user from OAuth information."""
    logger.info(f"Creating user from OAuth with email: {email}")
    with SessionLocal() as session:
        try:
            # Split name into first_name and last_name for backward compatibility
            name_parts = name.split(' ', 1) if name else ['', '']
            first_name = name_parts[0] if len(name_parts) > 0 else ''
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            user = User(
                email=email,
                name=name,
                first_name=first_name,
                last_name=last_name,
                picture=picture,
                google_id=google_id
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            logger.info(f"Successfully created user from OAuth with email: {email}")
            return user
        except exc.IntegrityError as e:
            session.rollback()
            logger.error(f"Conflict error while creating OAuth user with email '{email}': {str(e)}")
            raise ConflictError("User with this email or Google ID already exists")
        except exc.OperationalError as e:
            session.rollback()
            logger.error(f"Database unavailable while creating OAuth user with email '{email}': {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Unexpected database error while creating OAuth user with email '{email}': {str(e)}")
            raise DatabaseError(f"Error creating user: {str(e)}")


def update_user_profile(user_id: uuid.UUID, name: str = None, picture: str = None) -> User:
    """Update user profile information (used for OAuth updates)."""
    logger.info(f"Updating user profile for user {user_id}")
    with SessionLocal() as session:
        try:
            user = session.get(User, user_id)
            if not user:
                logger.warning(f"User {user_id} not found")
                raise NotFoundError("User", str(user_id))
            
            # Update provided fields
            if name is not None:
                user.name = name
                # Also update first_name and last_name for backward compatibility
                name_parts = name.split(' ', 1) if name else ['', '']
                user.first_name = name_parts[0] if len(name_parts) > 0 else ''
                user.last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            if picture is not None:
                user.picture = picture
            
            session.commit()
            session.refresh(user)
            logger.info(f"Successfully updated user profile for user {user_id}")
            return user
        except exc.OperationalError as e:
            session.rollback()
            logger.error(f"Database unavailable while updating user profile {user_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Unexpected database error while updating user profile {user_id}: {str(e)}")
            raise DatabaseError(f"Error updating user profile: {str(e)}")


def get_user_by_id_simple(user_id: uuid.UUID) -> Optional[User]:
    """Get user by ID without authorization check (used for internal OAuth operations)."""
    logger.info(f"Fetching user by ID: {user_id}")
    with SessionLocal() as session:
        try:
            user = session.get(User, user_id)
            if user:
                logger.info(f"Successfully fetched user by ID: {user_id}")
            else:
                logger.info(f"No user found with ID: {user_id}")
            return user
        except exc.OperationalError as e:
            logger.error(f"Database unavailable while fetching user by ID {user_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            logger.error(f"Unexpected database error while fetching user by ID {user_id}: {str(e)}")
            raise DatabaseError(f"Error fetching user: {str(e)}")