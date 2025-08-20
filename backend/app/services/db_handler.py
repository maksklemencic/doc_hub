import os
import uuid
import logging
from sqlalchemy import create_engine, exc
from sqlalchemy.orm import Session, sessionmaker
from typing import List, Optional

from ...db_init.db_init import Base, Document, Space, Message, User
from ..errors.errors import NotFoundError, PermissionError, DatabaseError, ConflictError

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
        except exc.OperationalError as e:
            session.rollback()
            logger.error(f"Database unavailable for user {user_id}: {str(e)}")
            raise DatabaseError("Database unavailable")
        except exc.SQLAlchemyError as e:
            session.rollback()
            logger.error(f"Unexpected database error for user {user_id}: {str(e)}")
            raise DatabaseError(f"Error creating space: {str(e)}")

def get_paginated_spaces(user_id: uuid.UUID, limit: int, offset: int) -> List[Space]:
    with SessionLocal() as session:
        query = session.query(Space).filter(Space.user_id == user_id)
        
        total_count = query.count()
        spaces = query.offset(offset).limit(limit).all()
        return spaces, total_count
    

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
def create_message(content: str, space_id: uuid.UUID, user_id: uuid.UUID) -> 'Message':
    session = SessionLocal()
    try:
        # Check if space exists and belongs to user
        space = session.query(Space).filter(Space.id == space_id, Space.user_id == user_id).first()
        if not space:
            return "space_not_found_or_unauthorized"
        message = Message(content=content, space_id=space_id, user_id=user_id)
        session.add(message)
        session.commit()
        session.refresh(message)
        return message
    except exc.SQLAlchemyError as e:
        session.rollback()
        raise RuntimeError(f"Error creating message: {e}")
    finally:
        session.close()

def get_messages(user_id: uuid.UUID, space_id: uuid.UUID, message_id: Optional[uuid.UUID] = None) -> List['Message']:
    session = SessionLocal()
    try:
        if message_id:
            message = session.query(Message).filter(
                Message.id == message_id,
                Message.space_id == space_id,
                Message.user_id == user_id
            ).first()
            return [message] if message else []
        messages = session.query(Message).filter(
            Message.space_id == space_id,
            Message.user_id == user_id
        ).all()
        return messages
    finally:
        session.close()

def update_message(message_id: uuid.UUID, space_id: uuid.UUID, user_id: uuid.UUID, content: str) -> Optional['Message']:
    session = SessionLocal()
    try:
        message = session.query(Message).filter(
            Message.id == message_id,
            Message.space_id == space_id,
            Message.user_id == user_id
        ).first()
        if not message:
            # Check if message exists but belongs to another user
            exists = session.query(Message).filter(Message.id == message_id, Message.space_id == space_id).first()
            if exists:
                return "unauthorized"
            return None
        message.content = content
        session.commit()
        session.refresh(message)
        return message
    except exc.SQLAlchemyError as e:
        session.rollback()
        raise RuntimeError(f"Error updating message: {e}")
    finally:
        session.close()

def delete_message(message_id: uuid.UUID, space_id: uuid.UUID, user_id: uuid.UUID) -> str:
    session = SessionLocal()
    try:
        message = session.query(Message).filter(
            Message.id == message_id,
            Message.space_id == space_id,
            Message.user_id == user_id
        ).first()
        if not message:
            # Check if message exists but belongs to another user
            exists = session.query(Message).filter(Message.id == message_id, Message.space_id == space_id).first()
            if exists:
                return "unauthorized"
            return "not_found"
        session.delete(message)
        session.commit()
        return "success"
    except exc.SQLAlchemyError as e:
        session.rollback()
        raise RuntimeError(f"Error deleting message: {e}")
    finally:
        session.close()
        
        

# Users CRUD Operaions
def create_user(email: str, first_name: str, last_name: str) -> User:
    session = SessionLocal()
    try:
        # Check if user exists
        found_user = session.query(User).filter(User.email == email).first()
        if found_user:
            return "User with this email already exists"
        
        user = User(email=email, first_name=first_name, last_name=last_name)
        session.add(user)
        session.commit()
        session.refresh(user)
        return user
    except exc.SQLAlchemyError as e:
        session.rollback()
        raise RuntimeError(f"Error creating user: {e}")
    finally:
        session.close()
        
        
def get_user_by_id(user_id: uuid.UUID) -> Optional[User]:
    session = SessionLocal()
    try:
        return session.query(User).filter(User.id == user_id).first()
    finally:
        session.close()
        
def update_user(user_id: uuid.UUID, **kwargs) -> Optional[User]:
    session = SessionLocal()
    try:
        user = session.get(User, user_id)
        if not user:
            raise ValueError(f"User with id {user_id} not found")
        for key, value in kwargs.items():
            if hasattr(user, key):
                setattr(user, key, value)
        session.commit()
        session.refresh(user)
        return user
    except exc.SQLAlchemyError as e:
        session.rollback()
        raise RuntimeError(f"Error updating user: {e}")
    finally:
        session.close()
        

def delete_user(user_id: uuid.UUID) -> bool:
    session = SessionLocal()
    try:
        user = session.get(User, user_id)
        if not user:
            raise ValueError(f"User with id {user_id} not found")
        session.delete(user)
        session.commit()
        return True
    except exc.SQLAlchemyError as e:
        session.rollback()
        raise RuntimeError(f"Error deleting user: {e}")
    finally:
        session.close()