import React, { useState } from 'react';
import { X, Quote, Check, Copy, BookOpen, Sparkles, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';

export default function CitationAssistantModal({ match, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('apa'); // 'apa' | 'mla' | 'chicago'
  const [copiedKey, setCopiedKey] = useState(null);

  if (!isOpen || !match) return null;

  // Use pre-computed citations from backend if available, or generate client fallback
  const citations = match.smart_citations || {
    apa: {
      in_text: `(${match.source_author || 'Anonymous'}, 2026)`,
      quoted_text: `"${match.matched_text}" (${match.source_author || 'Anonymous'}, 2026)`,
      bibliography: `${match.source_author || 'Anonymous'} (2026). ${match.source_title || 'Academic Reference Source'}. ${match.source_category || 'Institutional Repository'}.${match.source_url ? ' ' + match.source_url : ''}`
    },
    mla: {
      in_text: `(${match.source_author ? match.source_author.split(' ').pop() : 'Anonymous'})`,
      quoted_text: `"${match.matched_text}" (${match.source_author ? match.source_author.split(' ').pop() : 'Anonymous'})`,
      bibliography: `${match.source_author || 'Anonymous'}. "${match.source_title || 'Academic Reference Source'}." ${match.source_category || 'Institutional Repository'}, 2026.`
    },
    chicago: {
      footnote: `1. ${match.source_author || 'Anonymous'}, "${match.source_title || 'Academic Reference Source'}" (${match.source_category || 'Institutional Repository'}, 2026).`,
      bibliography: `${match.source_author || 'Anonymous'}. "${match.source_title || 'Academic Reference Source'}." ${match.source_category || 'Institutional Repository'}, 2026.`
    }
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const activeCitation = citations[activeTab];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <Quote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Smart Academic Citation Assistant
                </h3>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Turnitin Remediation
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Convert this detected match into a properly attributed scholarly reference in 1 click.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 pt-3 bg-slate-50/30 dark:bg-slate-900/30 gap-2">
          {[
            { id: 'apa', label: 'APA 7th Edition' },
            { id: 'mla', label: 'MLA 9th Edition' },
            { id: 'chicago', label: 'Chicago 17th' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* 1. Remediation Quote block */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Pre-Quoted Remediation Block (Ready to Paste)
              </span>
              <Button
                size="xs"
                variant="outline"
                onClick={() => handleCopy(activeCitation.quoted_text || activeCitation.footnote, 'quote')}
                className="h-7 text-xs font-bold"
              >
                {copiedKey === 'quote' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copy Quote
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-serif italic bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-indigo-100/60 dark:border-indigo-900/30">
              {activeCitation.quoted_text || activeCitation.footnote}
            </p>
          </div>

          {/* 2. In-Text Citation */}
          {activeCitation.in_text && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">In-Text Citation</span>
                <button
                  onClick={() => handleCopy(activeCitation.in_text, 'in_text')}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  {copiedKey === 'in_text' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  {copiedKey === 'in_text' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl font-mono text-xs text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                {activeCitation.in_text}
              </div>
            </div>
          )}

          {/* 3. Bibliography Entry */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {activeTab === 'mla' ? 'Works Cited Entry' : activeTab === 'chicago' ? 'Bibliography Entry' : 'References List Entry'}
              </span>
              <button
                onClick={() => handleCopy(activeCitation.bibliography, 'bib')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                {copiedKey === 'bib' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copiedKey === 'bib' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 leading-relaxed">
              {activeCitation.bibliography}
            </div>
          </div>

          {/* Source Context Metadata */}
          <div className="text-[11px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              Attributed Source: <strong className="text-slate-600 dark:text-slate-300">{match.source_title}</strong> ({match.source_category})
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <Button variant="default" onClick={onClose} className="px-6">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
