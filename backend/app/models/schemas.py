from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class OptionalSourceDetails(BaseModel):
    issuing_organization: Optional[str] = ""
    source_name: Optional[str] = ""
    date_received: Optional[str] = ""
    original_source_url: Optional[str] = ""
    reviewer_notes: Optional[str] = ""

class DocumentMetadata(BaseModel):
    creation_date: Optional[str] = None
    modification_date: Optional[str] = None
    author: Optional[str] = None
    creator: Optional[str] = None
    producer: Optional[str] = None
    page_count: int = 1
    pdf_version: Optional[str] = None
    file_size_bytes: int = 0
    file_hash: str = ""
    completeness_score: float = 0.0
    has_digital_signatures: bool = False
    font_count: int = 0
    embedded_images_count: int = 0
    is_encrypted: bool = False

class ExtractedFields(BaseModel):
    amounts: List[str] = Field(default_factory=list)
    dates: List[str] = Field(default_factory=list)
    document_numbers: List[str] = Field(default_factory=list)
    reference_ids: List[str] = Field(default_factory=list)
    organizations: List[str] = Field(default_factory=list)
    names: List[str] = Field(default_factory=list)
    payment_references: List[str] = Field(default_factory=list)
    claims: List[str] = Field(default_factory=list)

class DocumentModel(BaseModel):
    id: str
    investigation_id: str
    file_name: str
    file_type: str
    file_size: int
    file_hash: str
    file_path: str
    category: str = "Unknown / Needs Review"
    classification: str = "Unable to Determine"  # "Likely Text-Based PDF", "Likely Image-Based PDF", "Mixed Text and Image PDF", "Unable to Determine"
    metadata: DocumentMetadata
    extracted_text: str = ""
    extracted_fields: ExtractedFields
    source_details: OptionalSourceDetails = Field(default_factory=OptionalSourceDetails)
    processing_status: str = "uploaded"  # uploaded, processing, analyzed, error
    upload_timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    reviewer_notes: Optional[str] = ""

class DimensionAssessment(BaseModel):
    dimension_name: str  # Consistency, Source Independence, Authenticity Verification, Evidence Completeness
    status: str          # Supported, Consistent, Potential Conflict, Unverified, Incomplete
    supporting_observations: List[str] = Field(default_factory=list)
    unresolved_concerns: List[str] = Field(default_factory=list)
    relevant_evidence: List[str] = Field(default_factory=list)
    explanation: str
    suggested_next_action: str

class ClaimModel(BaseModel):
    id: str
    investigation_id: str
    claim_text: str
    status: str = "Partially Supported"  # Supported by Available Evidence, Partially Supported, Contradicted, Insufficient Evidence, Unable to Verify
    explanation: str = ""
    related_document_ids: List[str] = Field(default_factory=list)
    dimensions: List[DimensionAssessment] = Field(default_factory=list)
    suggested_action: str = ""

class FindingModel(BaseModel):
    id: str
    finding_id: str  # e.g. FND-001
    investigation_id: str
    category: str   # Inconsistency, Potential Duplicate, Potential Dependency, Timeline Conflict, Missing Evidence, Metadata Observation, Authenticity Verification Needed
    severity: str   # Informational, Low, Medium, High
    affected_claim: str
    affected_document_ids: List[str] = Field(default_factory=list)
    exact_field_or_passage: Optional[str] = None
    page_number: Optional[int] = None
    explanation: str
    supporting_observations: List[str] = Field(default_factory=list)
    suggested_verification_step: str
    reviewer_status: str = "Open"  # Open, Under Review, Confirmed Finding, Resolved, Dismissed
    reviewer_notes: Optional[str] = ""
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class GraphNode(BaseModel):
    id: str
    type: str  # claimNode, documentNode, factNode, sourceNode, findingNode
    data: Dict[str, Any]
    position: Dict[str, float]

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str  # SUPPORTS, CONTRADICTS, REFERENCES, POSSIBLY_DERIVED_FROM, DUPLICATE_OR_SIMILAR_TO, ISSUED_BY, RELATES_TO
    animated: bool = False
    style: Optional[Dict[str, Any]] = None
    data: Optional[Dict[str, Any]] = None

class ProvenanceGraphResponse(BaseModel):
    nodes: List[GraphNode] = Field(default_factory=list)
    edges: List[GraphEdge] = Field(default_factory=list)
    total_nodes: int = 0
    total_edges: int = 0
    clusters: List[Dict[str, Any]] = Field(default_factory=list)

class EvidenceGapItem(BaseModel):
    id: str
    claim_text: str
    available_evidence: List[str]
    missing_information: str
    why_it_matters: str
    recommended_step: str
    related_document_ids: List[str]
    status: str  # Supported by Available Evidence, Partially Supported, Contradicted, Insufficient Evidence, Unable to Verify

class InvestigationCreate(BaseModel):
    name: str
    description: str
    case_reference: Optional[str] = None
    category: str = "Financial Transactions"
    primary_claim: str
    reviewer_notes: Optional[str] = None

class InvestigationModel(BaseModel):
    id: str
    name: str
    description: str
    case_reference: Optional[str] = None
    category: str
    primary_claim: str
    creator: str = "Investigator"
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    current_version: int = 1
    status: str = "Not Analyzed"  # Not Analyzed, Processing, Review Required, Analysis Complete, Failed
    reviewer_notes: Optional[str] = None
    document_count: int = 0
    findings_count: int = 0
    is_demo: bool = False

class AuditActionModel(BaseModel):
    id: str
    investigation_id: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    reviewer: str = "Investigator"
    action_type: str  # document_upload, classification_change, finding_status_change, field_correction, simulation_run, reanalysis, report_exported
    description: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

class SimulationRequest(BaseModel):
    excluded_document_ids: List[str]

class SimulationResponse(BaseModel):
    excluded_document_ids: List[str]
    excluded_document_names: List[str]
    claims_that_lost_support: List[Dict[str, Any]]
    claims_still_supported: List[Dict[str, Any]]
    affected_relationships: List[Dict[str, Any]]
    recommended_next_checks: List[str]
    simulated_graph: ProvenanceGraphResponse

class VersionSnapshotModel(BaseModel):
    version_number: int
    investigation_id: str
    timestamp: str
    document_ids: List[str]
    document_count: int
    findings_count: int
    summary: str
    claims_state: List[Dict[str, Any]]
    findings_state: List[Dict[str, Any]]

class VersionComparisonResponse(BaseModel):
    investigation_id: str
    base_version: int
    target_version: int
    documents_added: List[str]
    documents_removed: List[str]
    new_findings: List[FindingModel]
    resolved_findings: List[FindingModel]
    new_contradictions: List[FindingModel]
    newly_supported_claims: List[str]
    claims_requiring_review: List[str]
    changed_relationships: List[Dict[str, Any]]
    summary: str
