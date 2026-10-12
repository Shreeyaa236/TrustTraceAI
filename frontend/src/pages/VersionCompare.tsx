import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  GitCompare,
  PlusCircle,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Layers,
  RotateCw,
  Download
} from 'lucide-react';
import { useInvestigation } from '../context/InvestigationContext';
import { api } from '../services/api';
import { VersionComparison } from '../types';
import { Badge } from '../components/Badge';

export const VersionCompare: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { activeInvestigation, selectInvestigationById, refreshInvestigations } = useInvestigation();

  const [versions, setVersions] = useState<any[]>([]);
  const [baseVersion, setBaseVersion] = useState<number>(1);
  const [targetVersion, setTargetVersion] = useState<number>(2);
  const [comparison, setComparison] = useState<VersionComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingVersion, setCreatingVersion] = useState(false);

  const targetId = id || activeInvestigation?.id || 'demo';

  const loadVersions = async () => {
    try {
      setLoading(true);
      const vList = await api.getVersions(targetId);
      setVersions(vList);
      if (vList.length >= 2) {
        setBaseVersion(vList[0].version_number);
        setTargetVersion(vList[vList.length - 1].version_number);
        const comp = await api.compareVersions(targetId, vList[0].version_number, vList[vList.length - 1].version_number);
        setComparison(comp);
      } else if (vList.length === 1) {
        setBaseVersion(1);
        setTargetVersion(1);
        const comp = await api.compareVersions(targetId, 1, 1);
        setComparison(comp);
      }
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
    loadVersions();
  }, [id, targetId]);

  const handleCompare = async () => {
    try {
      setLoading(true);
      const comp = await api.compareVersions(targetId, baseVersion, targetVersion);
      setComparison(comp);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewVersion = async () => {
    try {
      setCreatingVersion(true);
      await api.reanalyzeNewVersion(targetId);
      await refreshInvestigations();
      await loadVersions();
      alert('New analysis version successfully generated!');
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingVersion(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-[#49372C] tracking-tight">Version Comparison Dashboard</h1>
            <span className="px-2 py-0.5 text-xs font-bold bg-[#EFE6D8] text-[#725541] rounded border border-[#E4D8C8]">
              Incremental Forensics
            </span>
          </div>
          <p className="text-sm text-[#786C60] mt-1">
            Compare evidentiary assessments between analysis cycles after newly uploaded documents.
          </p>
        </div>

        <button
          onClick={handleCreateNewVersion}
          disabled={creatingVersion}
          className="flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-white bg-[#B8754D] hover:bg-[#725541] rounded-md shadow-xs transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${creatingVersion ? 'animate-spin' : ''}`} />
          <span>{creatingVersion ? 'Generating Version...' : 'Snapshot New Version'}</span>
        </button>
      </div>

      {/* Version Selector Bar */}
      <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center space-x-3 text-xs">
          <span className="font-semibold text-[#49372C]">Compare Baseline:</span>
          <select
            value={baseVersion}
            onChange={(e) => setBaseVersion(Number(e.target.value))}
            className="px-3 py-1.5 bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
          >
            {versions.map((v) => (
              <option key={v.version_number} value={v.version_number}>
                Version {v.version_number} ({v.document_count} files)
              </option>
            ))}
            {versions.length === 0 && <option value={1}>Version 1</option>}
          </select>

          <span className="font-semibold text-[#786C60]">&rarr;</span>

          <span className="font-semibold text-[#49372C]">With Target:</span>
          <select
            value={targetVersion}
            onChange={(e) => setTargetVersion(Number(e.target.value))}
            className="px-3 py-1.5 bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
          >
            {versions.map((v) => (
              <option key={v.version_number} value={v.version_number}>
                Version {v.version_number} ({v.document_count} files)
              </option>
            ))}
            {versions.length <= 1 && <option value={2}>Version 2 (Current)</option>}
          </select>

          <button
            onClick={handleCompare}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#B8754D] hover:bg-[#725541] rounded-md transition-colors"
          >
            Update Comparison
          </button>
        </div>

        <a
          href={api.getReportPdfUrl(targetId)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1.5 text-xs font-medium text-[#725541] hover:text-[#49372C]"
        >
          <Download className="w-3.5 h-3.5 text-[#B8754D]" />
          <span>Export Comparison Report</span>
        </a>
      </div>

      {comparison && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
            <h2 className="text-sm font-bold text-[#49372C]">Forensic Evolution Summary</h2>
            <p className="text-xs text-[#786C60] mt-1">
              {comparison.summary}
            </p>
          </div>

          {/* Metric Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#786C60]">Documents Added</span>
              <div className="text-xl font-bold text-[#49372C] mt-2">
                +{comparison.documents_added.length}
              </div>
              <div className="text-[11px] text-[#786C60] mt-0.5">Incremental files evaluated</div>
            </div>

            <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#786C60]">New Findings Discovered</span>
              <div className="text-xl font-bold text-[#B45309] mt-2">
                {comparison.new_findings.length}
              </div>
              <div className="text-[11px] text-[#786C60] mt-0.5">Anomalies or dependencies</div>
            </div>

            <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#786C60]">New Contradictions</span>
              <div className="text-xl font-bold text-[#991B1B] mt-2">
                {comparison.new_contradictions.length}
              </div>
              <div className="text-[11px] text-[#786C60] mt-0.5">Direct amount / timeline conflicts</div>
            </div>

            <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#786C60]">Resolved Findings</span>
              <div className="text-xl font-bold text-[#2D5A3A] mt-2">
                {comparison.resolved_findings.length}
              </div>
              <div className="text-[11px] text-[#786C60] mt-0.5">Addressed by new records</div>
            </div>
          </div>

          {/* Side by Side Assessment (Section 14 requirement) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Base Version Column */}
            <div className="p-5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4D8C8]">
                <span className="font-bold text-sm text-[#49372C]">
                  Version {comparison.base_version} State
                </span>
                <span className="text-xs text-[#786C60]">Baseline</span>
              </div>
              <div className="text-xs text-[#786C60]">
                Initial analysis before subsequent document submissions.
              </div>
            </div>

            {/* Target Version Column */}
            <div className="p-5 bg-[#FFFDFA] border border-[#CBA783] rounded-xl shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4D8C8]">
                <span className="font-bold text-sm text-[#49372C]">
                  Version {comparison.target_version} State
                </span>
                <span className="text-xs font-semibold text-[#B8754D]">Updated</span>
              </div>
              <div className="text-xs text-[#786C60]">
                Updated evaluation incorporating newly introduced evidence records.
              </div>
            </div>
          </div>

          {/* New Contradictions or Findings List */}
          {comparison.new_contradictions.length > 0 && (
            <div className="p-5 bg-[#FFFDFA] border border-[#991B1B]/30 rounded-xl shadow-2xs space-y-3">
              <h2 className="text-sm font-bold text-[#991B1B] flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Newly Emerge Contradictions ({comparison.new_contradictions.length})</span>
              </h2>
              <div className="divide-y divide-[#E4D8C8] text-xs">
                {comparison.new_contradictions.map((f) => (
                  <div key={f.id} className="py-2.5">
                    <div className="font-semibold text-[#49372C]">{f.finding_id}: {f.explanation}</div>
                    <div className="text-[11px] text-[#786C60] mt-0.5">{f.suggested_verification_step}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
