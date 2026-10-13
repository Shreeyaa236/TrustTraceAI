import os
import json
import logging
from typing import Dict, Any, Optional, List
import httpx
from app.config import LLM_PROVIDER, GEMINI_API_KEY, OPENAI_API_KEY
from app.services.storage import db

logger = logging.getLogger("trusttrace.llm")

# In-memory cache to avoid repeated expensive LLM calls for unchanged findings and gaps
_LLM_CACHE: Dict[str, Any] = {}

def get_effective_llm_config() -> Dict[str, Any]:
    """Reads configured provider and keys from env, with runtime fallback to app settings."""
    provider = (LLM_PROVIDER or "none").lower().strip()
    gemini_key = GEMINI_API_KEY
    openai_key = OPENAI_API_KEY

    # Check database settings as dynamic override if env is not configured
    try:
        settings = db.get_settings()
        if provider == "none" and settings.get("llm_provider"):
            provider = settings.get("llm_provider", "none").lower().strip()
        if not gemini_key and settings.get("gemini_api_key"):
            gemini_key = settings.get("gemini_api_key", "")
        if not openai_key and settings.get("openai_api_key"):
            openai_key = settings.get("openai_api_key", "")
    except Exception:
        pass

    configured = False
    if provider == "gemini" and gemini_key and len(gemini_key) > 8:
        configured = True
    elif provider == "openai" and openai_key and len(openai_key) > 8:
        configured = True

    return {
        "provider": provider,
        "configured": configured,
        "gemini_key": gemini_key,
        "openai_key": openai_key,
    }

def get_llm_status() -> Dict[str, Any]:
    cfg = get_effective_llm_config()
    return {
        "provider": cfg["provider"],
        "configured": cfg["configured"],
        "message": (
            f"Active: {cfg['provider'].upper()} AI narrative synthesis is active."
            if cfg["configured"] else
            "Deterministic rule engine active. (Configure GEMINI_API_KEY or OPENAI_API_KEY in backend/.env to activate AI narrative synthesis)."
        )
    }

def generate_deterministic_explanation(
    category: str,
    evidence_names: List[str],
    exact_field_or_passage: Optional[str],
    current_explanation: str
) -> str:
    """Fallback deterministic explanation grounded strictly in observed facts."""
    doc_str = ", ".join(evidence_names) if evidence_names else "submitted evidence"
    field_str = f" [{exact_field_or_passage}]" if exact_field_or_passage else ""
    return (
        f"[Deterministic Forensic Analysis] Review of {doc_str}{field_str} identifies a {category} observation. "
        f"{current_explanation} Independent confirmation against primary issuer records is recommended."
    )

async def _call_gemini_api(prompt: str, api_key: str) -> Optional[str]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 600}
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(url, json=payload)
        if res.status_code == 200:
            data = res.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "").strip()
        else:
            logger.warning(f"Gemini API returned status {res.status_code}: {res.text[:200]}")
    return None

async def _call_openai_api(prompt: str, api_key: str) -> Optional[str]:
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "You are a forensic document auditor. Analyze evidence discrepancies strictly and objectively."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "max_tokens": 600
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(url, json=payload, headers=headers)
        if res.status_code == 200:
            data = res.json()
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "").strip()
        else:
            logger.warning(f"OpenAI API returned status {res.status_code}: {res.text[:200]}")
    return None

async def explain_finding_with_ai(
    finding: Dict[str, Any],
    documents: List[Dict[str, Any]],
    primary_claim: str
) -> Dict[str, Any]:
    """
    Synthesizes an evidence-grounded AI explanation for a deterministic finding.
    Enforces strict grounding: no hallucinated facts, balanced plausible explanations,
    and concrete verification steps. Falls back safely if unconfigured or error.
    """
    cfg = get_effective_llm_config()
    finding_id = finding.get("finding_id", "FND")
    cache_key = f"finding_{finding_id}_{finding.get('category')}_{finding.get('exact_field_or_passage')}"

    if cache_key in _LLM_CACHE:
        return _LLM_CACHE[cache_key]

    affected_doc_ids = set(finding.get("affected_document_ids", []))
    affected_docs = [d for d in documents if d.get("id") in affected_doc_ids]
    doc_names = [d.get("file_name", "Document") for d in affected_docs]

    # If LLM is not configured, return deterministic synthesis
    if not cfg["configured"]:
        result = {
            "is_ai_assisted": False,
            "ai_explanation": None,
            "ai_analysis": None
        }
        _LLM_CACHE[cache_key] = result
        return result

    # Structured prompt strictly forbidding hallucination
    prompt = f"""You are a certified digital forensic auditor inspecting evidentiary records.
Analyze the following deterministically identified finding without inventing any dates, amounts, entities, or external verification.

Investigation Primary Claim: "{primary_claim}"
Finding ID: {finding.get('finding_id')}
Category: {finding.get('category')}
Severity: {finding.get('severity')}
Affected Documents: {', '.join(doc_names) if doc_names else 'Records in scope'}
Exact Observation: {finding.get('exact_field_or_passage', 'Not specified')}
Current Deterministic Observation: {finding.get('explanation')}

INSTRUCTIONS:
1. Ground your analysis ONLY on the stated observation. DO NOT invent dates, ledger IDs, or external events.
2. DO NOT declare whether a document is fraudulent or genuine. Maintain neutral, calibrated forensic language.
3. Respond ONLY with a valid JSON object matching this schema:
{{
  "observation_summary": "1-2 sentence neutral summary of what was observed",
  "why_it_matters": "Why this variance or anomaly is evidentially significant",
  "plausible_legitimate_explanation": "A realistic benign reason (e.g., timing difference, currency conversion, OCR artefact, amended bill)",
  "recommended_verification_step": "Precise independent action to verify the fact directly"
}}"""

    ai_text = None
    try:
        if cfg["provider"] == "gemini":
            ai_text = await _call_gemini_api(prompt, cfg["gemini_key"])
        elif cfg["provider"] == "openai":
            ai_text = await _call_openai_api(prompt, cfg["openai_key"])
    except Exception as e:
        logger.warning(f"LLM request error for {finding_id}: {e}")

    if ai_text:
        try:
            # Strip code fences if present
            cleaned = ai_text.strip()
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                cleaned = "\n".join(lines).strip()

            parsed = json.loads(cleaned)
            combined_explanation = (
                f"{parsed.get('observation_summary', '')} "
                f"Evidential Context: {parsed.get('why_it_matters', '')} "
                f"Plausible Cause: {parsed.get('plausible_legitimate_explanation', '')}"
            ).strip()

            result = {
                "is_ai_assisted": True,
                "ai_explanation": combined_explanation,
                "ai_analysis": parsed
            }
            _LLM_CACHE[cache_key] = result
            return result
        except Exception as parse_err:
            logger.warning(f"Failed to parse LLM JSON response: {parse_err}. Raw text: {ai_text[:120]}")

    result = {
        "is_ai_assisted": False,
        "ai_explanation": None,
        "ai_analysis": None
    }
    _LLM_CACHE[cache_key] = result
    return result

async def enrich_findings_with_ai(
    findings: List[Dict[str, Any]],
    documents: List[Dict[str, Any]],
    primary_claim: str
) -> List[Dict[str, Any]]:
    """Enriches a list of findings with evidence-grounded AI explanations when configured."""
    enriched = []
    for f in findings:
        ai_meta = await explain_finding_with_ai(f, documents, primary_claim)
        f_copy = dict(f)
        f_copy["is_ai_assisted"] = ai_meta["is_ai_assisted"]
        f_copy["ai_explanation"] = ai_meta["ai_explanation"]
        f_copy["ai_analysis"] = ai_meta["ai_analysis"]
        if ai_meta["is_ai_assisted"] and ai_meta["ai_explanation"]:
            f_copy["explanation"] = f"{f_copy['explanation']} [AI Synthesis: {ai_meta['ai_explanation']}]"
        enriched.append(f_copy)
    return enriched

async def enrich_gaps_with_ai(
    gap_eval: Dict[str, Any],
    documents: List[Dict[str, Any]],
    primary_claim: str
) -> Dict[str, Any]:
    """Enriches Evidence Gap items with grounded next-action recommendations."""
    cfg = get_effective_llm_config()
    if not cfg["configured"] or not gap_eval.get("gaps"):
        return gap_eval

    enriched_gaps = []
    for gap in gap_eval.get("gaps", []):
        gap_copy = dict(gap)
        cache_key = f"gap_{gap.get('id', '')}_{gap.get('missing_information', '')[:30]}"
        if cache_key in _LLM_CACHE:
            gap_copy["ai_enhanced_recommendation"] = _LLM_CACHE[cache_key]
            enriched_gaps.append(gap_copy)
            continue

        prompt = f"""You are an evidentiary investigator. Provide a concise, practical 1-sentence verification recommendation for this evidence gap:
Claim: "{primary_claim}"
Missing Information: "{gap.get('missing_information')}"
Available Evidence: {gap.get('available_evidence')}
Current Recommended Step: "{gap.get('recommended_step')}"

Respond with ONLY 1 sentence specifying the exact neutral third-party verification method to resolve this gap."""

        rec_text = None
        try:
            if cfg["provider"] == "gemini":
                rec_text = await _call_gemini_api(prompt, cfg["gemini_key"])
            elif cfg["provider"] == "openai":
                rec_text = await _call_openai_api(prompt, cfg["openai_key"])
        except Exception as e:
            logger.debug(f"LLM gap recommendation failed: {e}")

        if rec_text:
            rec_text = rec_text.strip().strip('"')
            gap_copy["ai_enhanced_recommendation"] = rec_text
            _LLM_CACHE[cache_key] = rec_text
        enriched_gaps.append(gap_copy)

    gap_eval_copy = dict(gap_eval)
    gap_eval_copy["gaps"] = enriched_gaps
    return gap_eval_copy
