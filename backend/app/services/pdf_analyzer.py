import hashlib
import os
from pathlib import Path
from typing import Dict, Any, Tuple
import fitz  # PyMuPDF

def compute_file_sha256(file_path: Path) -> str:
    sha = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return sha.hexdigest()

def analyze_pdf_document(file_path: Path) -> Dict[str, Any]:
    file_size = os.path.getsize(file_path)
    file_hash = compute_file_sha256(file_path)

    metadata: Dict[str, Any] = {
        "creation_date": None,
        "modification_date": None,
        "author": None,
        "creator": None,
        "producer": None,
        "page_count": 1,
        "pdf_version": None,
        "file_size_bytes": file_size,
        "file_hash": file_hash,
        "completeness_score": 0.0,
        "has_digital_signatures": False,
        "font_count": 0,
        "embedded_images_count": 0,
        "is_encrypted": False,
    }

    classification = "Unable to Determine"
    extracted_text = ""
    classification_notes = []

    try:
        doc = fitz.open(file_path)
        metadata["page_count"] = len(doc)
        metadata["is_encrypted"] = doc.is_encrypted

        # Extract doc metadata
        doc_meta = doc.metadata or {}
        metadata["creation_date"] = doc_meta.get("creationDate")
        metadata["modification_date"] = doc_meta.get("modDate")
        metadata["author"] = doc_meta.get("author") or None
        metadata["creator"] = doc_meta.get("creator") or None
        metadata["producer"] = doc_meta.get("producer") or None
        metadata["pdf_version"] = f"PDF-{doc.pdf_version()}" if hasattr(doc, "pdf_version") else "1.7"

        # Calculate metadata completeness score
        meta_keys = ["creation_date", "modification_date", "author", "creator", "producer"]
        filled_count = sum(1 for k in meta_keys if metadata[k])
        metadata["completeness_score"] = round(filled_count / len(meta_keys), 2)

        # Inspect pages, fonts, images and text
        total_text_chars = 0
        total_images = 0
        font_set = set()
        pages_with_large_images = 0

        full_text_parts = []
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            page_text = page.get_text("text")
            full_text_parts.append(page_text)
            total_text_chars += len(page_text.strip())

            # Check fonts
            fonts = page.get_fonts()
            for font in fonts:
                font_set.add(font[3] if len(font) > 3 else "UnknownFont")

            # Check images
            images = page.get_images(full=True)
            total_images += len(images)
            if len(images) >= 1:
                # Check image dimensions
                for img in images:
                    xref = img[0]
                    base_image = doc.extract_image(xref)
                    if base_image:
                        w, h = base_image.get("width", 0), base_image.get("height", 0)
                        if w > 600 and h > 800:
                            pages_with_large_images += 1
                            break

        metadata["font_count"] = len(font_set)
        metadata["embedded_images_count"] = total_images
        extracted_text = "\n\n".join(full_text_parts).strip()

        # Classification heuristics
        if total_text_chars > 200 and total_images == 0:
            classification = "Likely Text-Based PDF"
            classification_notes.append("High selectable text density with native embedded fonts and no raster background.")
        elif total_text_chars < 50 and total_images > 0:
            classification = "Likely Image-Based PDF"
            classification_notes.append("Minimal selectable text; document structure is dominated by raster image representations (screenshot or scan).")
        elif total_text_chars >= 50 and total_images > 0:
            if pages_with_large_images > 0 and len(font_set) < 3:
                classification = "Mixed Text and Image PDF"
                classification_notes.append("Contains both scanned/screenshot full-page images and partial OCR or overlaid text layers.")
            else:
                classification = "Likely Text-Based PDF"
                classification_notes.append("Digital text-based layout with embedded figures/logos.")
        else:
            classification = "Likely Text-Based PDF" if total_text_chars > 50 else "Unable to Determine"

        doc.close()

    except Exception as e:
        classification = "Unable to Determine"
        classification_notes.append(f"Error inspecting PDF internals: {str(e)}")

    return {
        "metadata": metadata,
        "classification": classification,
        "classification_notes": classification_notes,
        "extracted_text": extracted_text,
    }
