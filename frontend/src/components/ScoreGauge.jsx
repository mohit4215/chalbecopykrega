import React from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert, Sparkles } from 'lucide-react';

export default function ScoreGauge({ overallScore, originalityScore, summary, aiDetection = null }) {
  // Determine severity tier and theme colors
  const getSeverityTheme = (score) => {
    if (score < 20) {
      return {
        label: 'Low Similarity',
        subLabel: 'Original Work',
        stroke: '#10b981', // Emerald
        textColor: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/20',
        icon: <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      };
    } else if (score <= 40) {
      return {
        label: 'Moderate Overlap',
        subLabel: 'Review Recommended',
        stroke: '#f59e0b', // Amber
        textColor: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/20',
        icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
      };
    } else {
      return {
        label: 'High Plagiarism',
        subLabel: 'Significant Matches Detected',
        stroke: '#e11d48', // Rose / Red
        textColor: 'text-rose-600 dark:text-rose-400',
        bgColor: 'bg-rose-500/10',
        borderColor: 'border-rose-500/20',
        icon: <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
      };
    }
  };

  const theme = getSeverityTheme(overallScore);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-2xs border border-zinc-200 dark:border-zinc-800 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          {theme.icon}
          <div>
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Originality Report
            </h3>
            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              Overall Similarity Index
            </p>
          </div>
        </div>
        <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${theme.bgColor} ${theme.textColor} border ${theme.borderColor}`}>
          {theme.label}
        </span>
      </div>

      {/* Circular Gauge Center - Linear/Stripe Enterprise Hero Metric */}
      <div className="flex items-center justify-around py-5">
        <div className="relative flex items-center justify-center">
          <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 128 128">
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="currentColor"
              className="text-zinc-100 dark:text-zinc-800"
              strokeWidth="10"
              fill="transparent"
            />
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke={theme.stroke}
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className={`text-3xl font-black ${theme.textColor} leading-none tracking-tight font-mono tabular-nums`}>
              {overallScore}%
            </span>
            <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500 mt-1">
              Plagiarized
            </span>
          </div>
        </div>

        {/* Counter Badge */}
        <div className="flex flex-col gap-2 text-center">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 shadow-2xs">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none font-mono tabular-nums">
              {originalityScore}%
            </div>
            <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mt-1">
              Originality Score
            </div>
          </div>
        </div>
      </div>

      {/* Match Classification Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-center text-xs">
          <div className="bg-zinc-50 dark:bg-zinc-800/60 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
            <div className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono tabular-nums">
              {summary.exact_matches_count || 0}
            </div>
            <div className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase mt-0.5">
              Exact Match
            </div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800/60 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
            <div className="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
              {summary.paraphrase_matches_count || 0}
            </div>
            <div className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase mt-0.5">
              Paraphrased
            </div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800/60 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
            <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">
              {summary.internet_matches_count || 0}
            </div>
            <div className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase mt-0.5">
              Web Sources
            </div>
          </div>
        </div>
      )}

      {/* Commercial AI Writing Detection Card */}
      {aiDetection && (
        <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100">
                AI Content Probability
              </p>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                {aiDetection.verdict || 'Human-Authored'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">
              {aiDetection.ai_probability ?? 0}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
