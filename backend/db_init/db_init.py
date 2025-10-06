import os
import uuid
from sqlalchemy import UniqueConstraint, create_engine, Column, String, Integer, TIMESTAMP, ForeignKey, inspect, text, Boolean, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base
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
    file_size = Column(Integer, nullable=True)
    url = Column(String, nullable=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))

class Space(Base):
    __tablename__ = "spaces"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    icon = Column(String, nullable=True, default='Folder')
    icon_color = Column(String, nullable=True, default='text-gray-600')
    display_order = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    updated_at = Column(TIMESTAMP, server_default=text("NOW()"), onupdate=text("NOW()"))

    __table_args__ = (
        UniqueConstraint('user_id', 'name', name='unique_user_space_name'),
    )

class Message(Base):
    __tablename__ = "messages"

    # Core identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    space_id = Column(UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Message content
    content = Column(String, nullable=False)  # User query
    response = Column(String, nullable=True)  # AI response

    # Status and timing information
    status = Column(String(20), nullable=False, default='pending')
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("NOW()"), nullable=False)

    # Data validation constraints
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'streaming', 'completed', 'failed')", name='valid_status'),
    )


def database_is_empty(engine):
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    return not any(t in tables for t in ["users", "documents", "spaces", "messages"])

def create_tables():
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto;"))
    Base.metadata.create_all(engine)
    print("Tables created successfully!")
    
def create_indexes():
    """Create performance indexes after table creation."""
    with engine.connect() as conn:
        print("Creating performance indexes...")
        indexes = [
            # Document indexes
            "CREATE INDEX IF NOT EXISTS idx_documents_space_id ON documents(space_id);",
            "CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);",
            "CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);",
            "CREATE INDEX IF NOT EXISTS idx_documents_space_uploaded ON documents(space_id, uploaded_by);",

            # Message indexes
            "CREATE INDEX IF NOT EXISTS idx_messages_space_user ON messages(space_id, user_id);",
            "CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);",
            "CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);",
            "CREATE INDEX IF NOT EXISTS idx_messages_space_status ON messages(space_id, status);",
            "CREATE INDEX IF NOT EXISTS idx_messages_space_created ON messages(space_id, created_at DESC);",

            # Other indexes
            "CREATE INDEX IF NOT EXISTS idx_spaces_user_id ON spaces(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);",
        ]
        
        for index_sql in indexes:
            try:
                conn.execute(text(index_sql))
            except Exception as e:
                print(f"Index creation warning: {str(e)}")
        
        conn.commit()
        print("Indexes created successfully!")

def create_views():
    """Create analytical views for message statistics."""
    with engine.connect() as conn:
        print("Creating analytical views...")

        # Drop view if exists to handle schema changes
        conn.execute(text("DROP VIEW IF EXISTS message_analytics;"))

        view_sql = """
        CREATE VIEW message_analytics AS
        SELECT
            space_id,
            COUNT(*) as total_messages,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_messages,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_messages,
            COUNT(CASE WHEN response IS NOT NULL THEN 1 END) as messages_with_response,
            ROUND(
                COUNT(CASE WHEN status = 'completed' THEN 1 END)::NUMERIC /
                NULLIF(COUNT(*), 0) * 100, 2
            ) as success_rate_percent
        FROM messages
        GROUP BY space_id;
        """

        conn.execute(text(view_sql))
        conn.commit()
        print("Views created successfully!")

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
        create_indexes()
        create_views()
    else:
        print("Database already has tables. Skipping creation.")

    # insert_test_data()
