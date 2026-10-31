import React, { useState } from 'react';
import { 
  ShieldCheck, 
  RefreshCw, 
  Printer, 
  FileSpreadsheet, 
  HelpCircle,
  ArrowLeft
} from 'lucide-react';

import FileUpload from './components/FileUpload';
import DocumentViewer from './components/DocumentViewer';
import SimilarityGauge from './components/SimilarityGauge';
import MatchList from './components/MatchList';
import ComparisonDrawer from './components/ComparisonDrawer';

export default function App() {
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  const handleSelectMatch = (match) => {
    setSelectedMatch(match);
  };

  const handleOpenComparison = (match) => {
    setSelectedMatch(match);
    setIsComparisonOpen(true);
  };

  const handleReset = () => {
    setReport(null);
    setSelectedMatch(null);
    setIsComparisonOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 leading-none">Turnitin OriginalityGuard</h1>
                <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                  v2.0 NLP
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                N-gram Winnowing • MinHash LSH • HuggingFace Dense Paraphrase Detection
              </p>
            </div>
          </div>

          {report && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500 mr-2 border-r border-slate-200 pr-4">
                <span><strong>{report.total_words}</strong> words</span>
                <span><strong>{report.total_characters}</strong> characters</span>
              </div>

              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print Report</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 transition shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>New Scan</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {!report ? (
          <div className="my-auto">
            <FileUpload 
              onScanComplete={(newReport) => setReport(newReport)}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-6">
            {/* Report Header Banner */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                  Originality & Similarity Audit
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  {report.title}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Submission ID: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{report.document_id || 'LOCAL-SCAN'}</code>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900">
                    {report.overall_similarity_percentage}%
                  </div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Similarity Index</div>
                </div>
              </div>
            </div>

            {/* Turnitin Two-Column Split Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 min-h-[640px]">
              {/* Document Highlighter Viewer (8 cols) */}
              <div className="lg:col-span-8 h-full min-h-[620px] flex flex-col">
                <DocumentViewer
                  rawText={report.raw_text}
                  matches={report.matches}
                  selectedMatchId={selectedMatch?.id}
                  onSelectMatch={handleSelectMatch}
                />
              </div>

              {/* Sidebar: Turnitin Gauge & Matches Drawer (4 cols) */}
              <div className="lg:col-span-4 space-y-6">
                <SimilarityGauge
                  similarityPct={report.overall_similarity_percentage}
                  originalityPct={report.originality_percentage}
                  breakdown={report.sources_breakdown}
                />

                <MatchList
                  matches={report.matches}
                  selectedMatchId={selectedMatch?.id}
                  onSelectMatch={handleSelectMatch}
                  onOpenComparison={handleOpenComparison}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Comparison Drawer / Side-by-Side Modal */}
      <ComparisonDrawer
        match={selectedMatch}
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
      />
    </div>
  );
}
