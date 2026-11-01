import React from 'react';
import { Globe, Layers, ExternalLink, ChevronRight, CheckCircle2, Flag, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

export default function SourcesSidebar({
  matches = [],
  selectedMatchId,
  onSelectMatch,
  onOpenDiff,
  onFlagMatch,
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
        <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
          Exact Match
        </span>
      );
    } else if (type === 'paraphrase') {
      return (
        <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
          Paraphrased
        </span>
      );
    } else {
      return (
        <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
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
      highlightEl.classList.add('ring-4', 'ring-indigo-500/50');
      setTimeout(() => {
        highlightEl.classList.remove('ring-4', 'ring-indigo-500/50');
      }, 1500);
    }
  };

  if (!matches || matches.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100">100% Original Content</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
          No plagiarized sentences found against our academic paper repository or indexed web sources.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-full max-h-[720px] overflow-hidden transition-colors">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Matched Reference Sources
          </h3>
          <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
            {matches.length} Identified Sources
          </p>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
          Sorted by Similarity
        </span>
      </div>

      {/* Scrollable list of source cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
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
                'p-4 rounded-2xl cursor-pointer transition-all border select-none',
                isSelected
                  ? 'bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                  : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm'
              )}
            >
              {/* Top row: Index badge, Category badge, and Similarity score */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center">
                    {idx + 1}
                  </span>
                  {getTypeBadge(m.match_type)}
                </div>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  {scorePercent}% Overlap
                </span>
              </div>

              {/* Source Title & Domain */}
              <div className="space-y-0.5 mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                  {m.source_category === 'Internet Source' ? (
                    <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  ) : (
                    <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                  <span className="truncate">{m.source_title || 'Reference Source'}</span>
                </div>

                {domain && (
                  <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 truncate flex items-center gap-1">
                    <span>{domain}</span>
                    {m.source_url && (
                      <a
                        href={m.source_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </p>
                )}
              </div>

              {/* Matched Snippet */}
              <p className="text-xs text-slate-600 dark:text-slate-300 italic line-clamp-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                "{m.source_snippet || m.matched_text}"
              </p>

              {/* Footer actions: Diff compare & Flag */}
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                <span className="text-slate-400 font-mono text-[10px]">
                  Idx: [{m.start_index} - {m.end_index}]
                </span>

                <div className="flex items-center gap-2">
                  {onFlagMatch && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMatch(m);
                        onFlagMatch(m);
                      }}
                      className="text-amber-600 dark:text-amber-400 hover:text-amber-700 font-bold flex items-center gap-1 hover:underline"
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
                    className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-bold rounded-lg flex items-center gap-0.5 transition"
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
