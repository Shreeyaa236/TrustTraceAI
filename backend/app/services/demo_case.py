import os
import hashlib
from datetime import datetime
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from app.config import UPLOAD_DIR
from app.services.storage import db
from app.services.pdf_analyzer import analyze_pdf_document
from app.services.extractor import extract_structured_fields
from app.services.comparison import run_cross_document_comparison
from app.services.gap_finder import evaluate_evidence_gaps_and_dimensions

DEMO_INV_ID = "inv-demo-hospital-reimbursement"

def create_demo_pdf_file(filepath: Path, title: str, subtitle: str, table_rows: list, notes: str):
    doc = SimpleDocTemplate(str(filepath), pagesize=letter, leftMargin=40, rightMargin=40, topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()
    elements = []

    c_primary = colors.HexColor("#49372C")
    c_copper = colors.HexColor("#B8754D")

    elements.append(Paragraph(f"<b><font size=16 color='{c_primary}'>{title}</font></b>", styles['Normal']))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(f"<font size=10 color='{c_copper}'>{subtitle} (FICTIONAL DEMONSTRATION RECORD)</font>", styles['Normal']))
    elements.append(Spacer(1, 14))

    t = Table(table_rows, colWidths=[200, 300])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8F5EF")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#E4D8C8")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E4D8C8")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 14))

    elements.append(Paragraph(f"<b>Internal Forensic Annotation:</b> {notes}", styles['Normal']))
    doc.build(elements)

def seed_demonstration_investigation(force_reset: bool = False):
    existing = db.get_investigation(DEMO_INV_ID)
    if existing and not force_reset:
        return existing

    # Create demo documents on disk in uploads directory
    demo_dir = UPLOAD_DIR / "demo_files"
    demo_dir.mkdir(parents=True, exist_ok=True)

    # File 1: Hospital Bill (₹25,000)
    bill_path = demo_dir / "Hospital_Inpatient_Bill_INV-8821.pdf"
    create_demo_pdf_file(
        bill_path,
        "METROPOLITAN GENERAL HOSPITAL & HEALTHCARE",
        "Official Inpatient Summary Bill #INV-8821",
        [
            ["Patient Name", "Ananya Sharma (Age 34)"],
            ["Admission Date", "14-Aug-2026"],
            ["Discharge Date", "18-Aug-2026"],
            ["Treating Consultant", "Dr. Rajesh K. Varma, MD"],
            ["Diagnostic Procedures", "₹8,500.00"],
            ["Room Charges (4 Days)", "₹11,000.00"],
            ["Medications & Pharmacy", "₹5,500.00"],
            ["Total Amount Payable", "₹25,000.00 (Twenty-Five Thousand INR)"],
            ["Status", "Discharged — Payment Pending Verification"],
        ],
        "Official hospital bill generated from billing software. Selectable vector text with font definitions."
    )

    # File 2: Payment Receipt (₹25,000)
    receipt_path = demo_dir / "Hospital_Cash_Receipt_REC-4019.pdf"
    create_demo_pdf_file(
        receipt_path,
        "METROPOLITAN GENERAL HOSPITAL — ACCOUNTS",
        "Receipt of Acknowledgment #REC-4019",
        [
            ["Received With Thanks From", "Ananya Sharma"],
            ["Payment Towards", "Bill #INV-8821 Discharge Settlement"],
            ["Amount Received", "₹25,000.00 (INR)"],
            ["Payment Mode Stated", "Direct Bank IMPS Transfer"],
            ["Date Received", "19-Aug-2026"],
            ["Cashier Reference", "ACCTS-SHIFT-B #902"],
        ],
        "Receipt printed and issued on hospital letterhead. Matches total bill amount."
    )

    # File 3: Email Confirmation (₹25,000)
    email_path = demo_dir / "Insurance_Claim_Email_Confirmation.txt"
    email_text = (
        "Subject: RE: Hospital Reimbursement Claim Submission — Case Ref #MED-2026-991\n"
        "Date: 20-Aug-2026 11:42 AM\n"
        "From: billing.dept@metropolitangeneral.org\n"
        "To: claims.desk@reimbursement-portal.com\n\n"
        "Dear Claims Officer,\n\n"
        "This is to confirm that patient Ananya Sharma was discharged on 18-Aug-2026.\n"
        "Total hospital bill of ₹25,000 was settled as per Receipt #REC-4019.\n"
        "Attached please find the billing itemization for your reimbursement verification.\n\n"
        "Sincerely,\n"
        "Billing & Patient Accounts Department\n"
        "Metropolitan General Hospital & Healthcare"
    )
    with open(email_path, "w", encoding="utf-8") as f:
        f.write(email_text)

    # File 4: Disputed Bank Statement / Near-Duplicate Transaction Record (₹22,500 or ₹25,000)
    bank_path = demo_dir / "Axis_Bank_Customer_Statement_Aug2026.pdf"
    create_demo_pdf_file(
        bank_path,
        "NATIONAL APEX BANK — ACCOUNT DEBIT STATEMENT",
        "E-Statement for A/C ****4491 &bull; August 2026",
        [
            ["Account Holder", "Ananya Sharma"],
            ["Statement Period", "01-Aug-2026 to 31-Aug-2026"],
            ["Debit Date", "19-Aug-2026"],
            ["Transaction Description", "UPI-IMPS/METROPOLITAN-HOSP/UTR-9928190"],
            ["Debit Amount", "₹22,500.00 (Variance of ₹2,500 vs ₹25,000 Bill)"],
            ["Available Balance", "₹1,42,100.00"],
            ["Reference Number", "UTR-99281904412"],
        ],
        "Third-party bank statement reflecting debit entry of ₹22,500 instead of ₹25,000 claimed bill."
    )

    # Build Document objects
    files_to_index = [
        (bill_path, "Medical Document", "Metropolitan General Hospital"),
        (receipt_path, "Invoice or Receipt", "Metropolitan General Hospital"),
        (email_path, "Email or Communication", "Metropolitan General Hospital"),
        (bank_path, "Financial Document", "National Apex Bank")
    ]

    docs = []
    for fpath, cat, org in files_to_index:
        doc_id = f"doc-{fpath.stem.lower()[:24]}"
        f_size = os.path.getsize(fpath)
        
        if fpath.suffix.lower() == ".pdf":
            analysis_res = analyze_pdf_document(fpath)
            meta = analysis_res["metadata"]
            classif = analysis_res["classification"]
            extracted_txt = analysis_res["extracted_text"]
        else:
            with open(fpath, "r", encoding="utf-8") as tf:
                extracted_txt = tf.read()
            sha = hashlib.sha256(extracted_txt.encode()).hexdigest()
            meta = {
                "creation_date": "2026-08-20T11:42:00",
                "modification_date": "2026-08-20T11:42:00",
                "author": "Billing Dept",
                "creator": "Mail Server",
                "producer": "SMTP Client",
                "page_count": 1,
                "pdf_version": None,
                "file_size_bytes": f_size,
                "file_hash": sha,
                "completeness_score": 0.8,
                "has_digital_signatures": False,
                "font_count": 0,
                "embedded_images_count": 0,
                "is_encrypted": False,
            }
            classif = "Text Document"

        fields = extract_structured_fields(extracted_txt)

        doc_item = {
            "id": doc_id,
            "investigation_id": DEMO_INV_ID,
            "file_name": fpath.name,
            "file_type": fpath.suffix.lstrip(".").lower(),
            "file_size": f_size,
            "file_hash": meta.get("file_hash", ""),
            "file_path": str(fpath),
            "category": cat,
            "classification": classif,
            "metadata": meta,
            "extracted_text": extracted_txt,
            "extracted_fields": fields,
            "source_details": {
                "issuing_organization": org,
                "source_name": f"{org} Official Channel",
                "date_received": "2026-08-20",
                "original_source_url": "https://metropolitan.healthcare/portal",
                "reviewer_notes": "Demonstration evidence item for reimbursement assessment."
            },
            "processing_status": "analyzed",
            "upload_timestamp": datetime.utcnow().isoformat(),
            "reviewer_notes": ""
        }
        docs.append(doc_item)
        db.save_document(doc_item)

    # Run comparisons and gap findings for Version 1
    # For Version 1, let's include the first 3 documents (Bill, Receipt, Email)
    v1_docs = docs[:3]
    findings_v1 = run_cross_document_comparison(
        investigation_id=DEMO_INV_ID,
        documents=v1_docs,
        primary_claim="A hospital bill of ₹25,000 was paid."
    )
    db.save_findings(DEMO_INV_ID, findings_v1)

    inv_model = {
        "id": DEMO_INV_ID,
        "name": "Hospital Reimbursement Review",
        "description": "Evaluation of reimbursement claim for ₹25,000 inpatient hospital admission and settlement receipts.",
        "case_reference": "MED-2026-991",
        "category": "Medical Documents",
        "primary_claim": "A hospital bill of ₹25,000 was paid.",
        "creator": "Senior Investigator (Demo)",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "current_version": 1,
        "status": "Review Required",
        "reviewer_notes": "Initial documentation from hospital matches stated sum of ₹25,000, but lacks independent banking debit substantiation.",
        "document_count": len(docs),
        "findings_count": len(findings_v1),
        "is_demo": True
    }
    db.save_investigation(inv_model)

    # Save Version 1 snapshot
    gap_res_v1 = evaluate_evidence_gaps_and_dimensions(inv_model, v1_docs, findings_v1)
    db.save_version(DEMO_INV_ID, {
        "version_number": 1,
        "investigation_id": DEMO_INV_ID,
        "timestamp": datetime.utcnow().isoformat(),
        "document_ids": [d["id"] for d in v1_docs],
        "document_count": len(v1_docs),
        "findings_count": len(findings_v1),
        "summary": "Initial submission: Hospital Bill, Receipt, and Email Confirmation examined. Documents are internally concordant but share common origin.",
        "claims_state": [{"id": f"claim_{DEMO_INV_ID}", "claim_text": inv_model["primary_claim"], "status": gap_res_v1["overall_status"]}],
        "findings_state": findings_v1
    })

    # Save initial audit log
    db.log_audit_action({
        "id": "audit-init-demo",
        "investigation_id": DEMO_INV_ID,
        "timestamp": datetime.utcnow().isoformat(),
        "reviewer": "Senior Investigator",
        "action_type": "investigation_created",
        "description": "Demonstration case 'Hospital Reimbursement Review' initialized with 4 evidence files.",
        "metadata": {"case_reference": "MED-2026-991"}
    })

    return inv_model
