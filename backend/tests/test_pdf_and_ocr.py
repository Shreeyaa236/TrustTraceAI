import pytest
from app.services.pdf_analyzer import extract_pdf_forensic_data
from app.services.ocr_service import is_ocr_available, get_ocr_diagnostic

def test_ocr_diagnostic_endpoint(client):
    res = client.get("/api/ocr/status")
    assert res.status_code == 200
    data = res.json()
    assert "engine" in data
    assert "available" in data
    assert "setup_guide" in data
    assert isinstance(data["available"], bool)

def test_native_pdf_extraction(make_synthetic_pdf):
    lines = [
        "Metropolitan Hospital Center",
        "Invoice Number: INV-98432",
        "Total Amount Due: $1,250.00",
        "Date of Service: 2026-03-15"
    ]
    pdf_bytes = make_synthetic_pdf(lines)
    result = extract_pdf_forensic_data(pdf_bytes, "test_invoice.pdf")

    assert result["extracted_text"] != ""
    assert "INV-98432" in result["extracted_text"]
    assert "1,250.00" in result["extracted_text"]
    assert result["metadata"]["page_count"] == 1
    assert result["extraction_method"] == "native_text"
    assert result["ocr_status"] == "skipped_has_text"

def test_scanned_blank_pdf_handling(make_synthetic_pdf):
    # A blank page has no text, triggering the OCR pipeline attempt
    pdf_bytes = make_synthetic_pdf([])
    result = extract_pdf_forensic_data(pdf_bytes, "blank_scanned.pdf")

    assert result["metadata"]["page_count"] == 1
    # When OCR is unavailable or page is completely blank, result is handled gracefully
    assert result["ocr_status"] in ["completed", "unavailable", "failed"]
    # The application must never fabricate success when OCR is unavailable
    if not is_ocr_available():
        assert result["ocr_status"] == "unavailable"

def test_raw_image_upload(client, auth_headers_user1, make_synthetic_image):
    inv_res = client.post("/api/investigations", json={
        "name": "Image Evidence Case",
        "description": "Testing raw image upload pipeline",
        "primary_claim": "Receipt verification",
        "category": "Other"
    }, headers=auth_headers_user1)
    inv_id = inv_res.json()["id"]

    png_bytes = make_synthetic_image(fmt="PNG")
    files = [("files", ("receipt_photo.png", png_bytes, "image/png"))]
    upload_res = client.post(
        f"/api/investigations/{inv_id}/upload",
        files=files,
        headers=auth_headers_user1
    )
    assert upload_res.status_code == 200
    doc = upload_res.json()["documents"][0]
    assert doc["file_type"] == "PNG"
    assert "ocr_status" in doc["metadata"]
