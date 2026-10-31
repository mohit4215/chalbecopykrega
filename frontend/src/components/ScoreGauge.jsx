import React from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert, CheckCircle } from 'lucide-react';

export default function ScoreGauge({ overallScore, originalityScore, summary }) {
  // Determine severity tier and theme colors
  const getSeverityTheme = (score) => {
    if (score < 20) {
      return {
        label: 'Low Similarity',
        subLabel: 'Original Work',
        stroke: '#10b981', // Emerald
        textColor: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />
      };
    } else if (score <= 40) {
      return {
        label: 'Moderate Overlap',
        subLabel: 'Review Recommended',
        stroke: '#f59e0b', // Amber
        textColor: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        icon: <AlertTriangle className="w-5 h-5 text-amber-600" />
      };
    } else {
      return {
        label: 'High Plagiarism',
        subLabel: 'Significant Matches Detected',
        stroke: '#e11d48', // Rose / Red
        textColor: 'text-rose-600',
        bgColor: 'bg-rose-50',
        borderColor: 'border-rose-200',
        icon: <ShieldAlert className="w-5 h-5 text-rose-600" />
      };
    }
  };

  const theme = getSeverityTheme(overallScore);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          {theme.icon}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Originality Report</h3>
            <p className="text-sm font-extrabold text-slate-800">Overall Similarity Index</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${theme.bgColor} ${theme.textColor} border ${theme.borderColor}`}>
          {theme.label}
        </span>
      </div>

      {/* Circular Gauge Center */}
      <div className="flex items-center justify-around py-6">
        <div className="relative flex items-center justify-center">
          <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 128 128">
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="#f1f5f9"
              strokeWidth="11"
              fill="transparent"
            />
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke={theme.stroke}
              strokeWidth="11"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className={`text-4xl font-black ${theme.textColor} leading-none tracking-tight`}>
              {overallScore}%
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Plagiarized</span>
          </div>
        </div>

        {/* Counter Badge */}
        <div className="flex flex-col gap-2.5 text-center">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 shadow-sm">
            <div className="text-2xl font-black text-emerald-700 leading-none">
              {originalityScore}%
            </div>
            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-1">
              Originality Score
            </div>
          </div>
        </div>
      </div>

      {/* Match Classification Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 text-center text-xs">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div className="text-base font-extrabold text-rose-600">{summary.exact_matches_count || 0}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">Exact Match</div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div className="text-base font-extrabold text-amber-600">{summary.paraphrase_matches_count || 0}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">Paraphrased</div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div className="text-base font-extrabold text-blue-600">{summary.internet_matches_count || 0}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">Web Sources</div>
          </div>
        </div>
      )}
    </div>
  );
}
