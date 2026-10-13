import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  X,
  CheckCircle2,
  AlertCircle,
  Shield,
  ArrowRight,
  Building,
  FileText
} from 'lucide-react';
import { useInvestigation } from '../context/InvestigationContext';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const DOCUMENT_CATEGORIES = [
  'Unknown / Needs Review',
  'Identity Document',
  'Medical Document',
  'Financial Document',
  'Invoice or Receipt',
  'Email or Communication',
  'Legal Document',
  'Educational or Employment Record',
  'Transaction Record',
  'Screenshot or Image',
  'Other'
];

interface QueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  category: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export const UploadEvidence: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { activeInvestigation, selectInvestigationById, refreshInvestigations } = useInvestigation();
  const navigate = useNavigate();

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Optional source details
  const [issuingOrg, setIssuingOrg] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [dateReceived, setDateReceived] = useState(() => new Date().toISOString().slice(0, 10));
  const [reviewerNotes, setReviewerNotes] = useState('');

  const [uploadingAll, setUploadingAll] = useState(false);

  useEffect(() => {
    if (id && (!activeInvestigation || activeInvestigation.id !== id)) {
      selectInvestigationById(id);
    }
  }, [id, activeInvestigation, selectInvestigationById]);

  const targetId = id || activeInvestigation?.id || 'demo';

  const suggestCategory = (filename: string): string => {
    const f = filename.toLowerCase();
    if (f.includes('bill') || f.includes('invoice')) return 'Invoice or Receipt';
    if (f.includes('receipt')) return 'Invoice or Receipt';
    if (f.includes('hospital') || f.includes('medical') || f.includes('discharge')) return 'Medical Document';
    if (f.includes('bank') || f.includes('statement') || f.includes('txn') || f.includes('payment')) return 'Financial Document';
    if (f.includes('email') || f.includes('mail') || f.includes('msg')) return 'Email or Communication';
    if (f.includes('passport') || f.includes('id') || f.includes('license')) return 'Identity Document';
    if (f.includes('contract') || f.includes('agreement') || f.includes('legal')) return 'Legal Document';
    if (f.includes('screenshot') || f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) return 'Screenshot or Image';
    return 'Unknown / Needs Review';
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newItems: QueueItem[] = Array.from(files).map((f) => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      name: f.name,
      size: f.size,
      type: f.name.split('.').pop()?.toUpperCase() || 'FILE',
      category: suggestCategory(f.name),
      progress: 0,
      status: 'pending',
    }));
    setQueue((prev) => [...prev, ...newItems]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleRemove = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCategoryChange = (id: string, cat: string) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, category: cat } : item))
    );
  };

  const handleUploadAll = async () => {
    if (queue.length === 0) return;
    setUploadingAll(true);

    try {
      // Simulate progress updates for each item while uploading
      setQueue((prev) => prev.map((q) => ({ ...q, status: 'uploading', progress: 50 })));

      const rawFiles = queue.map((q) => q.file);
      const primaryCat = queue[0]?.category || 'Unknown / Needs Review';

      // Pass each file's specific selected category in the metadata manifest (Task 2)
      const fileMetadata = queue.map((q) => ({
        filename: q.file.name,
        category: q.category || 'Unknown / Needs Review',
        issuing_organization: issuingOrg,
        source_name: sourceName,
        reviewer_notes: reviewerNotes,
      }));

      await api.uploadDocuments(
        targetId,
        rawFiles,
        primaryCat,
        issuingOrg,
        sourceName,
        reviewerNotes,
        fileMetadata
      );

      setQueue((prev) =>
        prev.map((q) => ({ ...q, status: 'completed', progress: 100 }))
      );
      await refreshInvestigations();

      // Prompt to proceed to analysis
      setTimeout(() => {
        if (window.confirm('All files uploaded successfully! Proceed to Evidence Analysis now?')) {
          navigate(`/investigations/${targetId}/analysis`);
        }
      }, 300);
    } catch (err: any) {
      setQueue((prev) =>
        prev.map((q) => ({
          ...q,
          status: 'error',
          error: err.message || 'Upload failed',
        }))
      );
    } finally {
      setUploadingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#49372C] tracking-tight">Upload Evidence</h1>
        <p className="text-sm text-[#786C60] mt-1">
          Add the documents and records you want to examine. TrustTrace AI will analyze their content, available metadata, and relationships.
        </p>
      </div>

      {/* Target Investigation Banner */}
      {activeInvestigation && (
        <div className="p-3.5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-lg shadow-2xs flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-[#EFE6D8] rounded-md text-[#725541]">
              <FileText className="w-4 h-4 text-[#B8754D]" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#49372C]">
                Destination Case: {activeInvestigation.name}
              </div>
              <div className="text-[11px] text-[#786C60]">
                Ref: {activeInvestigation.case_reference || 'N/A'} &bull; Primary Claim: <i>"{activeInvestigation.primary_claim}"</i>
              </div>
            </div>
          </div>
          <div className="text-xs font-medium text-[#786C60]">
            Existing Evidence: <span className="font-bold text-[#49372C]">{activeInvestigation.document_count || 0}</span> files
          </div>
        </div>
      )}

      {/* Upload Drag & Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-8 sm:p-12 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-[#B8754D] bg-[#EFE6D8]/50 scale-[1.005]'
            : 'border-[#CBA783] bg-[#FFFDFA] hover:bg-[#F8F5EF]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.txt,.csv"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="w-12 h-12 mx-auto rounded-full bg-[#EFE6D8] flex items-center justify-center text-[#B8754D] mb-3">
          <UploadCloud className="w-6 h-6" />
        </div>

        <h2 className="text-sm font-bold text-[#49372C]">
          Drag and drop files here, or browse your device
        </h2>
        <p className="text-xs text-[#786C60] mt-1 max-w-md mx-auto">
          Supported forensic formats: <b>PDF</b> (digital & scans), <b>PNG</b>, <b>JPG</b>, <b>TXT</b>, <b>CSV</b>.
          Max file size: 25 MB per document.
        </p>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#B8754D] hover:bg-[#725541] rounded-md transition-colors"
        >
          Browse Files
        </button>
      </div>

      {/* Optional Source Details & Provenance Context */}
      <div className="p-5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs space-y-4">
        <div className="flex items-center space-x-2">
          <Building className="w-4 h-4 text-[#725541]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#49372C]">
            Optional Source & Chain of Custody Details
          </h2>
        </div>
        <p className="text-[11px] text-[#786C60]">
          Manual source information helps distinguish external third-party records from internal submissions. Clearly distinguished from extracted metadata.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-[#786C60] mb-1">Issuing Organization</label>
            <input
              type="text"
              placeholder="e.g. Metropolitan General Hospital"
              value={issuingOrg}
              onChange={(e) => setIssuingOrg(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#786C60] mb-1">Source / Submission Channel</label>
            <input
              type="text"
              placeholder="e.g. Email Attachment / Patient Portal"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#786C60] mb-1">Date Received</label>
            <input
              type="date"
              value={dateReceived}
              onChange={(e) => setDateReceived(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#786C60] mb-1">Reviewer Custody Notes</label>
          <input
            type="text"
            placeholder="e.g. Received directly from insured claimant via secure portal upload."
            value={reviewerNotes}
            onChange={(e) => setReviewerNotes(e.target.value)}
            className="w-full px-3 py-1.5 bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D] text-xs"
          />
        </div>
      </div>

      {/* Upload Queue Section */}
      {queue.length > 0 && (
        <div className="bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-[#E4D8C8] flex items-center justify-between bg-[#EFE6D8]/50">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-xs text-[#49372C]">
                Upload Queue ({queue.length} files selected)
              </span>
              <span className="text-[11px] text-[#786C60]">
                &bull; Total: {(queue.reduce((acc, q) => acc + q.size, 0) / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setQueue([])}
                className="px-2.5 py-1 text-xs text-[#786C60] hover:text-[#991B1B] hover:bg-[#FEE2E2] rounded transition-colors"
              >
                Clear Selection
              </button>
              <button
                onClick={handleUploadAll}
                disabled={uploadingAll}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#B8754D] hover:bg-[#725541] rounded-md shadow-xs transition-colors disabled:opacity-50"
              >
                <span>{uploadingAll ? 'Uploading & Parsing...' : 'Upload All & Store'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="divide-y divide-[#E4D8C8]">
            {queue.map((item) => (
              <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-9 h-9 rounded-md bg-[#EFE6D8] flex items-center justify-center text-[#725541] font-bold text-[10px] uppercase shrink-0">
                    {item.type}
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-[#49372C] truncate">{item.name}</div>
                    <div className="text-[11px] text-[#786C60] mt-0.5">
                      {(item.size / 1024).toFixed(1)} KB &bull; Suggested category:
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {/* Category Dropdown */}
                  <select
                    value={item.category}
                    onChange={(e) => handleCategoryChange(item.id, e.target.value)}
                    className="px-2 py-1 text-xs bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
                  >
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  {/* Status Indicator */}
                  {item.status === 'completed' && (
                    <span className="flex items-center text-[#2D5A3A] text-xs font-medium">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Uploaded
                    </span>
                  )}
                  {item.status === 'uploading' && (
                    <span className="text-xs text-[#B8754D] font-medium animate-pulse">
                      Uploading...
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span className="flex items-center text-[#991B1B] text-xs">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {item.error || 'Failed'}
                    </span>
                  )}
                  {item.status === 'pending' && (
                    <span className="text-[11px] text-[#786C60]">Ready</span>
                  )}

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="p-1 text-[#786C60] hover:text-[#991B1B] rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Privacy Notice */}
      <div className="p-4 bg-[#EFE6D8]/40 border border-[#E4D8C8] rounded-xl flex items-start space-x-3 text-xs text-[#786C60]">
        <Shield className="w-4 h-4 text-[#725541] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[#49372C]">Privacy & Data Protection Notice:</span>
          <p className="mt-0.5">
            Documents uploaded to TrustTrace AI are processed locally in secure workspace storage. SHA-256 hashes are computed for cryptographic integrity without transmitting raw personal records to third-party public AI providers. Please use synthetic or redacted records during public demonstrations.
          </p>
        </div>
      </div>
    </div>
  );
};
