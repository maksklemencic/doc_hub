import os
import uuid
from sqlalchemy import create_engine, Column, String, TIMESTAMP, ForeignKey, inspect, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in environment")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    first_name = Column(String)
    last_name = Column(String)
    created_at = Column(TIMESTAMP, server_default="NOW()")

class Document(Base):
    __tablename__ = "documents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    upload_date = Column(TIMESTAMP, server_default="NOW()")

def database_is_empty(engine):
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    return not any(t in tables for t in ["users", "documents"])

def create_tables():
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto;"))
    Base.metadata.create_all(engine)
    print("Tables created successfully!")

if __name__ == "__main__":
    if database_is_empty(engine):
        print("Database is empty. Creating tables...")
        create_tables()
    else:
        print("Database already has tables. Skipping creation.")
