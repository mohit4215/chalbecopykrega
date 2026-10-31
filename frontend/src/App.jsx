import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ArrowLeft, 
  Printer, 
  FileCheck, 
  Layers
} from 'lucide-react';

import UploadComponent from './components/UploadComponent';
import ScoreGauge from './components/ScoreGauge';
import DocumentViewer from './components/DocumentViewer';
import SourcesSidebar from './components/SourcesSidebar';
import DiffModal from './components/DiffModal';

export default function App() {
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isDiffOpen, setIsDiffOpen] = useState(false);

  const handleSelectMatch = (match) => {
    setSelectedMatch(match);
  };

  const handleOpenDiff = (match) => {
    setSelectedMatch(match);
    setIsDiffOpen(true);
  };

  const handleReset = () => {
    setReport(null);
    setSelectedMatch(null);
    setIsDiffOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100/60 flex flex-col font-sans antialiased text-slate-900">
      {/* Top Application Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-slate-900 leading-none">Turnitin OriginalityGuard</h1>
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                  FastAPI + React
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Multi-Stage Document Extraction • Qdrant Vector Search • Live Web Verification
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
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print Report</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-1.5 transition shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Upload New File</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {!report ? (
          <div className="my-auto py-8">
            <UploadComponent 
              onScanComplete={(data) => setReport(data)}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-6">
            {/* Document Header Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  Plagiarism Audit Dashboard
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-0.5">
                  {report.document_title}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Submission ID: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono text-[11px]">{report.document_id}</code>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900">
                    {report.overall_score}%
                  </div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Plagiarism</div>
                </div>
              </div>
            </div>

            {/* Turnitin Split-Screen Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 min-h-[640px]">
              {/* Left Pane (8 Cols): Full Document Viewer with Highlight Spans */}
              <div className="lg:col-span-8 h-full min-h-[620px] flex flex-col">
                <DocumentViewer
                  fullText={report.full_text}
                  matches={report.matches}
                  selectedMatchId={selectedMatch?.id}
                  onSelectMatch={handleSelectMatch}
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
                  onSelectMatch={handleSelectMatch}
                  onOpenDiff={handleOpenDiff}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Side-by-Side Snippet Comparison Modal */}
      <DiffModal
        match={selectedMatch}
        isOpen={isDiffOpen}
        onClose={() => setIsDiffOpen(false)}
      />
    </div>
  );
}
