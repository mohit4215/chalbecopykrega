import React, { useMemo, useEffect, useRef } from 'react';
import { FileText, ZoomIn, ZoomOut, Eye, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * High-performance Document Originality Viewer (Left Pane).
 * Renders large texts gracefully with zero DOM lag.
 * Features bi-directional auto-scroll synchronization with the Sources Sidebar.
 */
export default function DocumentViewer({
  fullText,
  matches = [],
  selectedMatchId,
  onSelectMatch,
}) {
  const containerRef = useRef(null);
  const [fontSize, setFontSize] = React.useState('base'); // 'sm' | 'base' | 'lg'

  /**
   * Slices fullText into non-overlapping plain and highlighted segments
   * using start_index and end_index from the similarity engine.
   */
  const textSegments = useMemo(() => {
    if (!fullText) return [];
    if (!matches || matches.length === 0) {
      return [{ type: 'plain', text: fullText, key: 'plain-0' }];
    }

    const textLen = fullText.length;
    const boundaryPoints = new Set([0, textLen]);

    matches.forEach((m) => {
      const start = Math.max(0, Math.min(m.start_index, textLen));
      const end = Math.max(0, Math.min(m.end_index, textLen));
      if (start < end) {
        boundaryPoints.add(start);
        boundaryPoints.add(end);
      }
    });

    const sortedPoints = Array.from(boundaryPoints).sort((a, b) => a - b);
    const segments = [];

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const pStart = sortedPoints[i];
      const pEnd = sortedPoints[i + 1];
      const sliceText = fullText.substring(pStart, pEnd);

      if (!sliceText) continue;

      const coveringMatches = matches.filter(
        (m) => m.start_index <= pStart && m.end_index >= pEnd
      );

      if (coveringMatches.length === 0) {
        segments.push({
          type: 'plain',
          text: sliceText,
          key: `plain-${pStart}-${pEnd}`,
        });
      } else {
        const primaryMatch = coveringMatches.reduce((best, curr) => {
          if (curr.match_type === 'exact_copy' && best.match_type !== 'exact_copy') return curr;
          return curr.similarity_score > best.similarity_score ? curr : best;
        }, coveringMatches[0]);

        segments.push({
          type: 'match',
          match: primaryMatch,
          text: sliceText,
          key: `match-${primaryMatch.id}-${pStart}-${pEnd}`,
        });
      }
    }

    return segments;
  }, [fullText, matches]);

  // Bi-directional Auto-scroll: When selectedMatchId changes from right pane click, scroll to highlight
  useEffect(() => {
    if (!selectedMatchId) return;

    const el = document.getElementById(`highlight-${selectedMatchId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedMatchId]);

  const handleHighlightClick = (match) => {
    if (onSelectMatch) {
      onSelectMatch(match);
    }

    // Auto-scroll the Right Pane to the matching source card
    const sourceCardEl = document.getElementById(`source-card-${match.id}`);
    if (sourceCardEl) {
      sourceCardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      sourceCardEl.classList.add('ring-4', 'ring-indigo-500/50', 'transition-all');
      setTimeout(() => {
        sourceCardEl.classList.remove('ring-4', 'ring-indigo-500/50');
      }, 1500);
    }
  };

  const getHighlightClass = (match, isSelected) => {
    let base = 'cursor-pointer rounded px-1.5 py-0.5 transition-all duration-150 inline font-medium select-text ';

    if (match.match_type === 'exact_copy' || match.similarity_score >= 0.92) {
      base += isSelected
        ? 'bg-rose-200 text-rose-950 dark:bg-rose-900/80 dark:text-rose-100 ring-2 ring-rose-600 shadow-sm underline decoration-rose-600 '
        : 'bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200 border-b-2 border-rose-400 dark:border-rose-500 hover:bg-rose-200 dark:hover:bg-rose-900/50 ';
    } else if (match.match_type === 'paraphrase') {
      base += isSelected
        ? 'bg-amber-200 text-amber-950 dark:bg-amber-900/80 dark:text-amber-100 ring-2 ring-amber-600 shadow-sm underline decoration-amber-600 '
        : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border-b-2 border-amber-400 dark:border-amber-500 hover:bg-amber-200 dark:hover:bg-amber-900/50 ';
    } else {
      base += isSelected
        ? 'bg-blue-200 text-blue-950 dark:bg-blue-900/80 dark:text-blue-100 ring-2 ring-blue-600 shadow-sm underline decoration-blue-600 '
        : 'bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-200 border-b-2 border-blue-400 dark:border-blue-500 hover:bg-blue-200 dark:hover:bg-blue-900/50 ';
    }

    return base;
  };

  const fontSizes = {
    sm: 'text-sm leading-relaxed',
    base: 'text-base leading-relaxed',
    lg: 'text-lg leading-loose',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-hidden transition-colors">
      {/* Viewer Header */}
      <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Document Originality Viewer
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
            {matches.length} Matched Spans
          </span>
        </div>

        {/* Legend & Controls */}
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <div className="hidden sm:flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              Exact Match
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              Paraphrased
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
              Web Citation
            </span>
          </div>

          {/* Font Size Zoom Controls */}
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden p-0.5 bg-white dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setFontSize('sm')}
              className={cn(
                'px-2 py-1 text-[11px] font-bold rounded-lg transition',
                fontSize === 'sm' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              )}
              title="Small text"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontSize('base')}
              className={cn(
                'px-2 py-1 text-[11px] font-bold rounded-lg transition',
                fontSize === 'base' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              )}
              title="Standard text"
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFontSize('lg')}
              className={cn(
                'px-2 py-1 text-[11px] font-bold rounded-lg transition',
                fontSize === 'lg' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              )}
              title="Large text"
            >
              A+
            </button>
          </div>
        </div>
      </div>

      {/* Main Document Body */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-6 sm:p-10 font-serif text-slate-800 dark:text-slate-200 select-text"
      >
        <div className={cn('max-w-3xl mx-auto whitespace-pre-wrap', fontSizes[fontSize])}>
          {textSegments.map((seg) => {
            if (seg.type === 'plain') {
              return <span key={seg.key}>{seg.text}</span>;
            }

            const isSelected = selectedMatchId === seg.match.id;

            return (
              <mark
                key={seg.key}
                id={`highlight-${seg.match.id}`}
                onClick={() => handleHighlightClick(seg.match)}
                className={getHighlightClass(seg.match, isSelected)}
                title={`Click to inspect matching source: ${seg.match.source_title} (${(seg.match.similarity_score * 100).toFixed(0)}% match)`}
              >
                {seg.text}
              </mark>
            );
          })}
        </div>
      </div>
    </div>
  );
}
