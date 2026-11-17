import React, { useState, useEffect } from 'react';
import { 
  X, 
  GitCompare, 
  Flag, 
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
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg">
              <GitCompare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {activeTab === 'diff' ? 'Side-by-Side Source Comparison' : 'Student Remediation Sandbox'}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Source: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{match.source_title}</span> • Category: <span className="font-mono">{match.source_category}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-2 bg-zinc-50/30 dark:bg-zinc-900/30 border-b border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('diff')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-1.5 border-b-2 ${
              activeTab === 'diff'
                ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100 bg-white dark:bg-zinc-800'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Side-by-Side Diff</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('remediation')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-1.5 border-b-2 ${
              activeTab === 'remediation'
                ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100 bg-white dark:bg-zinc-800'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Student Remediation Sandbox</span>
            <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 ml-1">
              Live Re-check
            </span>
          </button>
        </div>

        {/* Tab Content Panes */}
        {activeTab === 'diff' ? (
          /* Dual Panes: Diff Mode */
          <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-50/40 dark:bg-zinc-950/40">
            {/* Left: Uploaded text */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs flex flex-col">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-mono">
                  Submitted Student Work
                </span>
                <span className="text-xs text-zinc-400 font-mono tabular-nums">
                  Indices: [{match.start_index} - {match.end_index}]
                </span>
              </div>
              <div className="flex-1 bg-rose-500/10 border border-rose-500/20 p-4 rounded-lg text-zinc-900 dark:text-zinc-100 text-sm font-serif leading-relaxed">
                {match.matched_text}
              </div>
            </div>

            {/* Right: Matched Source Snippet */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs flex flex-col">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-mono">
                  Matched Reference Source
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold font-mono">
                    {(match.similarity_score * 100).toFixed(0)}% Similarity
                  </span>
                  {onFlagMatch && (
                    <button
                      type="button"
                      onClick={() => onFlagMatch(match)}
                      className="p-1 text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition"
                      title="Flag as False Positive / Incorrect"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-lg text-zinc-900 dark:text-zinc-100 text-sm font-serif leading-relaxed">
                {match.source_snippet || match.matched_text}
              </div>
            </div>
          </div>
        ) : (
          /* Remediation Sandbox Mode */
          <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-zinc-50/40 dark:bg-zinc-950/40">
            {/* Pedagogical Guidance Banner */}
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Pedagogical Learning Sandbox vs. Turnitin Punitive Flagging</p>
                <p className="text-indigo-700 dark:text-indigo-300 mt-0.5 leading-relaxed">
                  Rewrite the flagged passage in your own words below. Poach instantly checks your paraphrase against the reference source in real-time, certifying when your overlap drops below academic thresholds.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Reference Target */}
              <div className="space-y-4">
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                    Reference Source Text to Synthesize:
                  </span>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-xs font-serif text-zinc-700 dark:text-zinc-300 leading-relaxed max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-800">
                    {match.source_snippet || match.matched_text}
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                    Originally Flagged Passage:
                  </span>
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs font-serif text-rose-900 dark:text-rose-200 leading-relaxed max-h-36 overflow-y-auto">
                    {match.matched_text}
                  </div>
                </div>
              </div>

              {/* Right Column: Live Paraphrase Workspace */}
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200 font-mono">
                    Your Rewritten Revision:
                  </span>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1 transition"
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
                  className="w-full p-3.5 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none font-serif text-zinc-800 dark:text-zinc-100 leading-relaxed"
                />

                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-mono tabular-nums">{revisedText.trim() ? revisedText.trim().split(/\s+/).length : 0} words</span>
                  <button
                    type="button"
                    onClick={handleEvaluate}
                    disabled={isEvaluating || !revisedText.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition shadow-2xs"
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
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                      : remediationResult.is_partial
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
                  }`}>
                    <div className="flex items-center justify-between pb-2 border-b border-current/15 mb-2">
                      <div className="flex items-center gap-1.5">
                        {remediationResult.remediation_success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        )}
                        <span className="font-bold text-xs">{remediationResult.verdict}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold tabular-nums">
                        <span>{remediationResult.initial_similarity}%</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="underline decoration-2">{remediationResult.revised_similarity}%</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/70 dark:bg-black/30">
                          -{remediationResult.similarity_reduction}%
                        </span>
                      </div>
                    </div>

                    <p className="text-xs leading-relaxed font-sans">{remediationResult.pedagogical_feedback}</p>

                    {/* Patchwriting Alert */}
                    {remediationResult.is_patchwriting && (
                      <div className="mt-2.5 p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-900 dark:text-amber-200">
                        <strong className="block font-bold">Academic Integrity Alert: Patchwriting</strong>
                        Sentence syntax and clause sequence closely mirror the reference source despite thesaurus substitution.
                      </div>
                    )}

                    {/* Word-by-Word Granular Token Diff */}
                    {remediationResult.token_diff?.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-current/15 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider font-mono">
                          <span>Syntactic Token Highlighting:</span>
                          <div className="flex items-center gap-2 text-[9px] font-semibold lowercase">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> verbatim
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span> quoted
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> independent
                            </span>
                          </div>
                        </div>
                        <div className="p-2.5 bg-white/90 dark:bg-zinc-950/90 rounded-lg border border-current/10 text-xs font-serif leading-relaxed flex flex-wrap gap-1">
                          {remediationResult.token_diff.map((item, tIdx) => (
                            <span
                              key={tIdx}
                              className={`px-1 py-0.5 rounded transition ${
                                item.tag === 'verbatim'
                                  ? 'bg-rose-500/20 text-rose-800 dark:text-rose-300 font-bold'
                                  : item.tag === 'quoted'
                                  ? 'bg-purple-500/20 text-purple-800 dark:text-purple-300 italic'
                                  : 'text-zinc-800 dark:text-zinc-200'
                              }`}
                            >
                              {item.word}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {remediationResult.remaining_verbatim_phrases?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-current/10 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider block font-mono">
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
        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            Classification: <strong className="uppercase">{(match.match_type || 'direct_match').replace('_', ' ')}</strong>
          </div>
          <div className="flex items-center gap-2">
            {onOpenCite && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCite(match);
                }}
                className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-lg transition"
              >
                Open Citation Assistant
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
