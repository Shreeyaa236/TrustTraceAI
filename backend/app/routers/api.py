import uuid
import os
import json
import shutil
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response, Query, Depends, BackgroundTasks, status
from fastapi.responses import FileResponse

from app.config import UPLOAD_DIR
from app.services.storage import db
from app.services.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_optional_user
)
from app.services.pdf_analyzer import analyze_pdf_document, compute_file_sha256
from app.services.ocr_service import process_raw_image_file, get_ocr_status_info
from app.services.extractor import extract_structured_fields
from app.services.comparison import run_cross_document_comparison
from app.services.graph_builder import build_provenance_graph
from app.services.gap_finder import evaluate_evidence_gaps_and_dimensions
from app.services.time_machine import run_time_machine_simulation
from app.services.versioning import compare_analysis_versions
from app.services.report_generator import generate_pdf_report
from app.services.llm_service import (
    get_llm_status, explain_finding_with_ai, enrich_findings_with_ai, enrich_gaps_with_ai
)
from app.services.timeline_service import build_investigation_timeline
from app.services.demo_case import seed_demonstration_investigation, DEMO_INV_ID

from app.models.schemas import (
    InvestigationCreate, InvestigationModel, DocumentModel, FindingModel,
    ProvenanceGraphResponse, EvidenceGapItem, SimulationRequest, SimulationResponse,
    VersionComparisonResponse, AuditActionModel, UserRegister, UserLogin,
    UserResponse, TokenResponse, JobModel, TimelineResponse
)

logger = logging.getLogger("trusttrace.api")
router = APIRouter()

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB limit
ALLOWED_FILE_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "txt"}

def verify_investigation_access(inv: Dict[str, Any], user: Optional[Dict[str, Any]]) -> None:
    """Enforces multi-user ownership check: demo cases are public; custom cases require ownership."""
    if inv.get("is_demo") is True or inv.get("id") == DEMO_INV_ID:
        return
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to access private investigation.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    creator_id = inv.get("creator_id")
    if creator_id and creator_id != user.get("id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access or modify this investigation."
        )

# --- AUTHENTICATION ROUTES ---
@router.post("/auth/register", response_model=TokenResponse)
def register_user(data: UserRegister):
    clean_email = data.email.lower().strip()
    clean_username = data.username.lower().strip()

    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    if db.get_user_by_email(clean_email):
        raise HTTPException(status_code=400, detail="An account with this email address already exists.")

    if db.get_user_by_username(clean_username):
        raise HTTPException(status_code=400, detail="This username is already taken.")

    user_id = f"usr-{uuid.uuid4().hex[:10]}"
    now = datetime.utcnow().isoformat()
    new_user = {
        "id": user_id,
        "email": clean_email,
        "username": clean_username,
        "password_hash": hash_password(data.password),
        "full_name": data.full_name or data.username.title(),
        "role": "Lead Digital Forensics Reviewer",
        "created_at": now
    }
    db.save_user(new_user)

    token = create_access_token({"sub": user_id, "email": clean_email, "username": clean_username})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": clean_email,
            "username": clean_username,
            "full_name": new_user["full_name"],
            "role": new_user["role"],
            "created_at": now
        }
    }

@router.post("/auth/login", response_model=TokenResponse)
def login_user(data: UserLogin):
    clean_email = data.email.lower().strip()
    user = db.get_user_by_email(clean_email)
    if not user:
        # Also allow login with username
        user = db.get_user_by_username(clean_email)

    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token({"sub": user["id"], "email": user["email"], "username": user.get("username", "")})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "username": user.get("username", user["email"].split("@")[0]),
            "full_name": user.get("full_name", "Investigator"),
            "role": user.get("role", "Lead Digital Forensics Reviewer"),
            "created_at": user.get("created_at", "")
        }
    }

@router.get("/auth/me", response_model=UserResponse)
def get_current_user_profile(user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "id": user["id"],
        "email": user["email"],
        "username": user.get("username", ""),
        "full_name": user.get("full_name", "Investigator"),
        "role": user.get("role", "Lead Digital Forensics Reviewer"),
        "created_at": user.get("created_at", "")
    }

# --- SYSTEM & DIAGNOSTICS ---
@router.post("/demo/reset")
def reset_demo_case():
    inv = seed_demonstration_investigation(force_reset=True)
    return {"message": "Demonstration investigation re-seeded successfully.", "investigation": inv}

@router.get("/llm/status")
def check_llm_status():
    return get_llm_status()

@router.get("/ocr/status")
def check_ocr_status():
    return get_ocr_status_info()

# --- INVESTIGATIONS ---
@router.get("/investigations")
def list_investigations(
    search: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    seed_demonstration_investigation(force_reset=False)
    user_id = user["id"] if user else None
    invs = db.get_investigations(user_id=user_id)
    
    if search:
        s_low = search.lower()
        invs = [i for i in invs if s_low in i.get("name", "").lower() or s_low in i.get("case_reference", "").lower() or s_low in i.get("primary_claim", "").lower()]
    if category and category != "All":
        invs = [i for i in invs if i.get("category") == category]
    if status and status != "All":
        invs = [i for i in invs if i.get("status") == status]
        
    return invs

@router.post("/investigations")
def create_investigation(
    data: InvestigationCreate,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv_id = f"inv-{uuid.uuid4().hex[:10]}"
    now = datetime.utcnow().isoformat()
    creator_name = user.get("full_name", "Lead Investigator") if user else "Lead Investigator"
    creator_id = user["id"] if user else None
    creator_email = user.get("email") if user else None

    new_inv = {
        "id": inv_id,
        "name": data.name,
        "description": data.description,
        "case_reference": data.case_reference or f"REF-{uuid.uuid4().hex[:6].upper()}",
        "category": data.category,
        "primary_claim": data.primary_claim,
        "creator": creator_name,
        "creator_id": creator_id,
        "creator_email": creator_email,
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
        "reviewer": creator_name,
        "action_type": "investigation_created",
        "description": f"Created new investigation '{data.name}' with claim: '{data.primary_claim}'.",
        "metadata": {"category": data.category}
    })
    return new_inv

@router.get("/investigations/{inv_id}")
def get_investigation(
    inv_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    verify_investigation_access(inv, user)
    return inv

@router.delete("/investigations/{inv_id}")
def delete_investigation(
    inv_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    verify_investigation_access(inv, user)
    db.delete_investigation(inv_id)
    return {"message": "Investigation deleted successfully."}

# --- EVIDENCE DOCUMENTS & UPLOAD (TASK 2 & TASK 3) ---
@router.get("/investigations/{inv_id}/documents")
def get_investigation_documents(
    inv_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    verify_investigation_access(inv, user)
    return db.get_documents(inv_id)

@router.post("/investigations/{inv_id}/documents")
async def upload_investigation_documents(
    inv_id: str,
    files: List[UploadFile] = File(...),
    category: Optional[str] = Form("Unknown / Needs Review"),
    file_metadata: Optional[str] = Form(None),
    issuing_organization: Optional[str] = Form(""),
    source_name: Optional[str] = Form(""),
    reviewer_notes: Optional[str] = Form(""),
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    verify_investigation_access(inv, user)

    # Parse per-file metadata manifest if provided (Task 2 fix)
    metadata_map: Dict[str, Any] = {}
    if file_metadata:
        try:
            parsed = json.loads(file_metadata)
            if isinstance(parsed, list):
                for idx, item in enumerate(parsed):
                    if isinstance(item, dict):
                        fn = item.get("filename") or item.get("name")
                        if fn:
                            metadata_map[fn] = item
                        metadata_map[str(idx)] = item
            elif isinstance(parsed, dict):
                metadata_map = parsed
        except Exception as e:
            logger.warning(f"Could not parse file_metadata JSON: {e}")

    saved_docs = []
    inv_dir = UPLOAD_DIR / inv_id
    inv_dir.mkdir(parents=True, exist_ok=True)

    for idx, upload in enumerate(files):
        # 1. Validate file extension
        original_name = upload.filename or f"evidence_{idx}"
        ext = original_name.split(".")[-1].lower() if "." in original_name else ""
        if ext not in ALLOWED_FILE_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type for '{original_name}'. Supported formats: PDF, PNG, JPG, JPEG, TXT."
            )

        # 2. Extract per-file metadata assignment
        per_file = metadata_map.get(original_name) or metadata_map.get(str(idx)) or {}
        if isinstance(per_file, dict):
            doc_category = per_file.get("category") or category or "Unknown / Needs Review"
            doc_org = per_file.get("issuing_organization") or issuing_organization or ""
            doc_src = per_file.get("source_name") or source_name or "Uploaded Evidence"
            doc_notes = per_file.get("reviewer_notes") or reviewer_notes or ""
        else:
            doc_category = category or "Unknown / Needs Review"
            doc_org = issuing_organization or ""
            doc_src = source_name or "Uploaded Evidence"
            doc_notes = reviewer_notes or ""

        # 3. Save file safely
        doc_id = f"doc-{uuid.uuid4().hex[:10]}"
        safe_filename = f"{doc_id}_{Path(original_name).name}"
        dest_path = inv_dir / safe_filename
        
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(upload.file, buffer)

        f_size = os.path.getsize(dest_path)
        if f_size > MAX_FILE_SIZE_BYTES:
            dest_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=400,
                detail=f"File '{original_name}' exceeds maximum allowed size of 25MB."
            )

        now = datetime.utcnow().isoformat()
        ocr_details = {}

        # 4. Processing based on file type (Task 3: Real OCR)
        if ext == "pdf":
            analysis_res = analyze_pdf_document(dest_path)
            meta = analysis_res["metadata"]
            classif = analysis_res["classification"]
            extracted_txt = analysis_res["extracted_text"]
            ocr_details = {
                "ocr_status": meta.get("ocr_status", "not_needed"),
                "ocr_pages": meta.get("ocr_pages", []),
                "ocr_confidence": meta.get("ocr_confidence", 0.0),
                "extraction_method": meta.get("extraction_method", "native_text")
            }
        elif ext in ["png", "jpg", "jpeg"]:
            img_res = process_raw_image_file(dest_path)
            extracted_txt = img_res["extracted_text"]
            f_hash = compute_file_sha256(dest_path)
            meta = {
                "creation_date": now,
                "modification_date": now,
                "author": None,
                "creator": "Photographic / Scanned Image",
                "producer": None,
                "page_count": 1,
                "pdf_version": None,
                "file_size_bytes": f_size,
                "file_hash": f_hash,
                "completeness_score": 0.4,
                "has_digital_signatures": False,
                "font_count": 0,
                "embedded_images_count": 1,
                "is_encrypted": False,
                "image_dimensions": img_res.get("dimensions", "Unknown"),
                "ocr_status": img_res.get("ocr_status", "completed"),
                "ocr_confidence": img_res.get("ocr_confidence", 0.0),
                "extraction_method": img_res.get("extraction_method", "ocr"),
                "ocr_pages": [1] if img_res.get("ocr_status") == "completed" else []
            }
            classif = "Image / Scanned File"
            ocr_details = {
                "ocr_status": img_res.get("ocr_status"),
                "ocr_confidence": img_res.get("ocr_confidence"),
                "ocr_error": img_res.get("ocr_error"),
                "extraction_method": img_res.get("extraction_method")
            }
        else:
            # Text file fallback
            with open(dest_path, "r", encoding="utf-8", errors="ignore") as tf:
                extracted_txt = tf.read()
            f_hash = compute_file_sha256(dest_path)
            meta = {
                "creation_date": now,
                "modification_date": now,
                "author": None,
                "creator": "Raw Text Record",
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
                "extraction_method": "native_text",
                "ocr_status": "not_needed",
                "ocr_confidence": 0.0,
                "ocr_pages": []
            }
            classif = "Text Record"

        # 5. Extract structured fields from extracted text
        fields = extract_structured_fields(extracted_txt)

        doc_item = {
            "id": doc_id,
            "investigation_id": inv_id,
            "file_name": original_name,
            "file_type": ext,
            "file_size": f_size,
            "file_hash": meta.get("file_hash", ""),
            "file_path": str(dest_path),
            "category": doc_category,
            "classification": classif,
            "metadata": meta,
            "extracted_text": extracted_txt,
            "extracted_fields": fields,
            "source_details": {
                "issuing_organization": doc_org,
                "source_name": doc_src,
                "date_received": now[:10],
                "original_source_url": "",
                "reviewer_notes": doc_notes
            },
            "processing_status": "analyzed",
            "upload_timestamp": now,
            "reviewer_notes": "",
            "ocr_details": ocr_details
        }
        db.save_document(doc_item)
        saved_docs.append(doc_item)

        # Audit log for upload
        reviewer_name = user.get("full_name", "Investigator") if user else "Investigator"
        db.log_audit_action({
            "id": str(uuid.uuid4()),
            "investigation_id": inv_id,
            "timestamp": now,
            "reviewer": reviewer_name,
            "action_type": "document_upload",
            "description": f"Uploaded '{original_name}' (Category: {doc_category}, Classification: {classif}, OCR: {meta.get('ocr_status')}).",
            "metadata": {"doc_id": doc_id, "file_name": original_name, "category": doc_category}
        })

    # Update investigation doc count
    all_docs = db.get_documents(inv_id)
    inv["document_count"] = len(all_docs)
    inv["updated_at"] = datetime.utcnow().isoformat()
    db.save_investigation(inv)

    return {"uploaded_count": len(saved_docs), "documents": saved_docs}

@router.get("/documents/{doc_id}")
def get_single_document(
    doc_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    doc = db.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    inv = db.get_investigation(doc["investigation_id"])
    if inv:
        verify_investigation_access(inv, user)
    return doc

@router.get("/documents/{doc_id}/download")
def download_document(
    doc_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    doc = db.get_document(doc_id)
    if not doc or not os.path.exists(doc.get("file_path", "")):
        raise HTTPException(status_code=404, detail="Document file not found on disk")
    inv = db.get_investigation(doc["investigation_id"])
    if inv:
        verify_investigation_access(inv, user)
    return FileResponse(doc["file_path"], filename=doc["file_name"])

@router.patch("/documents/{doc_id}")
def update_document_details(
    doc_id: str,
    updates: dict,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    doc = db.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    inv = db.get_investigation(doc["investigation_id"])
    if inv:
        verify_investigation_access(inv, user)
    
    old_cat = doc.get("category")
    doc.update(updates)
    db.save_document(doc)

    reviewer_name = user.get("full_name", "Investigator") if user else "Investigator"
    db.log_audit_action({
        "id": str(uuid.uuid4()),
        "investigation_id": doc.get("investigation_id"),
        "timestamp": datetime.utcnow().isoformat(),
        "reviewer": reviewer_name,
        "action_type": "field_correction",
        "description": f"Updated metadata/category for '{doc['file_name']}' from '{old_cat}' to '{doc.get('category')}'.",
        "metadata": {"doc_id": doc_id, "updates": list(updates.keys())}
    })
    return doc

# --- ANALYSIS ENGINE (TASK 1: LLM SYNTHESIS & SAFE FALLBACK) ---
@router.post("/investigations/{inv_id}/analyze")
async def run_investigation_analysis(
    inv_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    verify_investigation_access(inv, user)

    docs = db.get_documents(inv_id)
    primary_claim = inv.get("primary_claim", "")

    # 1. Deterministic comparison engine
    findings = run_cross_document_comparison(inv_id, docs, primary_claim)

    # 2. Evidence Gap & 4-Dimensional Reliability
    gap_eval = evaluate_evidence_gaps_and_dimensions(inv, docs, findings)

    # 3. AI-assisted synthesis when configured (Task 1)
    findings = await enrich_findings_with_ai(findings, docs, primary_claim)
    gap_eval = await enrich_gaps_with_ai(gap_eval, docs, primary_claim)

    db.save_findings(inv_id, findings)

    # Update investigation status
    inv["status"] = "Review Required" if findings or gap_eval["gaps"] else "Analysis Complete"
    inv["findings_count"] = len(findings)
    inv["document_count"] = len(docs)
    inv["updated_at"] = datetime.utcnow().isoformat()
    db.save_investigation(inv)

    reviewer_name = user.get("full_name", "Investigator") if user else "Investigator"
    db.log_audit_action({
        "id": str(uuid.uuid4()),
        "investigation_id": inv_id,
        "timestamp": datetime.utcnow().isoformat(),
        "reviewer": reviewer_name,
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

# --- BACKGROUND JOBS (TASK 5) ---
async def execute_background_analysis_task(job_id: str, inv_id: str):
    """Worker function executed outside long-running HTTP request."""
    try:
        inv = db.get_investigation(inv_id)
        if not inv:
            db.save_job({"job_id": job_id, "status": "failed", "error": "Investigation not found", "completed_at": datetime.utcnow().isoformat()})
            return

        db.save_job({
            "job_id": job_id,
            "investigation_id": inv_id,
            "job_type": "analysis",
            "status": "processing",
            "progress_stage": "Cross-Document Evidence Comparison",
            "error": None
        })

        docs = db.get_documents(inv_id)
        primary_claim = inv.get("primary_claim", "")

        # 1. Comparison
        findings = run_cross_document_comparison(inv_id, docs, primary_claim)

        # 2. Gaps & Dimensions
        db.save_job({
            "job_id": job_id,
            "investigation_id": inv_id,
            "job_type": "analysis",
            "status": "processing",
            "progress_stage": "Evaluating 4-Dimensional Reliability & Gaps",
            "error": None
        })
        gap_eval = evaluate_evidence_gaps_and_dimensions(inv, docs, findings)

        # 3. AI synthesis
        db.save_job({
            "job_id": job_id,
            "investigation_id": inv_id,
            "job_type": "analysis",
            "status": "processing",
            "progress_stage": "AI Grounded Synthesis & Verification Recommendations",
            "error": None
        })
        findings = await enrich_findings_with_ai(findings, docs, primary_claim)
        gap_eval = await enrich_gaps_with_ai(gap_eval, docs, primary_claim)

        db.save_findings(inv_id, findings)

        # 4. Finalize
        inv["status"] = "Review Required" if findings or gap_eval["gaps"] else "Analysis Complete"
        inv["findings_count"] = len(findings)
        inv["document_count"] = len(docs)
        inv["updated_at"] = datetime.utcnow().isoformat()
        db.save_investigation(inv)

        now = datetime.utcnow().isoformat()
        db.save_job({
            "job_id": job_id,
            "investigation_id": inv_id,
            "job_type": "analysis",
            "status": "completed",
            "progress_stage": "Analysis Completed Successfully",
            "completed_at": now,
            "result_summary": {
                "document_count": len(docs),
                "findings_count": len(findings),
                "gaps_count": len(gap_eval["gaps"]),
                "status": inv["status"]
            }
        })
    except Exception as e:
        logger.exception(f"Background analysis failed for job {job_id}: {e}")
        db.save_job({
            "job_id": job_id,
            "investigation_id": inv_id,
            "job_type": "analysis",
            "status": "failed",
            "progress_stage": "Analysis Failed",
            "error": str(e),
            "completed_at": datetime.utcnow().isoformat()
        })

@router.post("/investigations/{inv_id}/analyze-async")
def run_investigation_analysis_async(
    inv_id: str,
    background_tasks: BackgroundTasks,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    verify_investigation_access(inv, user)

    job_id = f"job-{uuid.uuid4().hex[:12]}"
    now = datetime.utcnow().isoformat()
    job_record = {
        "job_id": job_id,
        "investigation_id": inv_id,
        "job_type": "analysis",
        "status": "queued",
        "progress_stage": "Queued for Forensic Analysis",
        "error": None,
        "created_at": now
    }
    db.save_job(job_record)

    background_tasks.add_task(execute_background_analysis_task, job_id, inv_id)
    return {"job_id": job_id, "status": "queued", "investigation_id": inv_id}

@router.get("/jobs/{job_id}", response_model=JobModel)
def get_job_status(job_id: str):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.post("/jobs/{job_id}/retry")
def retry_failed_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    inv = db.get_investigation(job["investigation_id"])
    if inv:
        verify_investigation_access(inv, user)

    job["status"] = "queued"
    job["progress_stage"] = "Retrying Analysis"
    job["error"] = None
    db.save_job(job)

    background_tasks.add_task(execute_background_analysis_task, job_id, job["investigation_id"])
    return {"message": "Job re-queued successfully.", "job_id": job_id, "status": "queued"}

# --- RESULTS & GRAPH & GAPS ---
@router.get("/investigations/{inv_id}/results")
def get_investigation_results(
    inv_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    verify_investigation_access(inv, user)

    docs = db.get_documents(inv_id)
    findings = db.get_findings(inv_id)
    gap_eval = evaluate_evidence_gaps_and_dimensions(inv, docs, findings)

    return {
        "investigation": inv,
        "documents": docs,
        "findings": findings,
        "gap_evaluation": gap_eval
    }

@router.get("/investigations/{inv_id}/graph")
def get_provenance_graph(
    inv_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    verify_investigation_access(inv, user)

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

@router.get("/investigations/{inv_id}/gaps")
def get_evidence_gaps(
    inv_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    verify_investigation_access(inv, user)

    docs = db.get_documents(inv_id)
    findings = db.get_findings(inv_id)
    return evaluate_evidence_gaps_and_dimensions(inv, docs, findings)

# --- CHRONOLOGICAL TIMELINE (TASK 7) ---
@router.get("/investigations/{inv_id}/timeline")
def get_investigation_timeline(
    inv_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    verify_investigation_access(inv, user)

    docs = db.get_documents(inv_id)
    findings = db.get_findings(inv_id)
    timeline_data = build_investigation_timeline(inv_id, docs, findings)
    return timeline_data

# --- ON-DEMAND AI EXPLANATION FOR SINGLE FINDING (TASK 1) ---
@router.post("/investigations/{inv_id}/findings/{finding_id}/explain-ai")
async def request_finding_ai_explanation(
    inv_id: str,
    finding_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    verify_investigation_access(inv, user)

    findings = db.get_findings(inv_id)
    target_finding = next((f for f in findings if f.get("id") == finding_id or f.get("finding_id") == finding_id), None)
    if not target_finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    docs = db.get_documents(inv_id)
    ai_meta = await explain_finding_with_ai(target_finding, docs, inv.get("primary_claim", ""))

    target_finding["is_ai_assisted"] = ai_meta["is_ai_assisted"]
    target_finding["ai_explanation"] = ai_meta["ai_explanation"]
    target_finding["ai_analysis"] = ai_meta["ai_analysis"]
    db.save_findings(inv_id, findings)

    return target_finding

# --- EVIDENCE TIME MACHINE (SIMULATE REMOVAL) ---
@router.post("/investigations/{inv_id}/simulate-removal")
def simulate_evidence_removal(
    inv_id: str,
    req: SimulationRequest,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    verify_investigation_access(inv, user)

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

    reviewer_name = user.get("full_name", "Investigator") if user else "Investigator"
    db.log_audit_action({
        "id": str(uuid.uuid4()),
        "investigation_id": inv_id,
        "timestamp": datetime.utcnow().isoformat(),
        "reviewer": reviewer_name,
        "action_type": "simulation_run",
        "description": f"Evidence Time Machine simulated removal of {len(req.excluded_document_ids)} document(s): {', '.join(res['excluded_document_names'])}.",
        "metadata": {"excluded_ids": req.excluded_document_ids}
    })

    return res

# --- VERSIONED ANALYSIS & COMPARISON ---
@router.post("/investigations/{inv_id}/reanalyze")
async def create_new_analysis_version(
    inv_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    verify_investigation_access(inv, user)

    docs = db.get_documents(inv_id)
    findings = run_cross_document_comparison(inv_id, docs, inv.get("primary_claim", ""))
    findings = await enrich_findings_with_ai(findings, docs, inv.get("primary_claim", ""))
    db.save_findings(inv_id, findings)

    gap_eval = evaluate_evidence_gaps_and_dimensions(inv, docs, findings)
    gap_eval = await enrich_gaps_with_ai(gap_eval, docs, inv.get("primary_claim", ""))

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

    reviewer_name = user.get("full_name", "Investigator") if user else "Investigator"
    db.log_audit_action({
        "id": str(uuid.uuid4()),
        "investigation_id": inv_id,
        "timestamp": datetime.utcnow().isoformat(),
        "reviewer": reviewer_name,
        "action_type": "reanalysis",
        "description": f"Created Analysis Version {new_version_num} incorporating updated evidence collection.",
        "metadata": {"version": new_version_num}
    })

    return {"message": f"Version {new_version_num} created successfully.", "version": version_snapshot}

@router.get("/investigations/{inv_id}/versions")
def get_investigation_versions(
    inv_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if inv:
        verify_investigation_access(inv, user)
    return db.get_versions(inv_id)

@router.get("/investigations/{inv_id}/compare")
def compare_versions(
    inv_id: str,
    base_version: int = Query(1),
    target_version: int = Query(2),
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if inv:
        verify_investigation_access(inv, user)

    versions = db.get_versions(inv_id)
    v_base = next((v for v in versions if v["version_number"] == base_version), None)
    v_target = next((v for v in versions if v["version_number"] == target_version), None)

    if not v_base or not v_target:
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
def update_finding_status(
    inv_id: str,
    finding_id: str,
    updates: dict,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if inv:
        verify_investigation_access(inv, user)

    updated = db.update_finding(inv_id, finding_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Finding not found")

    reviewer_name = user.get("full_name", "Investigator") if user else "Investigator"
    db.log_audit_action({
        "id": str(uuid.uuid4()),
        "investigation_id": inv_id,
        "timestamp": datetime.utcnow().isoformat(),
        "reviewer": reviewer_name,
        "action_type": "finding_status_change",
        "description": f"Finding {updated.get('finding_id', finding_id)} changed to status '{updates.get('reviewer_status')}' (Notes: '{updates.get('reviewer_notes', '')}').",
        "metadata": {"finding_id": finding_id, "new_status": updates.get("reviewer_status")}
    })
    return updated

# --- AUDIT TRAIL ---
@router.get("/investigations/{inv_id}/audit")
def get_investigation_audit_log(
    inv_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if inv:
        verify_investigation_access(inv, user)
    return db.get_audit_actions(inv_id)

# --- INVESTIGATION REPORT (PREVIEW & PDF EXPORT) ---
@router.get("/investigations/{inv_id}/report")
def get_report_preview(
    inv_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    verify_investigation_access(inv, user)

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
def download_pdf_report(
    inv_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    inv = db.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    verify_investigation_access(inv, user)

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

    reviewer_name = user.get("full_name", "Investigator") if user else "Investigator"
    db.log_audit_action({
        "id": str(uuid.uuid4()),
        "investigation_id": inv_id,
        "timestamp": datetime.utcnow().isoformat(),
        "reviewer": reviewer_name,
        "action_type": "report_exported",
        "description": "Generated and exported official PDF forensic verification report.",
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
def get_app_settings(user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    return db.get_settings()

@router.post("/settings")
def save_app_settings(
    settings: dict,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
):
    db.save_settings(settings)
    return {"message": "Settings updated successfully."}
