import React from 'react';
import { Globe, Layers, ExternalLink, ChevronRight, CheckCircle2, Flag, Quote } from 'lucide-react';
import { cn } from '../lib/utils';

export default function SourcesSidebar({
  matches = [],
  selectedMatchId,
  onSelectMatch,
  onOpenDiff,
  onFlagMatch,
  onOpenCite,
}) {
  const getDomainName = (url) => {
    if (!url) return null;
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url.split('/')[0] || url;
    }
  };

  const getTypeBadge = (type) => {
    if (type === 'exact_copy') {
      return (
        <span className="px-1.5 py-0.2 text-[9px] font-mono uppercase font-semibold rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          Exact Match
        </span>
      );
    } else if (type === 'paraphrase') {
      return (
        <span className="px-1.5 py-0.2 text-[9px] font-mono uppercase font-semibold rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          Paraphrased
        </span>
      );
    } else {
      return (
        <span className="px-1.5 py-0.2 text-[9px] font-mono uppercase font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          Web Source
        </span>
      );
    }
  };

  const handleCardClick = (m) => {
    if (onSelectMatch) {
      onSelectMatch(m);
    }

    // Bi-directional Auto-scroll: Scroll Document Viewer to the matching highlight mark
    const highlightEl = document.getElementById(`highlight-${m.id}`);
    if (highlightEl) {
      highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightEl.classList.add('ring-2', 'ring-slate-900', 'dark:ring-slate-100');
      setTimeout(() => {
        highlightEl.classList.remove('ring-2', 'ring-slate-900', 'dark:ring-slate-100');
      }, 1500);
    }
  };

  if (!matches || matches.length === 0) {
    return (
      <div className="bg-white dark:bg-[#0d121f] rounded-xl p-8 border border-slate-200 dark:border-slate-800 text-center shadow-2xs">
        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center mx-auto mb-3 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">100% Original Content</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
          No plagiarized passages detected against our indexed academic repositories or live web sources.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#0d121f] rounded-xl shadow-2xs border border-slate-200 dark:border-slate-800 flex flex-col h-full max-h-[720px] overflow-hidden transition-colors">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/60">
        <div>
          <h3 className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Matched Sources
          </h3>
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {matches.length} Identified Passages
          </p>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          Ranked by Similarity
        </span>
      </div>

      {/* Scrollable list of source cards */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {matches.map((m, idx) => {
          const isSelected = selectedMatchId === m.id;
          const scorePercent = (m.similarity_score * 100).toFixed(0);
          const domain = getDomainName(m.source_url);

          return (
            <div
              key={m.id || idx}
              id={`source-card-${m.id}`}
              onClick={() => handleCardClick(m)}
              className={cn(
                'p-3 rounded-lg cursor-pointer transition-colors border select-none',
                isSelected
                  ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-900 dark:border-slate-200 ring-1 ring-slate-900 dark:ring-slate-200'
                  : 'bg-white dark:bg-[#0d121f] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              )}
            >
              {/* Top row: Index badge, Category badge, and Similarity score */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-mono font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  {getTypeBadge(m.match_type)}
                </div>
                <span className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded tabular-nums border border-slate-200/60 dark:border-slate-700/60">
                  {scorePercent}% Overlap
                </span>
              </div>

              {/* Source Title & Domain */}
              <div className="space-y-0.5 mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                  {m.source_category === 'Internet Source' ? (
                    <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className="truncate">{m.source_title || 'Reference Document'}</span>
                </div>

                {domain && (
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                    <span>{domain}</span>
                    {m.source_url && (
                      <a
                        href={m.source_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-slate-900 dark:hover:text-white shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </p>
                )}
              </div>

              {/* Matched Snippet */}
              <p className="text-xs text-slate-600 dark:text-slate-300 italic line-clamp-2 bg-slate-50 dark:bg-slate-800/40 p-2 rounded border border-slate-100 dark:border-slate-800/80 leading-relaxed">
                &ldquo;{m.source_snippet || m.matched_text}&rdquo;
              </p>

              {/* Footer actions: Diff compare & Flag */}
              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                <span className="text-slate-400 font-mono text-[10px]">
                  Pos: {m.start_index}–{m.end_index}
                </span>

                <div className="flex items-center gap-1.5">
                  {onOpenCite && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMatch(m);
                        onOpenCite(m);
                      }}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 text-slate-700 dark:text-slate-300 font-medium rounded text-[11px] flex items-center gap-1 transition"
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
                      className="px-1.5 py-0.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium flex items-center gap-1 text-[11px]"
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
                    className="px-2 py-0.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium rounded text-[11px] flex items-center gap-0.5 transition"
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
