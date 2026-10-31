import React, { useMemo } from 'react';
import { ExternalLink, Info } from 'lucide-react';

export default function DocumentViewer({ 
  rawText, 
  matches = [], 
  selectedMatchId, 
  onSelectMatch 
}) {
  /**
   * Slice rawText into non-overlapping highlighted and unhighlighted fragments
   * based on the exact start_char and end_char intervals returned by the backend.
   */
  const renderedSegments = useMemo(() => {
    if (!rawText) return [];
    if (!matches || matches.length === 0) {
      return [{ type: 'plain', text: rawText, key: 'plain-all' }];
    }

    const textLen = rawText.length;
    // Collect all critical boundary points
    const pointSet = new Set([0, textLen]);
    matches.forEach(m => {
      const s = Math.max(0, Math.min(m.start_char, textLen));
      const e = Math.max(0, Math.min(m.end_char, textLen));
      if (s < e) {
        pointSet.add(s);
        pointSet.add(e);
      }
    });

    const sortedPoints = Array.from(pointSet).sort((a, b) => a - b);
    const segments = [];

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const pStart = sortedPoints[i];
      const pEnd = sortedPoints[i + 1];
      const sliceText = rawText.substring(pStart, pEnd);

      if (!sliceText) continue;

      // Find all matches that contain this entire slice [pStart, pEnd]
      const coveringMatches = matches.filter(
        m => m.start_char <= pStart && m.end_char >= pEnd
      );

      if (coveringMatches.length === 0) {
        segments.push({
          type: 'plain',
          text: sliceText,
          key: `plain-${pStart}-${pEnd}`
        });
      } else {
        // Pick primary match (favor exact > paraphrase, or highest similarity)
        const primaryMatch = coveringMatches.reduce((prev, curr) => {
          if (curr.match_type === 'exact' && prev.match_type !== 'exact') return curr;
          return (curr.similarity_score > prev.similarity_score) ? curr : prev;
        }, coveringMatches[0]);

        segments.push({
          type: 'match',
          match: primaryMatch,
          text: sliceText,
          key: `match-${primaryMatch.id}-${pStart}-${pEnd}`
        });
      }
    }

    return segments;
  }, [rawText, matches]);

  const getHighlightClasses = (match, isSelected) => {
    let base = "cursor-pointer rounded px-0.5 py-0.5 transition-all duration-150 inline font-medium ";
    
    if (match.match_type === 'exact') {
      base += isSelected 
        ? "bg-red-200 text-red-950 ring-2 ring-red-600 shadow-sm underline decoration-red-600 " 
        : "bg-red-100 text-red-900 border-b-2 border-red-400 hover:bg-red-200 ";
    } else if (match.match_type === 'paraphrase') {
      base += isSelected 
        ? "bg-amber-200 text-amber-950 ring-2 ring-amber-600 shadow-sm underline decoration-amber-600 " 
        : "bg-amber-100 text-amber-900 border-b-2 border-amber-400 hover:bg-amber-200 ";
    } else {
      // Web match
      base += isSelected 
        ? "bg-blue-200 text-blue-950 ring-2 ring-blue-600 shadow-sm underline decoration-blue-600 " 
        : "bg-blue-100 text-blue-900 border-b-2 border-blue-400 hover:bg-blue-200 ";
    }

    return base;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      {/* Viewer Header */}
      <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Document Originality Viewer
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
            {matches.length} Matched Clusters
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-red-400 inline-block"></span>
            Exact Match
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block"></span>
            Paraphrase
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-blue-400 inline-block"></span>
            Internet Source
          </span>
        </div>
      </div>

      {/* Document Paper Body */}
      <div className="flex-1 overflow-y-auto p-8 sm:p-12 bg-white font-serif text-slate-800 leading-relaxed text-base tracking-normal">
        <div className="max-w-3xl mx-auto whitespace-pre-wrap selection:bg-indigo-100">
          {renderedSegments.map(segment => {
            if (segment.type === 'plain') {
              return <span key={segment.key}>{segment.text}</span>;
            }

            const isSelected = selectedMatchId === segment.match.id;
            return (
              <mark
                key={segment.key}
                id={`match-span-${segment.match.id}`}
                onClick={() => onSelectMatch(segment.match)}
                className={getHighlightClasses(segment.match, isSelected)}
                title={`Matched with: ${segment.match.source_title} (${(segment.match.similarity_score * 100).toFixed(0)}%)`}
              >
                {segment.text}
              </mark>
            );
          })}
        </div>
      </div>
    </div>
  );
}
