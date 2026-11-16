import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { FileText, Quote, X, Filter } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * High-performance Document Originality Viewer (Screen B Left Column).
 * Linear-meets-Stripe enterprise standard:
 * - Asymmetric distraction-free reading pane
 * - Overlaid red underline/highlight for Exact Matches & amber for Paraphrase Matches
 * - Medium-style floating "Generate APA/MLA Citation" popover on text selection
 * - Source-specific highlight filtering
 * - Bi-directional auto-scroll synchronization
 */
export default function DocumentViewer({
  fullText,
  matches = [],
  selectedMatchId,
  onSelectMatch,
  filterSourceId = null,
  onClearFilter,
  onGenerateCitation,
}) {
  const containerRef = useRef(null);
  const [fontSize, setFontSize] = useState('base'); // 'sm' | 'base' | 'lg'
  const [selectionPopover, setSelectionPopover] = useState(null);

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

  // Medium-style floating selection popover handler
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionPopover(null);
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 4) {
      setSelectionPopover(null);
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const parentRect = containerRef.current?.getBoundingClientRect();

      if (rect && parentRect) {
        // Calculate coordinate relative to container
        const left = rect.left - parentRect.left + rect.width / 2;
        const top = rect.top - parentRect.top - 44; // Position just above selection

        setSelectionPopover({
          text,
          left: Math.max(60, Math.min(parentRect.width - 60, left)),
          top: Math.max(10, top),
        });
      }
    } catch {
      setSelectionPopover(null);
    }
  }, []);

  const handleHighlightClick = (match) => {
    if (onSelectMatch) {
      onSelectMatch(match);
    }

    // Auto-scroll the Right Pane to the matching source card
    const sourceCardEl = document.getElementById(`source-card-${match.id}`);
    if (sourceCardEl) {
      sourceCardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      sourceCardEl.classList.add('ring-2', 'ring-indigo-500', 'transition-all');
      setTimeout(() => {
        sourceCardEl.classList.remove('ring-2', 'ring-indigo-500');
      }, 1500);
    }
  };

  const getHighlightClass = (match, isSelected, isFilteredOut) => {
    if (isFilteredOut) {
      return 'opacity-25 grayscale hover:opacity-80 transition cursor-pointer px-1 py-0.5 rounded select-text';
    }

    let base = 'cursor-pointer rounded px-1.5 py-0.5 transition-all duration-150 inline select-text font-medium ';

    if (match.match_type === 'exact_copy' || match.similarity_score >= 0.92) {
      base += isSelected
        ? 'bg-rose-500/20 text-rose-800 dark:text-rose-200 ring-2 ring-rose-600 underline decoration-rose-600 '
        : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-b-2 border-rose-500 hover:bg-rose-500/20 underline decoration-rose-500 ';
    } else if (match.match_type === 'paraphrase') {
      base += isSelected
        ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 ring-2 ring-amber-600 underline decoration-amber-600 '
        : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-b-2 border-amber-500 hover:bg-amber-500/20 ';
    } else {
      base += isSelected
        ? 'bg-indigo-500/20 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-600 underline decoration-indigo-600 '
        : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-500 hover:bg-indigo-500/20 ';
    }

    return base;
  };

  const activeFilteredSource = useMemo(() => {
    if (!filterSourceId) return null;
    return matches.find((m) => m.id === filterSourceId || m.source_id === filterSourceId);
  }, [filterSourceId, matches]);

  const fontSizes = {
    sm: 'text-sm leading-relaxed',
    base: 'text-base leading-relaxed',
    lg: 'text-lg leading-loose',
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xs border border-zinc-200 dark:border-zinc-800 flex flex-col h-full overflow-hidden transition-colors">
      {/* Viewer Header */}
      <div className="px-5 py-3 bg-zinc-50/70 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 font-mono">
            Document Viewer
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 tabular-nums">
            {matches.length} Matched Spans
          </span>
        </div>

        {/* Legend & Controls */}
        <div className="flex items-center gap-4 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          <div className="hidden sm:flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
              Exact Match
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
              Paraphrased
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
              Web Citation
            </span>
          </div>

          {/* Font Size Zoom Controls */}
          <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden p-0.5 bg-white dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => setFontSize('sm')}
              className={cn(
                'px-2 py-0.5 text-[11px] font-semibold rounded transition',
                fontSize === 'sm'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              )}
              title="Small text"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontSize('base')}
              className={cn(
                'px-2 py-0.5 text-[11px] font-semibold rounded transition',
                fontSize === 'base'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              )}
              title="Standard text"
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFontSize('lg')}
              className={cn(
                'px-2 py-0.5 text-[11px] font-semibold rounded transition',
                fontSize === 'lg'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              )}
              title="Large text"
            >
              A+
            </button>
          </div>
        </div>
      </div>

      {/* Active Source Filter Banner */}
      {activeFilteredSource && (
        <div className="px-5 py-2 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300">
          <div className="flex items-center gap-2 truncate">
            <Filter className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold">Filtering highlights from source:</span>
            <span className="font-mono truncate">{activeFilteredSource.source_title}</span>
          </div>
          {onClearFilter && (
            <button
              type="button"
              onClick={onClearFilter}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-[11px] font-semibold transition shrink-0 ml-3"
            >
              <X className="w-3 h-3" />
              <span>Clear Filter</span>
            </button>
          )}
        </div>
      )}

      {/* Main Document Body */}
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className="relative flex-1 overflow-y-auto p-6 sm:p-10 font-serif text-zinc-800 dark:text-zinc-200 select-text"
      >
        {/* Floating Medium-style Citation Assistant Popover */}
        {selectionPopover && (
          <div
            style={{
              position: 'absolute',
              left: `${selectionPopover.left}px`,
              top: `${selectionPopover.top}px`,
              transform: 'translateX(-50%)',
            }}
            className="z-50 pointer-events-auto animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              type="button"
              onClick={() => {
                if (onGenerateCitation) {
                  onGenerateCitation({
                    matched_text: selectionPopover.text,
                    source_title: 'Highlighted Manuscript Excerpt',
                    source_author: 'Student / Manuscript',
                  });
                }
                setSelectionPopover(null);
                window.getSelection()?.removeAllRanges();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-semibold shadow-xl border border-zinc-700 dark:border-zinc-300 hover:scale-105 active:scale-95 transition-all select-none"
            >
              <Quote className="w-3.5 h-3.5 text-indigo-400 dark:text-indigo-600" />
              <span>Generate APA/MLA Citation</span>
            </button>
          </div>
        )}

        <div className={cn('max-w-3xl mx-auto whitespace-pre-wrap', fontSizes[fontSize])}>
          {textSegments.map((seg) => {
            if (seg.type === 'plain') {
              return <span key={seg.key}>{seg.text}</span>;
            }

            const isSelected = selectedMatchId === seg.match.id;
            const isFilteredOut = Boolean(
              filterSourceId &&
              seg.match.id !== filterSourceId &&
              seg.match.source_id !== filterSourceId
            );

            return (
              <mark
                key={seg.key}
                id={`highlight-${seg.match.id}`}
                onClick={() => handleHighlightClick(seg.match)}
                className={getHighlightClass(seg.match, isSelected, isFilteredOut)}
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
