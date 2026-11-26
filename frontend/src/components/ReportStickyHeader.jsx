import React from 'react';
import { 
  ArrowLeft, 
  Download, 
  Printer, 
  Award, 
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

  const authorName = report.author || 'Author';
  const scanDate = report.created_at 
    ? new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="sticky top-14 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors mb-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Document Title, Author, Date, Word Count */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate max-w-sm sm:max-w-md tracking-tight">
              {report.document_title || report.filename || 'Audited Document'}
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Verified Report
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>{authorName}</span>
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{scanDate}</span>
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>{report.total_words?.toLocaleString() || 0} words</span>
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 self-end md:self-center">
          {onOpenCertificate && (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenCertificate}
              className="text-xs font-medium"
              title="View verified originality certificate"
            >
              <Award className="w-3.5 h-3.5 mr-1 text-slate-500" />
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
            <span>{isDownloadingPdf ? 'Exporting...' : 'Download PDF'}</span>
          </Button>

          {onPrint && (
            <Button
              size="sm"
              variant="outline"
              onClick={onPrint}
              className="hidden sm:inline-flex text-xs font-medium"
              title="Print report"
            >
              <Printer className="w-3.5 h-3.5 mr-1 text-slate-500" />
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
