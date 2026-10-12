import uuid
import os
import shutil
from datetime import datetime
from typing import List, Optional
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response, Query
from fastapi.responses import FileResponse

from app.config import UPLOAD_DIR
from app.services.storage import db
from app.services.pdf_analyzer import analyze_pdf_document, compute_file_sha256
from app.services.extractor import extract_structured_fields
from app.services.comparison import run_cross_document_comparison
from app.services.graph_builder import build_provenance_graph
from app.services.gap_finder import evaluate_evidence_gaps_and_dimensions
from app.services.time_machine import run_time_machine_simulation
from app.services.versioning import compare_analysis_versions
from app.services.report_generator import generate_pdf_report
from app.services.llm_service import get_llm_status
from app.services.demo_case import seed_demonstration_investigation, DEMO_INV_ID

from app.models.schemas import (
    InvestigationCreate, InvestigationModel, DocumentModel, FindingModel,
    ProvenanceGraphResponse, EvidenceGapItem, SimulationRequest, SimulationResponse,
    VersionComparisonResponse, AuditActionModel
)

router = APIRouter()

# --- DEMO SEEDING / RESET ---
@router.post("/demo/reset")
def reset_demo_case():
    inv = seed_demonstration_investigation(force_reset=True)
    return {"message": "Demonstration investigation re-seeded successfully.", "investigation": inv}

@router.get("/llm/status")
def check_llm_status():
    return get_llm_status()

# --- INVESTIGATIONS ---
@router.get("/investigations")
def list_investigations(search: Optional[str] = None, category: Optional[str] = None, status: Optional[str] = None):
    # Ensure demo exists
    seed_demonstration_investigation(force_reset=False)
    invs = db.get_investigations()
    
    if search:
        s_low = search.lower()
        invs = [i for i in invs if s_low in i.get("name", "").lower() or s_low in i.get("case_reference", "").lower() or s_low in i.get("primary_claim", "").lower()]
    if category and category != "All":
        invs = [i for i in invs if i.get("category") == category]
    if status and status != "All":
        invs = [i for i in invs if i.get("status") == status]
        
    return invs

@router.post("/investigations")
def create_investigation(data: InvestigationCreate):
    inv_id = f"inv-{uuid.uuid4().hex[:10]}"
    now = datetime.utcnow().isoformat()
    new_inv = {
        "id": inv_id,
        "name": data.name,
        "description": data.description,
        "case_reference": data.case_reference or f"REF-{uuid.uuid4().hex[:6].upper()}",
        "category": data.category,
        "primary_claim": data.primary_claim,
        "creator": "Lead Investigator",
        "created_at": now,
        "updated_at": now,
        "current_version": 1,
        "status": "Not Analyzed",
        "reviewer_notes": data.reviewer_notes or "",
        "document_count": 0,
        "findings_count": 0,
        "is_demo": False
    }
    db.save_investigation(new_inv)
    
    db.log_audit_action({
        "id": str(uuid.uuid4()),
        "investigation_id": inv_id,
        "timestamp": now,
        "reviewer": "Lead Investigator",
        "action_type": "investigation_created",
        "description": f"Created new investigation '{data.name}' with claim: '{data.primary_claim}'.",
        "metadata": {"category": data.category}
    })
    return new_inv

@router.get("/investigations/{inv_id}")
def get_investigation(inv_id: str):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return inv

@router.delete("/investigations/{inv_id}")
def delete_investigation(inv_id: str):
    db.delete_investigation(inv_id)
    return {"message": "Investigation deleted successfully."}

# --- EVIDENCE DOCUMENTS ---
@router.get("/investigations/{inv_id}/documents")
def get_investigation_documents(inv_id: str):
    return db.get_documents(inv_id)

@router.post("/investigations/{inv_id}/documents")
async def upload_investigation_documents(
    inv_id: str,
    files: List[UploadFile] = File(...),
    category: Optional[str] = Form("Unknown / Needs Review"),
    issuing_organization: Optional[str] = Form(""),
    source_name: Optional[str] = Form(""),
    reviewer_notes: Optional[str] = Form("")
):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    saved_docs = []
    inv_dir = UPLOAD_DIR / inv_id
    inv_dir.mkdir(parents=True, exist_ok=True)

    for upload in files:
        doc_id = f"doc-{uuid.uuid4().hex[:10]}"
        dest_path = inv_dir / f"{doc_id}_{upload.filename}"
        
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(upload.file, buffer)

        f_size = os.path.getsize(dest_path)
        ext = dest_path.suffix.lstrip(".").lower()
        now = datetime.utcnow().isoformat()

        if ext == "pdf":
            analysis_res = analyze_pdf_document(dest_path)
            meta = analysis_res["metadata"]
            classif = analysis_res["classification"]
            extracted_txt = analysis_res["extracted_text"]
        else:
            with open(dest_path, "r", encoding="utf-8", errors="ignore") as tf:
                extracted_txt = tf.read()
            f_hash = compute_file_sha256(dest_path)
            meta = {
                "creation_date": now,
                "modification_date": now,
                "author": None,
                "creator": "Uploaded Raw Document",
                "producer": None,
                "page_count": 1,
                "pdf_version": None,
                "file_size_bytes": f_size,
                "file_hash": f_hash,
                "completeness_score": 0.5,
                "has_digital_signatures": False,
                "font_count": 0,
                "embedded_images_count": 0,
                "is_encrypted": False,
            }
            classif = "Image / Scanned File" if ext in ["png", "jpg", "jpeg"] else "Text Record"

        fields = extract_structured_fields(extracted_txt)

        doc_item = {
            "id": doc_id,
            "investigation_id": inv_id,
            "file_name": upload.filename,
            "file_type": ext,
            "file_size": f_size,
            "file_hash": meta.get("file_hash", ""),
            "file_path": str(dest_path),
            "category": category or "Unknown / Needs Review",
            "classification": classif,
            "metadata": meta,
            "extracted_text": extracted_txt,
            "extracted_fields": fields,
            "source_details": {
                "issuing_organization": issuing_organization or "",
                "source_name": source_name or "Uploaded Evidence",
                "date_received": now[:10],
                "original_source_url": "",
                "reviewer_notes": reviewer_notes or ""
            },
            "processing_status": "analyzed",
            "upload_timestamp": now,
            "reviewer_notes": ""
        }
        db.save_document(doc_item)
        saved_docs.append(doc_item)

        # Audit log for upload
        db.log_audit_action({
            "id": str(uuid.uuid4()),
            "investigation_id": inv_id,
            "timestamp": now,
            "reviewer": "Investigator",
            "action_type": "document_upload",
            "description": f"Uploaded evidence file '{upload.filename}' ({f_size:,} bytes, classification: {classif}).",
            "metadata": {"doc_id": doc_id, "file_name": upload.filename}
        })

    # Update investigation doc count
    all_docs = db.get_documents(inv_id)
    inv["document_count"] = len(all_docs)
    inv["updated_at"] = datetime.utcnow().isoformat()
    db.save_investigation(inv)

    return {"uploaded_count": len(saved_docs), "documents": saved_docs}

@router.get("/documents/{doc_id}")
def get_single_document(doc_id: str):
    doc = db.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.get("/documents/{doc_id}/download")
def download_document(doc_id: str):
    doc = db.get_document(doc_id)
    if not doc or not os.path.exists(doc.get("file_path", "")):
        raise HTTPException(status_code=404, detail="Document file not found on disk")
    return FileResponse(doc["file_path"], filename=doc["file_name"])

@router.patch("/documents/{doc_id}")
def update_document_details(doc_id: str, updates: dict):
    doc = db.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    old_cat = doc.get("category")
    doc.update(updates)
    db.save_document(doc)

    db.log_audit_action({
        "id": str(uuid.uuid4()),
        "investigation_id": doc.get("investigation_id"),
        "timestamp": datetime.utcnow().isoformat(),
        "reviewer": "Investigator",
        "action_type": "field_correction",
        "description": f"Updated metadata/category for '{doc['file_name']}' from '{old_cat}' to '{doc.get('category')}'.",
        "metadata": {"doc_id": doc_id, "updates": list(updates.keys())}
    })
    return doc

# --- ANALYSIS ENGINE & CROSS-DOCUMENT COMPARISON ---
@router.post("/investigations/{inv_id}/analyze")
def run_investigation_analysis(inv_id: str):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    docs = db.get_documents(inv_id)
    findings = run_cross_document_comparison(inv_id, docs, inv.get("primary_claim", ""))
    db.save_findings(inv_id, findings)

    # Evaluate Gaps & Reliability
    gap_eval = evaluate_evidence_gaps_and_dimensions(inv, docs, findings)
    
    # Update investigation status
    inv["status"] = "Review Required" if findings or gap_eval["gaps"] else "Analysis Complete"
    inv["findings_count"] = len(findings)
    inv["document_count"] = len(docs)
    inv["updated_at"] = datetime.utcnow().isoformat()
    db.save_investigation(inv)

    db.log_audit_action({
        "id": str(uuid.uuid4()),
        "investigation_id": inv_id,
        "timestamp": datetime.utcnow().isoformat(),
        "reviewer": "Investigator",
        "action_type": "analysis_run",
        "description": f"Analysis executed across {len(docs)} documents. Discovered {len(findings)} findings and {len(gap_eval['gaps'])} evidence gaps.",
        "metadata": {"findings_count": len(findings), "status": inv["status"]}
    })

    return {
        "status": inv["status"],
        "document_count": len(docs),
        "findings_count": len(findings),
        "findings": findings,
        "gap_evaluation": gap_eval
    }

@router.get("/investigations/{inv_id}/results")
def get_investigation_results(inv_id: str):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    docs = db.get_documents(inv_id)
    findings = db.get_findings(inv_id)
    gap_eval = evaluate_evidence_gaps_and_dimensions(inv, docs, findings)

    return {
        "investigation": inv,
        "documents": docs,
        "findings": findings,
        "gap_evaluation": gap_eval
    }

# --- PROVENANCE GRAPH ---
@router.get("/investigations/{inv_id}/graph")
def get_provenance_graph(inv_id: str):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    docs = db.get_documents(inv_id)
    findings = db.get_findings(inv_id)
    claims = db.get_claims(inv_id)

    graph_data = build_provenance_graph(
        investigation_id=inv_id,
        investigation=inv,
        documents=docs,
        findings=findings,
        claims=claims
    )
    return graph_data

# --- EVIDENCE GAP FINDER ---
@router.get("/investigations/{inv_id}/gaps")
def get_evidence_gaps(inv_id: str):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    docs = db.get_documents(inv_id)
    findings = db.get_findings(inv_id)
    return evaluate_evidence_gaps_and_dimensions(inv, docs, findings)

# --- EVIDENCE TIME MACHINE (SIMULATE REMOVAL) ---
@router.post("/investigations/{inv_id}/simulate-removal")
def simulate_evidence_removal(inv_id: str, req: SimulationRequest):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    docs = db.get_documents(inv_id)
    findings = db.get_findings(inv_id)
    claims = db.get_claims(inv_id)

    res = run_time_machine_simulation(
        investigation=inv,
        all_documents=docs,
        all_findings=findings,
        all_claims=claims,
        excluded_doc_ids=req.excluded_document_ids
    )

    db.log_audit_action({
        "id": str(uuid.uuid4()),
        "investigation_id": inv_id,
        "timestamp": datetime.utcnow().isoformat(),
        "reviewer": "Investigator",
        "action_type": "simulation_run",
        "description": f"Evidence Time Machine simulated removal of {len(req.excluded_document_ids)} document(s): {', '.join(res['excluded_document_names'])}.",
        "metadata": {"excluded_ids": req.excluded_document_ids}
    })

    return res

# --- VERSIONED ANALYSIS & COMPARISON ---
@router.post("/investigations/{inv_id}/reanalyze")
def create_new_analysis_version(inv_id: str):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    docs = db.get_documents(inv_id)
    findings = run_cross_document_comparison(inv_id, docs, inv.get("primary_claim", ""))
    db.save_findings(inv_id, findings)

    gap_eval = evaluate_evidence_gaps_and_dimensions(inv, docs, findings)

    new_version_num = inv.get("current_version", 1) + 1
    inv["current_version"] = new_version_num
    inv["status"] = "Review Required" if findings or gap_eval["gaps"] else "Analysis Complete"
    inv["findings_count"] = len(findings)
    inv["document_count"] = len(docs)
    inv["updated_at"] = datetime.utcnow().isoformat()
    db.save_investigation(inv)

    version_snapshot = {
        "version_number": new_version_num,
        "investigation_id": inv_id,
        "timestamp": datetime.utcnow().isoformat(),
        "document_ids": [d["id"] for d in docs],
        "document_count": len(docs),
        "findings_count": len(findings),
        "summary": f"Version {new_version_num} generated with {len(docs)} documents and {len(findings)} findings.",
        "claims_state": [{"id": f"claim_{inv_id}", "claim_text": inv["primary_claim"], "status": gap_eval["overall_status"]}],
        "findings_state": findings
    }
    db.save_version(inv_id, version_snapshot)

    db.log_audit_action({
        "id": str(uuid.uuid4()),
        "investigation_id": inv_id,
        "timestamp": datetime.utcnow().isoformat(),
        "reviewer": "Investigator",
        "action_type": "reanalysis",
        "description": f"Created Analysis Version {new_version_num} incorporating updated evidence collection.",
        "metadata": {"version": new_version_num}
    })

    return {"message": f"Version {new_version_num} created successfully.", "version": version_snapshot}

@router.get("/investigations/{inv_id}/versions")
def get_investigation_versions(inv_id: str):
    return db.get_versions(inv_id)

@router.get("/investigations/{inv_id}/compare")
def compare_versions(
    inv_id: str,
    base_version: int = Query(1),
    target_version: int = Query(2)
):
    versions = db.get_versions(inv_id)
    v_base = next((v for v in versions if v["version_number"] == base_version), None)
    v_target = next((v for v in versions if v["version_number"] == target_version), None)

    if not v_base or not v_target:
        # If versions list is incomplete, fallback with current state
        docs = db.get_documents(inv_id)
        findings = db.get_findings(inv_id)
        if not v_base:
            v_base = {
                "version_number": 1,
                "investigation_id": inv_id,
                "document_ids": [d["id"] for d in docs[:max(1, len(docs)-1)]],
                "findings_state": findings[:max(1, len(findings)-1)]
            }
        if not v_target:
            v_target = {
                "version_number": 2,
                "investigation_id": inv_id,
                "document_ids": [d["id"] for d in docs],
                "findings_state": findings
            }

    return compare_analysis_versions(v_base, v_target)

# --- HUMAN REVIEW OF FINDINGS ---
@router.patch("/investigations/{inv_id}/findings/{finding_id}")
def update_finding_status(inv_id: str, finding_id: str, updates: dict):
    updated = db.update_finding(inv_id, finding_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Finding not found")

    db.log_audit_action({
        "id": str(uuid.uuid4()),
        "investigation_id": inv_id,
        "timestamp": datetime.utcnow().isoformat(),
        "reviewer": "Investigator",
        "action_type": "finding_status_change",
        "description": f"Finding {updated.get('finding_id', finding_id)} changed to status '{updates.get('reviewer_status')}' (Notes: '{updates.get('reviewer_notes', '')}').",
        "metadata": {"finding_id": finding_id, "new_status": updates.get("reviewer_status")}
    })
    return updated

# --- AUDIT TRAIL ---
@router.get("/investigations/{inv_id}/audit")
def get_investigation_audit_log(inv_id: str):
    return db.get_audit_actions(inv_id)

# --- INVESTIGATION REPORT (PREVIEW & PDF EXPORT) ---
@router.get("/investigations/{inv_id}/report")
def get_report_preview(inv_id: str):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    docs = db.get_documents(inv_id)
    findings = db.get_findings(inv_id)
    gap_eval = evaluate_evidence_gaps_and_dimensions(inv, docs, findings)

    return {
        "investigation": inv,
        "documents": docs,
        "findings": findings,
        "gap_evaluation": gap_eval,
        "generated_at": datetime.utcnow().isoformat()
    }

@router.get("/investigations/{inv_id}/report/pdf")
def download_pdf_report(inv_id: str):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")

    docs = db.get_documents(inv_id)
    findings = db.get_findings(inv_id)
    gap_eval = evaluate_evidence_gaps_and_dimensions(inv, docs, findings)

    pdf_bytes = generate_pdf_report(
        investigation=inv,
        documents=docs,
        findings=findings,
        claims=[{"claim_text": inv["primary_claim"]}],
        gaps=gap_eval["gaps"],
        dimensions=gap_eval["dimensions"]
    )

    db.log_audit_action({
        "id": str(uuid.uuid4()),
        "investigation_id": inv_id,
        "timestamp": datetime.utcnow().isoformat(),
        "reviewer": "Investigator",
        "action_type": "report_exported",
        "description": f"Generated and exported official PDF forensic verification report.",
        "metadata": {"format": "PDF"}
    })

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=TrustTrace_{inv.get('case_reference', 'Report')}_Verification.pdf"
        }
    )

# --- SETTINGS ---
@router.get("/settings")
def get_app_settings():
    return db.get_settings()

@router.post("/settings")
def save_app_settings(settings: dict):
    db.save_settings(settings)
    return {"message": "Settings updated successfully."}
