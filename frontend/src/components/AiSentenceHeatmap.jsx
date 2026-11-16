import React, { useState } from 'react';
import { Sparkles, Shield, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function AiSentenceHeatmap({ aiDetection }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all' | 'flagged' | 'human'

  if (!aiDetection || !aiDetection.sentence_analyses || aiDetection.sentence_analyses.length === 0) {
    return null;
  }

  const { sentence_analyses, metrics, esl_shield_applied, verdict, ai_probability } = aiDetection;

  const filteredSentences = sentence_analyses.filter((item) => {
    if (selectedFilter === 'flagged') return item.is_ai_flagged;
    if (selectedFilter === 'human') return !item.is_ai_flagged;
    return true;
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                Explainable AI Perplexity & Sentence Heatmap
              </h4>
              {esl_shield_applied && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  ESL Bias Shield Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sentence-by-sentence linguistic audit disclosing burstiness, vocabulary variance, and AI clichés.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 self-start sm:self-auto hover:underline"
        >
          {isExpanded ? (
            <>
              Hide Heatmap Breakdown <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              View Sentence Breakdown ({sentence_analyses.length} sentences) <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* High-Level Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="text-xs text-slate-400 uppercase font-bold">AI Probability</div>
          <div className="text-lg font-black text-violet-600 dark:text-violet-400 mt-0.5">
            {ai_probability}%
          </div>
          <div className="text-[10px] text-slate-500 font-medium truncate">{verdict}</div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="text-xs text-slate-400 uppercase font-bold">Flagged Sentences</div>
          <div className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
            {metrics?.flagged_ai_sentences || 0} / {sentence_analyses.length}
          </div>
          <div className="text-[10px] text-slate-500 font-medium">Uniform / Synthetic</div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="text-xs text-slate-400 uppercase font-bold">Burstiness CV</div>
          <div className="text-lg font-black text-slate-700 dark:text-slate-200 mt-0.5">
            {metrics?.burstiness_score || '0.45'}
          </div>
          <div className="text-[10px] text-slate-500 font-medium">Cadence Variance</div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="text-xs text-slate-400 uppercase font-bold">Discourse Clichés</div>
          <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
            {metrics?.ai_marker_count || 0}
          </div>
          <div className="text-[10px] text-slate-500 font-medium">Formulas Detected</div>
        </div>
      </div>

      {/* ESL Student Bias Shield Info Banner */}
      {esl_shield_applied ? (
        <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">ESL Bias Shield Active: </span>
            <span>
              Textbook transition words (&quot;Furthermore&quot;, &quot;In conclusion&quot;) and uniform clause structures
              taught in standard international curricula are protected from false-positive AI flags.
            </span>
          </div>
        </div>
      ) : (
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            Standard AI Detection Calibration Active
          </span>
          <span className="text-[10px] text-slate-400">
            Tip: Enable ESL Shield on upload to protect non-native English essays
          </span>
        </div>
      )}

      {/* Expandable Sentence-by-Sentence Breakdown */}
      {isExpanded && (
        <div className="pt-3 space-y-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: `All Sentences (${sentence_analyses.length})` },
              { id: 'flagged', label: `Flagged as AI (${metrics?.flagged_ai_sentences || 0})` },
              { id: 'human', label: `Likely Human (${sentence_analyses.length - (metrics?.flagged_ai_sentences || 0)})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFilter(f.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  selectedFilter === f.id
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* List of Sentences */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {filteredSentences.map((item, idx) => {
              const isFlagged = item.is_ai_flagged;
              const scorePct = Math.round(item.ai_score * 100);

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs transition ${
                    isFlagged
                      ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                      : 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-slate-800 dark:text-slate-200 font-serif leading-relaxed flex-1">
                      {item.sentence}
                    </p>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0 ${
                        isFlagged
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}
                    >
                      {scorePct}% AI
                    </span>
                  </div>

                  {/* Explainable Linguistic Cues */}
                  {item.linguistic_cues && item.linguistic_cues.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap gap-1.5">
                      {item.linguistic_cues.map((cue, cIdx) => (
                        <span
                          key={cIdx}
                          className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-600 dark:text-slate-400"
                        >
                          {cue}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
