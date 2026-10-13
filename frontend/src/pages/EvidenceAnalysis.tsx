import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Sparkles,
  RefreshCw,
  X
} from 'lucide-react';
import { useInvestigation } from '../context/InvestigationContext';
import { Badge } from '../components/Badge';
import { api } from '../services/api';
import { Finding, DocumentItem, DimensionAssessment, EvidenceGap, Job } from '../types';

export const EvidenceAnalysis: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { activeInvestigation, selectInvestigationById, refreshInvestigations } = useInvestigation();

  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingStage, setAnalyzingStage] = useState<string>('');
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [dimensions, setDimensions] = useState<DimensionAssessment[]>([]);
  const [gaps, setGaps] = useState<EvidenceGap[]>([]);
  const [overallStatus, setOverallStatus] = useState<string>('Review Required');
  const [, setOverallExplanation] = useState<string>('');

  // Finding filter
  const [severityFilter, setSeverityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [reviewerStatusFilter, setReviewerStatusFilter] = useState('All');

  // AI explanation generating state
  const [aiGeneratingId, setAiGeneratingId] = useState<string | null>(null);

  // Review modal
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string>('Confirmed Finding');
  const [reviewNote, setReviewNote] = useState('');

  const targetId = id || activeInvestigation?.id || 'demo';

  const loadData = useCallback(async () => {
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
  }, [targetId]);

  useEffect(() => {
    if (id && (!activeInvestigation || activeInvestigation.id !== id)) {
      selectInvestigationById(id);
    }
    loadData();
  }, [id, targetId, activeInvestigation, selectInvestigationById, loadData]);

  // Background Job Polling (Task 5)
  const handleRunAnalysis = async () => {
    try {
      setAnalyzing(true);
      setJobError(null);
      setAnalyzingStage('Queuing forensic analysis job...');
      const { job_id } = await api.runAnalysisAsync(targetId);

      // Poll job status until completed or failed
      const pollInterval = setInterval(async () => {
        try {
          const status = await api.getJobStatus(job_id);
          setActiveJob(status);
          setAnalyzingStage(status.progress_stage || 'Processing evidence...');

          if (status.status === 'completed') {
            clearInterval(pollInterval);
            setAnalyzing(false);
            setAnalyzingStage('');
            await loadData();
            await refreshInvestigations();
          } else if (status.status === 'failed') {
            clearInterval(pollInterval);
            setAnalyzing(false);
            setJobError(status.error || 'Background analysis encountered an unexpected error.');
          }
        } catch (pollErr) {
          console.error('Job polling error:', pollErr);
        }
      }, 1500);
    } catch (err: any) {
      setAnalyzing(false);
      setJobError(err.message || 'Failed to initiate background analysis.');
    }
  };

  const handleRetryJob = async () => {
    if (!activeJob) return;
    try {
      setAnalyzing(true);
      setJobError(null);
      await api.retryJob(activeJob.job_id);
      handleRunAnalysis();
    } catch (err: any) {
      setJobError(err.message || 'Retry failed');
      setAnalyzing(false);
    }
  };

  // On-Demand AI Explanation (Task 1)
  const handleExplainWithAI = async (findingId: string) => {
    try {
      setAiGeneratingId(findingId);
      const updatedFinding = await api.explainFindingWithAI(targetId, findingId);
      setFindings((prev) =>
        prev.map((f) => (f.id === findingId ? updatedFinding : f))
      );
    } catch (err) {
      console.error('AI explanation failed:', err);
    } finally {
      setAiGeneratingId(null);
    }
  };

  const openReviewModal = (finding: Finding, statusToSet: string) => {
    setActiveFinding(finding);
    setPendingStatus(statusToSet);
    setReviewNote(finding.reviewer_notes || '');
  };

  const submitFindingReview = async () => {
    if (!activeFinding) return;
    try {
      await api.updateFindingStatus(targetId, activeFinding.id, pendingStatus, reviewNote);
      setActiveFinding(null);
      setReviewNote('');
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

      {/* Background Processing Progress Banner (Task 5) */}
      {analyzing && (
        <div className="p-4 bg-[#FFFDFA] border-2 border-[#B8754D] rounded-xl shadow-md flex items-center space-x-3 text-xs animate-pulse">
          <RefreshCw className="w-5 h-5 text-[#B8754D] animate-spin shrink-0" />
          <div className="flex-1">
            <div className="font-bold text-[#49372C]">Asynchronous Background Job Executing</div>
            <div className="text-[#786C60] mt-0.5">{analyzingStage}</div>
          </div>
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-[#EFE6D8] text-[#725541] rounded">
            Background Task Active
          </span>
        </div>
      )}

      {/* Job Error & Retry Banner */}
      {jobError && (
        <div className="p-4 bg-[#FEE2E2]/60 border border-[#991B1B]/30 rounded-xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-[#991B1B]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{jobError}</span>
          </div>
          <button
            onClick={handleRetryJob}
            className="px-3 py-1 bg-[#991B1B] text-white rounded font-semibold text-xs hover:bg-[#7F1D1D] transition-colors"
          >
            Retry Analysis
          </button>
        </div>
      )}

      {/* Processing Pipeline Tracker */}
      <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#786C60] mb-3">
          Forensic Processing Pipeline
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {trackerSteps.map((step) => (
            <div
              key={step.num}
              className={`p-2.5 rounded-lg border text-center transition-colors ${
                step.complete
                  ? 'bg-[#EFE6D8]/50 border-[#CBA783] text-[#49372C]'
                  : 'bg-[#F8F5EF] border-[#E4D8C8] text-[#786C60]'
              }`}
            >
              <div className="flex items-center justify-center space-x-1 mb-1">
                <span className="text-[10px] font-bold w-4 h-4 rounded-full bg-[#FFFDFA] flex items-center justify-center border border-[#E4D8C8]">
                  {step.num}
                </span>
                {step.complete && <CheckCircle2 className="w-3.5 h-3.5 text-[#2D5A3A]" />}
              </div>
              <div className="text-[11px] font-semibold truncate">{step.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 4-Dimensional Reliability Assessment */}
      <div className="space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-[#786C60]">
          4-Dimensional Reliability Assessment
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

      {/* Evidence Gaps & Verification Steps (Task 1: AI Enhanced) */}
      {gaps.length > 0 && (
        <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-[#B8754D] flex items-center justify-between">
            <span>Evidence Gap Finder ({gaps.length} Actionable Gaps)</span>
          </div>

          <div className="divide-y divide-[#E4D8C8]">
            {gaps.map((gap) => (
              <div key={gap.id} className="py-3 text-xs space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-[#49372C]">{gap.missing_information}</span>
                  <Badge variant="status">{gap.status}</Badge>
                </div>
                <p className="text-[11px] text-[#786C60]"><b>Evidential Rationale:</b> {gap.why_it_matters}</p>
                <div className="p-2 bg-[#F8F5EF] rounded border border-[#E4D8C8] text-[11px] text-[#725541]">
                  <b>Recommended Step:</b> {gap.ai_enhanced_recommendation || gap.recommended_step}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Traceable Forensic Findings Section */}
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
          {loading ? (
            <div className="p-8 text-center text-xs text-[#786C60]">Loading evidence analysis...</div>
          ) : filteredFindings.length === 0 ? (
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

                      {finding.is_ai_assisted && (
                        <span className="flex items-center text-[10px] font-bold text-[#B8754D] bg-[#EFE6D8] px-2 py-0.5 rounded-full border border-[#CBA783]">
                          <Sparkles className="w-3 h-3 mr-1" />
                          AI Synthesized
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-[#49372C] mt-2">
                      {finding.explanation}
                    </h3>

                    {/* AI Structured Analysis Box (Task 1) */}
                    {finding.ai_analysis && (
                      <div className="p-3 bg-[#FFFDFA] border border-[#B8754D]/40 rounded-lg text-xs space-y-1.5 mt-2">
                        <div className="flex items-center space-x-1.5 font-bold text-[#B8754D] text-[11px] uppercase tracking-wider">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Objective AI Forensic Synthesis</span>
                        </div>
                        {finding.ai_analysis.observation_summary && (
                          <div><b>Summary:</b> {finding.ai_analysis.observation_summary}</div>
                        )}
                        {finding.ai_analysis.why_it_matters && (
                          <div className="text-[#786C60]"><b>Evidential Weight:</b> {finding.ai_analysis.why_it_matters}</div>
                        )}
                        {finding.ai_analysis.plausible_legitimate_explanation && (
                          <div className="text-[#2D5A3A]"><b>Plausible Benign Reason:</b> {finding.ai_analysis.plausible_legitimate_explanation}</div>
                        )}
                      </div>
                    )}

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

                    {finding.reviewer_notes && (
                      <div className="mt-2 p-2 bg-[#F8F5EF] rounded border border-[#E4D8C8] text-[11px] text-[#49372C]">
                        <b>Reviewer Note:</b> {finding.reviewer_notes}
                      </div>
                    )}
                  </div>

                  {/* Actions: AI Explain + Review Status */}
                  <div className="flex flex-col sm:items-end space-y-2 shrink-0">
                    <button
                      onClick={() => handleExplainWithAI(finding.id)}
                      disabled={aiGeneratingId === finding.id}
                      className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-[#B8754D] bg-[#FFFDFA] hover:bg-[#F8F5EF] border border-[#B8754D]/40 rounded shadow-2xs transition-colors disabled:opacity-50"
                      title="Generate or refresh grounded AI explanation"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${aiGeneratingId === finding.id ? 'animate-spin' : ''}`} />
                      <span>{aiGeneratingId === finding.id ? 'Synthesizing...' : 'Explain with AI'}</span>
                    </button>

                    <div className="text-[11px] text-[#786C60]">
                      Review Action:
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => openReviewModal(finding, 'Confirmed Finding')}
                        className="px-2.5 py-1 text-xs font-medium text-[#2D5A3A] bg-[#EAF3EC] hover:bg-[#2D5A3A]/20 border border-[#2D5A3A]/20 rounded transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => openReviewModal(finding, 'Resolved')}
                        className="px-2.5 py-1 text-xs font-medium text-[#725541] bg-[#EFE6D8] hover:bg-[#CBA783]/50 border border-[#E4D8C8] rounded transition-colors"
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() => openReviewModal(finding, 'Dismissed')}
                        className="px-2.5 py-1 text-xs font-medium text-[#786C60] hover:text-[#991B1B] hover:bg-[#FEE2E2] border border-[#E4D8C8] rounded transition-colors"
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

      {/* Review Modal Dialog */}
      {activeFinding && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#49372C]">
                Update Finding Status: {activeFinding.finding_id}
              </h3>
              <button onClick={() => setActiveFinding(null)} className="p-1 text-[#786C60] hover:text-[#49372C]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-[#786C60]">
              Updating status to: <b className="text-[#49372C]">{pendingStatus}</b>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#786C60] mb-1">
                Reviewer Notes & Verification Rationale
              </label>
              <textarea
                rows={3}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Enter justification or independent verification findings..."
                className="w-full p-2.5 bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-xs text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setActiveFinding(null)}
                className="px-3 py-1.5 text-xs font-medium text-[#786C60] hover:bg-[#F8F5EF] rounded"
              >
                Cancel
              </button>
              <button
                onClick={submitFindingReview}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#B8754D] hover:bg-[#725541] rounded-md transition-colors"
              >
                Save Review Decision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
