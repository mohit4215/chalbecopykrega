import React, { useState } from 'react';
import { Flag, X, CheckCircle2, AlertTriangle, Send, ShieldAlert, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function FlagModal({ isOpen, onClose, match, report }) {
  const { authFetch } = useAuth();
  const [reason, setReason] = useState('false_positive');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !match) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        chunk_text: match.matched_text || '',
        matched_source_url: match.source_url || null,
        source_title: match.source_title || null,
        similarity_score: typeof match.similarity_score === 'number' ? match.similarity_score : null,
        reason: reason,
        comment: comment.trim() || null,
        scan_id: report?.scan_id || report?.id || null,
        filename: report?.document_title || report?.filename || null,
      };

      const res = await authFetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server returned HTTP ${res.status}`);
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setComment('');
        onClose();
      }, 2000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Flag as Incorrect / False Positive</h3>
              <p className="text-xs text-slate-500">
                Help our ML team calibrate similarity thresholds and quotation detection.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {success ? (
          <div className="p-8 text-center bg-white space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Feedback Recorded</h4>
            <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
              Thank you! This text chunk and source reference have been saved to our calibration database for manual review and threshold tuning.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Flagged Chunk Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
                <span>Flagged Text Chunk</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                  {match.similarity_score ? `${(match.similarity_score * 100).toFixed(0)}% Match` : 'Match'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-serif text-slate-800 line-clamp-3 italic">
                &ldquo;{match.matched_text}&rdquo;
              </div>
            </div>

            {/* Matched Source Info */}
            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center justify-between text-xs">
              <div className="truncate pr-3">
                <span className="text-slate-500">Source: </span>
                <strong className="text-slate-800">{match.source_title || 'Reference Document'}</strong>
                {match.source_url && (
                  <span className="text-indigo-600 block truncate text-[11px]">{match.source_url}</span>
                )}
              </div>
            </div>

            {/* Reason selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Reason for Flagging *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              >
                <option value="false_positive">False Positive (Engine is overly sensitive)</option>
                <option value="common_phrase">Common Phrase / Idiom / Academic Cliche</option>
                <option value="quotation_missed">Direct Quotation or Citation was missed by parser</option>
                <option value="public_domain">Universal Fact / Public Domain Knowledge</option>
                <option value="other">Other / Formatting Artifact</option>
              </select>
            </div>

            {/* Optional Comment */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Explanation or Details (Optional)
              </label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Why should this chunk not be marked as plagiarized? Any context helps our ML engineers..."
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Flag'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
