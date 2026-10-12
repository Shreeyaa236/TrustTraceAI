import React, { useState } from 'react';
import { X, FolderPlus, AlertCircle } from 'lucide-react';
import { useInvestigation } from '../context/InvestigationContext';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';

interface CreateInvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  'Financial Transactions',
  'Insurance Claims',
  'Medical Documents',
  'Identity Documents',
  'Legal Evidence',
  'Business Records',
  'Email and Communications',
  'Other'
];

export const CreateInvestigationModal: React.FC<CreateInvestigationModalProps> = ({ isOpen, onClose }) => {
  const { refreshInvestigations, setActiveInvestigation } = useInvestigation();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [caseReference, setCaseReference] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [primaryClaim, setPrimaryClaim] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Investigation name is required.';
    if (!description.trim()) errs.description = 'Investigation description is required.';
    if (!primaryClaim.trim()) errs.primaryClaim = 'Primary claim to verify is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      const newInv = await api.createInvestigation({
        name: name.trim(),
        description: description.trim(),
        case_reference: caseReference.trim() || undefined,
        category,
        primary_claim: primaryClaim.trim(),
        reviewer_notes: reviewerNotes.trim() || undefined,
      });

      await refreshInvestigations();
      setActiveInvestigation(newInv);
      onClose();
      // Navigate to Evidence Upload page for this investigation
      navigate(`/investigations/${newInv.id}/upload`);
    } catch (err: any) {
      setErrors({ form: err.message || 'Failed to create investigation.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#EFE6D8] border-b border-[#E4D8C8]">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-[#49372C] rounded-md text-[#EFE6D8]">
              <FolderPlus className="w-4 h-4 text-[#B8754D]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#49372C]">New Investigation</h2>
              <p className="text-xs text-[#786C60]">Establish case parameters and primary claim for multi-document verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#786C60] hover:text-[#49372C] rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errors.form && (
            <div className="flex items-center p-3 text-xs text-[#991B1B] bg-[#FEE2E2] border border-[#991B1B]/20 rounded-md">
              <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
              <span>{errors.form}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#49372C] mb-1">
              Investigation Name <span className="text-[#991B1B]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hospital Reimbursement Claim Review"
              className={`w-full px-3 py-2 text-xs bg-[#F8F5EF] border rounded-md text-[#302820] focus:outline-hidden ${
                errors.name ? 'border-[#991B1B]' : 'border-[#E4D8C8] focus:border-[#B8754D]'
              }`}
            />
            {errors.name && <p className="text-[11px] text-[#991B1B] mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#49372C] mb-1">
                Investigation Category <span className="text-[#991B1B]">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#49372C] mb-1">
                Case Reference <span className="text-[#786C60] font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={caseReference}
                onChange={(e) => setCaseReference(e.target.value)}
                placeholder="e.g. MED-2026-991"
                className="w-full px-3 py-2 text-xs bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#49372C] mb-1">
              Primary Claim to Verify <span className="text-[#991B1B]">*</span>
            </label>
            <input
              type="text"
              value={primaryClaim}
              onChange={(e) => setPrimaryClaim(e.target.value)}
              placeholder="e.g. A hospital bill of ₹25,000 was paid."
              className={`w-full px-3 py-2 text-xs bg-[#F8F5EF] border rounded-md text-[#302820] focus:outline-hidden ${
                errors.primaryClaim ? 'border-[#991B1B]' : 'border-[#E4D8C8] focus:border-[#B8754D]'
              }`}
            />
            {errors.primaryClaim && <p className="text-[11px] text-[#991B1B] mt-1">{errors.primaryClaim}</p>}
            <p className="text-[11px] text-[#786C60] mt-1">
              The focal evidentiary proposition that multi-document analysis will corroborate, refute, or highlight gaps for.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#49372C] mb-1">
              Investigation Description <span className="text-[#991B1B]">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide background context on the claim and circumstances of evidence submission..."
              className={`w-full px-3 py-2 text-xs bg-[#F8F5EF] border rounded-md text-[#302820] focus:outline-hidden ${
                errors.description ? 'border-[#991B1B]' : 'border-[#E4D8C8] focus:border-[#B8754D]'
              }`}
            />
            {errors.description && <p className="text-[11px] text-[#991B1B] mt-1">{errors.description}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#49372C] mb-1">
              Reviewer Notes <span className="text-[#786C60] font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              placeholder="Initial lead notes or investigator hypotheses..."
              className="w-full px-3 py-2 text-xs bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#E4D8C8]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#786C60] hover:text-[#49372C] bg-transparent rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#B8754D] hover:bg-[#725541] rounded-md shadow-xs transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating Case...' : 'Create & Proceed to Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
