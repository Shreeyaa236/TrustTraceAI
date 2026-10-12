import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import DEBUG
from app.routers.api import router
from app.services.demo_case import seed_demonstration_investigation

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("trusttrace")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing TrustTrace AI forensic service...")
    try:
        seed_demonstration_investigation(force_reset=False)
        logger.info("Fictional demonstration case seeded successfully.")
    except Exception as e:
        logger.warning(f"Error initializing demo dataset: {e}")
    yield
    logger.info("Shutting down TrustTrace AI...")

app = FastAPI(
    title="TrustTrace AI — Forensic Verification API",
    description="Digital evidence verification platform uncovering multi-document relationships, inconsistencies, provenance graphs, and evidence gaps.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.get("/")
def root():
    return {
        "app": "TrustTrace AI",
        "tagline": "Beyond Fake Detection. Understand the Entire Evidence Story.",
        "status": "online",
        "docs": "/docs"
    }

@app.get("/health")
def health():
    return {"status": "healthy"}
