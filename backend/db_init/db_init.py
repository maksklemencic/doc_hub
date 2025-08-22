import os
import uuid
from sqlalchemy import UniqueConstraint, create_engine, Column, String, TIMESTAMP, ForeignKey, inspect, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in environment")


TEST_USER_EMAIL = os.environ.get("TEST_USER_EMAIL")
TEST_USER_FIRST = os.environ.get("TEST_USER_FIRST", "Test")
TEST_USER_LAST = os.environ.get("TEST_USER_LAST", "User")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    first_name = Column(String)
    last_name = Column(String)
    name = Column(String)  # Full name from OAuth
    picture = Column(String)  # Profile picture URL
    google_id = Column(String, unique=True)  # Google OAuth ID
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))

class Document(Base):
    __tablename__ = "documents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    space_id = Column(UUID(as_uuid=True), ForeignKey("spaces.id"), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))

class Space(Base):
    __tablename__ = "spaces"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))
    
    __table_args__ = (
        UniqueConstraint('user_id', 'name', name='unique_user_space_name'),
    )

class Message(Base):
    __tablename__ = "messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    space_id = Column(UUID(as_uuid=True), ForeignKey("spaces.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))


def database_is_empty(engine):
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    return not any(t in tables for t in ["users", "documents", "spaces", "messages"])

def create_tables():
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto;"))
    Base.metadata.create_all(engine)
    print("Tables created successfully!")

def insert_test_data():
    session = SessionLocal()
    try:
        user_count = session.query(User).count()
        if user_count == 0 and TEST_USER_EMAIL:
            test_user = User(
                email=TEST_USER_EMAIL,
                first_name=TEST_USER_FIRST,
                last_name=TEST_USER_LAST
            )
            session.add(test_user)
            session.commit()
            print(f"Inserted test user {TEST_USER_EMAIL}")

            personal_space = Space(
                name="Personal space",
                user_id=test_user.id
            )
            session.add(personal_space)
            session.commit()
            print(f"Created 'Personal space' for user {TEST_USER_EMAIL}")

        else:
            print("Users table not empty or TEST_USER_EMAIL not set. Skipping test data creation.")
    finally:
        session.close()

if __name__ == "__main__":
    if database_is_empty(engine):
        print("Database is empty. Creating tables...")
        create_tables()
    else:
        print("Database already has tables. Skipping creation.")

    insert_test_data()
