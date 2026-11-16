import React from 'react';
import { 
  ArrowLeft, 
  Download, 
  Printer, 
  Award, 
  ShieldAlert,
  User,
  Calendar,
  FileText
} from 'lucide-react';
import { Button } from './ui/button';

export default function ReportStickyHeader({
  report,
  onNewScan,
  onDownloadPdf,
  isDownloadingPdf,
  onPrint,
  onOpenCertificate,
}) {
  if (!report) return null;

  const authorName = report.author || 'Anonymous Student';
  const scanDate = report.created_at 
    ? new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const isTampered = report.adversarial_integrity?.tampering_detected;

  return (
    <div className="sticky top-14 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-2xs transition-colors mb-5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Document Title, Author, Date, Word Count */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-sm sm:max-w-md tracking-tight">
              {report.document_title || report.filename || 'Audited Document'}
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
              Verified Report
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono text-[11px] tabular-nums">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3 text-zinc-400" />
              <span>{authorName}</span>
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-zinc-400" />
              <span>{scanDate}</span>
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3 text-zinc-400" />
              <span>{report.total_words?.toLocaleString() || 0} words</span>
            </span>
          </div>
        </div>

        {/* Center: Adversarial Evasion Warning (Hidden unless triggered) */}
        {isTampered && (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-md text-amber-700 dark:text-amber-300 text-xs font-medium animate-pulse">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>⚠️ Cyrillic Homoglyph Injection Neutralized</span>
            <span className="text-[10px] font-mono bg-amber-200/60 dark:bg-amber-900/60 px-1.5 py-0.2 rounded">
              Raw bytes normalized
            </span>
          </div>
        )}

        {/* Right: Actions (View SHA-256 Certificate, Export PDF, Print, New Scan) */}
        <div className="flex items-center gap-2 self-end md:self-center">
          {onOpenCertificate && (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenCertificate}
              className="text-xs font-medium font-mono"
              title="View SHA-256 verified cryptographic originality certificate"
            >
              <Award className="w-3.5 h-3.5 mr-1 text-zinc-600 dark:text-zinc-400" />
              <span>Certificate</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={onDownloadPdf}
            isLoading={isDownloadingPdf}
            className="text-xs font-semibold"
            title="Download signed PDF report"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span>{isDownloadingPdf ? 'Exporting...' : 'Export PDF'}</span>
          </Button>

          {onPrint && (
            <Button
              size="sm"
              variant="outline"
              onClick={onPrint}
              className="hidden sm:inline-flex text-xs font-medium"
              title="Print report"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              <span>Print</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={onNewScan}
            className="text-xs font-medium"
            title="Upload another document"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            <span>New Scan</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
