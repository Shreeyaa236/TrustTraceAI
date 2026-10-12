import json
import logging
import threading
from typing import List, Optional, Dict, Any
from pathlib import Path
from app.config import MONGO_URI, DATA_DIR

logger = logging.getLogger("trusttrace.storage")

class StorageService:
    def __init__(self):
        self.lock = threading.Lock()
        self.use_mongo = False
        self.mongo_client = None
        self.db = None
        self.json_file = DATA_DIR / "store.json"
        
        self._init_mongo()
        if not self.use_mongo:
            self._init_json_store()

    def _init_mongo(self):
        try:
            from pymongo import MongoClient
            client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=1000)
            client.admin.command('ping')
            self.mongo_client = client
            self.db = client.get_default_database() or client["trusttrace"]
            self.use_mongo = True
            logger.info("Connected to MongoDB successfully.")
        except Exception as e:
            self.use_mongo = False
            logger.info(f"MongoDB not available ({e}). Using persistent local JSON repository.")

    def _init_json_store(self):
        with self.lock:
            if not self.json_file.exists():
                initial_data = {
                    "investigations": {},
                    "documents": {},
                    "claims": {},
                    "findings": {},
                    "relationships": {},
                    "versions": {},
                    "audit_actions": {},
                    "settings": {
                        "user_profile": {"name": "Senior Investigator", "role": "Lead Digital Forensics Reviewer", "email": "investigator@trusttrace.ai"},
                        "notification_preferences": {"email_alerts": True, "critical_contradictions": True, "weekly_digest": False},
                        "data_retention_days": 90,
                        "llm_provider": "none",
                        "gemini_api_key": "",
                        "openai_api_key": "",
                        "deterministic_strictness": "Standard"
                    }
                }
                with open(self.json_file, "w", encoding="utf-8") as f:
                    json.dump(initial_data, f, indent=2)

    def _read_json(self) -> Dict[str, Any]:
        with self.lock:
            if not self.json_file.exists():
                self._init_json_store()
            try:
                with open(self.json_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}

    def _write_json(self, data: Dict[str, Any]):
        with self.lock:
            with open(self.json_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

    # --- INVESTIGATIONS ---
    def get_investigations(self) -> List[Dict[str, Any]]:
        if self.use_mongo:
            docs = list(self.db.investigations.find({}, {"_id": 0}))
            return sorted(docs, key=lambda x: x.get("updated_at", ""), reverse=True)
        data = self._read_json()
        items = list(data.get("investigations", {}).values())
        return sorted(items, key=lambda x: x.get("updated_at", ""), reverse=True)

    def get_investigation(self, inv_id: str) -> Optional[Dict[str, Any]]:
        if self.use_mongo:
            return self.db.investigations.find_one({"id": inv_id}, {"_id": 0})
        data = self._read_json()
        return data.get("investigations", {}).get(inv_id)

    def save_investigation(self, inv: Dict[str, Any]):
        if self.use_mongo:
            self.db.investigations.update_one({"id": inv["id"]}, {"$set": inv}, upsert=True)
            return
        data = self._read_json()
        if "investigations" not in data:
            data["investigations"] = {}
        data["investigations"][inv["id"]] = inv
        self._write_json(data)

    def delete_investigation(self, inv_id: str):
        if self.use_mongo:
            self.db.investigations.delete_one({"id": inv_id})
            self.db.documents.delete_many({"investigation_id": inv_id})
            self.db.findings.delete_many({"investigation_id": inv_id})
            self.db.claims.delete_many({"investigation_id": inv_id})
            self.db.versions.delete_many({"investigation_id": inv_id})
            self.db.audit_actions.delete_many({"investigation_id": inv_id})
            return
        data = self._read_json()
        data.get("investigations", {}).pop(inv_id, None)
        
        # Cascade delete
        docs = data.get("documents", {})
        doc_keys = [k for k, v in docs.items() if v.get("investigation_id") == inv_id]
        for k in doc_keys:
            docs.pop(k, None)
            
        data.get("claims", {}).pop(inv_id, None)
        data.get("findings", {}).pop(inv_id, None)
        data.get("versions", {}).pop(inv_id, None)
        data.get("audit_actions", {}).pop(inv_id, None)
        self._write_json(data)

    # --- DOCUMENTS ---
    def get_documents(self, inv_id: str) -> List[Dict[str, Any]]:
        if self.use_mongo:
            return list(self.db.documents.find({"investigation_id": inv_id}, {"_id": 0}))
        data = self._read_json()
        return [v for v in data.get("documents", {}).values() if v.get("investigation_id") == inv_id]

    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        if self.use_mongo:
            return self.db.documents.find_one({"id": doc_id}, {"_id": 0})
        data = self._read_json()
        return data.get("documents", {}).get(doc_id)

    def save_document(self, doc: Dict[str, Any]):
        if self.use_mongo:
            self.db.documents.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
            return
        data = self._read_json()
        if "documents" not in data:
            data["documents"] = {}
        data["documents"][doc["id"]] = doc
        self._write_json(data)

    def delete_document(self, doc_id: str):
        if self.use_mongo:
            self.db.documents.delete_one({"id": doc_id})
            return
        data = self._read_json()
        data.get("documents", {}).pop(doc_id, None)
        self._write_json(data)

    # --- CLAIMS ---
    def get_claims(self, inv_id: str) -> List[Dict[str, Any]]:
        if self.use_mongo:
            return list(self.db.claims.find({"investigation_id": inv_id}, {"_id": 0}))
        data = self._read_json()
        return data.get("claims", {}).get(inv_id, [])

    def save_claims(self, inv_id: str, claims: List[Dict[str, Any]]):
        if self.use_mongo:
            self.db.claims.delete_many({"investigation_id": inv_id})
            if claims:
                self.db.claims.insert_many(claims)
            return
        data = self._read_json()
        if "claims" not in data:
            data["claims"] = {}
        data["claims"][inv_id] = claims
        self._write_json(data)

    # --- FINDINGS ---
    def get_findings(self, inv_id: str) -> List[Dict[str, Any]]:
        if self.use_mongo:
            return list(self.db.findings.find({"investigation_id": inv_id}, {"_id": 0}))
        data = self._read_json()
        return data.get("findings", {}).get(inv_id, [])

    def save_findings(self, inv_id: str, findings: List[Dict[str, Any]]):
        if self.use_mongo:
            self.db.findings.delete_many({"investigation_id": inv_id})
            if findings:
                self.db.findings.insert_many(findings)
            return
        data = self._read_json()
        if "findings" not in data:
            data["findings"] = {}
        data["findings"][inv_id] = findings
        self._write_json(data)

    def update_finding(self, inv_id: str, finding_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        findings = self.get_findings(inv_id)
        target = None
        for f in findings:
            if f.get("id") == finding_id or f.get("finding_id") == finding_id:
                f.update(updates)
                target = f
                break
        if target:
            self.save_findings(inv_id, findings)
        return target

    # --- AUDIT ACTIONS ---
    def log_audit_action(self, action: Dict[str, Any]):
        inv_id = action.get("investigation_id", "global")
        if self.use_mongo:
            self.db.audit_actions.insert_one(action)
            return
        data = self._read_json()
        if "audit_actions" not in data:
            data["audit_actions"] = {}
        if inv_id not in data["audit_actions"]:
            data["audit_actions"][inv_id] = []
        data["audit_actions"][inv_id].insert(0, action)
        self._write_json(data)

    def get_audit_actions(self, inv_id: str) -> List[Dict[str, Any]]:
        if self.use_mongo:
            return list(self.db.audit_actions.find({"investigation_id": inv_id}, {"_id": 0}).sort("timestamp", -1))
        data = self._read_json()
        return data.get("audit_actions", {}).get(inv_id, [])

    # --- VERSIONS ---
    def get_versions(self, inv_id: str) -> List[Dict[str, Any]]:
        if self.use_mongo:
            return list(self.db.versions.find({"investigation_id": inv_id}, {"_id": 0}).sort("version_number", 1))
        data = self._read_json()
        return data.get("versions", {}).get(inv_id, [])

    def save_version(self, inv_id: str, version_snapshot: Dict[str, Any]):
        if self.use_mongo:
            self.db.versions.update_one(
                {"investigation_id": inv_id, "version_number": version_snapshot["version_number"]},
                {"$set": version_snapshot},
                upsert=True
            )
            return
        data = self._read_json()
        if "versions" not in data:
            data["versions"] = {}
        if inv_id not in data["versions"]:
            data["versions"][inv_id] = []
        # Replace if version exists, or append
        vers = [v for v in data["versions"][inv_id] if v["version_number"] != version_snapshot["version_number"]]
        vers.append(version_snapshot)
        vers.sort(key=lambda x: x["version_number"])
        data["versions"][inv_id] = vers
        self._write_json(data)

    # --- SETTINGS ---
    def get_settings(self) -> Dict[str, Any]:
        data = self._read_json()
        return data.get("settings", {})

    def save_settings(self, settings: Dict[str, Any]):
        data = self._read_json()
        data["settings"] = settings
        self._write_json(data)

db = StorageService()
