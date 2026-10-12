import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText,
  Download,
  Printer,
  ShieldCheck,
  Building,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useInvestigation } from '../context/InvestigationContext';
import { api } from '../services/api';
import { Badge } from '../components/Badge';

export const Reports: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { activeInvestigation, selectInvestigationById } = useInvestigation();

  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const targetId = id || activeInvestigation?.id || 'demo';

  useEffect(() => {
    if (id && (!activeInvestigation || activeInvestigation.id !== id)) {
      selectInvestigationById(id);
    }

    api.getReportPreview(targetId).then((res) => {
      setReportData(res);
      setLoading(false);
    }).catch(console.error);
  }, [id, targetId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-[#786C60]">Compiling forensic report...</div>;
  }

  if (!reportData) {
    return <div className="p-8 text-center text-xs text-[#991B1B]">Unable to generate report.</div>;
  }

  const { investigation, documents, findings, gap_evaluation } = reportData;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-[#49372C] tracking-tight">Investigation Forensic Report</h1>
          <p className="text-sm text-[#786C60] mt-1">
            Official explainable audit report detailing multi-document reliability, dependencies, and next steps.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-3.5 py-2 text-xs font-medium text-[#49372C] bg-[#FFFDFA] hover:bg-[#EFE6D8] border border-[#E4D8C8] rounded-md transition-colors"
          >
            <Printer className="w-4 h-4 text-[#725541]" />
            <span>Print View</span>
          </button>

          <a
            href={api.getReportPdfUrl(targetId)}
            download
            className="flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-white bg-[#B8754D] hover:bg-[#725541] rounded-md shadow-xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download Official PDF</span>
          </a>
        </div>
      </div>

      {/* Official Report Document Container */}
      <div className="p-8 sm:p-12 bg-[#FFFDFA] border border-[#E4D8C8] rounded-2xl shadow-sm print:shadow-none print:border-none print:p-0 space-y-8 text-xs text-[#302820]">
        {/* Report Top Header */}
        <div className="border-b border-[#E4D8C8] pb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#B8754D]">
              TRUSTTRACE AI &bull; DIGITAL EVIDENCE VERIFICATION PLATFORM
            </div>
            <h1 className="text-2xl font-bold text-[#49372C] mt-1">
              Case Verification Report: {investigation.name}
            </h1>
            <p className="text-xs text-[#786C60] mt-1">
              Tagline: Beyond Fake Detection. Understand the Entire Evidence Story.
            </p>
          </div>

          <div className="text-left sm:text-right text-[11px] text-[#786C60] space-y-1">
            <div>Case Ref: <b className="text-[#49372C]">{investigation.case_reference || 'REF-N/A'}</b></div>
            <div>Analysis Version: <b className="text-[#49372C]">Version {investigation.current_version}</b></div>
            <div>Generated: {new Date().toUTCString()}</div>
          </div>
        </div>

        {/* Case Metadata Box */}
        <div className="p-4 bg-[#F8F5EF] rounded-xl border border-[#E4D8C8] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <span className="text-[#786C60] font-semibold text-[11px]">Primary Evaluated Claim</span>
            <div className="font-bold text-[#49372C] text-xs mt-1">"{investigation.primary_claim}"</div>
          </div>
          <div>
            <span className="text-[#786C60] font-semibold text-[11px]">Current Finding Status</span>
            <div className="mt-1"><Badge variant="status">{investigation.status}</Badge></div>
          </div>
          <div>
            <span className="text-[#786C60] font-semibold text-[11px]">Category</span>
            <div className="font-semibold text-[#49372C] text-xs mt-1">{investigation.category}</div>
          </div>
          <div>
            <span className="text-[#786C60] font-semibold text-[11px]">Evidence Inventory</span>
            <div className="font-semibold text-[#49372C] text-xs mt-1">{documents.length} Records Analyzed</div>
          </div>
        </div>

        {/* Section 1: 4-Dimensional Reliability Assessment */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#49372C] border-b border-[#E4D8C8] pb-2">
            1. Claim Reliability Assessment (4 Forensic Dimensions)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {gap_evaluation.dimensions?.map((dim: any) => (
              <div key={dim.dimension_name} className="p-3.5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#49372C]">{dim.dimension_name}</span>
                  <Badge variant="status">{dim.status}</Badge>
                </div>
                <p className="text-[#786C60] text-[11px] mt-1.5">{dim.explanation}</p>
                <div className="mt-2 text-[11px] text-[#725541] font-semibold">
                  Recommended Action: {dim.suggested_next_action}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Evidence Inventory */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#49372C] border-b border-[#E4D8C8] pb-2">
            2. Evidentiary Document Inventory & Structural Classification
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E4D8C8] text-[#786C60] font-semibold">
                  <th className="py-2">File Name</th>
                  <th className="py-2">Category</th>
                  <th className="py-2">Classification</th>
                  <th className="py-2">Hash (SHA-256)</th>
                  <th className="py-2 text-right">Completeness</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4D8C8]">
                {documents.map((d: any) => (
                  <tr key={d.id}>
                    <td className="py-2.5 font-bold text-[#49372C]">{d.file_name}</td>
                    <td className="py-2.5 text-[#786C60]">{d.category}</td>
                    <td className="py-2.5"><Badge variant="classification">{d.classification}</Badge></td>
                    <td className="py-2.5 font-mono text-[10px] text-[#786C60]">{d.file_hash.substring(0, 20)}...</td>
                    <td className="py-2.5 text-right font-medium text-[#49372C]">{Math.round((d.metadata?.completeness_score || 0) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Traceable Findings */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#49372C] border-b border-[#E4D8C8] pb-2">
            3. Traceable Findings & Observations
          </h2>
          {findings.length === 0 ? (
            <p className="text-[#786C60] italic">No contradictions or anomalies discovered.</p>
          ) : (
            <div className="space-y-3">
              {findings.map((f: any) => (
                <div key={f.id} className="p-3.5 bg-[#F8F5EF] rounded-lg border border-[#E4D8C8] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#49372C]">{f.finding_id}: {f.category}</span>
                    <Badge variant="severity">{f.severity}</Badge>
                  </div>
                  <p className="text-[#302820] font-medium">{f.explanation}</p>
                  <p className="text-[11px] text-[#786C60]"><b>Suggested Step:</b> {f.suggested_verification_step}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 4: Evidence Gaps */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#49372C] border-b border-[#E4D8C8] pb-2">
            4. Identified Evidence Gaps & Missing Information
          </h2>
          {gap_evaluation.gaps?.length === 0 ? (
            <p className="text-[#786C60] italic">No evidentiary gaps identified.</p>
          ) : (
            gap_evaluation.gaps.map((g: any) => (
              <div key={g.id} className="p-3.5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-lg space-y-1">
                <div className="font-bold text-[#49372C]">Gap: {g.missing_information}</div>
                <div className="text-[11px] text-[#786C60]">Why It Matters: {g.why_it_matters}</div>
                <div className="text-[11px] text-[#B8754D] font-semibold">Recommended Step: {g.recommended_step}</div>
              </div>
            ))
          )}
        </div>

        {/* Section 5: Forensic Notice & Limitations */}
        <div className="pt-4 border-t border-[#E4D8C8] text-[11px] text-[#786C60] space-y-1">
          <div className="font-semibold text-[#49372C]">Legal & Forensic Limitations Notice:</div>
          <p>
            TrustTrace AI observations represent algorithmic, cryptographic, and documentary consistency checks.
            Findings should not be construed as definitive legal proof of fraud or conclusive authenticity without external confirmation from primary issuing repositories.
          </p>
        </div>
      </div>
    </div>
  );
};
