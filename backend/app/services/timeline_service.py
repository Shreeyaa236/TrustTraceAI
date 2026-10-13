import re
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

def parse_date_safely(date_str: str) -> Optional[datetime]:
    """Attempts to parse common date formats into a standard datetime object."""
    if not date_str:
        return None

    cleaned = date_str.strip()

    # Handle PDF format like "D:20261013005846+05'00'" or "D:20261012120000"
    if cleaned.startswith("D:"):
        m = re.match(r"D:(\d{4})(\d{2})(\d{2})", cleaned)
        if m:
            try:
                return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            except Exception:
                pass

    # Standard ISO formats
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(cleaned[:19], fmt[:len(cleaned[:19])])
        except Exception:
            pass

    # Common localized formats: DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY
    patterns = [
        ("%d/%m/%Y", r"^\d{1,2}/\d{1,2}/\d{4}$"),
        ("%d-%m-%Y", r"^\d{1,2}-\d{1,2}-\d{4}$"),
        ("%d.%m.%Y", r"^\d{1,2}\.\d{1,2}\.\d{4}$"),
        ("%B %d, %Y", r"^[A-Za-z]+\s+\d{1,2},?\s+\d{4}$"),
        ("%d %B %Y", r"^\d{1,2}\s+[A-Za-z]+\s+\d{4}$"),
        ("%b %d, %Y", r"^[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}$"),
        ("%d %b %Y", r"^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$"),
    ]

    for fmt, regex in patterns:
        if re.match(regex, cleaned):
            try:
                return datetime.strptime(cleaned.replace(",", ""), fmt.replace(",", ""))
            except Exception:
                pass

    return None

def build_investigation_timeline(
    investigation_id: str,
    documents: List[Dict[str, Any]],
    findings: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Constructs a verified chronological event timeline from document content,
    PDF internal metadata timestamps, and upload dates. Flags out-of-order sequences
    and timeline conflicts without jumping to conclusions.
    """
    events = []
    
    # Map finding references
    timeline_findings = [f for f in findings if f.get("category") == "Timeline Conflict"]
    finding_map = {}
    for tf in timeline_findings:
        for did in tf.get("affected_document_ids", []):
            finding_map[did] = tf

    parsed_event_records = []

    for doc in documents:
        doc_id = doc["id"]
        doc_name = doc.get("file_name", "Document")
        doc_cat = doc.get("category", "Unknown")
        extracted_fields = doc.get("extracted_fields", {})
        meta = doc.get("metadata", {})
        upload_ts = doc.get("upload_timestamp", "")

        # 1. Extracted content dates
        for d_idx, d_str in enumerate(extracted_fields.get("dates", [])):
            parsed = parse_date_safely(d_str)
            event_id = f"evt_{doc_id}_ext_{d_idx}"
            record = {
                "id": event_id,
                "investigation_id": investigation_id,
                "document_id": doc_id,
                "document_name": doc_name,
                "category": doc_cat,
                "date_str": d_str,
                "date_type": "Extracted Content Date",
                "parsed_date": parsed.isoformat() if parsed else None,
                "parsed_dt": parsed,
                "description": f"Date referenced in body of '{doc_name}' ({doc_cat}).",
                "is_conflict": False,
                "conflict_details": None,
                "related_finding_id": finding_map.get(doc_id, {}).get("finding_id")
            }
            parsed_event_records.append(record)

        # 2. PDF Internal Creation Date
        if meta.get("creation_date"):
            c_str = str(meta["creation_date"])
            c_parsed = parse_date_safely(c_str)
            record = {
                "id": f"evt_{doc_id}_meta_create",
                "investigation_id": investigation_id,
                "document_id": doc_id,
                "document_name": doc_name,
                "category": doc_cat,
                "date_str": c_str,
                "date_type": "PDF Metadata Creation Date",
                "parsed_date": c_parsed.isoformat() if c_parsed else None,
                "parsed_dt": c_parsed,
                "description": f"Internal PDF timestamp embedded when '{doc_name}' was originally authored or compiled.",
                "is_conflict": False,
                "conflict_details": None,
                "related_finding_id": finding_map.get(doc_id, {}).get("finding_id")
            }
            parsed_event_records.append(record)

        # 3. Document Source Date Received
        date_recv = doc.get("source_details", {}).get("date_received")
        if date_recv:
            r_parsed = parse_date_safely(date_recv)
            record = {
                "id": f"evt_{doc_id}_recv",
                "investigation_id": investigation_id,
                "document_id": doc_id,
                "document_name": doc_name,
                "category": doc_cat,
                "date_str": date_recv,
                "date_type": "Source Receipt Date",
                "parsed_date": r_parsed.isoformat() if r_parsed else None,
                "parsed_dt": r_parsed,
                "description": f"Recorded evidentiary intake date for '{doc_name}'.",
                "is_conflict": False,
                "conflict_details": None,
                "related_finding_id": None
            }
            parsed_event_records.append(record)

        # 4. Upload Timestamp
        if upload_ts:
            u_parsed = parse_date_safely(upload_ts)
            record = {
                "id": f"evt_{doc_id}_upload",
                "investigation_id": investigation_id,
                "document_id": doc_id,
                "document_name": doc_name,
                "category": doc_cat,
                "date_str": upload_ts[:10],
                "date_type": "Upload Timestamp",
                "parsed_date": u_parsed.isoformat() if u_parsed else None,
                "parsed_dt": u_parsed,
                "description": f"Time of digital upload to TrustTrace repository.",
                "is_conflict": False,
                "conflict_details": None,
                "related_finding_id": None
            }
            parsed_event_records.append(record)

    # Detect Chronological Inversions & Discrepancies
    # E.g., Payment Receipt with date EARLIER than Invoiced Admission Bill
    bills = [r for r in parsed_event_records if ("bill" in r["document_name"].lower() or "invoice" in r["category"].lower()) and r["parsed_dt"]]
    receipts = [r for r in parsed_event_records if ("receipt" in r["document_name"].lower() or "receipt" in r["category"].lower()) and r["parsed_dt"]]

    conflicts_count = 0
    for r in receipts:
        for b in bills:
            # If receipt extracted date is before bill date by more than 1 day
            if r["parsed_dt"] < b["parsed_dt"] and (b["parsed_dt"] - r["parsed_dt"]).days > 1:
                r["is_conflict"] = True
                r["conflict_details"] = (
                    f"Chronological anomaly: Payment receipt dated {r['date_str']} precedes associated billing invoice "
                    f"dated {b['date_str']} by {(b['parsed_dt'] - r['parsed_dt']).days} day(s). "
                    f"Plausible benign reasons include deposit advances or retrospective billing. "
                    f"Verify against bank account transaction timestamps."
                )
                b["is_conflict"] = True
                b["conflict_details"] = f"Associated with pre-dated payment receipt '{r['document_name']}'."
                conflicts_count += 1

    # Check for PDF metadata created years away from extracted date
    for r in parsed_event_records:
        if r["date_type"] == "PDF Metadata Creation Date" and r["parsed_dt"]:
            # Compare with extracted dates of same document
            same_doc_ext = [o for o in parsed_event_records if o["document_id"] == r["document_id"] and o["date_type"] == "Extracted Content Date" and o["parsed_dt"]]
            for ext in same_doc_ext:
                diff_days = abs((r["parsed_dt"] - ext["parsed_dt"]).days)
                if diff_days > 180:
                    r["is_conflict"] = True
                    r["conflict_details"] = (
                        f"PDF generation timestamp ({r['date_str']}) differs by {diff_days} days from content event date ({ext['date_str']}). "
                        f"Standard for scanned archives or re-printed statements; corroboration of transmission trail advised."
                    )
                    conflicts_count += 1

    # Sort events: events with parsed_dt first (chronological order), then unparseable dates
    def sort_key(item):
        if item["parsed_dt"]:
            return (0, item["parsed_dt"])
        return (1, datetime.max)

    parsed_event_records.sort(key=sort_key)

    # Clean out internal parsed_dt before returning
    clean_events = []
    for r in parsed_event_records:
        r_dict = {k: v for k, v in r.items() if k != "parsed_dt"}
        clean_events.append(r_dict)

    # Calculate date range
    valid_dts = [r["parsed_dt"] for r in parsed_event_records if r["parsed_dt"]]
    date_range = None
    if valid_dts:
        date_range = {
            "start": min(valid_dts).strftime("%Y-%m-%d"),
            "end": max(valid_dts).strftime("%Y-%m-%d")
        }

    return {
        "investigation_id": investigation_id,
        "events": clean_events,
        "total_events": len(clean_events),
        "conflicts_count": conflicts_count,
        "date_range": date_range
    }
