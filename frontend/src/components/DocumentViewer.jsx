import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { FileText, Quote, X, Filter } from 'lucide-react';
import { cn } from '../lib/utils';
import { useUiStore } from '../store/useUiStore';

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
  const activeHoverId = useUiStore((state) => state.activeHoverId);

  // Map match IDs to their 1-based index for Turnitin-style numbered pill tags
  const matchIndexMap = useMemo(() => {
    const map = new Map();
    matches.forEach((m, idx) => {
      map.set(m.id, idx + 1);
    });
    return map;
  }, [matches]);

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

  // Text selection for quick citation generator
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
        const left = rect.left - parentRect.left + rect.width / 2;
        const top = rect.top - parentRect.top - 42;

        setSelectionPopover({
          text,
          left: Math.max(70, Math.min(parentRect.width - 70, left)),
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

    // Scroll to matching source card in right sidebar
    const sourceCardEl = document.getElementById(`source-card-${match.id}`);
    if (sourceCardEl) {
      sourceCardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const getHighlightClass = (match, isSelected, isHovered, isFilteredOut) => {
    if (isFilteredOut) {
      return 'opacity-30 grayscale hover:opacity-80 transition cursor-pointer px-1 py-0.5 rounded select-text';
    }

    let base = 'cursor-pointer rounded px-1.5 py-0.5 transition-all duration-150 inline select-text font-medium ';

    if (match.match_type === 'exact_copy' || match.similarity_score >= 0.92) {
      base += isSelected || isHovered
        ? 'bg-rose-200/80 dark:bg-rose-900/50 text-rose-950 dark:text-rose-100 ring-2 ring-rose-500 rounded '
        : 'bg-rose-100/90 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-b-2 border-rose-500 hover:bg-rose-200/80 ';
    } else if (match.match_type === 'paraphrase') {
      base += isSelected || isHovered
        ? 'bg-amber-200/80 dark:bg-amber-900/50 text-amber-950 dark:text-amber-100 ring-2 ring-amber-500 rounded '
        : 'bg-amber-100/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-b-2 border-amber-500 hover:bg-amber-200/80 ';
    } else {
      base += isSelected || isHovered
        ? 'bg-sky-200/80 dark:bg-sky-900/50 text-sky-950 dark:text-sky-100 ring-2 ring-sky-500 rounded '
        : 'bg-sky-100/90 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 border-b-2 border-sky-500 hover:bg-sky-200/80 ';
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
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-hidden transition-colors">
      {/* Viewer Header */}
      <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Document Reader
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-slate-200/70 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300">
            {matches.length} {matches.length === 1 ? 'match' : 'matches'}
          </span>
        </div>

        {/* Legend & Zoom Controls */}
        <div className="flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
          <div className="hidden sm:flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              Exact Copy
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              Paraphrased
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"></span>
              Web Match
            </span>
          </div>

          {/* Text Zoom */}
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden p-0.5 bg-white dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setFontSize('sm')}
              className={cn(
                'px-2 py-0.5 text-xs font-medium rounded transition',
                fontSize === 'sm'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              )}
              title="Small text size"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontSize('base')}
              className={cn(
                'px-2 py-0.5 text-xs font-medium rounded transition',
                fontSize === 'base'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              )}
              title="Default text size"
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFontSize('lg')}
              className={cn(
                'px-2 py-0.5 text-xs font-medium rounded transition',
                fontSize === 'lg'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              )}
              title="Large text size"
            >
              A+
            </button>
          </div>
        </div>
      </div>

      {/* Filter Banner if active */}
      {activeFilteredSource && (
        <div className="px-5 py-2 bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-200 dark:border-indigo-900 flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300">
          <div className="flex items-center gap-2 truncate">
            <Filter className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium">Filtered to:</span>
            <span className="font-semibold truncate">{activeFilteredSource.source_title}</span>
          </div>
          {onClearFilter && (
            <button
              type="button"
              onClick={onClearFilter}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 hover:bg-indigo-200 text-[11px] font-semibold transition shrink-0 ml-3"
            >
              <X className="w-3 h-3" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      )}

      {/* Main Document Reading Sheet */}
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className="relative flex-1 overflow-y-auto p-6 sm:p-10 font-serif text-slate-800 dark:text-slate-200 select-text bg-white dark:bg-slate-900"
      >
        {/* Floating Citation Popover */}
        {selectionPopover && (
          <div
            style={{
              position: 'absolute',
              left: `${selectionPopover.left}px`,
              top: `${selectionPopover.top}px`,
              transform: 'translateX(-50%)',
            }}
            className="z-50 pointer-events-auto"
          >
            <button
              type="button"
              onClick={() => {
                if (onGenerateCitation) {
                  onGenerateCitation({
                    matched_text: selectionPopover.text,
                    source_title: 'Highlighted Manuscript Excerpt',
                    source_author: 'Author',
                  });
                }
                setSelectionPopover(null);
                window.getSelection()?.removeAllRanges();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold shadow-md border border-slate-700 dark:border-slate-300 hover:scale-105 transition-all select-none"
            >
              <Quote className="w-3.5 h-3.5 text-indigo-400 dark:text-indigo-600" />
              <span>Create Citation</span>
            </button>
          </div>
        )}

        {/* Document Content Canvas */}
        <div className={cn('max-w-3xl mx-auto whitespace-pre-wrap', fontSizes[fontSize])}>
          {textSegments.map((seg) => {
            if (seg.type === 'plain') {
              return <span key={seg.key}>{seg.text}</span>;
            }

            const matchIndex = matchIndexMap.get(seg.match.id) || 1;
            const isSelected = selectedMatchId === seg.match.id;
            const isHovered = activeHoverId === seg.match.id;
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
                onMouseEnter={() => useUiStore.getState().setActiveHover(seg.match.id)}
                onMouseLeave={() => useUiStore.getState().clearActiveHover()}
                className={getHighlightClass(seg.match, isSelected, isHovered, isFilteredOut)}
                title={`Match [${matchIndex}]: ${seg.match.source_title} (${(seg.match.similarity_score * 100).toFixed(0)}% overlap)`}
              >
                <span className="inline-flex items-center justify-center text-[10px] font-sans font-bold px-1 py-0.2 mr-1 rounded bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 select-none">
                  {matchIndex}
                </span>
                {seg.text}
              </mark>
            );
          })}
        </div>
      </div>
    </div>
  );
}
