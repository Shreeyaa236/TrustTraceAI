import re
from typing import Dict, Any, List

# Regex patterns for deterministic extraction
AMOUNT_PATTERN = re.compile(
    r'(?:[₹$€£]|INR|USD|EUR|GBP|Rs\.?)\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)',
    re.IGNORECASE
)

DATE_PATTERNS = [
    re.compile(r'\b(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b'),
    re.compile(r'\b(?:\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b', re.IGNORECASE),
    re.compile(r'\b(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})\b', re.IGNORECASE),
]

DOC_NUM_PATTERN = re.compile(
    r'(?:Invoice|Bill|Receipt|Claim|Ref|Policy|Account|Txn|Transaction|Order)\s*(?:No\.?|#|ID|Code)?\s*[:\-]?\s*([A-Z0-9\-_/]{4,24})',
    re.IGNORECASE
)

REF_ID_PATTERN = re.compile(
    r'\b(?:REF|TXN|UTR|IMPS|NEFT|REC|INV)-[A-Z0-9]{4,16}\b',
    re.IGNORECASE
)

ORG_KEYWORDS = [
    "Hospital", "Medical Center", "Clinic", "Healthcare", "Bank", "Insurance", "Corporation",
    "Ltd", "Limited", "Pvt", "Inc", "Services", "Enterprises", "Pharmacy", "Laboratory"
]

def extract_structured_fields(text: str) -> Dict[str, List[str]]:
    if not text:
        return {
            "amounts": [],
            "dates": [],
            "document_numbers": [],
            "reference_ids": [],
            "organizations": [],
            "names": [],
            "payment_references": [],
            "claims": [],
        }

    # Amounts
    amounts = []
    for match in AMOUNT_PATTERN.finditer(text):
        full_match = match.group(0).strip()
        if full_match not in amounts:
            amounts.append(full_match)

    # Dates
    dates = []
    for pattern in DATE_PATTERNS:
        for match in pattern.finditer(text):
            val = match.group(0).strip()
            if val not in dates:
                dates.append(val)

    # Document Numbers & Reference IDs
    doc_nums = []
    for match in DOC_NUM_PATTERN.finditer(text):
        val = match.group(1).strip()
        if len(val) >= 4 and val not in doc_nums and not val.isdigit():
            doc_nums.append(val)
        elif val.isdigit() and len(val) >= 4 and val not in doc_nums:
            doc_nums.append(f"#{val}")

    ref_ids = []
    for match in REF_ID_PATTERN.finditer(text):
        val = match.group(0).strip()
        if val not in ref_ids:
            ref_ids.append(val)

    # Organizations
    organizations = []
    lines = text.split("\n")
    for line in lines[:15]:  # Look mainly in headers/top lines
        line_clean = line.strip()
        for kw in ORG_KEYWORDS:
            if kw.lower() in line_clean.lower() and len(line_clean) < 60:
                if line_clean not in organizations:
                    organizations.append(line_clean)
                break

    # Payment references (UTR / IMPS / Bank Ref)
    payment_refs = []
    pmt_pattern = re.compile(r'\b(?:UTR|UPI|NEFT|IMPS|Ref No)\s*[:\-]?\s*([A-Za-z0-9]{8,22})\b', re.IGNORECASE)
    for match in pmt_pattern.finditer(text):
        val = match.group(0).strip()
        if val not in payment_refs:
            payment_refs.append(val)

    # Inferred claims or subject lines
    claims = []
    for line in lines:
        l = line.strip()
        if any(term in l.lower() for term in ["paid", "discharged", "diagnosis", "amount payable", "received with thanks", "total amount", "subject:"]):
            if len(l) > 10 and len(l) < 120 and l not in claims:
                claims.append(l)

    return {
        "amounts": amounts[:10],
        "dates": dates[:10],
        "document_numbers": doc_nums[:8],
        "reference_ids": ref_ids[:8],
        "organizations": organizations[:5],
        "names": [],
        "payment_references": payment_refs[:5],
        "claims": claims[:6],
    }
