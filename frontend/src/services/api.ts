import {
  Investigation, DocumentItem, Finding, EvidenceGap,
  ProvenanceGraphData, TimeMachineResult, VersionComparison,
  AuditAction, DimensionAssessment
} from '../types';

const API_BASE = '/api';

export const api = {
  // Investigations
  async getInvestigations(search?: string, category?: string, status?: string): Promise<Investigation[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    if (status) params.append('status', status);
    
    const res = await fetch(`${API_BASE}/investigations?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch investigations');
    return res.json();
  },

  async getInvestigation(id: string): Promise<Investigation> {
    const res = await fetch(`${API_BASE}/investigations/${id}`);
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create investigation');
    return res.json();
  },

  async deleteInvestigation(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/investigations/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete investigation');
  },

  // Documents
  async getDocuments(investigationId: string): Promise<DocumentItem[]> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/documents`);
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },

  async getDocument(docId: string): Promise<DocumentItem> {
    const res = await fetch(`${API_BASE}/documents/${docId}`);
    if (!res.ok) throw new Error('Failed to fetch document details');
    return res.json();
  },

  async updateDocument(docId: string, updates: Partial<DocumentItem>): Promise<DocumentItem> {
    const res = await fetch(`${API_BASE}/documents/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
    notes?: string
  ): Promise<{ uploaded_count: number; documents: DocumentItem[] }> {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (category) formData.append('category', category);
    if (issuingOrg) formData.append('issuing_organization', issuingOrg);
    if (sourceName) formData.append('source_name', sourceName);
    if (notes) formData.append('reviewer_notes', notes);

    const res = await fetch(`${API_BASE}/investigations/${investigationId}/documents`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload files');
    return res.json();
  },

  // Analysis & Results
  async runAnalysis(investigationId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/analyze`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Analysis run failed');
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
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/results`);
    if (!res.ok) throw new Error('Failed to fetch analysis results');
    return res.json();
  },

  // Provenance Graph
  async getProvenanceGraph(investigationId: string): Promise<ProvenanceGraphData> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/graph`);
    if (!res.ok) throw new Error('Failed to fetch provenance graph');
    return res.json();
  },

  // Evidence Gap Finder
  async getEvidenceGaps(investigationId: string): Promise<{
    gaps: EvidenceGap[];
    overall_status: string;
    overall_explanation: string;
    dimensions: DimensionAssessment[];
  }> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/gaps`);
    if (!res.ok) throw new Error('Failed to fetch gaps');
    return res.json();
  },

  // Evidence Time Machine
  async simulateRemoval(investigationId: string, excludedDocIds: string[]): Promise<TimeMachineResult> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/simulate-removal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ excluded_document_ids: excludedDocIds }),
    });
    if (!res.ok) throw new Error('Simulation failed');
    return res.json();
  },

  // Versions & Comparison
  async reanalyzeNewVersion(investigationId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/reanalyze`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to create new version');
    return res.json();
  },

  async getVersions(investigationId: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/versions`);
    if (!res.ok) throw new Error('Failed to fetch versions');
    return res.json();
  },

  async compareVersions(investigationId: string, base: number, target: number): Promise<VersionComparison> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/compare?base_version=${base}&target_version=${target}`);
    if (!res.ok) throw new Error('Failed to compare versions');
    return res.json();
  },

  // Human Review Findings
  async updateFindingStatus(
    investigationId: string,
    findingId: string,
    status: string,
    notes?: string
  ): Promise<Finding> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/findings/${findingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer_status: status, reviewer_notes: notes || '' }),
    });
    if (!res.ok) throw new Error('Failed to update finding status');
    return res.json();
  },

  // Audit Log
  async getAuditLog(investigationId: string): Promise<AuditAction[]> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/audit`);
    if (!res.ok) throw new Error('Failed to fetch audit log');
    return res.json();
  },

  // Report
  async getReportPreview(investigationId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/report`);
    if (!res.ok) throw new Error('Failed to fetch report preview');
    return res.json();
  },

  getReportPdfUrl(investigationId: string): string {
    return `${API_BASE}/investigations/${investigationId}/report/pdf`;
  },

  // Settings
  async getSettings(): Promise<any> {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async saveSettings(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save settings');
    return res.json();
  },

  // Reset Demo
  async resetDemo(): Promise<any> {
    const res = await fetch(`${API_BASE}/demo/reset`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset demo case');
    return res.json();
  },

  async getLlmStatus(): Promise<{ provider: string; configured: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/llm/status`);
    if (!res.ok) return { provider: 'none', configured: false, message: 'LLM status check unavailable' };
    return res.json();
  }
};
