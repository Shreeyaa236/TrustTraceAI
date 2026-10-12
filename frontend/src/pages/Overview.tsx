import React, { useState } from 'react';
import {
  FolderKanban,
  Files,
  AlertTriangle,
  FileSearch,
  Plus,
  UploadCloud,
  Search,
  ChevronRight,
  ExternalLink,
  Sparkles,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { useInvestigation } from '../context/InvestigationContext';
import { Badge } from '../components/Badge';
import { Link, useNavigate } from 'react-router-dom';

interface OverviewProps {
  onOpenCreateModal: () => void;
}

export const Overview: React.FC<OverviewProps> = ({ onOpenCreateModal }) => {
  const { investigations, setActiveInvestigation } = useInvestigation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const navigate = useNavigate();

  // Aggregate metrics
  const activeCasesCount = investigations.length;
  const docsAnalyzedCount = investigations.reduce((acc, i) => acc + (i.document_count || 0), 0);
  const claimsReviewCount = investigations.filter((i) => i.status === 'Review Required' || i.status === 'Failed').length;
  const gapsIdentifiedCount = investigations.filter((i) => (i.findings_count || 0) > 0).length;

  const filtered = investigations.filter((inv) => {
    const matchesSearch =
      inv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.case_reference && inv.case_reference.toLowerCase().includes(searchTerm.toLowerCase())) ||
      inv.primary_claim.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = selectedStatus === 'All' || inv.status === selectedStatus;
    const matchesCategory = selectedCategory === 'All' || inv.category === selectedCategory;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Title & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#49372C] tracking-tight">Evidence Overview</h1>
          <p className="text-sm text-[#786C60] mt-1">
            Review investigations, track evidence, and identify what needs verification.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenCreateModal}
            className="flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-white bg-[#B8754D] hover:bg-[#725541] rounded-md shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Investigation</span>
          </button>
          {investigations.length > 0 && (
            <button
              onClick={() => navigate(`/investigations/${investigations[0].id}/upload`)}
              className="flex items-center space-x-2 px-3.5 py-2 text-xs font-medium text-[#49372C] bg-[#FFFDFA] hover:bg-[#EFE6D8] border border-[#E4D8C8] rounded-md transition-colors"
            >
              <UploadCloud className="w-4 h-4 text-[#725541]" />
              <span>Upload Evidence</span>
            </button>
          )}
        </div>
      </div>

      {/* Demonstration Banner */}
      <div className="flex items-center justify-between p-3.5 bg-[#FFFDFA] border border-[#CBA783] rounded-lg shadow-2xs">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-[#EFE6D8] rounded-md text-[#B8754D]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#49372C] flex items-center space-x-2">
              <span>Interactive Demonstration Dataset Loaded</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#EFE6D8] text-[#725541]">DEMO</span>
            </div>
            <div className="text-[11px] text-[#786C60] mt-0.5">
              Explore <b>"Hospital Reimbursement Review"</b> showcasing PyMuPDF structural metadata analysis, amount discrepancy, and Evidence Time Machine simulation.
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            const demo = investigations.find((i) => i.is_demo);
            if (demo) {
              setActiveInvestigation(demo);
              navigate(`/investigations/${demo.id}/analysis`);
            }
          }}
          className="hidden sm:flex items-center space-x-1.5 text-xs font-semibold text-[#B8754D] hover:text-[#725541] px-3 py-1.5 rounded-md hover:bg-[#EFE6D8] transition-colors"
        >
          <span>Open Case</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="p-5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#786C60]">Active Investigations</span>
            <div className="p-2 bg-[#F8F5EF] text-[#725541] rounded-lg">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-[#49372C]">{activeCasesCount}</div>
          <div className="mt-1 text-[11px] text-[#786C60]">Currently active digital cases</div>
        </div>

        {/* Card 2 */}
        <div className="p-5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#786C60]">Documents Analyzed</span>
            <div className="p-2 bg-[#F8F5EF] text-[#725541] rounded-lg">
              <Files className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-[#49372C]">{docsAnalyzedCount}</div>
          <div className="mt-1 text-[11px] text-[#786C60]">PDFs, receipts, and electronic records</div>
        </div>

        {/* Card 3 */}
        <div className="p-5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#786C60]">Claims Requiring Review</span>
            <div className="p-2 bg-[#FEF3C7] text-[#B45309] rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-[#49372C]">{claimsReviewCount}</div>
          <div className="mt-1 text-[11px] text-[#B45309]">Potential inconsistencies detected</div>
        </div>

        {/* Card 4 */}
        <div className="p-5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#786C60]">Evidence Gaps Identified</span>
            <div className="p-2 bg-[#F8F5EF] text-[#B8754D] rounded-lg">
              <FileSearch className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-[#49372C]">{gapsIdentifiedCount}</div>
          <div className="mt-1 text-[11px] text-[#786C60]">Unverified dependencies or missing steps</div>
        </div>
      </div>

      {/* Recent Investigations Section */}
      <div className="bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 sm:p-5 border-b border-[#E4D8C8] flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-[#FFFDFA]">
          <div>
            <h2 className="text-base font-bold text-[#49372C]">Recent Investigations</h2>
            <p className="text-xs text-[#786C60]">Filter and inspect ongoing digital forensic verification cases</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#786C60]" />
              <input
                type="text"
                placeholder="Search case, claim, ref..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D] w-48 sm:w-56"
              />
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
            >
              <option value="All">All Statuses</option>
              <option value="Not Analyzed">Not Analyzed</option>
              <option value="Processing">Processing</option>
              <option value="Review Required">Review Required</option>
              <option value="Analysis Complete">Analysis Complete</option>
              <option value="Failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E4D8C8] bg-[#EFE6D8]/50 text-[11px] font-semibold text-[#786C60] uppercase tracking-wider">
                <th className="px-5 py-3">Investigation Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Evidence Files</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-4 py-3">Analysis Status</th>
                <th className="px-4 py-3">Reviewer</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4D8C8] text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#786C60]">
                    <div className="max-w-xs mx-auto space-y-3">
                      <div className="w-10 h-10 mx-auto rounded-full bg-[#EFE6D8] flex items-center justify-center text-[#725541]">
                        <FolderKanban className="w-5 h-5" />
                      </div>
                      <div className="font-semibold text-sm text-[#49372C]">No Investigations Found</div>
                      <p className="text-xs">
                        {searchTerm ? 'No records match your query. Try clearing filters.' : 'Get started by creating your first digital evidence verification case.'}
                      </p>
                      <button
                        onClick={onOpenCreateModal}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#B8754D] hover:bg-[#725541] rounded-md transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Your First Investigation</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-[#F8F5EF] transition-colors cursor-pointer group"
                    onClick={() => {
                      setActiveInvestigation(inv);
                      navigate(`/investigations/${inv.id}/analysis`);
                    }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-md bg-[#EFE6D8] border border-[#E4D8C8] flex items-center justify-center text-[#49372C] font-semibold">
                          {inv.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-[#49372C] group-hover:text-[#B8754D] transition-colors">
                            {inv.name}
                          </div>
                          <div className="text-[11px] text-[#786C60] font-mono mt-0.5">
                            {inv.case_reference || 'REF-N/A'} &bull; v{inv.current_version}
                            {inv.is_demo && <span className="ml-2 text-[#B8754D] font-sans font-bold">[Fictional Demo]</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-[#786C60]">{inv.category}</td>
                    <td className="px-4 py-4">
                      <span className="font-medium text-[#49372C]">{inv.document_count || 0}</span>
                      <span className="text-[#786C60] text-[11px] ml-1">files</span>
                    </td>
                    <td className="px-4 py-4 text-[#786C60]">
                      {new Date(inv.updated_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant="status">{inv.status}</Badge>
                    </td>
                    <td className="px-4 py-4 text-[#786C60]">{inv.creator}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveInvestigation(inv);
                          navigate(`/investigations/${inv.id}/analysis`);
                        }}
                        className="inline-flex items-center space-x-1 text-xs font-semibold text-[#B8754D] hover:text-[#725541] px-2.5 py-1 rounded-md hover:bg-[#EFE6D8] transition-colors"
                      >
                        <span>Open</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
