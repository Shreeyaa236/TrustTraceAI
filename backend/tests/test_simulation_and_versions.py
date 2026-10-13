import pytest
from app.services.time_machine import run_time_machine_simulation
from app.services.versioning import compare_analysis_versions
from app.services.report_generator import generate_pdf_report

def test_time_machine_simulation():
    inv = {
        "id": "inv_sim_test",
        "name": "Time Machine Test Case",
        "primary_claim": "Claim for medical expenses of $5,000",
        "status": "Review Required"
    }
    docs = [
        {
            "id": "doc_bill",
            "file_name": "Hospital_Bill.pdf",
            "category": "Medical Document",
            "extracted_fields": {"amounts": [5000.0]}
        },
        {
            "id": "doc_receipt",
            "file_name": "Suspicious_Receipt.pdf",
            "category": "Invoice or Receipt",
            "extracted_fields": {"amounts": [5000.0]}
        }
    ]
    findings = [
        {
            "finding_id": "FIND-01",
            "category": "Amount Discrepancy",
            "explanation": "Receipt details suspicious",
            "documents_involved": ["doc_receipt"]
        }
    ]
    claims = [{"id": "c1", "claim_text": "Claim for medical expenses of $5,000"}]

    # Simulate excluding the suspicious receipt
    sim_res = run_time_machine_simulation(
        investigation=inv,
        all_documents=docs,
        all_findings=findings,
        all_claims=claims,
        excluded_doc_ids=["doc_receipt"]
    )

    assert sim_res["excluded_document_ids"] == ["doc_receipt"]
    assert "Suspicious_Receipt.pdf" in sim_res["excluded_document_names"]
    assert "simulated_status" in sim_res
    assert "claims_still_supported" in sim_res
    assert "claims_that_lost_support" in sim_res

def test_version_comparison():
    v1 = {
        "version_number": 1,
        "investigation_id": "inv_1",
        "document_ids": ["doc_1"],
        "findings_state": []
    }
    v2 = {
        "version_number": 2,
        "investigation_id": "inv_1",
        "document_ids": ["doc_1", "doc_2"],
        "findings_state": [
            {
                "finding_id": "FIND-NEW-01",
                "category": "Amount Discrepancy",
                "explanation": "New mismatch between doc 1 and doc 2"
            }
        ]
    }

    comp = compare_analysis_versions(v1, v2)
    assert comp["base_version"] == 1
    assert comp["target_version"] == 2
    assert "doc_2" in comp["documents_added"]
    assert len(comp["new_findings"]) == 1

def test_pdf_report_generation(client, auth_headers_user1):
    inv_res = client.post("/api/investigations", json={
        "name": "Report Export Case",
        "description": "Testing PDF generation",
        "primary_claim": "Verified Claim",
        "category": "Corporate Compliance"
    }, headers=auth_headers_user1)
    inv_id = inv_res.json()["id"]

    # Request PDF export
    pdf_res = client.get(f"/api/investigations/{inv_id}/report/pdf", headers=auth_headers_user1)
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    # PDF magic bytes
    assert pdf_res.content.startswith(b"%PDF-")
