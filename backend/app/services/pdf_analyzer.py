import hashlib
import io
import os
from pathlib import Path
from typing import Dict, Any, Tuple, List
import fitz  # PyMuPDF
from PIL import Image

from app.services.ocr_service import run_ocr_on_pil_image, is_tesseract_available

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
        "extraction_method": "native_text",
        "ocr_status": "not_needed",
        "ocr_pages": [],
        "ocr_confidence": 0.0,
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

        total_text_chars = 0
        total_images = 0
        font_set = set()
        pages_with_large_images = 0

        full_text_parts = []
        ocr_pages_done = []
        ocr_confidences = []
        ocr_failed_pages = 0
        ocr_engine_missing = False

        for page_idx in range(len(doc)):
            page = doc[page_idx]
            page_text = page.get_text("text").strip()

            # Check fonts
            fonts = page.get_fonts()
            for font in fonts:
                font_set.add(font[3] if len(font) > 3 else "UnknownFont")

            # Check images
            images = page.get_images(full=True)
            total_images += len(images)
            has_large_image = False
            if len(images) >= 1:
                for img in images:
                    xref = img[0]
                    base_image = doc.extract_image(xref)
                    if base_image:
                        w, h = base_image.get("width", 0), base_image.get("height", 0)
                        if w > 600 and h > 800:
                            pages_with_large_images += 1
                            has_large_image = True
                            break

            # Evaluate whether page lacks usable text and requires OCR
            needs_ocr = len(page_text) < 40 and (len(images) > 0 or has_large_image or len(doc) == 1)

            if needs_ocr:
                try:
                    # Render page to raster image for OCR
                    pix = page.get_pixmap(dpi=150)
                    img_data = pix.tobytes("png")
                    pil_img = Image.open(io.BytesIO(img_data))
                    ocr_res = run_ocr_on_pil_image(pil_img)

                    if ocr_res["ocr_status"] == "completed" and ocr_res["text"]:
                        full_text_parts.append(f"[Page {page_idx + 1} - OCR Extracted]\n{ocr_res['text']}")
                        total_text_chars += len(ocr_res["text"])
                        ocr_pages_done.append(page_idx + 1)
                        if ocr_res["confidence"] > 0:
                            ocr_confidences.append(ocr_res["confidence"])
                    elif ocr_res["ocr_status"] == "unavailable":
                        ocr_engine_missing = True
                        if page_text:
                            full_text_parts.append(f"[Page {page_idx + 1}]\n{page_text}")
                            total_text_chars += len(page_text)
                    else:
                        ocr_failed_pages += 1
                        if page_text:
                            full_text_parts.append(f"[Page {page_idx + 1}]\n{page_text}")
                            total_text_chars += len(page_text)
                except Exception as page_err:
                    ocr_failed_pages += 1
                    if page_text:
                        full_text_parts.append(f"[Page {page_idx + 1}]\n{page_text}")
                        total_text_chars += len(page_text)
            else:
                if page_text:
                    full_text_parts.append(f"[Page {page_idx + 1}]\n{page_text}")
                    total_text_chars += len(page_text)

        metadata["font_count"] = len(font_set)
        metadata["embedded_images_count"] = total_images
        metadata["ocr_pages"] = ocr_pages_done

        if ocr_confidences:
            metadata["ocr_confidence"] = round(sum(ocr_confidences) / len(ocr_confidences), 2)

        # Extraction method & OCR status evaluation
        if ocr_pages_done:
            if len(ocr_pages_done) == len(doc):
                metadata["extraction_method"] = "ocr"
            else:
                metadata["extraction_method"] = "hybrid"
            metadata["ocr_status"] = "completed"
        elif ocr_engine_missing:
            metadata["ocr_status"] = "unavailable"
            metadata["extraction_method"] = "native_text" if total_text_chars > 0 else "none"
        elif ocr_failed_pages > 0:
            metadata["ocr_status"] = "failed"
            metadata["extraction_method"] = "native_text" if total_text_chars > 0 else "none"
        else:
            metadata["ocr_status"] = "not_needed"
            metadata["extraction_method"] = "native_text" if total_text_chars > 0 else "none"

        extracted_text = "\n\n".join(full_text_parts).strip()

        # Classification heuristics
        if ocr_pages_done and len(ocr_pages_done) == len(doc):
            classification = "Likely Image-Based PDF"
            classification_notes.append(f"Scanned / image-based PDF. Text recovered via OCR across {len(ocr_pages_done)} page(s).")
        elif total_text_chars > 200 and total_images == 0:
            classification = "Likely Text-Based PDF"
            classification_notes.append("High selectable text density with native embedded fonts and no raster background.")
        elif total_text_chars < 50 and total_images > 0:
            classification = "Likely Image-Based PDF"
            if ocr_engine_missing:
                classification_notes.append("Scanned / screenshot PDF with minimal selectable text. System Tesseract OCR engine was not found to extract text.")
            else:
                classification_notes.append("Minimal selectable text; document structure is dominated by raster image representations.")
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
