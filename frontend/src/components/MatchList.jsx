import React from 'react';
import { ExternalLink, ChevronRight, Layers, FileText, Globe } from 'lucide-react';

export default function MatchList({ 
  matches = [], 
  selectedMatchId, 
  onSelectMatch, 
  onOpenComparison 
}) {
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Internet':
        return <Globe className="w-3.5 h-3.5 text-blue-500" />;
      case 'Submitted Works':
        return <Layers className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-purple-500" />;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'exact':
        return <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded bg-red-100 text-red-700">Exact Match</span>;
      case 'paraphrase':
        return <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded bg-amber-100 text-amber-800">Paraphrase</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded bg-blue-100 text-blue-700">Web Match</span>;
    }
  };

  if (!matches || matches.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 border border-slate-200 text-center shadow-sm">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
          ✓
        </div>
        <h4 className="text-sm font-bold text-slate-800">No Plagiarism Detected</h4>
        <p className="text-xs text-slate-500 mt-1">This document appears original according to the current corpus and web indexes.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col max-h-[560px]">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Match Overview</h3>
          <p className="text-sm font-semibold text-slate-800">{matches.length} Primary Sources Identified</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
        {matches.map((m, idx) => {
          const isSelected = selectedMatchId === m.id;
          const scorePercent = (m.similarity_score * 100).toFixed(0);

          return (
            <div
              key={m.id || idx}
              onClick={() => {
                onSelectMatch(m);
                // Smooth scroll to highlight mark in document
                const el = document.getElementById(`match-span-${m.id}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
              className={`p-3 rounded-lg cursor-pointer transition-all border ${
                isSelected
                  ? 'bg-slate-50 border-indigo-400 shadow-sm'
                  : 'border-transparent hover:bg-slate-50/80 hover:border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  {getTypeBadge(m.match_type)}
                </div>
                <span className="text-xs font-bold text-slate-800">
                  {scorePercent}%
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 line-clamp-1 mb-1">
                {getCategoryIcon(m.source_category)}
                <span className="truncate">{m.source_title || 'Unnamed Reference Document'}</span>
              </div>

              <p className="text-xs text-slate-500 italic line-clamp-2 bg-slate-100/60 p-1.5 rounded text-[11px]">
                "{m.matched_text}"
              </p>

              <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 text-[11px] text-slate-400">
                <span>Offset: [{m.start_char} - {m.end_char}]</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectMatch(m);
                    onOpenComparison(m);
                  }}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5"
                >
                  Inspect Diff <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
