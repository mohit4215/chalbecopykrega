import React, { useState } from 'react';
import { ShieldAlert, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

export default function AdversarialEvasionBanner({ adversarialIntegrity }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!adversarialIntegrity || !adversarialIntegrity.tampering_detected) {
    return null;
  }

  const { 
    homoglyphs_detected_count = 0, 
    zero_width_chars_count = 0, 
    punctuation_splits_count = 0,
    evasion_tactics_detected = [],
    detected_tampering = {}, 
    integrity_score = 100,
    threat_level = 'SUSPICIOUS'
  } = adversarialIntegrity;

  return (
    <div className="mb-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-4 shadow-sm text-xs space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-lg shrink-0 mt-0.5">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-amber-900 dark:text-amber-200">
                Adversarial Evasion Attempt Neutralized
              </span>
              <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                threat_level.includes('CRITICAL') 
                  ? 'bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200'
                  : 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200'
              }`}>
                {threat_level.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-amber-800 dark:text-amber-300 mt-0.5">
              Detected <strong>{homoglyphs_detected_count} Cyrillic/Greek homoglyphs</strong> and <strong>{zero_width_chars_count} invisible characters</strong>
              {punctuation_splits_count > 0 && <span> and <strong>{punctuation_splits_count} punctuation word splits</strong></span>} intended to bypass similarity detection. Text was unmasked to canonical Latin ASCII prior to vector scanning.
            </p>

            {evasion_tactics_detected.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {evasion_tactics_detected.map((tactic, tIdx) => (
                  <span key={tIdx} className="px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 text-[10px] font-semibold">
                    {tactic}
                  </span>
                ))}
              </div>
            )}
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
        <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800/60 space-y-3">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Document Integrity Score: <strong>{integrity_score}%</strong> (Obfuscation fully neutralized)</span>
          </div>

          {detected_tampering?.homoglyphs && detected_tampering.homoglyphs.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-amber-900 dark:text-amber-300">
                Intercepted Unicode Homoglyphs ({detected_tampering.homoglyphs.length} samples shown):
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

          {detected_tampering?.punctuation_splits && detected_tampering.punctuation_splits.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-amber-900 dark:text-amber-300">
                Intercepted Artificial Punctuation Splitting:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {detected_tampering.punctuation_splits.map((item, sIdx) => (
                  <span key={sIdx} className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/40 rounded text-[10px] font-mono text-slate-700 dark:text-slate-300">
                    &ldquo;{item.original_split}&rdquo; &rarr; <strong>{item.reconstructed_word}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
