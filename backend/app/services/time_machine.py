from typing import List, Dict, Any
from app.services.gap_finder import evaluate_evidence_gaps_and_dimensions
from app.services.graph_builder import build_provenance_graph

def run_time_machine_simulation(
    investigation: Dict[str, Any],
    all_documents: List[Dict[str, Any]],
    all_findings: List[Dict[str, Any]],
    all_claims: List[Dict[str, Any]],
    excluded_doc_ids: List[str]
) -> Dict[str, Any]:
    # 1. Base assessment (all documents)
    base_eval = evaluate_evidence_gaps_and_dimensions(investigation, all_documents, all_findings, excluded_doc_ids=[])
    
    # 2. Simulated assessment (excluding specified doc IDs)
    sim_eval = evaluate_evidence_gaps_and_dimensions(investigation, all_documents, all_findings, excluded_doc_ids=excluded_doc_ids)

    excluded_names = [d["file_name"] for d in all_documents if d["id"] in excluded_doc_ids]
    primary_claim = investigation.get("primary_claim", "Primary Investigation Claim")

    # 3. Determine claims that lost support vs claims still supported
    claims_lost = []
    claims_still_supported = []

    if base_eval["overall_status"] != sim_eval["overall_status"]:
        claims_lost.append({
            "claim_text": primary_claim,
            "original_status": base_eval["overall_status"],
            "simulated_status": sim_eval["overall_status"],
            "reason": f"Excluding '{', '.join(excluded_names)}' shifts status from '{base_eval['overall_status']}' to '{sim_eval['overall_status']}'.",
            "impact": "High — corroborating link or inconsistency removed from chain."
        })
    else:
        claims_still_supported.append({
            "claim_text": primary_claim,
            "status": sim_eval["overall_status"],
            "notes": f"Claim status remains '{sim_eval['overall_status']}' based on remaining {sim_eval['active_document_count']} document(s)."
        })

    # 4. Affected Relationships (Edges removed or changed)
    affected_relationships = []
    for did in excluded_doc_ids:
        doc_obj = next((d for d in all_documents if d["id"] == did), None)
        doc_name = doc_obj["file_name"] if doc_obj else did
        affected_relationships.append({
            "source": doc_name,
            "target": "Primary Claim",
            "previous_edge": "SUPPORTS / CONTRADICTS",
            "simulated_edge": "EXCLUDED",
            "details": f"Direct evidential edge from {doc_name} severed in simulation graph."
        })

    # 5. Recommended Next Checks
    recommended_checks = []
    if sim_eval["overall_status"] == "Insufficient Evidence":
        recommended_checks.append("With this document removed, no corroboration remains. Independent primary records must be acquired.")
    elif "Contradicted" in base_eval["overall_status"] and "Contradicted" not in sim_eval["overall_status"]:
        recommended_checks.append(f"Exclusion of '{', '.join(excluded_names)}' resolved the primary contradiction! Investigator should forensically examine this specific file for tampering.")
    else:
        recommended_checks.append("Verify whether the remaining documents alone meet the statutory or audit threshold for claim substantiation.")
    
    recommended_checks.append("Check if issuing entity can furnish digital transaction certificates or certified duplicates.")

    # 6. Build the Simulated Graph
    simulated_graph = build_provenance_graph(
        investigation_id=investigation["id"],
        investigation=investigation,
        documents=all_documents,
        findings=all_findings,
        claims=all_claims,
        excluded_doc_ids=excluded_doc_ids
    )

    return {
        "excluded_document_ids": excluded_doc_ids,
        "excluded_document_names": excluded_names,
        "claims_that_lost_support": claims_lost,
        "claims_still_supported": claims_still_supported,
        "affected_relationships": affected_relationships,
        "recommended_next_checks": recommended_checks,
        "simulated_graph": simulated_graph,
        "original_status": base_eval["overall_status"],
        "simulated_status": sim_eval["overall_status"]
    }
