import {
  Investigation, DocumentItem, Finding, EvidenceGap,
  ProvenanceGraphData, TimeMachineResult, VersionComparison,
  AuditAction, DimensionAssessment, User, AuthResponse, Job,
  TimelineResponse
} from '../types';

const API_BASE = '/api';

export const getAuthToken = (): string | null => {
  return localStorage.getItem('trusttrace_auth_token');
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem('trusttrace_auth_token', token);
};

export const clearAuthToken = (): void => {
  localStorage.removeItem('trusttrace_auth_token');
};

const getHeaders = (extra: HeadersInit = {}): HeadersInit => {
  const headers: Record<string, string> = { ...extra as Record<string, string> };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // --- AUTHENTICATION ---
  async register(data: { email: string; username: string; password: string; full_name?: string }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(err.detail || 'Registration failed');
    }
    const result: AuthResponse = await res.json();
    setAuthToken(result.access_token);
    return result;
  },

  async login(data: { email: string; password: string }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Invalid credentials' }));
      throw new Error(err.detail || 'Login failed');
    }
    const result: AuthResponse = await res.json();
    setAuthToken(result.access_token);
    return result;
  },

  async getMe(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Session invalid or expired');
    return res.json();
  },

  // --- INVESTIGATIONS ---
  async getInvestigations(search?: string, category?: string, status?: string): Promise<Investigation[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    if (status) params.append('status', status);
    
    const res = await fetch(`${API_BASE}/investigations?${params.toString()}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch investigations');
    return res.json();
  },

  async getInvestigation(id: string): Promise<Investigation> {
    const res = await fetch(`${API_BASE}/investigations/${id}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Investigation not found');
    return res.json();
  },

  async createInvestigation(data: {
    name: string;
    description: string;
    case_reference?: string;
    category: string;
    primary_claim: string;
    reviewer_notes?: string;
  }): Promise<Investigation> {
    const res = await fetch(`${API_BASE}/investigations`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create investigation');
    return res.json();
  },

  async deleteInvestigation(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/investigations/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete investigation');
  },

  // --- DOCUMENTS (TASK 2: PER-FILE CATEGORIES) ---
  async getDocuments(investigationId: string): Promise<DocumentItem[]> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/documents`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },

  async getDocument(docId: string): Promise<DocumentItem> {
    const res = await fetch(`${API_BASE}/documents/${docId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch document details');
    return res.json();
  },

  async updateDocument(docId: string, updates: Partial<DocumentItem>): Promise<DocumentItem> {
    const res = await fetch(`${API_BASE}/documents/${docId}`, {
      method: 'PATCH',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update document');
    return res.json();
  },

  async uploadDocuments(
    investigationId: string,
    files: File[],
    category?: string,
    issuingOrg?: string,
    sourceName?: string,
    notes?: string,
    fileMetadata?: Array<{
      filename: string;
      category: string;
      issuing_organization?: string;
      source_name?: string;
      reviewer_notes?: string;
    }>
  ): Promise<{ uploaded_count: number; documents: DocumentItem[] }> {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (category) formData.append('category', category);
    if (issuingOrg) formData.append('issuing_organization', issuingOrg);
    if (sourceName) formData.append('source_name', sourceName);
    if (notes) formData.append('reviewer_notes', notes);
    if (fileMetadata && fileMetadata.length > 0) {
      formData.append('file_metadata', JSON.stringify(fileMetadata));
    }

    const res = await fetch(`${API_BASE}/investigations/${investigationId}/documents`, {
      method: 'POST',
      headers: getHeaders(),
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to upload files' }));
      throw new Error(err.detail || 'Failed to upload files');
    }
    return res.json();
  },

  // --- ANALYSIS & RESULTS ---
  async runAnalysis(investigationId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/analyze`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Analysis run failed');
    return res.json();
  },

  // --- BACKGROUND JOBS (TASK 5) ---
  async runAnalysisAsync(investigationId: string): Promise<{ job_id: string; status: string; investigation_id: string }> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/analyze-async`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Async analysis launch failed');
    return res.json();
  },

  async getJobStatus(jobId: string): Promise<Job> {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to retrieve job status');
    return res.json();
  },

  async retryJob(jobId: string): Promise<{ job_id: string; status: string }> {
    const res = await fetch(`${API_BASE}/jobs/${jobId}/retry`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Job retry failed');
    return res.json();
  },

  async getResults(investigationId: string): Promise<{
    investigation: Investigation;
    documents: DocumentItem[];
    findings: Finding[];
    gap_evaluation: {
      gaps: EvidenceGap[];
      overall_status: string;
      overall_explanation: string;
      dimensions: DimensionAssessment[];
    };
  }> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/results`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch analysis results');
    return res.json();
  },

  // --- PROVENANCE GRAPH ---
  async getProvenanceGraph(investigationId: string): Promise<ProvenanceGraphData> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/graph`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch provenance graph');
    return res.json();
  },

  // --- EVIDENCE GAP FINDER ---
  async getEvidenceGaps(investigationId: string): Promise<{
    gaps: EvidenceGap[];
    overall_status: string;
    overall_explanation: string;
    dimensions: DimensionAssessment[];
  }> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/gaps`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch gaps');
    return res.json();
  },

  // --- CHRONOLOGICAL TIMELINE (TASK 7) ---
  async getTimeline(investigationId: string): Promise<TimelineResponse> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/timeline`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch investigation timeline');
    return res.json();
  },

  // --- ON-DEMAND AI EXPLANATION (TASK 1) ---
  async explainFindingWithAI(investigationId: string, findingId: string): Promise<Finding> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/findings/${findingId}/explain-ai`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to generate AI explanation');
    return res.json();
  },

  // --- EVIDENCE TIME MACHINE ---
  async simulateRemoval(investigationId: string, excludedDocIds: string[]): Promise<TimeMachineResult> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/simulate-removal`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ excluded_document_ids: excludedDocIds }),
    });
    if (!res.ok) throw new Error('Simulation failed');
    return res.json();
  },

  // --- VERSIONS & COMPARISON ---
  async reanalyzeNewVersion(investigationId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/reanalyze`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to create new version');
    return res.json();
  },

  async getVersions(investigationId: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/versions`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch versions');
    return res.json();
  },

  async compareVersions(investigationId: string, base: number, target: number): Promise<VersionComparison> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/compare?base_version=${base}&target_version=${target}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to compare versions');
    return res.json();
  },

  // --- HUMAN REVIEW FINDINGS ---
  async updateFindingStatus(
    investigationId: string,
    findingId: string,
    status: string,
    notes?: string
  ): Promise<Finding> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/findings/${findingId}`, {
      method: 'PATCH',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ reviewer_status: status, reviewer_notes: notes }),
    });
    if (!res.ok) throw new Error('Failed to update finding status');
    return res.json();
  },

  // --- AUDIT ACTIONS ---
  async getAuditLog(investigationId: string): Promise<AuditAction[]> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/audit`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch audit log');
    return res.json();
  },

  // --- REPORT PREVIEW & PDF URL ---
  async getReportPreview(investigationId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/report`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch report preview');
    return res.json();
  },

  getReportPdfUrl(investigationId: string): string {
    return `${API_BASE}/investigations/${investigationId}/report/pdf`;
  },

  // --- SETTINGS & DIAGNOSTICS ---
  async getSettings(): Promise<any> {
    const res = await fetch(`${API_BASE}/settings`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async saveSettings(settings: any): Promise<void> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to save settings');
  },

  async getLlmStatus(): Promise<{ provider: string; configured: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/llm/status`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to check LLM status');
    return res.json();
  },

  async getOcrStatus(): Promise<{ engine: string; available: boolean; binary_path?: string; setup_guide: string }> {
    const res = await fetch(`${API_BASE}/ocr/status`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to check OCR status');
    return res.json();
  },

  async resetDemoCase(): Promise<any> {
    const res = await fetch(`${API_BASE}/demo/reset`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to reset demo');
    return res.json();
  },

  async resetDemo(): Promise<any> {
    return this.resetDemoCase();
  }
};
