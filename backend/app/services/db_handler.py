import os
import uuid
from sqlalchemy import create_engine, exc
from sqlalchemy.orm import Session, sessionmaker
from typing import List, Optional
from ...db_init.db_init import Base, Document, Space, User

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in environment")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

# Documents CRUD operations
def get_document_by_id(doc_id: uuid.UUID) -> Document | None:
    session = SessionLocal()
    try:
        doc = session.query(Document).filter(Document.id == doc_id).first()
        return doc
    finally:
        session.close()
        

def add_document(filename: str, file_path: str, mime_type: str, uploaded_by: uuid.UUID) -> uuid.UUID:
    session = SessionLocal()
    try:
        doc = Document(
            filename=filename,
            file_path=file_path,
            mime_type=mime_type,
            uploaded_by=uploaded_by
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
def create_space(name: str, user_id: uuid.UUID) -> Space:
    session = SessionLocal()
    try:
        space = Space(name=name, user_id=user_id)
        session.add(space)
        session.commit()
        session.refresh(space)
        return space
    except exc.SQLAlchemyError as e:
        session.rollback()
        raise RuntimeError(f"Error creating space: {e}")
    finally:
        session.close()

def get_space_by_id(space_id: uuid.UUID) -> Optional[Space]:
    session = SessionLocal()
    try:
        return session.query(Space).filter(Space.id == space_id, Space.user_id == user_id).first()
    finally:
        session.close()

def get_all_spaces() -> List[Space]:
    session = SessionLocal()
    try:
        return session.query(Space).all()
    finally:
        session.close()

def update_space(space_id: uuid.UUID, new_name: str) -> Optional[Space]:
    session = SessionLocal()
    try:
        space = session.query(Space).filter(Space.id == space_id).first()
        if space:
            space.name = new_name
            session.commit()
            session.refresh(space)
        return space
    except exc.SQLAlchemyError as e:
        session.rollback()
        raise RuntimeError(f"Error updating space: {e}")
    finally:
        session.close()

def delete_space(space_id: uuid.UUID) -> bool:
    session = SessionLocal()
    try:
        space = session.query(Space).filter(Space.id == space_id).first()
        if space:
            session.delete(space)
            session.commit()
            return True
        return False
    except exc.SQLAlchemyError as e:
        session.rollback()
        raise RuntimeError(f"Error deleting space: {e}")
    finally:
        session.close()