import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
  Download, 
  Trash2, 
  AlertTriangle, 
  Clock, 
  Lock, 
  FileJson, 
  CheckCircle2, 
  Loader2, 
  X,
  ExternalLink
} from 'lucide-react';

export default function PrivacySettings() {
  const { user, authFetch, logout } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // ---------------------------------------------------------------------------
  // 1. GDPR Art. 20: Right to Data Portability (JSON Export)
  // ---------------------------------------------------------------------------
  const handleExportData = async () => {
    setIsExporting(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const response = await authFetch('/api/users/me/export');
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Export failed with status: ${response.status}`);
      }

      const data = await response.json();
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `poach_gdpr_data_export_${user?.id?.slice(0, 8)}_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatusMessage('Data export downloaded successfully!');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to download data export.');
    } finally {
      setIsExporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 2. GDPR Art. 17 / CCPA: Right to Erasure (Account & Data Hard-Delete)
  // ---------------------------------------------------------------------------
  const handleDeleteAccount = async () => {
    if (confirmInput.trim().toUpperCase() !== 'DELETE') {
      setErrorMessage('Please type DELETE to confirm account erasure.');
      return;
    }

    setIsDeleting(true);
    setErrorMessage('');

    try {
      const response = await authFetch('/api/users/me', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Account deletion failed with status: ${response.status}`);
      }

      const resData = await response.json();
      alert(resData.message || 'Your account and all associated data have been permanently erased.');

      // Clear tokens and logout user
      logout();
      window.location.href = '/';
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete account. Please contact support.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Privacy & Compliance
            </span>
            <h1 className="text-2xl font-black text-slate-900 mt-1">
              Data & Privacy Center
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Manage your personal data in accordance with GDPR (EU 2016/679) and CCPA (Cal. Civ. Code § 1798).
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              GDPR & CCPA Compliant
            </span>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-5 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Section 1: Automated Retention Policy */}
        <div className="mt-8 bg-slate-50 rounded-2xl p-6 border border-slate-200/80">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl shrink-0 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Automated 30-Day Rolling Data Retention Policy
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
                  Daily Celery Purge Active
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                To protect your academic and intellectual privacy, Poach does not maintain permanent archives of your manuscripts.
                All document uploads, cached OCR fragments, similarity matrices, and S3 vault records are 
                <strong> permanently purged automatically after 30 days</strong> via scheduled Celery Beat maintenance tasks.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: GDPR Right to Data Portability (Art. 20) */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Download Your Personal Data (GDPR Art. 20)
              </h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Receive a complete, machine-readable JSON archive containing your user profile, active subscription status,
              credit transaction ledger, and all historical originality reports.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportData}
            disabled={isExporting}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 shrink-0"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting JSON...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Data Export (JSON)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Section 3: Danger Zone (Right to Erasure / Account Hard-Delete) */}
      <div className="bg-white rounded-3xl p-8 border border-red-200 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-3 pb-4 border-b border-red-100">
          <div className="p-2.5 bg-red-100 text-red-600 rounded-xl">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-red-700">Danger Zone: Permanent Account Deletion</h2>
            <p className="text-xs text-slate-500">GDPR Article 17 (Right to Erasure) & CCPA § 1798.105</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl text-xs text-slate-600 leading-relaxed">
            <p>
              Once initiated, your account deletion is <strong>immediate and permanent</strong>. The following actions will be executed:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-500 pl-1">
              <li>Immediate cancellation of any active Stripe Pro subscriptions via the Stripe API.</li>
              <li>Permanent hard-deletion of your PostgreSQL user account and password hash.</li>
              <li>Purge of all historical scan reports, similarity matrices, and S3 document files.</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => {
              setConfirmInput('');
              setShowDeleteModal(true);
            }}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 shrink-0 self-start md:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Account & Purge Data</span>
          </button>
        </div>
      </div>

      {/* Safety Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-red-200 space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Confirm Account Deletion</h3>
                  <p className="text-xs text-red-600 font-semibold">Irreversible action</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will permanently delete your account (<strong>{user?.email}</strong>), cancel your Stripe billing subscription, 
              and permanently expunge all scans and S3 files.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                To confirm, type <span className="font-mono text-red-600 font-black">DELETE</span> below:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={confirmInput.trim().toUpperCase() !== 'DELETE' || isDeleting}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Purging Account...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Erase All Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
