import pytest
from app.services.graph_builder import build_provenance_graph
from app.services.timeline_service import build_chronological_timeline

def test_provenance_graph_edge_handles():
    inv = {
        "id": "inv_graph_test",
        "name": "Graph Builder Test",
        "primary_claim": "Inpatient treatment expense reimbursement"
    }
    docs = [
        {
            "id": "doc_bill",
            "file_name": "Hospital_Bill.pdf",
            "category": "Medical Document",
            "extracted_fields": {"amounts": [4000.0], "dates": ["2026-04-01"]},
            "source_details": {"source_name": "General Hospital"}
        }
    ]
    findings = [
        {
            "finding_id": "FIND-01",
            "category": "Amount Discrepancy",
            "explanation": "Amount mismatch detected",
            "severity": "CRITICAL",
            "documents_involved": ["doc_bill"]
        }
    ]

    graph = build_provenance_graph(inv, docs, findings)
    assert "nodes" in graph
    assert "edges" in graph
    assert len(graph["nodes"]) > 0
    assert len(graph["edges"]) > 0

    node_ids = {n["id"] for n in graph["nodes"]}

    # Verify all edges link to valid nodes and specify valid directional handles
    for edge in graph["edges"]:
        assert edge["source"] in node_ids, f"Edge source {edge['source']} not in nodes"
        assert edge["target"] in node_ids, f"Edge target {edge['target']} not in nodes"
        # Edge handles must be defined for proper React Flow routing
        assert "sourceHandle" in edge
        assert "targetHandle" in edge
        assert edge["sourceHandle"] is not None
        assert edge["targetHandle"] is not None

def test_timeline_chronological_ordering_and_conflict():
    inv = {
        "id": "inv_timeline_test",
        "name": "Timeline Inversion Test",
        "primary_claim": "Medical reimbursement"
    }
    # Anomaly: Payment receipt claims payment was made on March 1st, but Hospital Bill was generated on March 15th
    docs = [
        {
            "id": "doc_bill",
            "file_name": "Hospital_Bill.pdf",
            "category": "Medical Document",
            "upload_timestamp": "2026-03-20T10:00:00Z",
            "extracted_fields": {"dates": ["2026-03-15"]},
            "metadata": {"creation_date": "2026-03-15"}
        },
        {
            "id": "doc_receipt",
            "file_name": "Cashier_Receipt.pdf",
            "category": "Invoice or Receipt",
            "upload_timestamp": "2026-03-20T10:05:00Z",
            "extracted_fields": {"dates": ["2026-03-01"]},
            "metadata": {"creation_date": "2026-03-01"}
        }
    ]
    findings = []

    timeline = build_chronological_timeline(inv, docs, findings)
    assert "events" in timeline
    assert "conflicts" in timeline
    assert len(timeline["events"]) >= 2

    # Events must be sorted chronologically
    dates = [e["timestamp"] for e in timeline["events"]]
    assert dates == sorted(dates)

    # Inversion between receipt (earlier) and bill (later) should be detected in conflicts
    assert len(timeline["conflicts"]) >= 1
    conflict = timeline["conflicts"][0]
    assert "conflict_reason" in conflict
    assert "verification_recommendation" in conflict
