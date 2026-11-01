import React from 'react';
import { Globe, Layers, ExternalLink, ChevronRight, CheckCircle2, Flag } from 'lucide-react';

export default function SourcesSidebar({ 
  matches = [], 
  selectedMatchId, 
  onSelectMatch, 
  onOpenDiff,
  onFlagMatch
}) {
  const getTypeBadge = (type) => {
    if (type === 'exact_copy') {
      return <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded bg-rose-100 text-rose-700">Exact Match</span>;
    } else if (type === 'paraphrase') {
      return <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded bg-amber-100 text-amber-800">Paraphrased</span>;
    } else {
      return <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded bg-blue-100 text-blue-700">Internet Source</span>;
    }
  };

  const getSourceIcon = (category) => {
    if (category === 'Internet Source') {
      return <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
    }
    return <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  };

  if (!matches || matches.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center shadow-sm">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-800">100% Original Content</h4>
        <p className="text-xs text-slate-500 mt-1">
          No matches found against database submissions or internet sources.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full max-h-[640px] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Matched Sources</h3>
          <p className="text-sm font-extrabold text-slate-800">{matches.length} Identified Sources</p>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {matches.map((m, idx) => {
          const isSelected = selectedMatchId === m.id;
          const scorePercent = (m.similarity_score * 100).toFixed(0);

          return (
            <div
              key={m.id || idx}
              onClick={() => {
                onSelectMatch(m);
                // Scroll document viewer to corresponding highlighted mark
                const el = document.getElementById(`highlight-${m.id}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
              className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                isSelected
                  ? 'bg-slate-50 border-indigo-500 shadow-sm'
                  : 'bg-white border-slate-200/80 hover:bg-slate-50/70 hover:border-slate-300'
              }`}
            >
              {/* Top row: match badge & score */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-extrabold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  {getTypeBadge(m.match_type)}
                </div>
                <span className="text-xs font-black text-slate-800">
                  {scorePercent}% Match
                </span>
              </div>

              {/* Source title & category */}
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 line-clamp-1 mb-1">
                {getSourceIcon(m.source_category)}
                <span className="truncate">{m.source_title || 'Unnamed Reference'}</span>
              </div>

              {/* Source link or ID */}
              {m.source_url ? (
                <a
                  href={m.source_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 truncate mb-2 hover:underline"
                >
                  <span className="truncate">{m.source_url}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ) : m.source_id ? (
                <div className="text-[10px] text-slate-400 font-mono mb-2 truncate">
                  ID: {m.source_id}
                </div>
              ) : null}

              {/* Matched excerpt */}
              <p className="text-xs text-slate-600 italic line-clamp-2 bg-slate-100/70 p-2 rounded-lg text-[11px]">
                "{m.matched_text}"
              </p>

              {/* Footer row: index coordinates, flag action & diff inspection */}
              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                <span>Indices: [{m.start_index} - {m.end_index}]</span>
                <div className="flex items-center gap-2.5">
                  {onFlagMatch && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMatch(m);
                        onFlagMatch(m);
                      }}
                      className="text-amber-600 hover:text-amber-800 font-bold flex items-center gap-1 hover:underline"
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
                    className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5"
                  >
                    Compare Diff <ChevronRight className="w-3 h-3" />
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
