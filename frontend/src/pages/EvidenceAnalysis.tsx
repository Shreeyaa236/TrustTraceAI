import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ScanSearch,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  FileText,
  Filter,
  Check,
  XCircle,
  HelpCircle,
  ShieldCheck,
  Layers,
  ArrowRight,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { useInvestigation } from '../context/InvestigationContext';
import { Badge } from '../components/Badge';
import { api } from '../services/api';
import { Finding, DocumentItem, DimensionAssessment, EvidenceGap } from '../types';

export const EvidenceAnalysis: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { activeInvestigation, selectInvestigationById, refreshInvestigations } = useInvestigation();

  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [dimensions, setDimensions] = useState<DimensionAssessment[]>([]);
  const [gaps, setGaps] = useState<EvidenceGap[]>([]);
  const [overallStatus, setOverallStatus] = useState<string>('Review Required');
  const [overallExplanation, setOverallExplanation] = useState<string>('');

  // Finding filter
  const [severityFilter, setSeverityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [reviewerStatusFilter, setReviewerStatusFilter] = useState('All');

  // Selected finding for modal/status update
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const targetId = id || activeInvestigation?.id || 'demo';

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getResults(targetId);
      setDocuments(res.documents || []);
      setFindings(res.findings || []);
      setDimensions(res.gap_evaluation?.dimensions || []);
      setGaps(res.gap_evaluation?.gaps || []);
      setOverallStatus(res.gap_evaluation?.overall_status || 'Review Required');
      setOverallExplanation(res.gap_evaluation?.overall_explanation || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && (!activeInvestigation || activeInvestigation.id !== id)) {
      selectInvestigationById(id);
    }
    loadData();
  }, [id, targetId]);

  const handleRunAnalysis = async () => {
    try {
      setAnalyzing(true);
      await api.runAnalysis(targetId);
      await loadData();
      await refreshInvestigations();
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpdateFindingStatus = async (fId: string, newStatus: string) => {
    try {
      await api.updateFindingStatus(targetId, fId, newStatus, reviewNote);
      setReviewNote('');
      setActiveFinding(null);
      await loadData();
      await refreshInvestigations();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredFindings = findings.filter((f) => {
    const matchSev = severityFilter === 'All' || f.severity === severityFilter;
    const matchCat = categoryFilter === 'All' || f.category === categoryFilter;
    const matchStatus = reviewerStatusFilter === 'All' || f.reviewer_status === reviewerStatusFilter;
    return matchSev && matchCat && matchStatus;
  });

  const trackerSteps = [
    { num: 1, label: 'Document Processing', complete: documents.length > 0 },
    { num: 2, label: 'Claim Extraction', complete: documents.some((d) => d.extracted_fields?.amounts?.length > 0) },
    { num: 3, label: 'Cross-Document Comparison', complete: true },
    { num: 4, label: 'Dependency Analysis', complete: true },
    { num: 5, label: 'Evidence Graph Construction', complete: true },
    { num: 6, label: 'Report Generation', complete: true },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-[#49372C] tracking-tight">Evidence Analysis Engine</h1>
            <Badge variant="status">{overallStatus}</Badge>
          </div>
          <p className="text-sm text-[#786C60] mt-1">
            Deterministic cross-document comparison, inconsistency detection, and multi-dimensional claim reliability.
          </p>
        </div>

        <button
          onClick={handleRunAnalysis}
          disabled={analyzing}
          className="flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-white bg-[#B8754D] hover:bg-[#725541] rounded-md shadow-xs transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
          <span>{analyzing ? 'Executing Engine...' : 'Re-Run Analysis'}</span>
        </button>
      </div>

      {/* Processing Pipeline Tracker (Section 10 requirement) */}
      <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#786C60] mb-3">
          Forensic Processing Pipeline
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {trackerSteps.map((step) => (
            <div
              key={step.num}
              className={`p-2.5 rounded-lg border text-xs flex items-center space-x-2 ${
                step.complete
                  ? 'bg-[#EAF3EC] border-[#2D5A3A]/20 text-[#2D5A3A]'
                  : 'bg-[#F8F5EF] border-[#E4D8C8] text-[#786C60]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <div className="truncate">
                <div className="text-[10px] font-bold leading-none">Step {step.num}</div>
                <div className="font-medium text-[11px] truncate mt-0.5">{step.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Claim Summary Banner */}
      {activeInvestigation && (
        <div className="p-4 bg-[#FFFDFA] border-l-4 border-[#B8754D] border-y border-r border-[#E4D8C8] rounded-r-xl shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#786C60]">
                Evaluated Primary Claim
              </div>
              <h2 className="text-base font-bold text-[#49372C] mt-0.5">
                "{activeInvestigation.primary_claim}"
              </h2>
              <p className="text-xs text-[#786C60] mt-1">
                {overallExplanation}
              </p>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <Link
                to={`/investigations/${targetId}/graph`}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-[#49372C] bg-[#EFE6D8] hover:bg-[#CBA783]/50 rounded-md transition-colors"
              >
                <span>View Provenance Graph</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 4-Dimensional Reliability Assessment (Section 15 requirement) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#49372C]">
            Claim Reliability Assessment (4 Forensic Dimensions)
          </h2>
          <span className="text-xs text-[#786C60]">
            Comprehensive multi-factor evaluation beyond simplistic binary scores
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {dimensions.map((dim) => (
            <div
              key={dim.dimension_name}
              className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#49372C]">{dim.dimension_name}</span>
                  <Badge variant="status">{dim.status}</Badge>
                </div>
                <p className="text-xs text-[#786C60] mt-2">
                  {dim.explanation}
                </p>

                {dim.unresolved_concerns && dim.unresolved_concerns.length > 0 && (
                  <div className="mt-3 p-2 bg-[#FEE2E2]/60 rounded border border-[#991B1B]/20 text-[11px] text-[#991B1B]">
                    <span className="font-semibold">Concern:</span> {dim.unresolved_concerns[0]}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-[#E4D8C8] text-[11px] text-[#725541]">
                <span className="font-semibold">Suggested Action:</span> {dim.suggested_next_action}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Traceable Forensic Findings Section (Section 10 requirement) */}
      <div className="bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 border-b border-[#E4D8C8] flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-[#FFFDFA]">
          <div>
            <h2 className="text-base font-bold text-[#49372C]">
              Traceable Findings & Observations ({findings.length})
            </h2>
            <p className="text-xs text-[#786C60]">
              Identified inconsistencies, potential dependencies, metadata anomalies, and evidence duplicates
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-2.5 py-1 text-xs bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
            >
              <option value="All">Severity: All</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Informational">Informational</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1 text-xs bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
            >
              <option value="All">Category: All</option>
              <option value="Inconsistency">Inconsistency</option>
              <option value="Potential Duplicate">Potential Duplicate</option>
              <option value="Potential Dependency">Potential Dependency</option>
              <option value="Metadata Observation">Metadata Observation</option>
              <option value="Authenticity Verification Needed">Authenticity Verification Needed</option>
            </select>

            <select
              value={reviewerStatusFilter}
              onChange={(e) => setReviewerStatusFilter(e.target.value)}
              className="px-2.5 py-1 text-xs bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
            >
              <option value="All">Review Status: All</option>
              <option value="Open">Open</option>
              <option value="Under Review">Under Review</option>
              <option value="Confirmed Finding">Confirmed</option>
              <option value="Resolved">Resolved</option>
              <option value="Dismissed">Dismissed</option>
            </select>
          </div>
        </div>

        {/* Findings List */}
        <div className="divide-y divide-[#E4D8C8]">
          {filteredFindings.length === 0 ? (
            <div className="p-8 text-center text-[#786C60] text-xs">
              No findings match current filter criteria.
            </div>
          ) : (
            filteredFindings.map((finding) => (
              <div key={finding.id} className="p-5 hover:bg-[#F8F5EF]/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#49372C] bg-[#EFE6D8] px-2 py-0.5 rounded">
                        {finding.finding_id}
                      </span>
                      <Badge variant="severity">{finding.severity}</Badge>
                      <span className="text-xs font-semibold text-[#725541] px-2 py-0.5 bg-[#F8F5EF] rounded border border-[#E4D8C8]">
                        {finding.category}
                      </span>
                      <Badge variant="status">{finding.reviewer_status}</Badge>
                    </div>

                    <h3 className="text-sm font-bold text-[#49372C] mt-2">
                      {finding.explanation}
                    </h3>

                    {finding.exact_field_or_passage && (
                      <div className="text-xs font-mono text-[#725541] bg-[#F8F5EF] p-2 rounded border border-[#E4D8C8] mt-1.5 inline-block max-w-full truncate">
                        Passage / Entity: {finding.exact_field_or_passage}
                      </div>
                    )}

                    <div className="text-xs text-[#786C60] space-y-1 mt-2">
                      {finding.supporting_observations.map((obs, oIdx) => (
                        <div key={oIdx} className="flex items-start space-x-1.5">
                          <span className="text-[#B8754D] font-bold">&bull;</span>
                          <span>{obs}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 p-2.5 bg-[#EFE6D8]/50 rounded-md border border-[#E4D8C8] text-xs">
                      <span className="font-semibold text-[#49372C]">Suggested Verification Step:</span>
                      <p className="text-[#786C60] mt-0.5">{finding.suggested_verification_step}</p>
                    </div>
                  </div>

                  {/* Review Actions */}
                  <div className="flex flex-col sm:items-end space-y-2 shrink-0">
                    <div className="text-[11px] text-[#786C60]">
                      Review Action:
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => handleUpdateFindingStatus(finding.id, 'Confirmed Finding')}
                        className="px-2.5 py-1 text-xs font-medium text-[#2D5A3A] bg-[#EAF3EC] hover:bg-[#2D5A3A]/20 border border-[#2D5A3A]/20 rounded transition-colors"
                        title="Confirm finding as valid evidence observation"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => handleUpdateFindingStatus(finding.id, 'Resolved')}
                        className="px-2.5 py-1 text-xs font-medium text-[#725541] bg-[#EFE6D8] hover:bg-[#CBA783]/50 border border-[#E4D8C8] rounded transition-colors"
                        title="Mark finding resolved after verification"
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() => handleUpdateFindingStatus(finding.id, 'Dismissed')}
                        className="px-2.5 py-1 text-xs font-medium text-[#786C60] hover:text-[#991B1B] hover:bg-[#FEE2E2] border border-[#E4D8C8] rounded transition-colors"
                        title="Dismiss finding with reason"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
