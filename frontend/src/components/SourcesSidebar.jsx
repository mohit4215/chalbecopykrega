import React from 'react';
import { 
  Globe, 
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

  const getSourceBadge = (m) => {
    const url = (m.source_url || '').toLowerCase();
    const title = (m.source_title || '').toLowerCase();

    if (url.includes('arxiv.org') || title.includes('arxiv')) {
      return (
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800">
          arXiv
        </span>
      );
    }
    if (m.source_category === 'Internal Repository' || title.includes('internal repository') || title.includes('student paper')) {
      return (
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
          <Database className="w-2.5 h-2.5" />
          Student Paper
        </span>
      );
    }
    if (m.source_category === 'Academic Database' || url.includes('openalex') || url.includes('semanticscholar')) {
      return (
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
          <BookOpen className="w-2.5 h-2.5" />
          Academic
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
        <Globe className="w-2.5 h-2.5" />
        Web
      </span>
    );
  };

  const getTypeBadge = (type) => {
    if (type === 'exact_copy') {
      return (
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          Exact Match
        </span>
      );
    } else if (type === 'paraphrase') {
      return (
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          Paraphrased
        </span>
      );
    } else {
      return (
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
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

    // Scroll Document Viewer to the matching highlight mark
    const highlightEl = document.getElementById(`highlight-${m.id}`);
    if (highlightEl) {
      highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (!matches || matches.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl p-8 border border-slate-200 dark:border-slate-800 text-center shadow-xs">
        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 rounded-xl flex items-center justify-center mx-auto mb-3 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">100% Original Content</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
          No matching passages were found across indexed academic publications or web sources.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col h-full max-h-[720px] overflow-hidden transition-colors">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
        <div>
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Matched Sources
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {matches.length} {matches.length === 1 ? 'source' : 'sources'} identified
          </p>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 font-medium">
          Ranked by Similarity
        </span>
      </div>

      {/* List of source cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
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
              onMouseEnter={() => useUiStore.getState().setActiveHover(m.id)}
              onMouseLeave={() => useUiStore.getState().clearActiveHover()}
              className={cn(
                'p-3.5 rounded-xl cursor-pointer transition-all border select-none',
                isSelected || isFiltered
                  ? 'bg-slate-50 dark:bg-slate-800/90 border-slate-900 dark:border-slate-300 shadow-xs'
                  : isHovered
                  ? 'bg-slate-50/70 dark:bg-slate-800/60 border-indigo-400 dark:border-indigo-600'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              )}
            >
              {/* Row 1: Index pill, category badge, match type badge, and Overlap % */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="w-5 h-5 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[11px] font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  {getSourceBadge(m)}
                  {getTypeBadge(m.match_type)}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    {scorePercent}% Overlap
                  </span>
                </div>
              </div>

              {/* Source Title & Domain */}
              <div className="space-y-1 mb-2">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                  {m.source_title || 'Reference Document'}
                </h4>

                {domain && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                    <span>{domain}</span>
                    {m.source_url && (
                      <a
                        href={m.source_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-slate-900 dark:hover:text-white shrink-0 ml-0.5"
                        title="Open external source"
                      >
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    )}
                  </p>
                )}
              </div>

              {/* Matched Snippet Quote */}
              <p className="text-xs text-slate-600 dark:text-slate-300 italic line-clamp-2 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 leading-relaxed font-serif">
                &ldquo;{m.source_snippet || m.matched_text}&rdquo;
              </p>

              {/* Actions Footer */}
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                <span className="text-slate-400 text-[10px]">
                  Chars {m.start_index}–{m.end_index}
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
                        'px-2 py-0.5 rounded text-[11px] font-medium transition flex items-center gap-1',
                        isFiltered
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      )}
                      title="Filter document highlights to only this source"
                    >
                      <Filter className="w-3 h-3" />
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
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded text-[11px] flex items-center gap-1 transition"
                      title="Generate APA, MLA, or Chicago Citation"
                    >
                      <Quote className="w-3 h-3 text-slate-500" />
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
                      className="px-1.5 py-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium flex items-center gap-1 text-[11px]"
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
                    className="px-2.5 py-0.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium rounded text-[11px] flex items-center gap-0.5 transition"
                  >
                    <span>Compare</span>
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
