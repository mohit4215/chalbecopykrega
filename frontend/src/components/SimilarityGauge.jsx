import React from 'react';

export default function SimilarityGauge({ similarityPct, originalityPct, breakdown }) {
  // Score-dependent color theme
  const getBadgeColor = (pct) => {
    if (pct < 15) return { bg: 'bg-emerald-500', text: 'text-emerald-700', stroke: '#10b981', label: 'Low Plagiarism' };
    if (pct < 25) return { bg: 'bg-yellow-500', text: 'text-yellow-700', stroke: '#eab308', label: 'Moderate Overlap' };
    if (pct < 50) return { bg: 'bg-orange-500', text: 'text-orange-700', stroke: '#f97316', label: 'Significant Overlap' };
    return { bg: 'bg-red-600', text: 'text-red-700', stroke: '#dc2626', label: 'High Plagiarism' };
  };

  const theme = getBadgeColor(similarityPct);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (similarityPct / 100) * circumference;

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">Originality Score</h3>
          <p className="text-sm font-medium text-slate-700">Turnitin Similarity Index</p>
        </div>
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 ${theme.text}`}>
          {theme.label}
        </span>
      </div>

      <div className="flex items-center justify-around py-5">
        {/* Radial Dial */}
        <div className="relative flex items-center justify-center">
          <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="#e2e8f0"
              strokeWidth="9"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke={theme.stroke}
              strokeWidth="9"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-3xl font-extrabold text-slate-900 leading-none">
              {similarityPct}%
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Similarity</span>
          </div>
        </div>

        {/* Originality Counter */}
        <div className="flex flex-col gap-3">
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">{originalityPct}%</div>
            <div className="text-[11px] font-semibold text-emerald-600 uppercase">Original Text</div>
          </div>
        </div>
      </div>

      {/* Sources Distribution Breakdown */}
      <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
        <div className="flex items-center justify-between text-slate-600">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            Internet Sources
          </span>
          <span className="font-semibold text-slate-900">{breakdown?.internet_percentage || 0}%</span>
        </div>
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-blue-500 h-full rounded-full transition-all duration-500" 
            style={{ width: `${breakdown?.internet_percentage || 0}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-slate-600">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            Submitted Student Works
          </span>
          <span className="font-semibold text-slate-900">{breakdown?.internal_db_percentage || 0}%</span>
        </div>
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-amber-500 h-full rounded-full transition-all duration-500" 
            style={{ width: `${breakdown?.internal_db_percentage || 0}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-slate-600">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            Publications & Crossref
          </span>
          <span className="font-semibold text-slate-900">{breakdown?.publications_percentage || 0}%</span>
        </div>
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-rose-500 h-full rounded-full transition-all duration-500" 
            style={{ width: `${breakdown?.publications_percentage || 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}
