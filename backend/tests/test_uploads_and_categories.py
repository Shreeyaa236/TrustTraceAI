import hashlib
import json
import pytest

def test_per_file_category_assignment(client, auth_headers_user1, make_synthetic_pdf):
    # Create investigation
    inv_res = client.post("/api/investigations", json={
        "name": "Category Assignment Verification Case",
        "description": "Testing distinct per-file categories in batch",
        "primary_claim": "Hospital and pharmacy reimbursement",
        "category": "Medical Documents"
    }, headers=auth_headers_user1)
    assert inv_res.status_code == 200
    inv_id = inv_res.json()["id"]

    # Prepare 4 synthetic PDFs
    pdf1 = make_synthetic_pdf(["Hospital Inpatient Bill", "Amount: $4,500.00"])
    pdf2 = make_synthetic_pdf(["Official Payment Receipt", "Received $4,500.00"])
    pdf3 = make_synthetic_pdf(["Bank Checking Statement", "Withdrawal: $4,500.00"])
    pdf4 = make_synthetic_pdf(["Discharge Summary and Medical Notes", "Patient discharged in good condition."])

    # Category manifest with 4 distinct categories
    metadata_manifest = [
        {"file_name": "hospital_bill.pdf", "category": "Medical Document", "issuing_organization": "General Hospital"},
        {"file_name": "payment_receipt.pdf", "category": "Invoice or Receipt", "issuing_organization": "Hospital Cashier"},
        {"file_name": "bank_statement.pdf", "category": "Financial Document", "issuing_organization": "Metro Bank"},
        {"file_name": "discharge_summary.pdf", "category": "Identity Document", "issuing_organization": "Medical Board"}
    ]

    files = [
        ("files", ("hospital_bill.pdf", pdf1, "application/pdf")),
        ("files", ("payment_receipt.pdf", pdf2, "application/pdf")),
        ("files", ("bank_statement.pdf", pdf3, "application/pdf")),
        ("files", ("discharge_summary.pdf", pdf4, "application/pdf"))
    ]

    data = {
        "file_metadata": json.dumps(metadata_manifest)
    }

    upload_res = client.post(
        f"/api/investigations/{inv_id}/upload",
        files=files,
        data=data,
        headers=auth_headers_user1
    )
    assert upload_res.status_code == 200, upload_res.text
    uploaded_docs = upload_res.json()["documents"]
    assert len(uploaded_docs) == 4

    doc_map = {d["file_name"]: d for d in uploaded_docs}

    # Verify each file received its own designated category
    assert doc_map["hospital_bill.pdf"]["category"] == "Medical Document"
    assert doc_map["payment_receipt.pdf"]["category"] == "Invoice or Receipt"
    assert doc_map["bank_statement.pdf"]["category"] == "Financial Document"
    assert doc_map["discharge_summary.pdf"]["category"] == "Identity Document"

    # Reopening/fetching documents verifies persistence
    get_docs = client.get(f"/api/investigations/{inv_id}/documents", headers=auth_headers_user1)
    assert get_docs.status_code == 200
    persisted_docs = {d["file_name"]: d for d in get_docs.json()}
    assert persisted_docs["hospital_bill.pdf"]["category"] == "Medical Document"
    assert persisted_docs["payment_receipt.pdf"]["category"] == "Invoice or Receipt"
    assert persisted_docs["bank_statement.pdf"]["category"] == "Financial Document"
    assert persisted_docs["discharge_summary.pdf"]["category"] == "Identity Document"

def test_file_hash_and_duplicate_detection(client, auth_headers_user1, make_synthetic_pdf):
    inv_res = client.post("/api/investigations", json={
        "name": "Duplicate File Test Case",
        "description": "Testing hash and duplicate detection",
        "primary_claim": "Duplicate claim",
        "category": "Financial Fraud"
    }, headers=auth_headers_user1)
    inv_id = inv_res.json()["id"]

    pdf_content = make_synthetic_pdf(["Unique Document Content For Hash Verification"])
    expected_hash = hashlib.sha256(pdf_content).hexdigest()

    # Upload first time
    files1 = [("files", ("doc_alpha.pdf", pdf_content, "application/pdf"))]
    res1 = client.post(f"/api/investigations/{inv_id}/upload", files=files1, headers=auth_headers_user1)
    assert res1.status_code == 200
    doc = res1.json()["documents"][0]
    assert doc["file_hash"] == expected_hash

    # Upload identical content under a different filename
    files2 = [("files", ("doc_duplicate.pdf", pdf_content, "application/pdf"))]
    res2 = client.post(f"/api/investigations/{inv_id}/upload", files=files2, headers=auth_headers_user1)
    assert res2.status_code == 200
    # Duplicate detection triggers finding during analysis
    analyze_res = client.post(f"/api/investigations/{inv_id}/analyze", headers=auth_headers_user1)
    assert analyze_res.status_code == 200
    findings = analyze_res.json()["findings"]
    duplicate_findings = [f for f in findings if f["category"] == "Duplicate / Hash Identity" or "duplicate" in f["finding_id"].lower()]
    assert len(duplicate_findings) >= 1

def test_unsupported_file_extension(client, auth_headers_user1):
    inv_res = client.post("/api/investigations", json={
        "name": "Invalid File Test Case",
        "description": "Testing invalid extension rejection",
        "primary_claim": "Invalid extension",
        "category": "Other"
    }, headers=auth_headers_user1)
    inv_id = inv_res.json()["id"]

    bad_file = [("files", ("malicious.exe", b"MZexecutablecontent", "application/octet-stream"))]
    res = client.post(f"/api/investigations/{inv_id}/upload", files=bad_file, headers=auth_headers_user1)
    assert res.status_code == 400
    assert "unsupported file format" in res.json()["detail"].lower()
