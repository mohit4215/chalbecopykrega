import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider, useToast } from './components/ui/toast';
import { ShieldCheck, X } from 'lucide-react';

import AppShell from './components/layout/AppShell';
import UploadComponent from './components/UploadComponent';
import ScoreGauge from './components/ScoreGauge';
import DocumentViewer from './components/DocumentViewer';
import SourcesSidebar from './components/SourcesSidebar';
import ReportStickyHeader from './components/ReportStickyHeader';
import DiffModal from './components/DiffModal';
import HistoryDashboard from './components/HistoryDashboard';
import PricingPage from './components/PricingPage';
import BillingDashboard from './components/BillingDashboard';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import AdminDashboard from './components/admin/AdminDashboard';
import CookieConsent from './components/CookieConsent';
import PrivacySettings from './components/PrivacySettings';
import DeveloperApiDashboard from './components/DeveloperApiDashboard';
import SupportChatWidget from './components/SupportChatWidget';
import FlagModal from './components/FlagModal';
import ProductTour from './components/ProductTour';
import telemetry from './services/telemetry';
import { Button } from './components/ui/button';

function MainApp() {
  const { user, isAuthenticated, updateUserCredits, refreshUser, authFetch } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'history' | 'report' | 'pricing' | 'billing' | 'privacy' | 'admin'
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [flaggingMatch, setFlaggingMatch] = useState(null);
  const [authModal, setAuthModal] = useState(null); // null | 'login' | 'register'
  const [runManualTour, setRunManualTour] = useState(false);

  useEffect(() => {
    telemetry.init();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      refreshUser();
      telemetry.identify(user.id, {
        email: user.email,
        subscription_tier: user.subscription_tier || 'free',
        scan_credits: user.scan_credits ?? 0,
        is_admin: Boolean(user.is_admin),
      });
    } else if (!isAuthenticated) {
      telemetry.reset();
    }
  }, [isAuthenticated, user?.id]);

  const handleScanComplete = (reportData) => {
    setReport(reportData);
    if (reportData.remaining_credits !== undefined) {
      updateUserCredits(reportData.remaining_credits, reportData.subscription_tier);
    }
    setActiveTab('report');

    toast({
      title: 'Originality Audit Complete',
      description: `Analyzed ${reportData.total_words || 0} words against reference papers and live web pages.`,
      variant: 'success',
    });

    telemetry.track('Scan Completed', {
      scan_id: reportData.scan_id || reportData.id,
      document_title: reportData.document_title || reportData.filename,
      overall_score: reportData.overall_score,
      originality_score: reportData.originality_score,
      total_words: reportData.total_words,
      matches_count: reportData.matches?.length || 0,
      subscription_tier: reportData.subscription_tier || user?.subscription_tier || 'free',
    });
  };

  const handleSelectHistoryReport = (historicalReport) => {
    setReport(historicalReport);
    setActiveTab('report');
  };

  const handleOpenDiff = (match) => {
    setSelectedMatch(match);
    setIsDiffOpen(true);
  };

  const handleFlagMatch = (match) => {
    setFlaggingMatch(match);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!report?.scan_id) {
      toast({
        title: 'Report ID Missing',
        description: 'Please select this report from Scan History or scan the document again.',
        variant: 'warning',
      });
      return;
    }

    setIsDownloadingPdf(true);

    telemetry.track('PDF Report Downloaded', {
      scan_id: report.scan_id,
      document_title: report.document_title || 'Document',
      overall_score: report.overall_score,
      originality_score: report.originality_score,
    });

    try {
      const res = await authFetch(`/api/export-report/${report.scan_id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server returned HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const safeTitle = (report.document_title || 'Document').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `Poach_Originality_Report_${safeTitle}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: 'PDF Export Ready',
        description: 'Your signed originality certificate has downloaded successfully.',
        variant: 'success',
      });
    } catch (err) {
      toast({
        title: 'Export Failed',
        description: err.message || 'Could not download PDF report.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={(tab) => {
        if (tab === 'login') {
          setAuthModal('login');
        } else {
          setActiveTab(tab);
        }
      }}
      onStartTour={() => setRunManualTour(true)}
      report={report}
    >
      {/* Route Views */}
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
      ) : activeTab === 'developers' && isAuthenticated ? (
        <DeveloperApiDashboard />
      ) : activeTab === 'privacy' && isAuthenticated ? (
        <PrivacySettings />
      ) : activeTab === 'history' && isAuthenticated ? (
        <HistoryDashboard
          onSelectReport={handleSelectHistoryReport}
          onNewScan={() => setActiveTab('scan')}
        />
      ) : activeTab === 'report' && report ? (
        /* Report Screen: Turnitin Split-Screen Experience */
        <div className="flex-1 flex flex-col">
          {/* Sticky Top Header with Circular SVG Originality Gauge */}
          <ReportStickyHeader
            report={report}
            onNewScan={() => setActiveTab('scan')}
            onDownloadPdf={handleDownloadPDF}
            isDownloadingPdf={isDownloadingPdf}
            onPrint={handlePrint}
          />

          {/* Split Screen Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 min-h-[660px]">
            {/* Left Pane (8 Cols): Full Document Viewer with Bi-directional Highlight Sync */}
            <div className="lg:col-span-8 h-full min-h-[640px] flex flex-col">
              <DocumentViewer
                fullText={report.full_text}
                matches={report.matches}
                selectedMatchId={selectedMatch?.id}
                onSelectMatch={(m) => setSelectedMatch(m)}
              />
            </div>

            {/* Right Pane (4 Cols): Matched Sources Sidebar & Score Breakdown */}
            <div className="lg:col-span-4 space-y-6">
              <ScoreGauge
                overallScore={report.overall_score}
                originalityScore={report.originality_score}
                summary={report.summary}
                aiDetection={report.ai_detection}
              />

              <SourcesSidebar
                matches={report.matches}
                selectedMatchId={selectedMatch?.id}
                onSelectMatch={(m) => setSelectedMatch(m)}
                onOpenDiff={handleOpenDiff}
                onFlagMatch={handleFlagMatch}
              />
            </div>
          </div>
        </div>
      ) : !isAuthenticated && (activeTab === 'history' || activeTab === 'billing' || activeTab === 'privacy' || activeTab === 'admin' || activeTab === 'developers') ? (
        /* Protected Tab Sign In Prompt */
        <div className="my-auto py-12 max-w-xl mx-auto text-center space-y-4">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100">
            Sign In Required
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Please sign in to access your {activeTab === 'history' ? 'historical scans' : activeTab === 'billing' ? 'subscription and billing details' : activeTab === 'privacy' ? 'data privacy settings' : 'dashboard'}.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button size="lg" onClick={() => setAuthModal('login')}>
              Sign In
            </Button>
            <Button size="lg" variant="outline" onClick={() => setActiveTab('scan')}>
              Back to Scanner
            </Button>
          </div>
        </div>
      ) : (
        /* Default Tab ('scan') and Fallback: Always display Scanner Dropzone */
        <div className="my-auto py-6">
          <UploadComponent
            onScanComplete={handleScanComplete}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            onNeedLogin={() => setAuthModal('login')}
          />
        </div>
      )}

      {/* Side-by-Side Snippet Comparison Modal */}
      <DiffModal
        match={selectedMatch}
        isOpen={isDiffOpen}
        onClose={() => setIsDiffOpen(false)}
        onFlagMatch={handleFlagMatch}
      />

      {/* Flag Incorrect Match / False Positive Modal */}
      <FlagModal
        match={flaggingMatch}
        report={report}
        isOpen={!!flaggingMatch}
        onClose={() => setFlaggingMatch(null)}
      />

      {/* 4-Step Interactive Product Tour */}
      <ProductTour
        manualRun={runManualTour}
        onTourEnd={() => setRunManualTour(false)}
      />

      {/* Auth Modal (Login / Register) */}
      {authModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-md w-full animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setAuthModal(null)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition z-10"
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
    </AppShell>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <MainApp />
          <CookieConsent />
          <SupportChatWidget />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
