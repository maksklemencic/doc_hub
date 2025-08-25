import pytest
from uuid import uuid4

from starlette.testclient import TestClient

from backend.db_init.db_init import Space, User


@pytest.fixture(scope="function")
def test_user_id():
    """Fixture to create a test user ID."""
    return uuid4()


@pytest.fixture(scope="function")
def test_user(db_session, test_user_id):
    """Fixture to create a test user."""
    import time
    user = User(
        id=test_user_id,
        email=f"test{int(time.time() * 1000000)}@example.com",  # Unique email
        first_name="Test",
        last_name="User",
        name="Test User"
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture(scope="function")
def test_space(db_session, test_user):
    """Fixture to create a test space."""
    # Use UUID for guaranteed uniqueness
    space_name = f"Test Space {uuid4()}"
    space = Space(id=uuid4(), name=space_name, user_id=test_user.id)
    db_session.add(space)
    db_session.commit()
    return space


class TestCreateSpace:
    def test_create_space_success(self, client: TestClient, test_user):
        """Test creating a space successfully."""
        response = client.post("/api/v1/spaces/", json={"name": "New Space"}, headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Space"
        # assert "user_id" in data

    def test_create_space_unauthenticated(self, client: TestClient):
        """Test creating a space without authentication."""
        response = client.post("/api/v1/spaces/", json={"name": "New Space"})
        assert response.status_code == 401

    def test_create_space_conflict(self, client: TestClient, test_space, test_user):
        """Test creating a space with a name that already exists."""
        response = client.post("/api/v1/spaces/", json={"name": test_space.name}, headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 409

    def test_create_space_invalid_data(self, client: TestClient, test_user):
        """Test creating a space with invalid data."""
        response = client.post("/api/v1/spaces/", json={"name": ""}, headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 422


class TestGetSpaces:
    def test_get_spaces_success(self, client: TestClient, test_space, test_user):
        """Test getting a paginated list of spaces successfully."""
        response = client.get("/api/v1/spaces/", headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 200
        data = response.json()
        assert len(data["spaces"]) == 1
        assert data["spaces"][0]["name"] == test_space.name

    def test_get_spaces_unauthenticated(self, client: TestClient):
        """Test getting a list of spaces without authentication."""
        response = client.get("/api/v1/spaces/")
        assert response.status_code == 401

    def test_get_spaces_with_pagination(self, client: TestClient, test_space, test_user, db_session):
        """Test getting a list of spaces with pagination parameters."""
        # Create a second space for the same user
        space2 = Space(id=uuid4(), name="Test Space 2", user_id=test_user.id)
        db_session.add(space2)
        db_session.commit()

        response = client.get("/api/v1/spaces/?limit=1&offset=1", headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 200
        data = response.json()
        assert len(data["spaces"]) == 1
        assert data["spaces"][0]["name"] == "Test Space 2"
        assert data["pagination"]["total_count"] == 2

    def test_get_spaces_empty(self, client: TestClient, test_user):
        """Test getting a list of spaces when there are no spaces."""
        response = client.get("/api/v1/spaces/", headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 200
        data = response.json()
        assert len(data["spaces"]) == 0


class TestUpdateSpace:
    def test_update_space_success(self, client: TestClient, test_space, test_user):
        """Test updating a space successfully."""
        response = client.patch(f"/api/v1/spaces/{test_space.id}", json={"name": "Updated Space"}, headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Space"

    def test_update_space_unauthenticated(self, client: TestClient, test_space):
        """Test updating a space without authentication."""
        response = client.patch(f"/api/v1/spaces/{test_space.id}", json={"name": "Updated Space"})
        assert response.status_code == 401

    def test_update_space_not_found(self, client: TestClient, test_user):
        """Test updating a space that does not exist."""
        response = client.patch(f"/api/v1/spaces/{uuid4()}", json={"name": "Updated Space"}, headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 404

    def test_update_space_permission_denied(self, client: TestClient, test_space, db_session):
        """Test updating a space that belongs to another user."""
        other_user = User(id=uuid4(), email="other@example.com", first_name="Other", last_name="User", name="Other User")
        db_session.add(other_user)
        db_session.commit()
        response = client.patch(f"/api/v1/spaces/{test_space.id}", json={"name": "Updated Space"}, headers={"Authorization": f"Bearer {other_user.id}"})
        assert response.status_code == 403

    def test_update_space_invalid_data(self, client: TestClient, test_space, test_user):
        """Test updating a space with invalid data."""
        response = client.patch(f"/api/v1/spaces/{test_space.id}", json={"name": ""}, headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 422


class TestDeleteSpace:
    def test_delete_space_success(self, client: TestClient, test_space, test_user):
        """Test deleting a space successfully."""
        response = client.delete(f"/api/v1/spaces/{test_space.id}", headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 204

    def test_delete_space_unauthenticated(self, client: TestClient, test_space):
        """Test deleting a space without authentication."""
        response = client.delete(f"/api/v1/spaces/{test_space.id}")
        assert response.status_code == 401

    def test_delete_space_not_found(self, client: TestClient, test_user):
        """Test deleting a space that does not exist."""
        response = client.delete(f"/api/v1/spaces/{uuid4()}", headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 404

    def test_delete_space_permission_denied(self, client: TestClient, test_space, db_session):
        """Test deleting a space that belongs to another user."""
        other_user = User(id=uuid4(), email="other2@example.com", first_name="Other", last_name="User", name="Other User")
        db_session.add(other_user)
        db_session.commit()
        response = client.delete(f"/api/v1/spaces/{test_space.id}", headers={"Authorization": f"Bearer {other_user.id}"})
        assert response.status_code == 403


class TestSpacesEdgeCases:
    """Additional test cases for edge cases and comprehensive coverage."""
    
    def test_create_space_with_maximum_length_name(self, client: TestClient, test_user):
        """Test creating a space with maximum allowed name length."""
        max_name = "A" * 100  # Maximum length according to model
        response = client.post("/api/v1/spaces/", json={"name": max_name}, headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == max_name

    def test_create_space_with_unicode_characters(self, client: TestClient, test_user):
        """Test creating a space with unicode characters."""
        unicode_name = "Test Space 🚀 中文 العربية"
        response = client.post("/api/v1/spaces/", json={"name": unicode_name}, headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == unicode_name

    def test_create_space_with_whitespace_name(self, client: TestClient, test_user):
        """Test creating a space with leading/trailing whitespace."""
        response = client.post("/api/v1/spaces/", json={"name": "  Spaced Name  "}, headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "  Spaced Name  "  # Should preserve whitespace

    def test_get_spaces_with_large_limit(self, client: TestClient, test_user):
        """Test getting spaces with maximum allowed limit."""
        response = client.get("/api/v1/spaces/?limit=100", headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 200
        data = response.json()
        assert data["pagination"]["limit"] == 100

    def test_get_spaces_with_invalid_limit(self, client: TestClient, test_user):
        """Test getting spaces with invalid limit (over 100)."""
        response = client.get("/api/v1/spaces/?limit=101", headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 422

    def test_get_spaces_with_negative_offset(self, client: TestClient, test_user):
        """Test getting spaces with negative offset."""
        response = client.get("/api/v1/spaces/?offset=-1", headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 422

    def test_update_space_with_same_name(self, client: TestClient, test_space, test_user):
        """Test updating a space with the same name (should succeed)."""
        response = client.patch(f"/api/v1/spaces/{test_space.id}", json={"name": test_space.name}, headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == test_space.name

    def test_update_space_with_maximum_length_name(self, client: TestClient, test_space, test_user):
        """Test updating a space with maximum allowed name length."""
        max_name = "B" * 100
        response = client.patch(f"/api/v1/spaces/{test_space.id}", json={"name": max_name}, headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == max_name

    def test_operations_with_invalid_uuid(self, client: TestClient, test_user):
        """Test space operations with invalid UUID."""
        invalid_uuid = "not-a-uuid"
        
        # Update with invalid UUID
        response = client.patch(f"/api/v1/spaces/{invalid_uuid}", json={"name": "New Name"}, headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 422
        
        # Delete with invalid UUID  
        response = client.delete(f"/api/v1/spaces/{invalid_uuid}", headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 422

    def test_space_timestamps_are_set(self, client: TestClient, test_user):
        """Test that created_at and updated_at timestamps are properly set."""
        response = client.post("/api/v1/spaces/", json={"name": "Timestamp Test"}, headers={"Authorization": f"Bearer {test_user.id}"})
        assert response.status_code == 201
        data = response.json()
        assert "created_at" in data
        assert "updated_at" in data
        assert data["created_at"] is not None
        assert data["updated_at"] is not None

    def test_multiple_users_can_have_same_space_name(self, client: TestClient, db_session):
        """Test that different users can have spaces with the same name."""
        # Create two different users
        import time
        user1_id = uuid4()
        user2_id = uuid4()
        
        user1 = User(
            id=user1_id,
            email=f"user1{int(time.time() * 1000000)}@example.com",
            first_name="User",
            last_name="One",
            name="User One"
        )
        user2 = User(
            id=user2_id,
            email=f"user2{int(time.time() * 1000000)}@example.com", 
            first_name="User",
            last_name="Two", 
            name="User Two"
        )
        db_session.add(user1)
        db_session.add(user2)
        db_session.commit()

        space_name = "Shared Name"
        
        # User 1 creates space
        response1 = client.post("/api/v1/spaces/", json={"name": space_name}, headers={"Authorization": f"Bearer {user1_id}"})
        assert response1.status_code == 201
        
        # User 2 creates space with same name (should succeed)
        response2 = client.post("/api/v1/spaces/", json={"name": space_name}, headers={"Authorization": f"Bearer {user2_id}"})
        assert response2.status_code == 201
        
        assert response1.json()["name"] == space_name
        assert response2.json()["name"] == space_name
        assert response1.json()["id"] != response2.json()["id"]
