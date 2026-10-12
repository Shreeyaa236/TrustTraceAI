import os
import logging
from typing import Dict, Any, Optional
import httpx
from app.config import LLM_PROVIDER, GEMINI_API_KEY, OPENAI_API_KEY

logger = logging.getLogger("trusttrace.llm")

def get_llm_status() -> Dict[str, Any]:
    configured = False
    provider = LLM_PROVIDER.lower()
    
    if provider == "gemini" and GEMINI_API_KEY and len(GEMINI_API_KEY) > 10:
        configured = True
    elif provider == "openai" and OPENAI_API_KEY and len(OPENAI_API_KEY) > 10:
        configured = True

    return {
        "provider": provider,
        "configured": configured,
        "message": (
            "LLM AI assistance is active for natural-language synthesis." 
            if configured else 
            "Deterministic rule engine active. (Optional: configure GEMINI_API_KEY or OPENAI_API_KEY in backend/.env for AI narrative generation)."
        )
    }

async def generate_explanation_with_fallback(
    finding_category: str,
    evidence_names: list,
    discrepancy_details: str
) -> str:
    status = get_llm_status()
    if not status["configured"]:
        return (
            f"[Deterministic Synthesis] Analysis of {', '.join(evidence_names)} indicates a {finding_category} issue: "
            f"{discrepancy_details}. Corroboration with primary ledger or third-party bank settlement is advised."
        )

    # Optional Gemini / OpenAI async query
    try:
        if status["provider"] == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
            prompt = (
                f"You are a forensic document auditor. Write a concise, 2-sentence objective explanation for this evidence finding:\n"
                f"Category: {finding_category}\nDocuments: {evidence_names}\nDiscrepancy: {discrepancy_details}"
            )
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json={"contents": [{"parts": [{"text": prompt}]}]})
                if res.status_code == 200:
                    data = res.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as e:
        logger.warning(f"LLM API call failed, falling back to deterministic: {e}")

    return (
        f"[Deterministic Synthesis] Analysis of {', '.join(evidence_names)} indicates a {finding_category} issue: "
        f"{discrepancy_details}."
    )
