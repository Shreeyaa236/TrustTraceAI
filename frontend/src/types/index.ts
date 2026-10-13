export interface OptionalSourceDetails {
  issuing_organization?: string;
  source_name?: string;
  date_received?: string;
  original_source_url?: string;
  reviewer_notes?: string;
}

export interface DocumentMetadata {
  creation_date?: string | null;
  modification_date?: string | null;
  author?: string | null;
  creator?: string | null;
  producer?: string | null;
  page_count: number;
  pdf_version?: string | null;
  file_size_bytes: number;
  file_hash: string;
  completeness_score: number;
  has_digital_signatures: boolean;
  font_count: number;
  embedded_images_count: number;
  is_encrypted: boolean;
  extraction_method?: string;
  ocr_status?: string;
  ocr_pages?: number[];
  ocr_confidence?: number;
  image_dimensions?: string;
}

export interface ExtractedFields {
  amounts: string[];
  dates: string[];
  document_numbers: string[];
  reference_ids: string[];
  organizations: string[];
  names: string[];
  payment_references: string[];
  claims: string[];
}

export interface DocumentItem {
  id: string;
  investigation_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_hash: string;
  file_path: string;
  category: string;
  classification: string;
  metadata: DocumentMetadata;
  extracted_text: string;
  extracted_fields: ExtractedFields;
  source_details: OptionalSourceDetails;
  processing_status: 'uploaded' | 'processing' | 'analyzed' | 'error';
  upload_timestamp: string;
  reviewer_notes?: string;
  ocr_details?: Record<string, any>;
}

export interface DimensionAssessment {
  dimension_name: string;
  status: string;
  supporting_observations: string[];
  unresolved_concerns: string[];
  relevant_evidence: string[];
  explanation: string;
  suggested_next_action: string;
}

export interface EvidenceGap {
  id: string;
  claim_text: string;
  available_evidence: string[];
  missing_information: string;
  why_it_matters: string;
  recommended_step: string;
  related_document_ids: string[];
  status: string;
  ai_enhanced_recommendation?: string;
}

export interface Finding {
  id: string;
  finding_id: string;
  investigation_id: string;
  category: string;
  severity: 'Informational' | 'Low' | 'Medium' | 'High';
  affected_claim: string;
  affected_document_ids: string[];
  exact_field_or_passage?: string;
  page_number?: number;
  explanation: string;
  supporting_observations: string[];
  suggested_verification_step: string;
  reviewer_status: 'Open' | 'Under Review' | 'Confirmed Finding' | 'Resolved' | 'Dismissed';
  reviewer_notes?: string;
  created_at: string;
  is_ai_assisted?: boolean;
  ai_explanation?: string;
  ai_analysis?: Record<string, any>;
}

export interface Investigation {
  id: string;
  name: string;
  description: string;
  case_reference?: string;
  category: string;
  primary_claim: string;
  creator: string;
  creator_id?: string;
  creator_email?: string;
  created_at: string;
  updated_at: string;
  current_version: number;
  status: 'Not Analyzed' | 'Processing' | 'Review Required' | 'Analysis Complete' | 'Failed';
  reviewer_notes?: string;
  document_count: number;
  findings_count: number;
  is_demo?: boolean;
}

export interface AuditAction {
  id: string;
  investigation_id: string;
  timestamp: string;
  reviewer: string;
  action_type: string;
  description: string;
  metadata: Record<string, any>;
}

export interface ProvenanceGraphData {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, any>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label: string;
    sourceHandle?: string;
    targetHandle?: string;
    type?: string;
    animated?: boolean;
    style?: Record<string, any>;
    data?: Record<string, any>;
  }>;
  total_nodes: number;
  total_edges: number;
  clusters: Array<{ cluster_id: number; node_count: number; nodes: string[] }>;
}

export interface TimeMachineResult {
  excluded_document_ids: string[];
  excluded_document_names: string[];
  claims_that_lost_support: Array<{
    claim_text: string;
    original_status: string;
    simulated_status: string;
    reason: string;
    impact: string;
  }>;
  claims_still_supported: Array<{
    claim_text: string;
    status: string;
    notes: string;
  }>;
  affected_relationships: Array<{
    source: string;
    target: string;
    previous_edge: string;
    simulated_edge: string;
    details: string;
  }>;
  recommended_next_checks: string[];
  simulated_graph: ProvenanceGraphData;
  original_status: string;
  simulated_status: string;
}

export interface VersionComparison {
  investigation_id: string;
  base_version: number;
  target_version: number;
  documents_added: string[];
  documents_removed: string[];
  new_findings: Finding[];
  resolved_findings: Finding[];
  new_contradictions: Finding[];
  newly_supported_claims: string[];
  claims_requiring_review: string[];
  changed_relationships: Array<{ type: string; count: number; description: string }>;
  summary: string;
}

// --- AUTH TYPES ---
export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// --- BACKGROUND JOB TYPES ---
export interface Job {
  job_id: string;
  investigation_id: string;
  job_type: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress_stage: string;
  error?: string | null;
  created_at: string;
  completed_at?: string | null;
  result_summary?: Record<string, any>;
}

// --- TIMELINE TYPES ---
export interface TimelineEvent {
  id: string;
  investigation_id: string;
  document_id?: string;
  document_name: string;
  category: string;
  date_str: string;
  date_type: string;
  parsed_date?: string | null;
  description: string;
  is_conflict: boolean;
  conflict_details?: string | null;
  related_finding_id?: string | null;
}

export interface TimelineResponse {
  investigation_id: string;
  events: TimelineEvent[];
  total_events: number;
  conflicts_count: number;
  date_range?: { start: string; end: string } | null;
}
