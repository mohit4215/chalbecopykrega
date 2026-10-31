import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { 
  ShieldCheck, 
  ArrowLeft, 
  Printer, 
  History, 
  UploadCloud, 
  User, 
  LogOut, 
  LogIn, 
  FileCheck2,
  X
} from 'lucide-react';

import UploadComponent from './components/UploadComponent';
import ScoreGauge from './components/ScoreGauge';
import DocumentViewer from './components/DocumentViewer';
import SourcesSidebar from './components/SourcesSidebar';
import DiffModal from './components/DiffModal';
import HistoryDashboard from './components/HistoryDashboard';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';

function MainApp() {
  const { user, isAuthenticated, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'history' | 'report'
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [authModal, setAuthModal] = useState(null); // null | 'login' | 'register'

  const handleScanComplete = (reportData) => {
    setReport(reportData);
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
                <h1 className="text-base font-extrabold text-slate-900 leading-none">Turnitin OriginalityGuard</h1>
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                  JWT Auth & History
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                FastAPI • Qdrant Vector DB • Scanned OCR • Audit Logging
              </p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-3">
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
                  <span>New Scan</span>
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
                  <span>Scan History</span>
                </button>

                {report && activeTab === 'report' && (
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="hidden sm:flex px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl items-center gap-1.5 transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                )}

                {/* User Profile Pill & Logout */}
                <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                  <div className="hidden md:flex flex-col text-right">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[140px]">{user?.email}</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">Authenticated</span>
                  </div>
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
                  Create Account
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {!isAuthenticated ? (
          /* Unauthenticated Landing / Gate */
          <div className="my-auto py-12 max-w-xl mx-auto text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-black text-slate-900">Academic Plagiarism Engine</h2>
            <p className="text-sm text-slate-500 mt-2">
              Sign in to scan research papers, track your originality audit history, and access full Turnitin-style side-by-side diff reports.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setAuthModal('login')}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-md transition"
              >
                Sign In to Your Account
              </button>
              <button
                type="button"
                onClick={() => setAuthModal('register')}
                className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm rounded-2xl border border-slate-200 shadow-sm transition"
              >
                Register Free
              </button>
            </div>
          </div>
        ) : activeTab === 'history' ? (
          /* Scan Audit History Table */
          <HistoryDashboard 
            onSelectReport={handleSelectHistoryReport}
            onNewScan={() => setActiveTab('scan')}
          />
        ) : activeTab === 'scan' ? (
          /* Upload Component */
          <div className="my-auto py-8">
            <UploadComponent
              onScanComplete={handleScanComplete}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          </div>
        ) : (
          /* Report Screen: Split View */
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
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-3xl font-black text-slate-900">
                      {report.overall_score}%
                    </div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Similarity Index</div>
                  </div>
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
