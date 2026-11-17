import React from 'react';
import { 
  Globe, 
  Layers, 
  ExternalLink, 
  ChevronRight, 
  CheckCircle2, 
  Flag, 
  Quote, 
  BookOpen, 
  Database, 
  Filter
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useUiStore } from '../store/useUiStore';

export default function SourcesSidebar({
  matches = [],
  selectedMatchId,
  filterSourceId = null,
  onSelectMatch,
  onOpenDiff,
  onFlagMatch,
  onOpenCite,
  onFilterBySource,
}) {
  const activeHoverId = useUiStore((state) => state.activeHoverId);

  const getDomainName = (url) => {
    if (!url) return null;
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url.split('/')[0] || url;
    }
  };

  const getSourceIcon = (m) => {
    const url = (m.source_url || '').toLowerCase();
    const title = (m.source_title || '').toLowerCase();

    if (url.includes('arxiv.org') || title.includes('arxiv')) {
      return (
        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">
          arXiv
        </span>
      );
    }
    if (url.includes('doi.org') || title.includes('crossref') || m.source_category === 'Crossref') {
      return (
        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
          Crossref
        </span>
      );
    }
    if (m.source_category === 'Internal Repository' || title.includes('internal repository') || title.includes('student paper')) {
      return (
        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
          <Database className="w-2.5 h-2.5" />
          Repo
        </span>
      );
    }
    if (m.source_category === 'Academic Database' || url.includes('openalex') || url.includes('semanticscholar')) {
      return (
        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
          <BookOpen className="w-2.5 h-2.5" />
          Academic
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1">
        <Globe className="w-2.5 h-2.5" />
        Web
      </span>
    );
  };

  const getTypeBadge = (type) => {
    if (type === 'exact_copy') {
      return (
        <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase font-semibold rounded bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
          Exact Match
        </span>
      );
    } else if (type === 'paraphrase') {
      return (
        <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase font-semibold rounded bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20">
          Paraphrased
        </span>
      );
    } else {
      return (
        <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase font-semibold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
          Web Source
        </span>
      );
    }
  };

  const handleCardClick = (m) => {
    if (onSelectMatch) {
      onSelectMatch(m);
    }

    if (onFilterBySource) {
      onFilterBySource(m.id || m.source_id);
    }

    // Bi-directional Auto-scroll: Scroll Document Viewer to the matching highlight mark
    const highlightEl = document.getElementById(`highlight-${m.id}`);
    if (highlightEl) {
      highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightEl.classList.add('ring-2', 'ring-zinc-900', 'dark:ring-zinc-100');
      setTimeout(() => {
        highlightEl.classList.remove('ring-2', 'ring-zinc-900', 'dark:ring-zinc-100');
      }, 1500);
    }
  };

  const handleCardMouseEnter = (m) => {
    const cardEl = document.getElementById(`source-card-${m.id}`);
    const highlightEl = document.getElementById(`highlight-${m.id}`);
    if (cardEl && highlightEl) {
      const cRect = cardEl.getBoundingClientRect();
      const hRect = highlightEl.getBoundingClientRect();
      useUiStore.getState().setActiveHover(m.id, hRect, cRect);
    } else {
      useUiStore.getState().setActiveHover(m.id);
    }
  };

  const handleCardMouseLeave = () => {
    useUiStore.getState().clearActiveHover();
  };

  if (!matches || matches.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-8 border border-zinc-200 dark:border-zinc-800 text-center shadow-2xs">
        <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center mx-auto mb-3 border border-emerald-500/20">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">100% Original Content</h4>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto">
          No plagiarized passages detected against our indexed academic repositories or live web sources.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xs border border-zinc-200 dark:border-zinc-800 flex flex-col h-full max-h-[720px] overflow-hidden transition-colors">
      {/* Header */}
      <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/60">
        <div>
          <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Matched Sources
          </h3>
          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
            {matches.length} Identified Passages
          </p>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
          Ranked by Similarity
        </span>
      </div>

      {/* Scrollable list of source cards */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {matches.map((m, idx) => {
          const isSelected = selectedMatchId === m.id;
          const isHovered = activeHoverId === m.id;
          const isFiltered = filterSourceId === m.id || filterSourceId === m.source_id;
          const scorePercent = (m.similarity_score * 100).toFixed(0);
          const domain = getDomainName(m.source_url);

          return (
            <div
              key={m.id || idx}
              id={`source-card-${m.id}`}
              onClick={() => handleCardClick(m)}
              onMouseEnter={() => handleCardMouseEnter(m)}
              onMouseLeave={handleCardMouseLeave}
              className={cn(
                'p-3 rounded-lg cursor-pointer transition-all duration-150 border select-none',
                isHovered
                  ? 'bg-zinc-50 dark:bg-zinc-800/90 border-indigo-500 ring-2 ring-indigo-500/50 shadow-sm'
                  : isSelected || isFiltered
                  ? 'bg-zinc-50 dark:bg-zinc-800/80 border-zinc-900 dark:border-zinc-200 ring-1 ring-zinc-900 dark:ring-zinc-200'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              )}
            >
              {/* Top row: Index badge, Category badge, Source badge, and Similarity score */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="w-4 h-4 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-mono font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  {getSourceIcon(m)}
                  {getTypeBadge(m.match_type)}
                </div>
                <div className="flex items-center gap-1.5">
                  {isFiltered && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                      Filtering
                    </span>
                  )}
                  <span className="text-xs font-mono font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded tabular-nums border border-zinc-200 dark:border-zinc-700">
                    {scorePercent}% Overlap
                  </span>
                </div>
              </div>

              {/* Source Title & Domain */}
              <div className="space-y-0.5 mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                  {m.source_category === 'Internet Source' ? (
                    <Globe className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  ) : (
                    <Layers className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  )}
                  <span className="truncate">{m.source_title || 'Reference Document'}</span>
                </div>

                {domain && (
                  <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1">
                    <span>{domain}</span>
                    {m.source_url && (
                      <a
                        href={m.source_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-zinc-900 dark:hover:text-white shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </p>
                )}
              </div>

              {/* Matched Snippet */}
              <p className="text-xs text-zinc-600 dark:text-zinc-300 italic line-clamp-2 bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded border border-zinc-100 dark:border-zinc-800/80 leading-relaxed font-serif">
                &ldquo;{m.source_snippet || m.matched_text}&rdquo;
              </p>

              {/* Footer actions: Diff compare, Cite, & Flag */}
              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px]">
                <span className="text-zinc-400 font-mono text-[10px]">
                  Pos: {m.start_index}–{m.end_index}
                </span>

                <div className="flex items-center gap-1.5">
                  {onFilterBySource && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFilterBySource(isFiltered ? null : (m.id || m.source_id));
                      }}
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium transition flex items-center gap-0.5',
                        isFiltered
                          ? 'bg-indigo-600 text-white'
                          : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                      )}
                      title="Filter document highlights to only this source"
                    >
                      <Filter className="w-2.5 h-2.5" />
                      <span>{isFiltered ? 'Active' : 'Filter'}</span>
                    </button>
                  )}

                  {onOpenCite && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMatch(m);
                        onOpenCite(m);
                      }}
                      className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 font-medium rounded text-[11px] flex items-center gap-1 transition"
                      title="Generate APA, MLA, or Chicago Citation"
                    >
                      <Quote className="w-3 h-3 text-zinc-500" />
                      <span>Cite</span>
                    </button>
                  )}

                  {onFlagMatch && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMatch(m);
                        onFlagMatch(m);
                      }}
                      className="px-1.5 py-0.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium flex items-center gap-1 text-[11px]"
                      title="Flag as False Positive"
                    >
                      <Flag className="w-3 h-3" />
                      <span>Flag</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectMatch(m);
                      onOpenDiff(m);
                    }}
                    className="px-2 py-0.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium rounded text-[11px] flex items-center gap-0.5 transition"
                  >
                    <span>Diff</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
