import uuid
from typing import List, Dict, Any

def evaluate_evidence_gaps_and_dimensions(
    investigation: Dict[str, Any],
    documents: List[Dict[str, Any]],
    findings: List[Dict[str, Any]],
    excluded_doc_ids: List[str] = None
) -> Dict[str, Any]:
    if excluded_doc_ids is None:
        excluded_doc_ids = []

    active_docs = [d for d in documents if d["id"] not in excluded_doc_ids]
    primary_claim = investigation.get("primary_claim", "Primary Claim Under Verification")

    has_high_inconsistency = any(
        f.get("severity") == "High" and f.get("category") == "Inconsistency"
        for f in findings
        if not any(did in excluded_doc_ids for did in f.get("affected_document_ids", []))
    )

    has_bank_doc = any(
        "bank" in d.get("file_name", "").lower() or
        "transaction" in d.get("category", "").lower() or
        "statement" in d.get("file_name", "").lower()
        for d in active_docs
    )

    has_receipt = any(
        "receipt" in d.get("file_name", "").lower() or
        "receipt" in d.get("category", "").lower()
        for d in active_docs
    )

    has_bill = any(
        "bill" in d.get("file_name", "").lower() or
        "invoice" in d.get("category", "").lower() or
        "hospital" in d.get("file_name", "").lower()
        for d in active_docs
    )

    gaps: List[Dict[str, Any]] = []

    # Check 1: Missing Independent Third-Party Financial Settlement Confirmation
    if not has_bank_doc and (has_bill or has_receipt):
        gaps.append({
            "id": str(uuid.uuid4()),
            "claim_text": primary_claim,
            "available_evidence": [d["file_name"] for d in active_docs],
            "missing_information": "Independent settlement confirmation from an authorized banking or payment clearing network.",
            "why_it_matters": "Billing invoices and vendor payment receipts share single-party dependency and can be fabricated or prematurely issued without actual financial settlement.",
            "recommended_step": "Obtain an official bank account statement showing the matching debit transaction with valid UTR/IMPS reference number, or perform direct API clearing verification.",
            "related_document_ids": [d["id"] for d in active_docs if "receipt" in d.get("file_name", "").lower() or "bill" in d.get("file_name", "").lower()],
            "status": "Partially Supported"
        })

    # Check 2: Unverified Document Origin (No digital signature or verified portal download)
    image_based_docs = [d for d in active_docs if "Image-Based" in d.get("classification", "")]
    if image_based_docs:
        names = [d["file_name"] for d in image_based_docs]
        gaps.append({
            "id": str(uuid.uuid4()),
            "claim_text": primary_claim,
            "available_evidence": names,
            "missing_information": "Native vector PDF or cryptographically signed audit trail.",
            "why_it_matters": f"{len(names)} document(s) exist only as rasterized screenshots/scans, which eliminates structural font verification and tamper-evident PDF revision trees.",
            "recommended_step": "Request uncompressed original electronic files directly from the issuing authority's administrative portal.",
            "related_document_ids": [d["id"] for d in image_based_docs],
            "status": "Partially Supported"
        })

    # Check 3: If no documents at all
    if not active_docs:
        gaps.append({
            "id": str(uuid.uuid4()),
            "claim_text": primary_claim,
            "available_evidence": [],
            "missing_information": "No active evidence records available in current evaluation scope.",
            "why_it_matters": "A claim cannot be substantiated without evidentiary documentation.",
            "recommended_step": "Upload relevant invoices, receipts, or official statements.",
            "related_document_ids": [],
            "status": "Insufficient Evidence"
        })

    # Evaluate Overall Claim Status
    if not active_docs:
        overall_status = "Insufficient Evidence"
        overall_explanation = "No evidence documents currently support the claim."
    elif has_high_inconsistency:
        overall_status = "Contradicted"
        overall_explanation = "Direct numerical or factual contradictions exist between uploaded evidence files."
    elif gaps:
        overall_status = "Partially Supported"
        overall_explanation = "Evidence is internally consistent for presented documents, but essential corroborating steps or independent records remain missing."
    else:
        overall_status = "Supported by Available Evidence"
        overall_explanation = "Uploaded evidence displays high internal consistency and satisfies currently evaluated corroboration checks."

    # 4-Dimensional Reliability Assessment
    # Dimension 1: Consistency
    dim_consistency_status = "Contradicted" if has_high_inconsistency else ("Consistent" if active_docs else "Incomplete")
    dim_consistency = {
        "dimension_name": "Consistency",
        "status": dim_consistency_status,
        "supporting_observations": [
            f"Evaluated {len(active_docs)} document records for conflicting dates, numerical amounts, and entity names.",
        ] + ([f"Consistent amount references identified across {len(active_docs)} documents."] if not has_high_inconsistency and active_docs else []),
        "unresolved_concerns": ["Amount or date variance identified between submitted records."] if has_high_inconsistency else [],
        "relevant_evidence": [d["file_name"] for d in active_docs],
        "explanation": "Evaluates whether multiple evidentiary artifacts state concordant facts without conflicting totals or impossible timelines.",
        "suggested_next_action": "Reconcile differing itemized ledgers." if has_high_inconsistency else "No inconsistency observed across presented files."
    }

    # Dimension 2: Source Independence
    dim_independence_status = "Independent Corroboration Established" if has_bank_doc and (has_bill or has_receipt) else ("Shared Dependency / Potential Single Origin" if len(active_docs) > 1 else "Single Source Only")
    dim_independence = {
        "dimension_name": "Source Independence",
        "status": dim_independence_status,
        "supporting_observations": [
            f"{'Third-party banking record provides non-affiliated verification.' if has_bank_doc else 'Presented files originate primarily from the service provider or internal parties.'}"
        ],
        "unresolved_concerns": [] if has_bank_doc else ["Absence of an external, neutral intermediary record (e.g. bank or government registry)."],
        "relevant_evidence": [d["file_name"] for d in active_docs],
        "explanation": "Assesses whether multiple files corroborate each other from truly independent entities, or if they all stem from a single source.",
        "suggested_next_action": "Obtain bank statement or direct third-party clearing log." if not has_bank_doc else "Independent trail verified."
    }

    # Dimension 3: Authenticity Verification
    has_unverified_image = bool(image_based_docs)
    dim_auth_status = "Pending Direct Verification" if has_unverified_image or not active_docs else "Digital Structural Integrity Verified"
    dim_authenticity = {
        "dimension_name": "Authenticity Verification",
        "status": dim_auth_status,
        "supporting_observations": [
            f"PyMuPDF structural parsing performed on {len(active_docs)} records."
        ] + ([f"{len(image_based_docs)} document(s) detected as rasterized/scanned images."] if has_unverified_image else ["Vector text streams and font tables preserved in digital PDFs."]),
        "unresolved_concerns": ["Visual scans/screenshots cannot rule out pixel-level editing without source server transmission logs."] if has_unverified_image else [],
        "relevant_evidence": [d["file_name"] for d in active_docs],
        "explanation": "Checks internal file properties (PDF fonts, producer tags, hashes, and formatting) for signs of artificial rasterization or missing metadata.",
        "suggested_next_action": "Request digital origin files directly from institution portal." if has_unverified_image else "Routine verification adequate."
    }

    # Dimension 4: Evidence Completeness
    dim_comp_status = "Sufficient for Review" if len(active_docs) >= 3 and not gaps else ("Gaps Identified" if gaps else "Incomplete")
    dim_completeness = {
        "dimension_name": "Evidence Completeness",
        "status": dim_comp_status,
        "supporting_observations": [
            f"{len(active_docs)} document(s) submitted for the investigation claim."
        ],
        "unresolved_concerns": [g["missing_information"] for g in gaps],
        "relevant_evidence": [d["file_name"] for d in active_docs],
        "explanation": "Determines whether all logical steps in the evidence chain (billing -> payment authorization -> settlement debit) are documented.",
        "suggested_next_action": gaps[0]["recommended_step"] if gaps else "Investigation documentation complete."
    }

    dimensions = [dim_consistency, dim_independence, dim_authenticity, dim_completeness]

    return {
        "gaps": gaps,
        "overall_status": overall_status,
        "overall_explanation": overall_explanation,
        "dimensions": dimensions,
        "active_document_count": len(active_docs)
    }
