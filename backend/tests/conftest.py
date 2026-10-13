import io
import os
import shutil
import tempfile
import pytest
from fastapi.testclient import TestClient
from PIL import Image
import fitz  # PyMuPDF

# Point test data storage to a temporary directory before importing app
temp_dir = tempfile.mkdtemp(prefix="trusttrace_test_")
os.environ["DATA_DIR"] = os.path.join(temp_dir, "data")
os.environ["UPLOAD_DIR"] = os.path.join(temp_dir, "uploads")
os.environ["JWT_SECRET"] = "test-secret-key-very-secure-trusttrace-12345"
os.environ["STORAGE_MODE"] = "json"
os.environ["LLM_PROVIDER"] = "none"

from app.main import app
from app.services.storage import db

@pytest.fixture(scope="session", autouse=True)
def cleanup_temp_dir():
    yield
    shutil.rmtree(temp_dir, ignore_errors=True)

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def auth_headers_user1(client):
    # Register and login user 1
    email = "agent1@trusttrace.test"
    password = "TestPassword2026!"
    client.post("/api/auth/register", json={
        "email": email,
        "username": "agent1",
        "password": password,
        "full_name": "Senior Agent One"
    })
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def auth_headers_user2(client):
    # Register and login user 2
    email = "agent2@trusttrace.test"
    password = "TestPassword2026!"
    client.post("/api/auth/register", json={
        "email": email,
        "username": "agent2",
        "password": password,
        "full_name": "Reviewer Agent Two"
    })
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def make_synthetic_pdf():
    def _create(text_lines, filename="test.pdf"):
        doc = fitz.open()
        page = doc.new_page()
        y = 72
        for line in text_lines:
            page.insert_text((72, y), line, fontsize=12)
            y += 20
        pdf_bytes = doc.write()
        doc.close()
        return pdf_bytes
    return _create

@pytest.fixture
def make_synthetic_image():
    def _create(width=300, height=150, color=(255, 255, 255), fmt="PNG"):
        img = Image.new("RGB", (width, height), color=color)
        buf = io.BytesIO()
        img.save(buf, format=fmt)
        return buf.getvalue()
    return _create
