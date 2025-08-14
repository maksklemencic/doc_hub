import os
import uuid
from sqlalchemy import create_engine, exc
from sqlalchemy.orm import sessionmaker
from ...db_init.db_init import Base, Document

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in environment")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


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
