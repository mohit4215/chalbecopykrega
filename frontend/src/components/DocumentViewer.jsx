import React, { useMemo } from 'react';
import { FileText, Eye } from 'lucide-react';

export default function DocumentViewer({ 
  fullText, 
  matches = [], 
  selectedMatchId, 
  onSelectMatch 
}) {
  /**
   * Slices fullText into non-overlapping plain and highlighted segments
   * using start_index and end_index from the API response.
   */
  const textSegments = useMemo(() => {
    if (!fullText) return [];
    if (!matches || matches.length === 0) {
      return [{ type: 'plain', text: fullText, key: 'plain-0' }];
    }

    const textLen = fullText.length;
    const boundaryPoints = new Set([0, textLen]);

    matches.forEach(m => {
      const start = Math.max(0, Math.min(m.start_index, textLen));
      const end = Math.max(0, Math.min(m.end_index, textLen));
      if (start < end) {
        boundaryPoints.add(start);
        boundaryPoints.add(end);
      }
    });

    const sortedPoints = Array.from(boundaryPoints).sort((a, b) => a - b);
    const segments = [];

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const pStart = sortedPoints[i];
      const pEnd = sortedPoints[i + 1];
      const sliceText = fullText.substring(pStart, pEnd);

      if (!sliceText) continue;

      // Find all matches that encompass this slice
      const coveringMatches = matches.filter(
        m => m.start_index <= pStart && m.end_index >= pEnd
      );

      if (coveringMatches.length === 0) {
        segments.push({
          type: 'plain',
          text: sliceText,
          key: `plain-${pStart}-${pEnd}`
        });
      } else {
        // Pick primary match (prioritize exact_copy or highest similarity score)
        const primaryMatch = coveringMatches.reduce((best, curr) => {
          if (curr.match_type === 'exact_copy' && best.match_type !== 'exact_copy') return curr;
          return (curr.similarity_score > best.similarity_score) ? curr : best;
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
  }, [fullText, matches]);

  const getHighlightClass = (match, isSelected) => {
    let classes = "cursor-pointer rounded px-1 py-0.5 transition-all duration-150 inline font-medium ";

    if (match.match_type === 'exact_copy' || match.similarity_score >= 0.92) {
      classes += isSelected
        ? "bg-rose-200 text-rose-950 ring-2 ring-rose-600 shadow-sm underline decoration-rose-600 "
        : "bg-rose-100 text-rose-900 border-b-2 border-rose-400 hover:bg-rose-200 ";
    } else if (match.match_type === 'paraphrase') {
      classes += isSelected
        ? "bg-amber-200 text-amber-950 ring-2 ring-amber-600 shadow-sm underline decoration-amber-600 "
        : "bg-amber-100 text-amber-900 border-b-2 border-amber-400 hover:bg-amber-200 ";
    } else {
      // Internet / Web source
      classes += isSelected
        ? "bg-blue-200 text-blue-950 ring-2 ring-blue-600 shadow-sm underline decoration-blue-600 "
        : "bg-blue-100 text-blue-900 border-b-2 border-blue-400 hover:bg-blue-200 ";
    }

    return classes;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
      {/* Viewer Header */}
      <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FileText className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Document Originality Viewer
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
            {matches.length} Matched Sections
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-rose-400 inline-block"></span>
            Exact Copy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block"></span>
            Paraphrase
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-blue-400 inline-block"></span>
            Web Source
          </span>
        </div>
      </div>

      {/* Main Document Body */}
      <div className="flex-1 overflow-y-auto p-8 sm:p-12 font-serif text-slate-800 text-base leading-relaxed select-text">
        <div className="max-w-3xl mx-auto whitespace-pre-wrap">
          {textSegments.map(seg => {
            if (seg.type === 'plain') {
              return <span key={seg.key}>{seg.text}</span>;
            }

            const isSelected = selectedMatchId === seg.match.id;

            return (
              <mark
                key={seg.key}
                id={`highlight-${seg.match.id}`}
                onClick={() => onSelectMatch(seg.match)}
                className={getHighlightClass(seg.match, isSelected)}
                title={`Source: ${seg.match.source_title} (${(seg.match.similarity_score * 100).toFixed(0)}% match)`}
              >
                {seg.text}
              </mark>
            );
          })}
        </div>
      </div>
    </div>
  );
}
