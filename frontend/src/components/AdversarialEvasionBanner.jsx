import React, { useState } from 'react';
import { ShieldAlert, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

export default function AdversarialEvasionBanner({ adversarialIntegrity }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!adversarialIntegrity || !adversarialIntegrity.tampering_detected) {
    return null;
  }

  const { homoglyphs_detected_count, zero_width_chars_count, detected_tampering, integrity_score } = adversarialIntegrity;

  return (
    <div className="mb-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-4 shadow-sm text-xs space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-lg shrink-0 mt-0.5">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-amber-900 dark:text-amber-200">
                Adversarial Evasion Attempt Neutralized
              </span>
              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 uppercase">
                Turnitin Hack Failed
              </span>
            </div>
            <p className="text-amber-800 dark:text-amber-300 mt-0.5">
              Detected <strong>{homoglyphs_detected_count} Cyrillic/Greek homoglyphs</strong> and <strong>{zero_width_chars_count} invisible characters</strong> intended to break text matching. Text was unmasked to canonical Latin before scanning.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-amber-900 dark:text-amber-200 font-bold flex items-center gap-1 hover:underline shrink-0 self-start sm:self-auto"
        >
          {isExpanded ? (
            <>
              Hide Tampering Logs <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              Inspect Intercepted Characters <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800/60 space-y-2">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Document Integrity Score: <strong>{integrity_score}%</strong> (Tampering mitigated)</span>
          </div>

          {detected_tampering?.homoglyphs && detected_tampering.homoglyphs.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-amber-900 dark:text-amber-300">
                Detected Homoglyph Substitutions ({detected_tampering.homoglyphs.length} samples shown):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {detected_tampering.homoglyphs.map((item, idx) => (
                  <div key={idx} className="p-1.5 bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-800/40 text-[10px] font-mono text-slate-700 dark:text-slate-300 truncate">
                    <span className="text-rose-600 font-bold">{item.code_point}</span> ({item.script} &apos;{item.char}&apos;) &rarr; Latin &apos;{item.replaced_with}&apos; in &ldquo;{item.context}&rdquo;
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
