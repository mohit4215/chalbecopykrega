import React, { useState, useEffect } from 'react';
import { 
  Flag, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  RefreshCw, 
  Sparkles, 
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AdminFeedbackReview() {
  const { authFetch } = useAuth();
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [editingNotesId, setEditingNotesId] = useState(null);
  const [adminNotesDraft, setAdminNotesDraft] = useState('');

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      });
      if (statusFilter) params.append('status', statusFilter);
      if (reasonFilter) params.append('reason', reasonFilter);

      const res = await authFetch(`/api/admin/feedback?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load feedback records');
      const data = await res.json();
      setFeedbacks(data.feedbacks || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, [page, statusFilter, reasonFilter]);

  const handleUpdateStatus = async (feedbackId, newStatus, notes = null) => {
    setUpdatingId(feedbackId);
    try {
      const payload = { status: newStatus };
      if (notes !== null) {
        payload.admin_notes = notes;
      }

      const res = await authFetch(`/api/admin/feedback/${feedbackId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = await res.json();
        setFeedbacks((prev) =>
          prev.map((f) => (f.id === feedbackId ? updated : f))
        );
        setEditingNotesId(null);
      }
    } catch (err) {
      alert(`Could not update feedback: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const getReasonBadge = (r) => {
    switch (r) {
      case 'false_positive':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">False Positive</span>;
      case 'common_phrase':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">Common Phrase</span>;
      case 'quotation_missed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">Quotation Missed</span>;
      case 'public_domain':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Public Domain</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">{r}</span>;
    }
  };

  const getStatusBadge = (s) => {
    switch (s) {
      case 'pending':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">Pending Review</span>;
      case 'reviewed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200">Reviewed</span>;
      case 'resolved':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Threshold Tuned</span>;
      case 'dismissed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">Dismissed</span>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-900">NLP False Positive & Feedback Queue</h3>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-xs">
              {total} Total Flags
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit user reports to calibrate semantic similarity thresholds and improve winnowing parameters.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="resolved">Threshold Tuned</option>
            <option value="dismissed">Dismissed</option>
          </select>

          <select
            value={reasonFilter}
            onChange={(e) => {
              setReasonFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700"
          >
            <option value="">All Reasons</option>
            <option value="false_positive">False Positive</option>
            <option value="common_phrase">Common Phrase</option>
            <option value="quotation_missed">Quotation Missed</option>
            <option value="public_domain">Public Domain</option>
            <option value="other">Other</option>
          </select>

          <button
            type="button"
            onClick={fetchFeedbacks}
            className="p-1.5 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-xl border border-slate-200 transition"
            title="Refresh Feedback Queue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feedback List */}
      {feedbacks.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-600">No Feedback Items Found</p>
          <p className="text-xs text-slate-400 mt-1">The false-positive audit queue is currently clean.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((f) => (
            <div
              key={f.id}
              className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all bg-white shadow-sm space-y-3"
            >
              {/* Row 1: Badges & Metadata */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {getReasonBadge(f.reason)}
                  {getStatusBadge(f.status)}
                  {f.similarity_score !== null && (
                    <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                      Score: {(f.similarity_score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  {f.user_email ? (
                    <span>By: <strong className="text-slate-700">{f.user_email}</strong></span>
                  ) : (
                    <span>By: <em>Guest User</em></span>
                  )}
                  {f.filename && <span className="ml-2 font-mono">Doc: {f.filename}</span>}
                  <span className="ml-2">({f.created_at?.split('T')[0]})</span>
                </div>
              </div>

              {/* Row 2: Flagged Text */}
              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 text-xs font-serif text-slate-800 italic">
                &ldquo;{f.chunk_text}&rdquo;
              </div>

              {/* Row 3: Matched Source & User Comment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {f.matched_source_url && (
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500 truncate mr-2">
                      Source: <strong className="text-slate-700">{f.source_title || 'Web URL'}</strong>
                    </span>
                    <a
                      href={f.matched_source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline flex items-center gap-1 shrink-0 font-bold"
                    >
                      Inspect <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {f.comment && (
                  <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-100 text-slate-700">
                    <strong className="text-amber-800">User Comment: </strong>
                    <span>{f.comment}</span>
                  </div>
                )}
              </div>

              {/* Row 4: Admin Notes & Triage Actions */}
              {f.admin_notes && editingNotesId !== f.id && (
                <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">ML Calibration Notes: </span>
                    <span>{f.admin_notes}</span>
                  </div>
                </div>
              )}

              {editingNotesId === f.id && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Record ML Calibration / Threshold Adjustment Notes:
                  </label>
                  <textarea
                    rows={2}
                    value={adminNotesDraft}
                    onChange={(e) => setAdminNotesDraft(e.target.value)}
                    placeholder="e.g. Raised threshold to 0.88; added stop phrase to common idioms dictionary..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingNotesId(null)}
                      className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(f.id, 'resolved', adminNotesDraft)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg"
                    >
                      Save & Mark Tuned
                    </button>
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEditingNotesId(f.id);
                    setAdminNotesDraft(f.admin_notes || '');
                  }}
                  className="text-slate-500 hover:text-indigo-600 font-bold flex items-center gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{f.admin_notes ? 'Edit Calibration Notes' : 'Add Tuning Notes'}</span>
                </button>

                <div className="flex items-center gap-2">
                  {f.status === 'pending' && (
                    <button
                      type="button"
                      disabled={updatingId === f.id}
                      onClick={() => handleUpdateStatus(f.id, 'reviewed')}
                      className="px-3 py-1 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition"
                    >
                      Mark Reviewed
                    </button>
                  )}
                  {f.status !== 'resolved' && (
                    <button
                      type="button"
                      disabled={updatingId === f.id}
                      onClick={() => handleUpdateStatus(f.id, 'resolved')}
                      className="px-3 py-1 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition"
                    >
                      Mark Resolved
                    </button>
                  )}
                  {f.status !== 'dismissed' && (
                    <button
                      type="button"
                      disabled={updatingId === f.id}
                      onClick={() => handleUpdateStatus(f.id, 'dismissed')}
                      className="px-3 py-1 text-xs font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
          <span className="text-slate-500">
            Page {page} of {pages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
