import logging
import os
import uuid
from typing import List, Optional

from sqlalchemy import create_engine, exc
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
def get_document_by_id(doc_id: uuid.UUID) -> Document | None:
    session = SessionLocal()
    try:
        doc = session.query(Document).filter(Document.id == doc_id).first()
        return doc
    finally:
        session.close()


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
    
    session = SessionLocal()
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
        return doc.id
    except exc.SQLAlchemyError as e:
        session.rollback()
        raise RuntimeError(f"Error adding document: {e}")
    finally:
        session.close()
        

def update_document(doc_id: uuid.UUID, **kwargs) -> Document:
    session = SessionLocal()
    try:
        doc = session.get(Document, doc_id)
        if not doc:
            raise ValueError(f"Document with id {doc_id} not found")
        for key, value in kwargs.items():
            if hasattr(doc, key):
                setattr(doc, key, value)
        session.commit()
        session.refresh(doc)
        return doc
    except exc.SQLAlchemyError as e:
        session.rollback()
        raise RuntimeError(f"Error updating document: {e}")
    finally:
        session.close()
        

def delete_document(doc_id: uuid.UUID) -> bool:
    session = SessionLocal()
    try:
        doc = session.get(Document, doc_id)
        if not doc:
            raise ValueError(f"Document with id {doc_id} not found")
        session.delete(doc)
        session.commit()
        return True
    except exc.SQLAlchemyError as e:
        session.rollback()
        raise RuntimeError(f"Error deleting document: {e}")
    finally:
        session.close()

# Spaces CRUD operations
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
            if not query.count():
                logger.warning(f"No spaces found for user {user_id}")
                raise NotFoundError("Space", "No spaces found")

            total_count = query.count()
            spaces = query.offset(offset).limit(limit).all()
            logger.info(f"Successfully fetched {len(spaces)} spaces for user {user_id}")
            return spaces, total_count
        except exc.OperationalError as e:
            logger.error(f"Database unavailable for user {user_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            logger.error(f"Unexpected database error for user {user_id}: {str(e)}")
            raise DatabaseError(f"Error fetching messages: {str(e)}")
    

def update_space(user_id: uuid.UUID, space_id: uuid.UUID, new_name: str) -> Optional[Space]:
    logger.info(f"Updating space {space_id} for user {user_id} to new name '{new_name}'")
    with SessionLocal() as session:  
        try:
            space = session.query(Space).filter(Space.user_id == user_id, Space.id == space_id).first()
            if not space:
                logger.warning(f"Space {space_id} not found for user {user_id}")
                raise NotFoundError("Space", str(space_id))
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
            space = session.query(Space).filter(Space.user_id == user_id, Space.id == space_id).first()
            if not space:
                logger.warning(f"Space {space_id} not found for user {user_id}")
                raise NotFoundError("Space", str(space_id))
            if space.user_id != user_id:
                logger.warning(f"Permission denied for user {user_id} on space {space_id}")
                raise PermissionError("Not authorized to update this space")
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
def create_message(content: str, space_id: uuid.UUID, user_id: uuid.UUID) -> Message:
    logger.info(f"Creating message in space {space_id} for user {user_id}")
    with SessionLocal() as session:
        try:
            space = session.query(Space).filter(Space.id == space_id, Space.user_id == user_id).first()
            if not space:
                logger.warning(f"Space {space_id} not found or user {user_id} not authorized.")
                raise NotFoundError("Space", str(space_id))

            message = Message(content=content, space_id=space_id, user_id=user_id)
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


def update_message(message_id: uuid.UUID, space_id: uuid.UUID, user_id: uuid.UUID, content: str) -> Message:
    """Update message content. Users can only update their own messages."""
    logger.info(f"Updating message {message_id} in space {space_id} for user {user_id}")
    with SessionLocal() as session:
        try:
            # Verify space ownership and message existence
            space = session.query(Space).filter(Space.id == space_id, Space.user_id == user_id).first()
            if not space:
                logger.warning(f"Space {space_id} not found or user {user_id} not authorized.")
                raise NotFoundError("Space", str(space_id))
            
            message = session.query(Message).filter(
                Message.id == message_id,
                Message.space_id == space_id,
                Message.user_id == user_id
            ).first()
            if not message:
                logger.warning(f"Message {message_id} not found for user {user_id} in space {space_id}")
                raise NotFoundError("Message", str(message_id))
            
            if message.user_id != user_id:
                logger.warning(f"Permission denied for user {user_id} on message {message_id} in space {space_id}")
                raise PermissionError("Not authorized to update this message")

            # Update message content
            message.content = content
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
    logger.info(f"Deleting message {message_id} in space {space_id} for user {user_id}")
    with SessionLocal() as session:
        try:
            message = session.query(Message).filter(
                Message.id == message_id,
                Message.space_id == space_id,
                Message.user_id == user_id
            ).first()
            if not message:
                logger.warning(f"Message {message_id} not found for user {user_id} in space {space_id}")
                raise NotFoundError("Message", str(message_id))
            if message.user_id != user_id:
                logger.warning(f"Permission denied for user {user_id} on message {message_id} in space {space_id}")
                raise PermissionError("Not authorized to delete this message")

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