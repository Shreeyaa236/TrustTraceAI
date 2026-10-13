import pytest
from app.services.comparison import run_cross_document_comparison
from app.services.gap_finder import evaluate_evidence_gaps_and_dimensions
from app.services.llm_service import (
    generate_explanation_with_fallback,
    explain_finding_with_ai,
    enrich_findings_with_ai
)

def test_deterministic_amount_contradiction():
    docs = [
        {
            "id": "doc_1",
            "file_name": "Hospital_Bill.pdf",
            "category": "Medical Document",
            "extracted_fields": {"amounts": [5000.00], "dates": ["2026-03-01"]},
            "metadata": {}
        },
        {
            "id": "doc_2",
            "file_name": "Payment_Receipt.pdf",
            "category": "Invoice or Receipt",
            "extracted_fields": {"amounts": [3500.00], "dates": ["2026-03-02"]},
            "metadata": {}
        }
    ]

    findings = run_cross_document_comparison("inv_test", docs, "Hospital treatment claim $5000")
    assert len(findings) > 0
    amount_findings = [f for f in findings if f["category"] == "Amount Discrepancy" or "amount" in f["finding_id"].lower()]
    assert len(amount_findings) >= 1
    f = amount_findings[0]
    assert "3500" in f["explanation"] or "5000" in f["explanation"]
    assert f["severity"] in ["CRITICAL", "WARNING", "HIGH"]

def test_evidence_gap_finder():
    inv = {
        "id": "inv_test_gap",
        "name": "Gap Test Case",
        "primary_claim": "Reimbursement of medical and surgical expenses",
        "category": "Medical Documents"
    }
    # Only medical bill provided, no payment receipt or discharge record
    docs = [
        {
            "id": "doc_bill",
            "file_name": "Surgery_Bill.pdf",
            "category": "Medical Document",
            "extracted_fields": {"amounts": [12000.00], "dates": ["2026-02-15"]},
            "metadata": {}
        }
    ]
    findings = []
    eval_res = evaluate_evidence_gaps_and_dimensions(inv, docs, findings)

    assert "gaps" in eval_res
    assert len(eval_res["gaps"]) > 0
    gap_types = [g["gap_type"] for g in eval_res["gaps"]]
    assert any("receipt" in gt.lower() or "payment" in gt.lower() or "discharge" in gt.lower() or "missing" in gt.lower() for gt in gap_types)

@pytest.mark.asyncio
async def test_llm_fallback_without_api_key():
    finding = {
        "finding_id": "FIND-AMT-001",
        "category": "Amount Discrepancy",
        "explanation": "Document A states $5,000 but Document B states $3,500.",
        "documents_involved": ["doc_1", "doc_2"],
        "severity": "CRITICAL"
    }
    docs = [{"id": "doc_1", "file_name": "A.pdf"}, {"id": "doc_2", "file_name": "B.pdf"}]

    res = await explain_finding_with_ai(finding, docs, "Primary claim")
    # Must fallback safely with deterministic observation preserved
    assert res["finding_id"] == "FIND-AMT-001"
    assert res["is_ai_generated"] is False
    assert "observation_summary" in res
    assert "recommended_verification_step" in res

@pytest.mark.asyncio
async def test_enrich_findings_with_ai_fallback():
    findings = [{
        "finding_id": "FIND-01",
        "category": "Amount Discrepancy",
        "explanation": "Mismatch detected",
        "documents_involved": ["d1"],
        "severity": "WARNING"
    }]
    docs = [{"id": "d1", "file_name": "Bill.pdf"}]

    # In environment without API keys, enriched findings remain valid and safe
    enriched = await enrich_findings_with_ai(findings, docs, "Claim text")
    assert len(enriched) == 1
    assert enriched[0]["finding_id"] == "FIND-01"
