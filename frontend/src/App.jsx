import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { 
  ShieldCheck, 
  ArrowLeft, 
  Printer, 
  History, 
  UploadCloud, 
  CreditCard, 
  Sparkles,
  Zap,
  LogOut, 
  X,
  Download,
  Loader2
} from 'lucide-react';

import UploadComponent from './components/UploadComponent';
import ScoreGauge from './components/ScoreGauge';
import DocumentViewer from './components/DocumentViewer';
import SourcesSidebar from './components/SourcesSidebar';
import DiffModal from './components/DiffModal';
import HistoryDashboard from './components/HistoryDashboard';
import PricingPage from './components/PricingPage';
import BillingDashboard from './components/BillingDashboard';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import AdminDashboard from './components/admin/AdminDashboard';

function MainApp() {
  const { user, isAuthenticated, logout, updateUserCredits, refreshUser, authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'history' | 'report' | 'pricing' | 'billing'
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [authModal, setAuthModal] = useState(null); // null | 'login' | 'register'

  useEffect(() => {
    if (isAuthenticated) {
      refreshUser();
    }
  }, [isAuthenticated]);

  const handleScanComplete = (reportData) => {
    setReport(reportData);
    if (reportData.remaining_credits !== undefined) {
      updateUserCredits(reportData.remaining_credits, reportData.subscription_tier);
    }
    setActiveTab('report');
  };

  const handleSelectHistoryReport = (historicalReport) => {
    setReport(historicalReport);
    setActiveTab('report');
  };

  const handleOpenDiff = (match) => {
    setSelectedMatch(match);
    setIsDiffOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!report?.scan_id) {
      alert("Report ID not found. Please select this report from Scan History or scan the document again.");
      return;
    }
    setIsDownloadingPdf(true);
    try {
      const res = await authFetch(`/api/export-report/${report.scan_id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server returned HTTP ${res.status}`);
      }
      const blob = await res.blob();
      // Trigger native browser download without opening a blank tab
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const safeTitle = (report.document_title || 'Document').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `Originality_Report_${safeTitle}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert(`Could not download PDF report: ${err.message}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const isPro = user?.has_active_subscription || user?.subscription_tier === 'pro';

  return (
    <div className="min-h-screen bg-slate-100/60 flex flex-col font-sans antialiased text-slate-900">
      {/* Top Application Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Product Name */}
          <div 
            onClick={() => setActiveTab(report ? 'report' : 'scan')}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-slate-900 leading-none">OriginalityGuard</h1>
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Stripe SaaS
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                FastAPI • Qdrant • Hybrid NLP • Subscription Monetization
              </p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('scan')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition ${
                    activeTab === 'scan'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New Scan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition ${
                    activeTab === 'history'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">History</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('pricing')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition ${
                    activeTab === 'pricing'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pricing</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('billing')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition ${
                    activeTab === 'billing'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Billing</span>
                </button>

                {/* Superadmin Navigation Pill */}
                {user?.is_admin && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('admin')}
                    className={`px-3 py-1.5 text-xs font-extrabold rounded-xl flex items-center gap-1.5 transition ${
                      activeTab === 'admin'
                        ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
                        : 'text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200'
                    }`}
                    title="Superadmin Dashboard & User Management"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                    <span>Admin</span>
                  </button>
                )}

                {report && activeTab === 'report' && (
                  <>
                    <button
                      type="button"
                      onClick={handleDownloadPDF}
                      disabled={isDownloadingPdf}
                      className="hidden sm:flex px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl items-center gap-1.5 shadow-sm transition"
                      title="Download PDF Originality Report"
                    >
                      {isDownloadingPdf ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>{isDownloadingPdf ? 'Exporting...' : 'PDF Report'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="hidden md:flex px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl items-center gap-1.5 transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                  </>
                )}

                {/* Credits / Tier Badge */}
                <div 
                  onClick={() => setActiveTab('billing')}
                  className="cursor-pointer ml-1 px-3 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-full flex items-center gap-1.5 text-xs font-bold text-amber-900 transition"
                  title="Click to manage subscription or purchase credits"
                >
                  <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
                  <span>{isPro ? 'Pro Plan' : `${user?.scan_credits || 0} Credits`}</span>
                </div>

                {/* User Profile Pill & Logout */}
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <button
                    type="button"
                    onClick={logout}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('pricing')}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Pricing
                </button>
                <button
                  type="button"
                  onClick={() => setAuthModal('login')}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthModal('register')}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
                >
                  Get Started Free
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {activeTab === 'admin' && isAuthenticated ? (
          <AdminDashboard onExitAdmin={() => setActiveTab('scan')} />
        ) : activeTab === 'pricing' ? (
          <PricingPage
            onNeedLogin={() => setAuthModal('login')}
            onBillingSuccess={() => {
              refreshUser();
              setActiveTab('billing');
            }}
          />
        ) : activeTab === 'billing' && isAuthenticated ? (
          <BillingDashboard onNavigateToPricing={() => setActiveTab('pricing')} />
        ) : !isAuthenticated ? (
          /* Unauthenticated Landing */
          <div className="my-auto py-12 max-w-xl mx-auto text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-black text-slate-900">Academic Plagiarism Engine</h2>
            <p className="text-sm text-slate-500 mt-2">
              Sign in to receive <strong>3 free document scans</strong>, or upgrade to Pro for unlimited document checks.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setAuthModal('login')}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-md transition"
              >
                Sign In to Scan
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pricing')}
                className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm rounded-2xl border border-slate-200 shadow-sm transition"
              >
                View Plans & Pricing
              </button>
            </div>
          </div>
        ) : activeTab === 'history' ? (
          <HistoryDashboard 
            onSelectReport={handleSelectHistoryReport}
            onNewScan={() => setActiveTab('scan')}
          />
        ) : activeTab === 'scan' ? (
          <div className="my-auto py-8">
            <UploadComponent
              onScanComplete={handleScanComplete}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          </div>
        ) : (
          /* Report Screen: Split Screen */
          report && (
            <div className="flex-1 flex flex-col gap-6">
              {/* Document Header Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                      Audit Report
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ID: {report.document_id?.slice(0, 8)}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 mt-0.5">
                    {report.document_title}
                  </h2>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                    <span><strong>{report.total_words}</strong> words</span>
                    <span><strong>{report.total_characters}</strong> characters</span>
                    <span>Remaining Balance: <strong>{isPro ? 'Unlimited Pro' : `${user?.scan_credits} Credits`}</strong></span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right mr-1">
                    <div className="text-3xl font-black text-slate-900">
                      {report.overall_score}%
                    </div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Similarity Index</div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    disabled={isDownloadingPdf}
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-xl flex items-center gap-2 shadow-sm shadow-indigo-100 transition active:scale-95"
                    title="Generate and download publication-ready PDF originality audit"
                  >
                    {isDownloadingPdf ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('scan')}
                    className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>New Scan</span>
                  </button>
                </div>
              </div>

              {/* Turnitin Split-Screen Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 min-h-[640px]">
                {/* Left Pane (8 Cols): Full Document Viewer with Highlights */}
                <div className="lg:col-span-8 h-full min-h-[620px] flex flex-col">
                  <DocumentViewer
                    fullText={report.full_text}
                    matches={report.matches}
                    selectedMatchId={selectedMatch?.id}
                    onSelectMatch={(m) => setSelectedMatch(m)}
                  />
                </div>

                {/* Right Pane (4 Cols): Gauge & Clickable Sources List */}
                <div className="lg:col-span-4 space-y-6">
                  <ScoreGauge
                    overallScore={report.overall_score}
                    originalityScore={report.originality_score}
                    summary={report.summary}
                  />

                  <SourcesSidebar
                    matches={report.matches}
                    selectedMatchId={selectedMatch?.id}
                    onSelectMatch={(m) => setSelectedMatch(m)}
                    onOpenDiff={handleOpenDiff}
                  />
                </div>
              </div>
            </div>
          )
        )}
      </main>

      {/* Side-by-Side Snippet Comparison Modal */}
      <DiffModal
        match={selectedMatch}
        isOpen={isDiffOpen}
        onClose={() => setIsDiffOpen(false)}
      />

      {/* Auth Modal (Login / Register) */}
      {authModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-md w-full">
            <button
              type="button"
              onClick={() => setAuthModal(null)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {authModal === 'login' ? (
              <LoginForm
                onSwitchToRegister={() => setAuthModal('register')}
                onSuccess={() => setAuthModal(null)}
              />
            ) : (
              <RegisterForm
                onSwitchToLogin={() => setAuthModal('login')}
                onSuccess={() => setAuthModal(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
