import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Download,
  Hash,
  ArrowLeft,
  Edit3,
  Save
} from 'lucide-react';
import { api } from '../services/api';
import { DocumentItem } from '../types';
import { Badge } from '../components/Badge';

const CATEGORIES = [
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

export const DocumentDetail: React.FC = () => {
  const { docId } = useParams<{ docId: string }>();
  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'metadata' | 'extracted' | 'text'>('metadata');

  const loadDocument = useCallback(async () => {
    if (!docId) return;
    try {
      setLoading(true);
      const res = await api.getDocument(docId);
      setDoc(res);
      setSelectedCategory(res.category);
      setReviewerNotes(res.reviewer_notes || res.source_details?.reviewer_notes || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const handleSaveCorrections = async () => {
    if (!docId) return;
    try {
      const updated = await api.updateDocument(docId, {
        category: selectedCategory,
        reviewer_notes: reviewerNotes,
      });
      setDoc(updated);
      setEditing(false);
      alert('Document classifications and reviewer notes saved.');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-[#786C60]">
        Loading forensic document internals...
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="p-8 text-center text-xs text-[#991B1B]">
        Document not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to={`/investigations/${doc.investigation_id}/analysis`}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#725541] hover:text-[#49372C] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Analysis Engine</span>
        </Link>

        <a
          href={`/api/documents/${doc.id}/download`}
          download
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-[#49372C] bg-[#FFFDFA] hover:bg-[#EFE6D8] border border-[#E4D8C8] rounded-md transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-[#B8754D]" />
          <span>Download Original File</span>
        </a>
      </div>

      {/* Header Document Summary */}
      <div className="p-6 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-[#EFE6D8] border border-[#E4D8C8] flex items-center justify-center text-[#725541] font-bold text-sm uppercase shrink-0">
              {doc.file_type}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-[#49372C] tracking-tight">{doc.file_name}</h1>
                <Badge variant="classification">{doc.classification}</Badge>
                <Badge variant="status">{doc.processing_status}</Badge>
              </div>

              <div className="mt-2 text-xs text-[#786C60] flex flex-wrap items-center gap-3">
                <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                <span>&bull;</span>
                <span>Pages: {doc.metadata?.page_count || 1}</span>
                <span>&bull;</span>
                <span>Category: <b>{doc.category}</b></span>
                <span>&bull;</span>
                <span>Uploaded: {new Date(doc.upload_timestamp).toLocaleDateString()}</span>
              </div>

              {/* SHA-256 Hash */}
              <div className="mt-3 flex items-center space-x-2 text-xs font-mono text-[#786C60] bg-[#F8F5EF] px-3 py-1.5 rounded-md border border-[#E4D8C8]">
                <Hash className="w-3.5 h-3.5 text-[#B8754D] shrink-0" />
                <span className="truncate">SHA-256: {doc.file_hash}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-[#49372C] bg-[#EFE6D8] hover:bg-[#CBA783]/50 rounded-md transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#725541]" />
                <span>Correct Metadata</span>
              </button>
            ) : (
              <button
                onClick={handleSaveCorrections}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#B8754D] hover:bg-[#725541] rounded-md transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            )}
          </div>
        </div>

        {/* Inline editing bar */}
        {editing && (
          <div className="mt-4 pt-4 border-t border-[#E4D8C8] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#F8F5EF] p-3 rounded-lg">
            <div>
              <label className="block font-semibold text-[#49372C] mb-1">Correct Document Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-md"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-[#49372C] mb-1">Reviewer Annotation</label>
              <input
                type="text"
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Forensic observation notes..."
                className="w-full px-2.5 py-1.5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-md"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabs Layout */}
      <div className="border-b border-[#E4D8C8] flex space-x-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('metadata')}
          className={`pb-2.5 transition-colors ${
            activeTab === 'metadata'
              ? 'text-[#B8754D] border-b-2 border-[#B8754D]'
              : 'text-[#786C60] hover:text-[#49372C]'
          }`}
        >
          Structural & OCR Provenance
        </button>
        <button
          onClick={() => setActiveTab('extracted')}
          className={`pb-2.5 transition-colors ${
            activeTab === 'extracted'
              ? 'text-[#B8754D] border-b-2 border-[#B8754D]'
              : 'text-[#786C60] hover:text-[#49372C]'
          }`}
        >
          Extracted Forensic Fields
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`pb-2.5 transition-colors ${
            activeTab === 'text'
              ? 'text-[#B8754D] border-b-2 border-[#B8754D]'
              : 'text-[#786C60] hover:text-[#49372C]'
          }`}
        >
          Extracted Raw Text
        </button>
      </div>

      {/* Tab 1: PyMuPDF Metadata & OCR Provenance */}
      {activeTab === 'metadata' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
              <span className="text-[#786C60] font-semibold">Extraction Method</span>
              <div className="font-bold text-[#49372C] text-sm mt-1 uppercase">
                {doc.metadata?.extraction_method || 'native_text'}
              </div>
              <div className="text-[11px] text-[#786C60] mt-1">Native font stream or OCR engine</div>
            </div>

            <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
              <span className="text-[#786C60] font-semibold">OCR Processing Status</span>
              <div className="font-bold text-[#49372C] text-sm mt-1 capitalize">
                {doc.metadata?.ocr_status || 'not_needed'}
              </div>
              <div className="text-[11px] text-[#786C60] mt-1">
                {doc.metadata?.ocr_confidence ? `Average confidence: ${doc.metadata.ocr_confidence}%` : 'Tesseract status'}
              </div>
            </div>

            <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
              <span className="text-[#786C60] font-semibold">Producer Software</span>
              <div className="font-bold text-[#49372C] text-sm mt-1">
                {doc.metadata?.producer || 'Not Stamped / Stripped'}
              </div>
              <div className="text-[11px] text-[#786C60] mt-1">PDF rendering library</div>
            </div>

            <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
              <span className="text-[#786C60] font-semibold">Creator Engine</span>
              <div className="font-bold text-[#49372C] text-sm mt-1">
                {doc.metadata?.creator || 'Not Specified'}
              </div>
              <div className="text-[11px] text-[#786C60] mt-1">Application that created source</div>
            </div>

            <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
              <span className="text-[#786C60] font-semibold">Creation Timestamp</span>
              <div className="font-bold text-[#49372C] text-sm mt-1">
                {doc.metadata?.creation_date || 'Missing / Not Embedded'}
              </div>
              <div className="text-[11px] text-[#786C60] mt-1">Internal PDF header date</div>
            </div>

            <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
              <span className="text-[#786C60] font-semibold">Font Streams Count</span>
              <div className="font-bold text-[#49372C] text-sm mt-1">
                {doc.metadata?.font_count || 0} embedded fonts
              </div>
              <div className="text-[11px] text-[#786C60] mt-1">Indicates native digital typesetting</div>
            </div>

            <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
              <span className="text-[#786C60] font-semibold">Embedded Images / Dimensions</span>
              <div className="font-bold text-[#49372C] text-sm mt-1">
                {doc.metadata?.image_dimensions || `${doc.metadata?.embedded_images_count || 0} images`}
              </div>
              <div className="text-[11px] text-[#786C60] mt-1">Raster image presence</div>
            </div>

            <div className="p-4 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs">
              <span className="text-[#786C60] font-semibold">Metadata Completeness</span>
              <div className="font-bold text-[#49372C] text-sm mt-1">
                {Math.round((doc.metadata?.completeness_score || 0) * 100)}%
              </div>
              <div className="text-[11px] text-[#786C60] mt-1">Standard attribute coverage</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Extracted Fields */}
      {activeTab === 'extracted' && (
        <div className="p-5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-[#49372C]">
            Deterministically Extracted Forensic Entities
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-[#F8F5EF] rounded-lg border border-[#E4D8C8] space-y-2">
              <span className="font-bold text-[#725541]">Financial Amounts Detected</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {doc.extracted_fields?.amounts?.length > 0 ? (
                  doc.extracted_fields.amounts.map((a, i) => (
                    <span key={i} className="font-mono px-2 py-1 bg-[#FFFDFA] rounded border border-[#E4D8C8] text-[#49372C] font-semibold">
                      {a}
                    </span>
                  ))
                ) : (
                  <span className="text-[#786C60] italic">No financial figures detected</span>
                )}
              </div>
            </div>

            <div className="p-4 bg-[#F8F5EF] rounded-lg border border-[#E4D8C8] space-y-2">
              <span className="font-bold text-[#725541]">Dates & Timestamps</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {doc.extracted_fields?.dates?.length > 0 ? (
                  doc.extracted_fields.dates.map((d, i) => (
                    <span key={i} className="font-mono px-2 py-1 bg-[#FFFDFA] rounded border border-[#E4D8C8] text-[#49372C]">
                      {d}
                    </span>
                  ))
                ) : (
                  <span className="text-[#786C60] italic">No dates detected</span>
                )}
              </div>
            </div>

            <div className="p-4 bg-[#F8F5EF] rounded-lg border border-[#E4D8C8] space-y-2">
              <span className="font-bold text-[#725541]">Document & Reference Numbers</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {doc.extracted_fields?.document_numbers?.length > 0 ? (
                  doc.extracted_fields.document_numbers.map((n, i) => (
                    <span key={i} className="font-mono px-2 py-1 bg-[#FFFDFA] rounded border border-[#E4D8C8] text-[#49372C]">
                      {n}
                    </span>
                  ))
                ) : (
                  <span className="text-[#786C60] italic">No document numbers detected</span>
                )}
              </div>
            </div>

            <div className="p-4 bg-[#F8F5EF] rounded-lg border border-[#E4D8C8] space-y-2">
              <span className="font-bold text-[#725541]">Organizations Referenced</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {doc.extracted_fields?.organizations?.length > 0 ? (
                  doc.extracted_fields.organizations.map((o, i) => (
                    <span key={i} className="px-2 py-1 bg-[#FFFDFA] rounded border border-[#E4D8C8] text-[#49372C]">
                      {o}
                    </span>
                  ))
                ) : (
                  <span className="text-[#786C60] italic">No organization names detected</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Raw Text */}
      {activeTab === 'text' && (
        <div className="p-5 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs space-y-2">
          <div className="text-xs font-bold text-[#49372C]">Extracted Text Stream</div>
          <pre className="p-4 bg-[#F8F5EF] rounded-lg border border-[#E4D8C8] text-xs font-mono text-[#302820] max-h-96 overflow-y-auto whitespace-pre-wrap">
            {doc.extracted_text || 'No text extracted from document.'}
          </pre>
        </div>
      )}
    </div>
  );
};
