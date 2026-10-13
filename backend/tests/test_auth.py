import pytest

def test_user_registration(client):
    res = client.post("/api/auth/register", json={
        "email": "investigator_new@trusttrace.test",
        "username": "new_investigator",
        "password": "SecurePassword123!",
        "full_name": "New Forensic Specialist"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "investigator_new@trusttrace.test"
    assert data["user"]["username"] == "new_investigator"

def test_duplicate_user_registration(client):
    email = "duplicate@trusttrace.test"
    payload = {
        "email": email,
        "username": "dup_user",
        "password": "Password123!",
        "full_name": "Duplicate User"
    }
    res1 = client.post("/api/auth/register", json=payload)
    assert res1.status_code == 200

    # Attempt second registration with same email
    res2 = client.post("/api/auth/register", json=payload)
    assert res2.status_code == 400
    assert "already registered" in res2.json()["detail"].lower()

def test_login_flow(client):
    email = "login_test@trusttrace.test"
    password = "CorrectPassword123!"
    client.post("/api/auth/register", json={
        "email": email,
        "username": "login_user",
        "password": password,
        "full_name": "Login User"
    })

    # Successful login
    res_ok = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res_ok.status_code == 200
    assert "access_token" in res_ok.json()

    # Wrong password
    res_bad = client.post("/api/auth/login", json={"email": email, "password": "WrongPassword!"})
    assert res_bad.status_code == 401

def test_invalid_jwt_token(client):
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.token.value"})
    assert res.status_code == 401

def test_multi_user_isolation(client, auth_headers_user1, auth_headers_user2):
    # User 1 creates an investigation
    create_res = client.post("/api/investigations", json={
        "name": "User 1 Confidential Investigation",
        "description": "Private matter for User 1",
        "primary_claim": "Claim 100",
        "category": "Financial Fraud"
    }, headers=auth_headers_user1)
    assert create_res.status_code == 200
    inv_id = create_res.json()["id"]

    # User 1 can view it
    get_res1 = client.get(f"/api/investigations/{inv_id}", headers=auth_headers_user1)
    assert get_res1.status_code == 200
    assert get_res1.json()["name"] == "User 1 Confidential Investigation"

    # User 2 CANNOT access User 1's investigation (403 Forbidden)
    get_res2 = client.get(f"/api/investigations/{inv_id}", headers=auth_headers_user2)
    assert get_res2.status_code == 403

    # User 2 CANNOT delete User 1's investigation
    del_res2 = client.delete(f"/api/investigations/{inv_id}", headers=auth_headers_user2)
    assert del_res2.status_code == 403

    # User 1 CAN delete own investigation
    del_res1 = client.delete(f"/api/investigations/{inv_id}", headers=auth_headers_user1)
    assert del_res1.status_code == 200
