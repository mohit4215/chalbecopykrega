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
    <div className="mb-4 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-800/80 p-3.5 shadow-2xs text-xs space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-1 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 rounded shrink-0 mt-0.5">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-amber-900 dark:text-amber-200">
                Adversarial Evasion Attempt Neutralized
              </span>
              <span className={`px-1.5 py-0.2 text-[9px] font-mono font-semibold rounded uppercase ${
                threat_level.includes('CRITICAL') 
                  ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                  : 'bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
              }`}>
                {threat_level.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
              Detected <strong>{homoglyphs_detected_count} Cyrillic/Greek homoglyphs</strong> and <strong>{zero_width_chars_count} invisible characters</strong>
              {punctuation_splits_count > 0 && <span> and <strong>{punctuation_splits_count} punctuation word splits</strong></span>} intended to bypass similarity detection. Text unmasked to canonical ASCII prior to comparison.
            </p>

            {evasion_tactics_detected.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {evasion_tactics_detected.map((tactic, tIdx) => (
                  <span key={tIdx} className="px-1.5 py-0.2 rounded font-mono bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[9px] font-medium border border-amber-200/60 dark:border-amber-800/60">
                    {tactic}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-amber-900 dark:text-amber-200 font-medium flex items-center gap-1 hover:underline shrink-0 self-start sm:self-auto text-xs"
        >
          {isExpanded ? (
            <>
              Hide Logs <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              Inspect Intercepted Characters <ChevronDown className="w-3.5 h-3.5" />
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
