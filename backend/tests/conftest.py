import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.testclient import TestClient
from unittest.mock import MagicMock

# Mock external services before importing the app
import sys
from unittest.mock import patch, MagicMock
from uuid import UUID
from datetime import datetime, timedelta

# Create comprehensive mocks for external services
mock_qdrant_client = MagicMock()
mock_qdrant_http = MagicMock()
mock_qdrant_models = MagicMock()

# Mock Qdrant related modules
sys.modules['qdrant_client'] = MagicMock()
sys.modules['qdrant_client.QdrantClient'] = MagicMock(return_value=mock_qdrant_client)
sys.modules['qdrant_client.http'] = mock_qdrant_http
sys.modules['qdrant_client.http.models'] = mock_qdrant_models

# Mock sentence transformers
mock_sentence_transformer = MagicMock()
mock_sentence_transformer.encode.return_value = [[0.1] * 384]  # Mock 384-dim vector
sys.modules['sentence_transformers'] = MagicMock()
sys.modules['sentence_transformers.SentenceTransformer'] = MagicMock(return_value=mock_sentence_transformer)

# Mock other external dependencies  
sys.modules['chonkie'] = MagicMock()
sys.modules['chonkie.RecursiveChunker'] = MagicMock()

# Mock JWT library - this needs to happen before any JWT service imports
mock_jose = MagicMock()
mock_jwt = MagicMock()

def mock_jwt_decode(token, secret, algorithms):
    """Mock JWT decode that accepts UUID strings as tokens"""
    try:
        # In tests, we use UUID strings directly as tokens
        user_id = UUID(token)
        return {
            "user_id": str(user_id),
            "email": "test@example.com",
            "exp": (datetime.utcnow() + timedelta(hours=1)).timestamp(),
            "iat": datetime.utcnow().timestamp(),
            "type": "access"
        }
    except ValueError:
        # If not a valid UUID, raise JWTError
        raise Exception("Invalid token")  # Use generic exception since we're mocking

mock_jwt.decode = mock_jwt_decode
mock_jwt.encode = MagicMock(return_value="mock-jwt-token")
mock_jose.jwt = mock_jwt
mock_jose.JWTError = Exception  # Simple exception for testing

sys.modules['jose'] = mock_jose
sys.modules['jose.jwt'] = mock_jwt

# Set environment variables for testing
os.environ.setdefault('JWT_SECRET_KEY', 'test_secret_key')
os.environ['TESTING'] = 'true'

from backend.app.main import app
from backend.app.services import db_handler
from backend.db_init.db_init import Base

# Test database URL - use TEST_DATABASE_URL if set, otherwise fallback to DATABASE_URL for Docker
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL") or os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/test_db")


@pytest.fixture(scope="session")
def db_engine():
    """Creates a database engine for the test database."""
    engine = create_engine(TEST_DATABASE_URL)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(db_engine):
    """Creates a new database session for each test function."""
    connection = db_engine.connect()
    transaction = connection.begin()
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=connection)
    session = SessionLocal()
    yield session
    session.close()
    if transaction.is_active:
        transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db_session, monkeypatch):
    """Creates a TestClient that uses the test database."""
    from uuid import UUID
    
    monkeypatch.setattr(db_handler, "SessionLocal", lambda: db_session)
    

    with TestClient(app) as c:
        yield c
