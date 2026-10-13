import os
import io
import shutil
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
from PIL import Image, ImageOps

from app.config import TESSERACT_CMD

logger = logging.getLogger("trusttrace.ocr")

# Candidate Tesseract paths on Windows & Linux
COMMON_TESSERACT_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    os.path.expanduser(r"~\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"),
    "/usr/bin/tesseract",
    "/usr/local/bin/tesseract"
]

def resolve_tesseract_binary() -> Optional[str]:
    """Finds available Tesseract binary from config, PATH, or common install locations."""
    if TESSERACT_CMD and Path(TESSERACT_CMD).exists():
        return TESSERACT_CMD

    path_in_env = shutil.which("tesseract")
    if path_in_env:
        return path_in_env

    for candidate in COMMON_TESSERACT_PATHS:
        if Path(candidate).exists():
            return candidate

    return None

def is_tesseract_available() -> bool:
    """Returns True if the Tesseract binary is discoverable and runnable."""
    bin_path = resolve_tesseract_binary()
    if not bin_path:
        return False
    try:
        import pytesseract
        pytesseract.pytesseract.tesseract_cmd = bin_path
        version = pytesseract.get_tesseract_version()
        return bool(version)
    except Exception as e:
        logger.debug(f"Tesseract check failed: {e}")
        return False

def get_ocr_status_info() -> Dict[str, Any]:
    bin_path = resolve_tesseract_binary()
    available = is_tesseract_available()
    return {
        "engine": "Tesseract-OCR (pytesseract)",
        "available": available,
        "binary_path": bin_path if available else None,
        "setup_guide": (
            "Tesseract OCR is active and ready."
            if available else
            "System Tesseract OCR binary not found. To enable OCR on images and scanned PDFs, "
            "install Tesseract-OCR (e.g., UB-Mannheim installer for Windows or apt install tesseract-ocr on Linux) "
            "and set TESSERACT_CMD in backend/.env if not in PATH."
        )
    }

def run_ocr_on_pil_image(image: Image.Image) -> Dict[str, Any]:
    """
    Runs Tesseract OCR on a PIL Image object with preprocessing.
    Returns structured result with extracted text, confidence, and status.
    """
    bin_path = resolve_tesseract_binary()
    if not bin_path:
        return {
            "text": "",
            "ocr_status": "unavailable",
            "confidence": 0.0,
            "error": "Tesseract OCR binary not installed or not in PATH.",
            "pages_processed": 1
        }

    try:
        import pytesseract
        pytesseract.pytesseract.tesseract_cmd = bin_path

        # 1. Image preprocessing: EXIF orientation transpose
        img = ImageOps.exif_transpose(image)

        # 2. Convert to RGB / Grayscale if necessary
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        # 3. Extract text
        extracted_text = pytesseract.image_to_string(img, lang="eng")

        # 4. Extract word confidence data
        avg_confidence = 0.0
        try:
            data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
            confs = [float(c) for c in data.get("conf", []) if str(c).replace("-", "").isdigit() and float(c) > 0]
            if confs:
                avg_confidence = round(sum(confs) / len(confs), 2)
        except Exception:
            avg_confidence = 80.0 if extracted_text.strip() else 0.0

        return {
            "text": extracted_text.strip(),
            "ocr_status": "completed",
            "confidence": avg_confidence,
            "error": None,
            "pages_processed": 1
        }
    except Exception as e:
        logger.warning(f"OCR execution failed: {e}")
        return {
            "text": "",
            "ocr_status": "failed",
            "confidence": 0.0,
            "error": str(e),
            "pages_processed": 1
        }

def process_raw_image_file(file_path: Path) -> Dict[str, Any]:
    """
    Processes PNG/JPG/JPEG file: validates format, extracts dimensions, runs OCR.
    """
    try:
        with Image.open(file_path) as img:
            width, height = img.size
            format_name = img.format or file_path.suffix.lstrip(".").upper()

            ocr_res = run_ocr_on_pil_image(img)

            return {
                "format": format_name,
                "dimensions": f"{width}x{height}",
                "extracted_text": ocr_res["text"],
                "ocr_status": ocr_res["ocr_status"],
                "ocr_confidence": ocr_res["confidence"],
                "ocr_error": ocr_res["error"],
                "extraction_method": "ocr" if ocr_res["ocr_status"] == "completed" else "none"
            }
    except Exception as e:
        logger.warning(f"Failed to process image file {file_path}: {e}")
        return {
            "format": file_path.suffix.lstrip(".").upper(),
            "dimensions": "Unknown",
            "extracted_text": "",
            "ocr_status": "failed",
            "ocr_confidence": 0.0,
            "ocr_error": f"Invalid or corrupt image file: {str(e)}",
            "extraction_method": "none"
        }
