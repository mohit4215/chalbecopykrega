import React, { useState, useEffect } from 'react';
import { 
  X, 
  ExternalLink, 
  GitCompare, 
  Flag, 
  Quote, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight,
  RotateCcw
} from 'lucide-react';

export default function DiffModal({ match, isOpen, onClose, onFlagMatch, onOpenCite }) {
  const [activeTab, setActiveTab] = useState('diff'); // 'diff' | 'remediation'
  const [revisedText, setRevisedText] = useState('');
  const [remediationResult, setRemediationResult] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (match) {
      setRevisedText(match.matched_text || '');
      setRemediationResult(null);
      setErrorMsg('');
      setActiveTab('diff');
    }
  }, [match]);

  if (!isOpen || !match) return null;

  const handleEvaluate = async () => {
    if (!revisedText.trim()) {
      setErrorMsg('Please enter your revised text.');
      return;
    }
    setErrorMsg('');
    setIsEvaluating(true);

    try {
      const res = await fetch('/api/remediation/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_text: match.matched_text,
          revised_text: revisedText.trim(),
          source_text: match.source_snippet || match.matched_text,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      setRemediationResult(data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to evaluate revision. Please try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleReset = () => {
    setRevisedText(match.matched_text || '');
    setRemediationResult(null);
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                {activeTab === 'diff' ? 'Side-by-Side Source Comparison' : 'Interactive Remediation Sandbox'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Source: <span className="font-bold text-slate-700 dark:text-slate-300">{match.source_title}</span> • Category: <span className="font-semibold">{match.source_category}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 bg-slate-50/40 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('diff')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
              activeTab === 'diff'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 shadow-sm'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <GitCompare className="w-4 h-4" />
            <span>Side-by-Side Diff</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('remediation')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
              activeTab === 'remediation'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 shadow-sm'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Student Remediation Sandbox</span>
            <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 ml-1">
              Live Re-check
            </span>
          </button>
        </div>

        {/* Tab Content Panes */}
        {activeTab === 'diff' ? (
          /* Dual Panes: Diff Mode */
          <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/40 dark:bg-slate-950/40">
            {/* Left: Uploaded text */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-700/60">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Submitted Student Work
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Indices: [{match.start_index} - {match.end_index}]
                </span>
              </div>
              <div className="flex-1 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/60 p-4 rounded-xl text-slate-800 dark:text-slate-200 text-sm font-serif leading-relaxed">
                {match.matched_text}
              </div>
            </div>

            {/* Right: Matched Source Snippet */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-700/60">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Matched Reference Source
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-extrabold">
                    {(match.similarity_score * 100).toFixed(0)}% Similarity
                  </span>
                  {onFlagMatch && (
                    <button
                      type="button"
                      onClick={() => onFlagMatch(match)}
                      className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 rounded-lg transition"
                      title="Flag as False Positive / Incorrect"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/60 p-4 rounded-xl text-slate-800 dark:text-slate-200 text-sm font-serif leading-relaxed">
                {match.source_snippet || match.matched_text}
              </div>
            </div>
          </div>
        ) : (
          /* Remediation Sandbox Mode */
          <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/40 dark:bg-slate-950/40">
            {/* Pedagogical Guidance Banner */}
            <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold">Pedagogical Learning Sandbox vs. Turnitin Punitive Flagging</p>
                <p className="text-indigo-700 dark:text-indigo-300 mt-0.5 leading-relaxed">
                  Rewrite the flagged passage in your own words below. Poach instantly checks your paraphrase against the reference source in real-time, certifying when your overlap drops below academic thresholds.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Reference Target */}
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Reference Source Text to Synthesize:
                  </span>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-xs font-serif text-slate-700 dark:text-slate-300 leading-relaxed max-h-48 overflow-y-auto">
                    {match.source_snippet || match.matched_text}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Originally Flagged Passage:
                  </span>
                  <div className="p-3 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 rounded-xl text-xs font-serif text-rose-900 dark:text-rose-200 leading-relaxed max-h-36 overflow-y-auto">
                    {match.matched_text}
                  </div>
                </div>
              </div>

              {/* Right Column: Live Paraphrase Workspace */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Your Rewritten Revision:
                  </span>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 transition"
                    title="Reset to original text"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </div>

                <textarea
                  value={revisedText}
                  onChange={(e) => setRevisedText(e.target.value)}
                  placeholder="Synthesize the key points in your authentic academic voice..."
                  rows={6}
                  className="w-full p-3.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none font-serif text-slate-800 dark:text-slate-100 leading-relaxed"
                />

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{revisedText.trim() ? revisedText.trim().split(/\s+/).length : 0} words</span>
                  <button
                    type="button"
                    onClick={handleEvaluate}
                    disabled={isEvaluating || !revisedText.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm"
                  >
                    {isEvaluating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Evaluating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Live Re-Check Overlap</span>
                      </>
                    )}
                  </button>
                </div>

                {errorMsg && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{errorMsg}</p>
                )}

                {/* Remediation Live Feedback Card */}
                {remediationResult && (
                  <div className={`mt-2 p-4 rounded-xl border animate-in fade-in duration-200 ${
                    remediationResult.remediation_success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : remediationResult.is_partial
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  }`}>
                    <div className="flex items-center justify-between pb-2 border-b border-current/15 mb-2">
                      <div className="flex items-center gap-1.5">
                        {remediationResult.remediation_success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        )}
                        <span className="font-extrabold text-xs">{remediationResult.verdict}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
                        <span>{remediationResult.initial_similarity}%</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="underline decoration-2">{remediationResult.revised_similarity}%</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/70 dark:bg-black/30">
                          -{remediationResult.similarity_reduction}%
                        </span>
                      </div>
                    </div>

                    <p className="text-xs leading-relaxed font-sans">{remediationResult.pedagogical_feedback}</p>

                    {remediationResult.remaining_verbatim_phrases?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-current/10 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider block">
                          Overlapping n-grams to rephrase:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {remediationResult.remaining_verbatim_phrases.map((phrase, i) => (
                            <span key={i} className="px-2 py-0.5 text-[10px] font-mono rounded bg-white/80 dark:bg-black/40 border border-current/20">
                              &ldquo;{phrase}&rdquo;
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Classification: <strong className="uppercase">{(match.match_type || 'direct_match').replace('_', ' ')}</strong>
          </div>
          <div className="flex items-center gap-2.5">
            {onOpenCite && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCite(match);
                }}
                className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition border border-emerald-200 dark:border-emerald-800 shadow-sm"
                title="1-Click Smart Academic Citation"
              >
                <Quote className="w-3.5 h-3.5" />
                <span>1-Click Cite</span>
              </button>
            )}
            {onFlagMatch && (
              <button
                type="button"
                onClick={() => onFlagMatch(match)}
                className="px-3.5 py-2 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition border border-amber-200 dark:border-amber-800 shadow-sm"
                title="Flag this match as false positive or incorrect citation"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Flag as Incorrect</span>
              </button>
            )}
            {match.source_url && (
              <a
                href={match.source_url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
              >
                Open Source URL <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white font-bold rounded-xl text-xs transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
