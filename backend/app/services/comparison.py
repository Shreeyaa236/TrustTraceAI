import uuid
import re
from typing import List, Dict, Any

def normalize_amount_str(val: str) -> float:
    cleaned = re.sub(r'[^\d.]', '', val)
    try:
        return float(cleaned)
    except Exception:
        return 0.0

def run_cross_document_comparison(
    investigation_id: str,
    documents: List[Dict[str, Any]],
    primary_claim: str
) -> List[Dict[str, Any]]:
    findings = []
    finding_counter = 1

    if not documents:
        return findings

    # 1. Exact Duplicate File Hash Check
    hashes = {}
    for doc in documents:
        f_hash = doc.get("file_hash") or doc.get("metadata", {}).get("file_hash")
        if f_hash:
            hashes.setdefault(f_hash, []).append(doc)

    for f_hash, doc_list in hashes.items():
        if len(doc_list) > 1:
            names = [d["file_name"] for d in doc_list]
            doc_ids = [d["id"] for d in doc_list]
            findings.append({
                "id": str(uuid.uuid4()),
                "finding_id": f"FND-{finding_counter:03d}",
                "investigation_id": investigation_id,
                "category": "Potential Duplicate",
                "severity": "Medium",
                "affected_claim": primary_claim,
                "affected_document_ids": doc_ids,
                "exact_field_or_passage": f"SHA-256: {f_hash[:16]}...",
                "page_number": 1,
                "explanation": f"Identical cryptographic hashes detected across {len(doc_list)} files: {', '.join(names)}. They represent identical digital records.",
                "supporting_observations": [
                    f"SHA-256 collision probability is zero; byte-for-byte exact matches.",
                    f"Uploaded as separate evidence entries but sharing common origin."
                ],
                "suggested_verification_step": "Confirm whether duplicate files were submitted redundantly or represent independent submissions of the same document.",
                "reviewer_status": "Open",
                "reviewer_notes": ""
            })
            finding_counter += 1

    # 2. Amount Discrepancy & Consistency Checks
    doc_amounts = {}
    for doc in documents:
        extracted = doc.get("extracted_fields", {})
        amts = extracted.get("amounts", [])
        numeric_vals = [normalize_amount_str(a) for a in amts if normalize_amount_str(a) > 0]
        if numeric_vals:
            doc_amounts[doc["id"]] = {
                "name": doc["file_name"],
                "raw": amts,
                "max": max(numeric_vals),
                "all": numeric_vals
            }

    # If multiple documents have amounts, check if any conflict
    doc_ids_with_amt = list(doc_amounts.keys())
    for i in range(len(doc_ids_with_amt)):
        for j in range(i + 1, len(doc_ids_with_amt)):
            id_a, id_b = doc_ids_with_amt[i], doc_ids_with_amt[j]
            data_a, data_b = doc_amounts[id_a], doc_amounts[id_b]
            # Check if there is a primary amount mismatch
            diff = abs(data_a["max"] - data_b["max"])
            if diff > 1.0 and min(data_a["max"], data_b["max"]) > 100:
                findings.append({
                    "id": str(uuid.uuid4()),
                    "finding_id": f"FND-{finding_counter:03d}",
                    "investigation_id": investigation_id,
                    "category": "Inconsistency",
                    "severity": "High",
                    "affected_claim": primary_claim,
                    "affected_document_ids": [id_a, id_b],
                    "exact_field_or_passage": f"{data_a['name']} says {data_a['raw'][0]} vs {data_b['name']} says {data_b['raw'][0]}",
                    "page_number": 1,
                    "explanation": f"Amount discrepancy identified between '{data_a['name']}' ({data_a['raw'][0]}) and '{data_b['name']}' ({data_b['raw'][0]}).",
                    "supporting_observations": [
                        f"Numerical variance of {diff:,.2f} between major extracted financial figures.",
                        f"Requires reconciliation against primary transaction ledger or issuing accounting record."
                    ],
                    "suggested_verification_step": "Cross-reference the invoiced amount with the settlement bank account debit statement and authorized hospital fee schedule.",
                    "reviewer_status": "Open",
                    "reviewer_notes": ""
                })
                finding_counter += 1

    # 3. Document Representation Checks (Screenshot / Image-Based PDF)
    for doc in documents:
        classification = doc.get("classification", "")
        if "Image-Based" in classification:
            findings.append({
                "id": str(uuid.uuid4()),
                "finding_id": f"FND-{finding_counter:03d}",
                "investigation_id": investigation_id,
                "category": "Metadata Observation",
                "severity": "Low",
                "affected_claim": primary_claim,
                "affected_document_ids": [doc["id"]],
                "exact_field_or_passage": f"Rasterized Page Layout (Lack of Selectable Vector Text)",
                "page_number": 1,
                "explanation": f"Document '{doc['file_name']}' is classified as a '{classification}'. It lacks native font streams and appears to be a screenshot or scan converted into PDF.",
                "supporting_observations": [
                    "Native digital PDFs usually contain structured font streams and selectable vector glyphs.",
                    "Note: Image-based format does not automatically indicate manipulation, but limits direct digital forensics verification."
                ],
                "suggested_verification_step": "Request the original digital PDF export directly from the issuer portal, or request uncompressed source image with intact EXIF metadata.",
                "reviewer_status": "Open",
                "reviewer_notes": ""
            })
            finding_counter += 1

    # 4. Shared Dependency / Non-Independent Source Check
    org_map = {}
    for doc in documents:
        src = doc.get("source_details", {}).get("issuing_organization") or ""
        extracted_orgs = doc.get("extracted_fields", {}).get("organizations", [])
        combined_orgs = set([src] + extracted_orgs)
        for org in combined_orgs:
            if org and len(org) > 3:
                org_map.setdefault(org.lower().strip(), []).append(doc)

    for org_name, docs_with_org in org_map.items():
        if len(docs_with_org) >= 2:
            names = [d["file_name"] for d in docs_with_org]
            doc_ids = [d["id"] for d in docs_with_org]
            findings.append({
                "id": str(uuid.uuid4()),
                "finding_id": f"FND-{finding_counter:03d}",
                "investigation_id": investigation_id,
                "category": "Potential Dependency",
                "severity": "Low",
                "affected_claim": primary_claim,
                "affected_document_ids": doc_ids,
                "exact_field_or_passage": f"Organization: {org_name.title()}",
                "page_number": 1,
                "explanation": f"Multiple evidence items ({', '.join(names)}) originate from or reference the same entity '{org_name.title()}'.",
                "supporting_observations": [
                    "Documents share a single institutional origin, indicating they may not provide independent corroboration.",
                    "Evidence independence requires verification from a separate third-party institution (e.g. banking settlement network)."
                ],
                "suggested_verification_step": "Obtain independent third-party confirmation from a neutral entity not affiliated with the issuing organization.",
                "reviewer_status": "Open",
                "reviewer_notes": ""
            })
            finding_counter += 1
            break  # one finding for org dependency is sufficient

    # 5. Metadata Completeness Check
    for doc in documents:
        meta = doc.get("metadata", {})
        c_score = meta.get("completeness_score", 0.0)
        producer = meta.get("producer") or ""
        if c_score < 0.25 and doc.get("file_type") == "pdf":
            findings.append({
                "id": str(uuid.uuid4()),
                "finding_id": f"FND-{finding_counter:03d}",
                "investigation_id": investigation_id,
                "category": "Authenticity Verification Needed",
                "severity": "Medium",
                "affected_claim": primary_claim,
                "affected_document_ids": [doc["id"]],
                "exact_field_or_passage": f"Stripped / Minimal PDF Metadata (Completeness: {int(c_score * 100)}%)",
                "page_number": 1,
                "explanation": f"Document '{doc['file_name']}' exhibits stripped creation/producer metadata. Standard digital generation tools typically stamp author and rendering engine details.",
                "supporting_observations": [
                    f"Producer: {producer or 'None'}",
                    "Metadata may have been scrubbed by social messaging apps, editing software, or virtual print drivers."
                ],
                "suggested_verification_step": "Inquire about document transmission channel (e.g. WhatsApp, direct download, web portal) and obtain raw server delivery audit logs.",
                "reviewer_status": "Open",
                "reviewer_notes": ""
            })
            finding_counter += 1

    return findings
