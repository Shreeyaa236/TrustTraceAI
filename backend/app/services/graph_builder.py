import networkx as nx
from typing import List, Dict, Any

def build_provenance_graph(
    investigation_id: str,
    investigation: Dict[str, Any],
    documents: List[Dict[str, Any]],
    findings: List[Dict[str, Any]],
    claims: List[Dict[str, Any]],
    excluded_doc_ids: List[str] = None
) -> Dict[str, Any]:
    if excluded_doc_ids is None:
        excluded_doc_ids = []

    active_docs = [d for d in documents if d["id"] not in excluded_doc_ids]
    active_doc_ids = set(d["id"] for d in active_docs)

    G = nx.DiGraph()

    nodes = []
    edges = []

    # Layout coordinate spacing parameters
    x_offset_claim = 450
    y_offset_claim = 60

    # 1. Add Claim Node(s)
    primary_claim_text = investigation.get("primary_claim", "Primary Claim Under Verification")
    claim_node_id = f"claim_{investigation_id}"
    G.add_node(claim_node_id, label=primary_claim_text, node_type="claimNode")
    nodes.append({
        "id": claim_node_id,
        "type": "claimNode",
        "data": {
            "id": claim_node_id,
            "label": primary_claim_text,
            "title": "Primary Investigation Claim",
            "type": "claimNode",
            "status": investigation.get("status", "Review Required"),
            "category": investigation.get("category", "General"),
            "connected_count": len(active_docs),
            "claim_text": primary_claim_text,
            "description": investigation.get("description", ""),
        },
        "position": {"x": x_offset_claim, "y": y_offset_claim}
    })

    # 2. Add Document Nodes
    doc_y = 240
    doc_start_x = max(50, 450 - ((len(active_docs) - 1) * 160))
    doc_node_ids = {}

    for idx, doc in enumerate(active_docs):
        doc_id = doc["id"]
        d_node_id = f"doc_{doc_id}"
        doc_node_ids[doc_id] = d_node_id

        pos_x = doc_start_x + (idx * 320)
        pos_y = doc_y + ((idx % 2) * 50)  # slight stagger for visual clarity

        G.add_node(d_node_id, label=doc["file_name"], node_type="documentNode")
        nodes.append({
            "id": d_node_id,
            "type": "documentNode",
            "data": {
                "id": doc_id,
                "label": doc["file_name"],
                "type": "documentNode",
                "file_name": doc["file_name"],
                "category": doc.get("category", "Unknown"),
                "classification": doc.get("classification", "Unable to Determine"),
                "file_size": doc.get("file_size", 0),
                "file_hash": doc.get("file_hash", ""),
                "completeness": doc.get("metadata", {}).get("completeness_score", 0),
                "extracted_amounts": doc.get("extracted_fields", {}).get("amounts", []),
                "extracted_dates": doc.get("extracted_fields", {}).get("dates", []),
                "issuing_org": doc.get("source_details", {}).get("issuing_organization") or "Not Specified",
            },
            "position": {"x": pos_x, "y": pos_y}
        })

        # Edge from Document to Primary Claim
        edge_id = f"edge_doc_claim_{doc_id}"
        edge_label = "SUPPORTS"
        # If document has high contradiction finding, mark CONTRADICTS
        has_contradiction = any(
            f.get("severity") == "High" and doc_id in f.get("affected_document_ids", [])
            for f in findings
        )
        if has_contradiction:
            edge_label = "CONTRADICTS"

        G.add_edge(d_node_id, claim_node_id, label=edge_label)
        edges.append({
            "id": edge_id,
            "source": d_node_id,
            "target": claim_node_id,
            "label": edge_label,
            "animated": edge_label == "CONTRADICTS",
            "style": {
                "stroke": "#991B1B" if edge_label == "CONTRADICTS" else "#2D5A3A",
                "strokeWidth": 2.5
            },
            "data": {
                "relationship": edge_label,
                "explanation": f"{doc['file_name']} {edge_label.lower()} the primary claim."
            }
        })

    # 3. Add Fact Nodes (Amounts / References extracted from documents)
    fact_y = 480
    fact_counter = 0
    added_facts = set()

    for idx, doc in enumerate(active_docs):
        d_node_id = doc_node_ids[doc["id"]]
        amts = doc.get("extracted_fields", {}).get("amounts", [])
        refs = doc.get("extracted_fields", {}).get("document_numbers", []) + doc.get("extracted_fields", {}).get("reference_ids", [])

        # Take first amount if any
        if amts and amts[0] not in added_facts:
            amt_val = amts[0]
            added_facts.add(amt_val)
            f_node_id = f"fact_amt_{fact_counter}"
            fact_counter += 1

            pos_x = doc_start_x + (idx * 280) - 40
            pos_y = fact_y

            G.add_node(f_node_id, label=amt_val, node_type="factNode")
            nodes.append({
                "id": f_node_id,
                "type": "factNode",
                "data": {
                    "id": f_node_id,
                    "label": f"Amount: {amt_val}",
                    "type": "factNode",
                    "fact_type": "Financial Amount",
                    "value": amt_val,
                    "source_doc": doc["file_name"],
                },
                "position": {"x": pos_x, "y": pos_y}
            })

            edge_id = f"edge_doc_fact_{d_node_id}_{f_node_id}"
            G.add_edge(d_node_id, f_node_id, label="REFERENCES")
            edges.append({
                "id": edge_id,
                "source": d_node_id,
                "target": f_node_id,
                "label": "REFERENCES",
                "style": {"stroke": "#725541", "strokeDasharray": "4 4"},
                "data": {"relationship": "REFERENCES", "explanation": f"Document asserts recorded amount of {amt_val}."}
            })

    # 4. Add Source Nodes (Issuing Organizations / Channels)
    source_y = 620
    added_sources = set()
    source_counter = 0

    for idx, doc in enumerate(active_docs):
        d_node_id = doc_node_ids[doc["id"]]
        org = doc.get("source_details", {}).get("issuing_organization")
        if not org:
            orgs = doc.get("extracted_fields", {}).get("organizations", [])
            org = orgs[0] if orgs else None

        if org and org not in added_sources:
            added_sources.add(org)
            s_node_id = f"source_{source_counter}"
            source_counter += 1

            pos_x = doc_start_x + (idx * 300)
            pos_y = source_y

            G.add_node(s_node_id, label=org, node_type="sourceNode")
            nodes.append({
                "id": s_node_id,
                "type": "sourceNode",
                "data": {
                    "id": s_node_id,
                    "label": f"Issuer: {org}",
                    "type": "sourceNode",
                    "organization": org,
                    "verification_status": "Third-Party Unverified" if "Bank" not in org else "Institutional Entity",
                },
                "position": {"x": pos_x, "y": pos_y}
            })

            edge_id = f"edge_src_doc_{s_node_id}_{d_node_id}"
            G.add_edge(s_node_id, d_node_id, label="ISSUED_BY")
            edges.append({
                "id": edge_id,
                "source": s_node_id,
                "target": d_node_id,
                "label": "ISSUED_BY",
                "style": {"stroke": "#B8754D", "strokeWidth": 2},
                "data": {"relationship": "ISSUED_BY", "explanation": f"Evidence is attributed to issuing entity: {org}."}
            })

    # 5. Add Finding Nodes (for active documents)
    finding_y = 360
    finding_counter = 0

    for idx, f in enumerate(findings):
        aff_docs = [did for did in f.get("affected_document_ids", []) if did in active_doc_ids]
        if not aff_docs and f.get("affected_document_ids"):
            continue  # finding only applied to excluded documents!

        f_node_id = f"finding_{f['id']}"
        pos_x = 950 + ((finding_counter % 2) * 220)
        pos_y = 120 + (finding_counter * 140)
        finding_counter += 1

        G.add_node(f_node_id, label=f["finding_id"], node_type="findingNode")
        nodes.append({
            "id": f_node_id,
            "type": "findingNode",
            "data": {
                "id": f["id"],
                "finding_id": f["finding_id"],
                "label": f"{f['finding_id']}: {f['category']}",
                "type": "findingNode",
                "severity": f["severity"],
                "category": f["category"],
                "status": f.get("reviewer_status", "Open"),
                "explanation": f["explanation"],
            },
            "position": {"x": pos_x, "y": pos_y}
        })

        # Connect to affected active documents
        for did in aff_docs:
            d_node_id = doc_node_ids[did]
            edge_id = f"edge_finding_{f_node_id}_{d_node_id}"
            rel = "RELATES_TO"
            if f["severity"] == "High":
                rel = "CONTRADICTS"
            elif f["category"] == "Potential Duplicate":
                rel = "DUPLICATE_OR_SIMILAR_TO"
            elif f["category"] == "Potential Dependency":
                rel = "POSSIBLY_DERIVED_FROM"

            edges.append({
                "id": edge_id,
                "source": f_node_id,
                "target": d_node_id,
                "label": rel,
                "style": {"stroke": "#B91C1C" if f["severity"] == "High" else "#B45309"},
                "data": {"relationship": rel, "explanation": f["explanation"]}
            })

    # Calculate graph clusters and degree centrality using NetworkX
    clusters = []
    if len(G.nodes) > 0:
        try:
            undirected = G.to_undirected()
            components = list(nx.connected_components(undirected))
            for c_idx, comp in enumerate(components):
                clusters.append({
                    "cluster_id": c_idx + 1,
                    "node_count": len(comp),
                    "nodes": list(comp)
                })
        except Exception:
            clusters = []

    return {
        "nodes": nodes,
        "edges": edges,
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "clusters": clusters
    }
