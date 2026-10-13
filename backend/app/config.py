import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))
DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/trusttrace")
UPLOAD_DIR = BASE_DIR / "uploads"
DATA_DIR = BASE_DIR / "data"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "none")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

DATA_RETENTION_DAYS = int(os.getenv("DATA_RETENTION_DAYS", "90"))
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "trusttrace_default_dev_secret_key_2026")
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))

# OCR Configuration
TESSERACT_CMD = os.getenv("TESSERACT_CMD", "")
