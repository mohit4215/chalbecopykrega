import React from 'react';
import { 
  ArrowLeft, 
  Download, 
  Printer, 
  Loader2, 
  FileText, 
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

/**
 * Sticky Header for Document Originality Report.
 * Displays overall Originality Score with an animated circular SVG gauge
 * dynamically shifting from Green (>=80%) to Yellow (60-79%) to Red (<60%).
 */
export default function ReportStickyHeader({
  report,
  onNewScan,
  onDownloadPdf,
  isDownloadingPdf,
  onPrint,
}) {
  if (!report) return null;

  const originality = Math.max(0, Math.min(100, Math.round(report.originality_score ?? (100 - (report.overall_score || 0)))));
  const similarity = Math.round(report.overall_score || (100 - originality));

  // Determine color theme based on originality percentage
  const getScoreTheme = (pct) => {
    if (pct >= 80) {
      return {
        color: '#10b981', // Emerald / Green
        textClass: 'text-emerald-600 dark:text-emerald-400',
        bgClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        statusText: 'High Originality',
        icon: CheckCircle2,
      };
    } else if (pct >= 60) {
      return {
        color: '#f59e0b', // Amber / Yellow
        textClass: 'text-amber-600 dark:text-amber-400',
        bgClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        statusText: 'Moderate Overlap',
        icon: AlertTriangle,
      };
    } else {
      return {
        color: '#f43f5e', // Rose / Red
        textClass: 'text-rose-600 dark:text-rose-400',
        bgClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        statusText: 'High Similarity',
        icon: AlertCircle,
      };
    }
  };

  const theme = getScoreTheme(originality);

  // SVG Circular Gauge calculations
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (originality / 100) * circumference;

  return (
    <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors mb-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Document Info & Dynamic Circular SVG Gauge */}
        <div className="flex items-center gap-4">
          {/* Circular SVG Gauge */}
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <svg className="w-16 h-16 -rotate-90 transform">
              {/* Background Track */}
              <circle
                cx="32"
                cy="32"
                r={radius}
                className="text-slate-100 dark:text-slate-800"
                strokeWidth="6"
                stroke="currentColor"
                fill="transparent"
              />
              {/* Animated Progress Arc */}
              <circle
                cx="32"
                cy="32"
                r={radius}
                stroke={theme.color}
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                style={{
                  transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.5s ease',
                }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className={cn('text-sm font-black leading-none tracking-tight', theme.textClass)}>
                {originality}%
              </span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                Original
              </span>
            </div>
          </div>

          {/* Document Metadata & Status Tag */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate max-w-sm sm:max-w-md">
                {report.document_title || report.filename || 'Audited Document'}
              </h2>
              <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border', theme.bgClass)}>
                {theme.statusText}
              </span>
              {report.ai_detection && (
                <span className={cn(
                  'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1',
                  report.ai_detection.ai_probability >= 50
                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                    : 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800'
                )}>
                  <Sparkles className="w-3 h-3" />
                  AI Writing: {report.ai_detection.ai_probability}% ({report.ai_detection.verdict})
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span>{report.total_words?.toLocaleString() || 0} words</span>
              <span>•</span>
              <span>{report.total_characters?.toLocaleString() || 0} characters</span>
              <span>•</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {similarity}% Similarity Index
              </span>
              {report.citation_exclusions && (
                <>
                  <span>•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                    ✓ Quotes & References Excluded
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions (Download PDF, Print, New Scan) */}
        <div className="flex items-center gap-2.5 self-end md:self-center">
          <Button
            size="sm"
            onClick={onDownloadPdf}
            isLoading={isDownloadingPdf}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            title="Download signed PDF report"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span>{isDownloadingPdf ? 'Exporting...' : 'PDF Report'}</span>
          </Button>

          {onPrint && (
            <Button
              size="sm"
              variant="outline"
              onClick={onPrint}
              className="hidden sm:inline-flex"
              title="Print report"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              <span>Print</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={onNewScan}
            title="Upload another document"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            <span>New Scan</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
