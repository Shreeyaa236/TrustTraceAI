import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  History,
  FileText,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldAlert,
  Info,
  GitBranch,
  SplitSquareVertical
} from 'lucide-react';
import { useInvestigation } from '../context/InvestigationContext';
import { api } from '../services/api';
import { DocumentItem, TimeMachineResult } from '../types';
import { Badge } from '../components/Badge';

export const EvidenceTimeMachine: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { activeInvestigation, selectInvestigationById } = useInvestigation();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<TimeMachineResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [loading, setLoading] = useState(true);

  const targetId = id || activeInvestigation?.id || 'demo';

  useEffect(() => {
    if (id && (!activeInvestigation || activeInvestigation.id !== id)) {
      selectInvestigationById(id);
    }

    api.getDocuments(targetId).then((docs) => {
      setDocuments(docs);
      if (docs.length > 0) {
        // Pre-select second or bank document if available
        const cand = docs.find((d) => d.file_name.includes('Statement') || d.file_name.includes('Receipt')) || docs[0];
        setSelectedDocId(cand.id);
      }
      setLoading(false);
    }).catch(console.error);
  }, [id, targetId]);

  const handleRunSimulation = async () => {
    if (!selectedDocId) return;
    const doc = documents.find((d) => d.id === selectedDocId);
    if (!doc) return;

    if (!window.confirm(`Simulate temporary exclusion of '${doc.file_name}'? The original document will NOT be deleted.`)) {
      return;
    }

    try {
      setSimulating(true);
      const res = await api.simulateRemoval(targetId, [selectedDocId]);
      setSimulationResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(false);
    }
  };

  const handleExitSimulation = () => {
    setSimulationResult(null);
  };

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-[#49372C] tracking-tight">Evidence Time Machine</h1>
            <span className="px-2 py-0.5 text-xs font-bold bg-[#EFE6D8] text-[#725541] rounded border border-[#E4D8C8]">
              Hypothetical Simulation
            </span>
          </div>
          <p className="text-sm text-[#786C60] mt-1">
            Test what happens to the overall claim reliability when a single suspicious document is excluded from the evidentiary chain.
          </p>
        </div>

        {simulationResult && (
          <button
            onClick={handleExitSimulation}
            className="flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-[#49372C] bg-[#FFFDFA] hover:bg-[#EFE6D8] border border-[#E4D8C8] rounded-md shadow-2xs transition-colors self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#B8754D]" />
            <span>Exit Simulation Mode</span>
          </button>
        )}
      </div>

      {/* Safety Notice (Section 13 requirement) */}
      <div className="p-4 bg-[#FFFDFA] border-l-4 border-[#CBA783] border-y border-r border-[#E4D8C8] rounded-r-xl shadow-2xs text-xs text-[#786C60] flex items-start space-x-3">
        <Info className="w-4 h-4 text-[#725541] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[#49372C]">Simulation Guarantee:</span> This module runs a purely non-destructive hypothetical experiment. It recalculates claim support, contradictions, and graph edges without permanently deleting files or altering permanent case records.
        </div>
      </div>

      {!simulationResult ? (
        /* Document Selection Step */
        <div className="space-y-4">
          <div className="p-5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
            <h2 className="text-sm font-bold text-[#49372C] mb-1">
              Step 1: Select Evidence Document to Temporarily Exclude
            </h2>
            <p className="text-xs text-[#786C60] mb-4">
              Choose a document to isolate and simulate how the evidence network behaves in its absence.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {documents.map((doc) => {
                const isSelected = doc.id === selectedDocId;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`p-4 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#B8754D] bg-[#EFE6D8]/50 ring-2 ring-[#B8754D]/20'
                        : 'border-[#E4D8C8] bg-[#FFFDFA] hover:bg-[#F8F5EF]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded bg-[#EFE6D8] flex items-center justify-center text-[#725541] font-bold text-[10px] shrink-0">
                          {doc.file_type.toUpperCase()}
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-[#49372C] truncate">{doc.file_name}</div>
                          <div className="text-[11px] text-[#786C60] mt-0.5">{doc.category}</div>
                        </div>
                      </div>
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => setSelectedDocId(doc.id)}
                        className="accent-[#B8754D] mt-1"
                      />
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#E4D8C8] flex items-center justify-between text-[11px] text-[#786C60]">
                      <span>{doc.classification}</span>
                      <span className="font-mono text-[#49372C] font-semibold">
                        {doc.extracted_fields?.amounts?.[0] || 'No Amount'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedDoc && (
              <div className="mt-5 pt-4 border-t border-[#E4D8C8] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-xs text-[#786C60]">
                  Target document: <b className="text-[#49372C]">{selectedDoc.file_name}</b>
                </div>
                <button
                  onClick={handleRunSimulation}
                  disabled={simulating}
                  className="flex items-center space-x-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#B8754D] hover:bg-[#725541] rounded-md shadow-xs transition-colors self-start sm:self-auto disabled:opacity-50"
                >
                  <History className={`w-4 h-4 ${simulating ? 'animate-spin' : ''}`} />
                  <span>{simulating ? 'Simulating Impact...' : 'Simulate Removal'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Simulation Results Dashboard (Section 13 requirement) */
        <div className="space-y-6">
          {/* Comparison Status Bar */}
          <div className="p-5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#786C60]">
              Simulation Summary: Excluded "{simulationResult.excluded_document_names.join(', ')}"
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[#F8F5EF] rounded-lg border border-[#E4D8C8]">
                <div className="text-xs font-semibold text-[#786C60]">Original Baseline Assessment</div>
                <div className="text-lg font-bold text-[#49372C] mt-1 flex items-center space-x-2">
                  <Badge variant="status">{simulationResult.original_status}</Badge>
                </div>
                <p className="text-xs text-[#786C60] mt-1">
                  Based on complete evidentiary collection of {documents.length} files.
                </p>
              </div>

              <div className="p-4 bg-[#EFE6D8]/60 rounded-lg border border-[#CBA783]">
                <div className="text-xs font-semibold text-[#786C60]">Simulated Assessment</div>
                <div className="text-lg font-bold text-[#49372C] mt-1 flex items-center space-x-2">
                  <Badge variant="status">{simulationResult.simulated_status}</Badge>
                </div>
                <p className="text-xs text-[#786C60] mt-1">
                  Based on remaining {documents.length - simulationResult.excluded_document_ids.length} documents.
                </p>
              </div>
            </div>
          </div>

          {/* Section 1: Claims That Lost Support */}
          <div className="p-5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs space-y-3">
            <h2 className="text-sm font-bold text-[#49372C] flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-[#B45309]" />
              <span>Claims That Shifted or Lost Support</span>
            </h2>

            {simulationResult.claims_that_lost_support.length === 0 ? (
              <p className="text-xs text-[#786C60] italic">
                No claims lost support. The remaining evidence documents independently substantiate the primary assertion.
              </p>
            ) : (
              simulationResult.claims_that_lost_support.map((c, idx) => (
                <div key={idx} className="p-3 bg-[#FEF3C7]/40 border border-[#B45309]/20 rounded-lg text-xs space-y-1">
                  <div className="font-bold text-[#49372C]">"{c.claim_text}"</div>
                  <div className="text-[#B45309]">{c.reason}</div>
                  <div className="text-[11px] text-[#786C60]">Impact: {c.impact}</div>
                </div>
              ))
            )}
          </div>

          {/* Section 2: Claims Still Supported */}
          <div className="p-5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs space-y-3">
            <h2 className="text-sm font-bold text-[#49372C] flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#2D5A3A]" />
              <span>Claims Still Supported By Remaining Evidence</span>
            </h2>

            {simulationResult.claims_still_supported.map((c, idx) => (
              <div key={idx} className="p-3 bg-[#EAF3EC] border border-[#2D5A3A]/20 rounded-lg text-xs">
                <div className="font-bold text-[#49372C]">"{c.claim_text}"</div>
                <div className="text-[#2D5A3A] text-[11px] mt-0.5">{c.notes}</div>
              </div>
            ))}
          </div>

          {/* Section 3: Affected Graph Relationships */}
          <div className="p-5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs space-y-3">
            <h2 className="text-sm font-bold text-[#49372C] flex items-center space-x-2">
              <GitBranch className="w-4 h-4 text-[#725541]" />
              <span>Affected Provenance Graph Relationships</span>
            </h2>

            <div className="space-y-2">
              {simulationResult.affected_relationships.map((rel, idx) => (
                <div key={idx} className="p-3 bg-[#F8F5EF] rounded-lg border border-[#E4D8C8] text-xs flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-[#49372C]">{rel.source}</span> &rarr; <span className="font-semibold text-[#49372C]">{rel.target}</span>
                    <div className="text-[11px] text-[#786C60] mt-0.5">{rel.details}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B]">
                    {rel.simulated_edge}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Recommended Next Checks */}
          <div className="p-5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs space-y-3">
            <h2 className="text-sm font-bold text-[#49372C]">
              Recommended Next Investigative Checks
            </h2>

            <div className="space-y-2">
              {simulationResult.recommended_next_checks.map((chk, idx) => (
                <div key={idx} className="p-3 bg-[#EFE6D8]/40 border border-[#E4D8C8] rounded-lg text-xs flex items-start space-x-2">
                  <span className="text-[#B8754D] font-bold">&bull;</span>
                  <span className="text-[#49372C]">{chk}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
