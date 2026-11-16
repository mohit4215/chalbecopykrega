import React from 'react';
import { 
  ArrowLeft, 
  Download, 
  Printer, 
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Shield,
  EyeOff,
  Code2,
  Award,
  Database,
  Cpu
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
  onOpenCertificate,
}) {
  if (!report) return null;

  const originality = Math.max(0, Math.min(100, Math.round(report.originality_score ?? (100 - (report.overall_score || 0)))));
  const similarity = Math.round(report.overall_score || (100 - originality));

  // Determine color theme based on originality percentage
  const getScoreTheme = (pct) => {
    if (pct >= 80) {
      return {
        color: '#10b981', // Emerald
        textClass: 'text-emerald-700 dark:text-emerald-400',
        bgClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        statusText: 'High Originality',
        icon: CheckCircle2,
      };
    } else if (pct >= 60) {
      return {
        color: '#f59e0b', // Amber
        textClass: 'text-amber-700 dark:text-amber-400',
        bgClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        statusText: 'Moderate Overlap',
        icon: AlertTriangle,
      };
    } else {
      return {
        color: '#e11d48', // Rose
        textClass: 'text-rose-700 dark:text-rose-400',
        bgClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        statusText: 'High Similarity',
        icon: AlertCircle,
      };
    }
  };

  const theme = getScoreTheme(originality);

  // SVG Circular Gauge calculations
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (originality / 100) * circumference;

  return (
    <div className="sticky top-14 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2.5 bg-white/95 dark:bg-[#0d121f]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-2xs transition-colors mb-5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Document Info & Dynamic Circular SVG Gauge */}
        <div className="flex items-center gap-3.5">
          {/* Circular SVG Gauge */}
          <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
            <svg className="w-14 h-14 -rotate-90 transform">
              {/* Background Track */}
              <circle
                cx="28"
                cy="28"
                r={radius}
                className="text-slate-100 dark:text-slate-800"
                strokeWidth="5"
                stroke="currentColor"
                fill="transparent"
              />
              {/* Animated Progress Arc */}
              <circle
                cx="28"
                cy="28"
                r={radius}
                stroke={theme.color}
                strokeWidth="5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                style={{
                  transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease',
                }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className={cn('text-xs font-bold leading-none tracking-tight font-mono tabular-nums', theme.textClass)}>
                {originality}%
              </span>
              <span className="text-[7px] font-semibold text-slate-400 uppercase tracking-tighter">
                Original
              </span>
            </div>
          </div>

          {/* Document Metadata & Status Tag */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate max-w-sm sm:max-w-md">
                {report.document_title || report.filename || 'Audited Document'}
              </h2>
              <span className={cn('text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border font-mono', theme.bgClass)}>
                {theme.statusText}
              </span>
              {report.ai_detection && (
                <span className={cn(
                  'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1 font-mono',
                  report.ai_detection.ai_probability >= 50
                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                )}>
                  <Cpu className="w-3 h-3" />
                  AI Index: {report.ai_detection.ai_probability}%
                </span>
              )}

              {report.esl_mode && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1 font-mono">
                  <Shield className="w-3 h-3" />
                  ESL Shield
                </span>
              )}

              {report.ephemeral_mode && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 flex items-center gap-1 font-mono">
                  <EyeOff className="w-3 h-3" />
                  Ephemeral
                </span>
              )}

              {report.code_analysis && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 flex items-center gap-1 font-mono">
                  <Code2 className="w-3 h-3" />
                  AST Protected
                </span>
              )}

              {report.indexed_in_repository && !report.ephemeral_mode && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 flex items-center gap-1 font-mono">
                  <Database className="w-3 h-3" />
                  Corpus Indexed
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              <span>{report.total_words?.toLocaleString() || 0} words</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>{report.total_characters?.toLocaleString() || 0} chars</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                {similarity}% Similarity Index
              </span>
              {report.citation_exclusions && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium text-[11px]">
                    Quotes & References Excluded
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions (Certificate, Download PDF, Print, New Scan) */}
        <div className="flex items-center gap-2 self-end md:self-center">
          {onOpenCertificate && (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenCertificate}
              className="text-xs font-medium"
              title="View cryptographic originality certificate"
            >
              <Award className="w-3.5 h-3.5 mr-1 text-slate-600 dark:text-slate-400" />
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
