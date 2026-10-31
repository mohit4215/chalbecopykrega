import React from 'react';
import { X, ExternalLink, AlertTriangle } from 'lucide-react';

export default function ComparisonDrawer({ match, isOpen, onClose }) {
  if (!isOpen || !match) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Side-by-Side Match Breakdown</h3>
              <p className="text-xs text-slate-500">
                Source: <span className="font-semibold text-slate-700">{match.source_title}</span> • Category: <span className="font-semibold">{match.source_category}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body - Dual Panes */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50">
          {/* Submitted Document Chunk */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Submitted Student Work
              </span>
              <span className="text-xs text-slate-400">
                Chars: [{match.start_char} - {match.end_char}]
              </span>
            </div>
            <div className="flex-1 bg-red-50/60 border border-red-100 p-4 rounded-lg text-slate-800 text-sm font-serif leading-relaxed">
              {match.matched_text}
            </div>
          </div>

          {/* Matched Reference Source */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Matched Source Passage
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold">
                {(match.similarity_score * 100).toFixed(0)}% Similarity
              </span>
            </div>
            <div className="flex-1 bg-blue-50/60 border border-blue-100 p-4 rounded-lg text-slate-800 text-sm font-serif leading-relaxed">
              {match.source_snippet || match.matched_text}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Detected via: <strong className="uppercase">{match.match_type}</strong> comparison engine
          </div>
          <div className="flex items-center gap-3">
            {match.source_url && (
              <a
                href={match.source_url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition"
              >
                Visit Web Source <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 font-semibold rounded-lg text-xs transition"
            >
              Close Diff
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
