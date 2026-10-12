from typing import List, Dict, Any

def compare_analysis_versions(
    version_base: Dict[str, Any],
    version_target: Dict[str, Any]
) -> Dict[str, Any]:
    base_num = version_base.get("version_number", 1)
    target_num = version_target.get("version_number", 2)

    base_doc_ids = set(version_base.get("document_ids", []))
    target_doc_ids = set(version_target.get("document_ids", []))

    added_doc_ids = list(target_doc_ids - base_doc_ids)
    removed_doc_ids = list(base_doc_ids - target_doc_ids)

    base_findings = {f["id"]: f for f in version_base.get("findings_state", [])}
    target_findings = {f["id"]: f for f in version_target.get("findings_state", [])}

    new_findings = [f for fid, f in target_findings.items() if fid not in base_findings]
    resolved_findings = [f for fid, f in base_findings.items() if fid not in target_findings]

    new_contradictions = [
        f for f in new_findings
        if f.get("category") == "Inconsistency" or f.get("severity") == "High"
    ]

    # Evaluate claim transitions
    base_claims = {c.get("id"): c for c in version_base.get("claims_state", [])}
    target_claims = {c.get("id"): c for c in version_target.get("claims_state", [])}

    newly_supported_claims = []
    claims_requiring_review = []

    for cid, t_claim in target_claims.items():
        b_claim = base_claims.get(cid)
        t_status = t_claim.get("status", "")
        b_status = b_claim.get("status", "") if b_claim else "None"

        if t_status == "Supported by Available Evidence" and b_status != "Supported by Available Evidence":
            newly_supported_claims.append(t_claim.get("claim_text", "Primary Claim"))
        elif t_status in ["Contradicted", "Partially Supported", "Review Required"]:
            claims_requiring_review.append(t_claim.get("claim_text", "Primary Claim"))

    changed_relationships = []
    if added_doc_ids:
        changed_relationships.append({
            "type": "NEW_DOCUMENTS_INTEGRATED",
            "count": len(added_doc_ids),
            "description": f"Added {len(added_doc_ids)} new evidentiary record(s) into the provenance knowledge graph."
        })
    if new_contradictions:
        changed_relationships.append({
            "type": "NEW_CONTRADICTIONS_EMERGED",
            "count": len(new_contradictions),
            "description": f"Detected {len(new_contradictions)} new contradiction(s) introduced by recently uploaded documents."
        })

    summary = (
        f"Comparison between Version {base_num} and Version {target_num}: "
        f"{len(added_doc_ids)} document(s) added, {len(new_findings)} new finding(s) discovered, "
        f"{len(resolved_findings)} previous finding(s) addressed."
    )

    return {
        "investigation_id": version_target.get("investigation_id", ""),
        "base_version": base_num,
        "target_version": target_num,
        "documents_added": added_doc_ids,
        "documents_removed": removed_doc_ids,
        "new_findings": new_findings,
        "resolved_findings": resolved_findings,
        "new_contradictions": new_contradictions,
        "newly_supported_claims": newly_supported_claims,
        "claims_requiring_review": claims_requiring_review,
        "changed_relationships": changed_relationships,
        "summary": summary
    }
