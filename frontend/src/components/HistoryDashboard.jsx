import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { History, FileText, ChevronRight, Clock, ShieldCheck, AlertTriangle, ShieldAlert, RefreshCw, Download, Loader2 } from 'lucide-react';

export default function HistoryDashboard({ onSelectReport, onNewScan }) {
  const { authFetch, user } = useAuth();
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/history');
      if (!res.ok) {
        throw new Error('Failed to retrieve scan history.');
      }
      const data = await res.json();
      setHistoryItems(data);
    } catch (err) {
      setError(err.message || 'Error loading scan history.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadItemPDF = async (item) => {
    if (!item?.id) return;
    setDownloadingId(item.id);
    try {
      const res = await authFetch(`/api/export-report/${item.id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Download failed with HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const safeTitle = (item.filename || 'Document').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `Poach_Originality_Report_${safeTitle}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert(`Could not download PDF report: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const getScoreBadge = (score) => {
    if (score < 20) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5" />
          {score}% Similarity
        </span>
      );
    } else if (score <= 40) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5" />
          {score}% Similarity
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <ShieldAlert className="w-3.5 h-3.5" />
          {score}% Similarity
        </span>
      );
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 max-w-5xl w-full mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Scan Audit History</h2>
              <p className="text-xs text-slate-500">
                Audited submissions for <span className="font-semibold text-slate-700">{user?.email}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchHistory}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
            title="Refresh history"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onNewScan}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            + Scan New Document
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading your scan audit records...</p>
        </div>
      ) : historyItems.length === 0 ? (
        /* Empty state */
        <div className="py-16 text-center">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Past Scans Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            You haven't scanned any documents yet under this account.
          </p>
          <button
            type="button"
            onClick={onNewScan}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition inline-block"
          >
            Run Your First Scan
          </button>
        </div>
      ) : (
        /* History Table */
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Document / File</th>
                <th className="py-3 px-4">Date Scanned</th>
                <th className="py-3 px-4">Similarity Index</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyItems.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => item.report && onSelectReport({ ...item.report, scan_id: item.id })}
                  className="hover:bg-slate-50/80 cursor-pointer transition group"
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition">
                          {item.filename}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          ID: {item.id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-4 text-xs text-slate-500 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                  </td>

                  <td className="py-4 px-4 whitespace-nowrap">
                    {getScoreBadge(item.overall_score)}
                  </td>

                  <td className="py-4 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleDownloadItemPDF(item)}
                        disabled={downloadingId === item.id}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title="Download PDF Originality Report"
                      >
                        {downloadingId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => item.report && onSelectReport({ ...item.report, scan_id: item.id })}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition ml-1"
                      >
                        View Report <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
