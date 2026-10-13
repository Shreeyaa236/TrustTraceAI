import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  AlertTriangle,
  FileText,
  Search,
  ArrowUpDown,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { useInvestigation } from '../context/InvestigationContext';
import { api } from '../services/api';
import { TimelineResponse, TimelineEvent } from '../types';
import { Badge } from '../components/Badge';

export const Timeline: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { activeInvestigation, selectInvestigationById } = useInvestigation();
  const navigate = useNavigate();

  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [dateTypeFilter, setDateTypeFilter] = useState('All');
  const [showConflictsOnly, setShowConflictsOnly] = useState(false);
  const [sortAscending, setSortAscending] = useState(true);

  const targetId = id || activeInvestigation?.id || 'demo';

  const loadTimeline = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getTimeline(targetId);
      setTimelineData(res);
      if (res.events && res.events.length > 0) {
        setSelectedEvent((prev) => prev || res.events.find(e => e.is_conflict) || res.events[0] || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load chronological timeline.');
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useEffect(() => {
    if (id && (!activeInvestigation || activeInvestigation.id !== id)) {
      selectInvestigationById(id);
    }
    loadTimeline();
  }, [id, activeInvestigation, selectInvestigationById, loadTimeline]);

  // Unique categories in timeline
  const categories = useMemo(() => {
    if (!timelineData?.events) return [];
    return Array.from(new Set(timelineData.events.map(e => e.category)));
  }, [timelineData]);

  // Filtered & sorted events
  const filteredEvents = useMemo(() => {
    if (!timelineData?.events) return [];
    let list = [...timelineData.events];

    if (showConflictsOnly) {
      list = list.filter(e => e.is_conflict);
    }

    if (categoryFilter !== 'All') {
      list = list.filter(e => e.category === categoryFilter);
    }

    if (dateTypeFilter !== 'All') {
      list = list.filter(e => e.date_type === dateTypeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        e.document_name.toLowerCase().includes(q) ||
        e.date_str.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const dateA = a.parsed_date ? new Date(a.parsed_date).getTime() : 0;
      const dateB = b.parsed_date ? new Date(b.parsed_date).getTime() : 0;
      return sortAscending ? dateA - dateB : dateB - dateA;
    });

    return list;
  }, [timelineData, showConflictsOnly, categoryFilter, dateTypeFilter, searchQuery, sortAscending]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-[#49372C] tracking-tight">Chronological Evidence Timeline</h1>
            {timelineData && (
              <Badge variant={timelineData.conflicts_count > 0 ? 'severity' : 'status'}>
                {timelineData.conflicts_count > 0 ? `${timelineData.conflicts_count} Conflicts Flagged` : 'Consistent Sequence'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-[#786C60] mt-1 max-w-2xl">
            Reconstructs evidence sequence across document dates, transaction milestones, internal PDF creation stamps, and ingestion logs to detect chronological inconsistencies without assuming fraud.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSortAscending(!sortAscending)}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-[#FFFDFA] border border-[#E4D8C8] text-[#49372C] rounded-lg hover:bg-[#F8F5EF] transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-[#B8754D]" />
            <span>{sortAscending ? 'Oldest First' : 'Newest First'}</span>
          </button>
        </div>
      </div>

      {/* Overview Banner if Conflicts Exist */}
      {timelineData && timelineData.conflicts_count > 0 && (
        <div className="p-4 bg-[#FEF3C7]/40 border border-[#B45309]/30 rounded-xl flex items-start space-x-3 text-xs">
          <ShieldAlert className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="font-bold text-[#49372C]">
              Timeline Inconsistency Detected across {timelineData.conflicts_count} Evidence Points
            </h2>
            <p className="text-[#786C60]">
              Discrepancies identified between itemized billing records, payment receipts, or authoring metadata. Note: A metadata date differing from an event date can result from routine virtual printing, scanning backlogs, or invoice amendments. Independent ledger verification is recommended.
            </p>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-3.5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#786C60]" />
            <input
              type="text"
              placeholder="Search timeline..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D] w-40 sm:w-48"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Date Type Filter */}
          <select
            value={dateTypeFilter}
            onChange={(e) => setDateTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
          >
            <option value="All">All Date Types</option>
            <option value="Extracted Content Date">Extracted Content Date</option>
            <option value="PDF Metadata Creation Date">PDF Metadata Creation Date</option>
            <option value="Source Receipt Date">Source Receipt Date</option>
            <option value="Upload Timestamp">Upload Timestamp</option>
          </select>
        </div>

        {/* Toggle Conflicts */}
        <label className="flex items-center space-x-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showConflictsOnly}
            onChange={(e) => setShowConflictsOnly(e.target.checked)}
            className="rounded border-[#E4D8C8] text-[#B8754D] focus:ring-[#B8754D]"
          />
          <span className="font-semibold text-[#49372C]">Show Conflicts Only</span>
        </label>
      </div>

      {/* Main Timeline + Detail Split Layout */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#786C60] bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl">
          Extracting chronological evidence anchors...
        </div>
      ) : error ? (
        <div className="p-8 text-center text-xs text-[#991B1B] bg-[#FEE2E2]/30 border border-[#991B1B]/30 rounded-xl">
          {error}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 text-center text-xs text-[#786C60] bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl">
          No timeline events match the selected criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Timeline Rail (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative pl-6 border-l-2 border-[#E4D8C8] space-y-6">
              {filteredEvents.map((evt) => {
                const isSelected = selectedEvent?.id === evt.id;
                return (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className={`relative p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#B8754D] bg-[#FFFDFA] ring-2 ring-[#B8754D]/25 shadow-md'
                        : evt.is_conflict
                        ? 'border-[#B45309]/50 bg-[#FEF3C7]/20 hover:border-[#B45309]'
                        : 'border-[#E4D8C8] bg-[#FFFDFA] hover:border-[#CBA783]'
                    }`}
                  >
                    {/* Node marker on the rail */}
                    <div
                      className={`absolute -left-[31px] top-4 w-3.5 h-3.5 rounded-full border-2 border-[#FFFDFA] shadow-xs ${
                        evt.is_conflict
                          ? 'bg-[#B45309]'
                          : isSelected
                          ? 'bg-[#B8754D]'
                          : 'bg-[#725541]'
                      }`}
                    />

                    {/* Event Card Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-3.5 h-3.5 text-[#B8754D]" />
                        <span className="font-mono font-bold text-xs text-[#49372C]">
                          {evt.date_str}
                        </span>
                        <span className="text-[10px] text-[#786C60] px-1.5 py-0.5 rounded bg-[#EFE6D8]">
                          {evt.date_type}
                        </span>
                      </div>

                      {evt.is_conflict && (
                        <span className="flex items-center text-[10px] font-bold text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded-full border border-[#B45309]/30">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Conflict
                        </span>
                      )}
                    </div>

                    {/* Document Title */}
                    <div className="mt-2 flex items-center space-x-1.5 text-xs font-semibold text-[#49372C]">
                      <FileText className="w-3.5 h-3.5 text-[#725541]" />
                      <span className="truncate">{evt.document_name}</span>
                      <span className="text-[10px] text-[#786C60] font-normal">({evt.category})</span>
                    </div>

                    {/* Description */}
                    <p className="mt-1 text-[11px] text-[#786C60] line-clamp-2">
                      {evt.description}
                    </p>

                    {/* Conflict Highlight if applicable */}
                    {evt.is_conflict && evt.conflict_details && (
                      <div className="mt-2.5 p-2 bg-[#FEF3C7]/60 rounded-md border border-[#B45309]/20 text-[11px] text-[#49372C]">
                        <b>Observation:</b> {evt.conflict_details}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Event Detail Panel (5 cols sticky) */}
          <div className="lg:col-span-5 sticky top-6">
            {selectedEvent ? (
              <div className="bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-md p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#786C60]">
                      Chronological Milestone Details
                    </span>
                    <h2 className="text-base font-bold text-[#49372C] mt-0.5 font-mono">
                      {selectedEvent.date_str}
                    </h2>
                  </div>
                  {selectedEvent.is_conflict ? (
                    <span className="px-2 py-1 text-xs font-bold text-[#B45309] bg-[#FEF3C7] rounded-md border border-[#B45309]/30">
                      Discrepancy Flagged
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium text-[#2D5A3A] bg-[#E8F5E9] rounded-md">
                      Sequential
                    </span>
                  )}
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-[#F8F5EF] rounded-lg border border-[#E4D8C8]">
                    <span className="text-[#786C60] font-semibold block text-[11px]">Timestamp Nature:</span>
                    <span className="font-bold text-[#49372C]">{selectedEvent.date_type}</span>
                    <p className="text-[11px] text-[#786C60] mt-1">
                      {selectedEvent.date_type === 'PDF Metadata Creation Date'
                        ? 'Internal binary creation timestamp embedded by the PDF rendering engine at compile time.'
                        : selectedEvent.date_type === 'Extracted Content Date'
                        ? 'Date literal parsed directly from document body text or itemized table.'
                        : selectedEvent.date_type === 'Source Receipt Date'
                        ? 'Date recorded when investigator or client took physical/digital custody.'
                        : 'System ingestion timestamp recorded in repository storage.'}
                    </p>
                  </div>

                  <div className="p-3 bg-[#F8F5EF] rounded-lg border border-[#E4D8C8]">
                    <span className="text-[#786C60] font-semibold block text-[11px]">Associated Document:</span>
                    <span className="font-bold text-[#49372C]">{selectedEvent.document_name}</span>
                    <div className="text-[11px] text-[#786C60] mt-0.5">Category: {selectedEvent.category}</div>
                  </div>

                  {selectedEvent.is_conflict && selectedEvent.conflict_details && (
                    <div className="p-3 bg-[#FEF3C7]/40 rounded-lg border border-[#B45309]/30 space-y-2">
                      <span className="font-bold text-[#B45309] text-[11px] uppercase tracking-wider block">
                        Forensic Warning Context
                      </span>
                      <p className="text-[#49372C] text-xs">
                        {selectedEvent.conflict_details}
                      </p>
                      <div className="pt-2 border-t border-[#B45309]/20 text-[11px] text-[#786C60]">
                        <b>Recommended Step:</b> Cross-verify with third-party bank settlement timestamp or original issuer registry log.
                      </div>
                    </div>
                  )}
                </div>

                {/* Direct Action Link */}
                {selectedEvent.document_id && (
                  <div className="pt-3 border-t border-[#E4D8C8]">
                    <button
                      onClick={() => navigate(`/investigations/${targetId}/documents/${selectedEvent.document_id}`)}
                      className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#B8754D] hover:bg-[#725541] rounded-md transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Inspect Document Forensic Profile</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#786C60] bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl">
                Select an event from the timeline to view detailed forensic timestamp analysis.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
