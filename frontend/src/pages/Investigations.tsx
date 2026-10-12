import React, { useState } from 'react';
import {
  FolderKanban,
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  ChevronRight,
  Trash2,
  ExternalLink,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { useInvestigation } from '../context/InvestigationContext';
import { Badge } from '../components/Badge';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface InvestigationsProps {
  onOpenCreateModal: () => void;
}

const CATEGORIES = [
  'All',
  'Financial Transactions',
  'Insurance Claims',
  'Medical Documents',
  'Identity Documents',
  'Legal Evidence',
  'Business Records',
  'Email and Communications',
  'Other'
];

export const Investigations: React.FC<InvestigationsProps> = ({ onOpenCreateModal }) => {
  const { investigations, setActiveInvestigation, refreshInvestigations } = useInvestigation();
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('All');
  const [sortBy, setSortBy] = useState<'updated_at' | 'name' | 'document_count'>('updated_at');
  const navigate = useNavigate();

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to permanently delete investigation '${name}' and its evidence files?`)) {
      try {
        await api.deleteInvestigation(id);
        await refreshInvestigations();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const filtered = investigations
    .filter((inv) => {
      const matchesSearch =
        inv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.case_reference && inv.case_reference.toLowerCase().includes(searchTerm.toLowerCase())) ||
        inv.primary_claim.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = category === 'All' || inv.category === category;
      const matchesStatus = status === 'All' || inv.status === status;

      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'document_count') return (b.document_count || 0) - (a.document_count || 0);
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#49372C] tracking-tight">Case Investigations</h1>
          <p className="text-sm text-[#786C60] mt-1">
            Browse and manage all registered digital evidence verification matters.
          </p>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-white bg-[#B8754D] hover:bg-[#725541] rounded-md shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Investigation</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#786C60]" />
          <input
            type="text"
            placeholder="Search by case name, reference ID, or primary claim..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 text-xs bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                Category: {c}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 text-xs bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
          >
            <option value="All">Status: All</option>
            <option value="Not Analyzed">Not Analyzed</option>
            <option value="Processing">Processing</option>
            <option value="Review Required">Review Required</option>
            <option value="Analysis Complete">Analysis Complete</option>
            <option value="Failed">Failed</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-xs bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
          >
            <option value="updated_at">Sort: Last Updated</option>
            <option value="name">Sort: Name (A-Z)</option>
            <option value="document_count">Sort: Most Evidence</option>
          </select>
        </div>
      </div>

      {/* Grid of Investigations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((inv) => (
          <div
            key={inv.id}
            onClick={() => {
              setActiveInvestigation(inv);
              navigate(`/investigations/${inv.id}/analysis`);
            }}
            className="p-5 bg-[#FFFDFA] border border-[#E4D8C8] hover:border-[#B8754D] rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-mono text-[#786C60] bg-[#F8F5EF] px-2 py-0.5 rounded border border-[#E4D8C8]">
                  {inv.case_reference || 'REF-N/A'} &bull; v{inv.current_version}
                </span>
                <Badge variant="status">{inv.status}</Badge>
              </div>

              <h2 className="text-base font-bold text-[#49372C] group-hover:text-[#B8754D] transition-colors mt-3 line-clamp-1">
                {inv.name}
              </h2>

              <p className="text-xs text-[#786C60] mt-1.5 line-clamp-2">
                {inv.description}
              </p>

              <div className="mt-3.5 p-2.5 bg-[#F8F5EF] rounded-md border border-[#E4D8C8]">
                <div className="text-[10px] uppercase font-semibold text-[#786C60]">Primary Claim</div>
                <div className="text-xs font-medium text-[#49372C] italic mt-0.5 line-clamp-2">
                  "{inv.primary_claim}"
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-[#E4D8C8] flex items-center justify-between text-xs text-[#786C60]">
              <div>
                <span className="font-semibold text-[#49372C]">{inv.document_count || 0}</span> Evidence Files
                {inv.findings_count > 0 && (
                  <span className="ml-2 text-[#B45309] font-medium">&bull; {inv.findings_count} Findings</span>
                )}
              </div>

              <div className="flex items-center space-x-1">
                {!inv.is_demo && (
                  <button
                    onClick={(e) => handleDelete(e, inv.id, inv.name)}
                    className="p-1.5 text-[#786C60] hover:text-[#991B1B] hover:bg-[#FEE2E2] rounded transition-colors"
                    title="Delete Case"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="p-1.5 text-[#B8754D] group-hover:translate-x-0.5 transition-transform">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
