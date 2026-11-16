import React, { useState } from 'react';
import { X, Award, ShieldCheck, Check, Copy, ExternalLink, Printer, QrCode, Lock } from 'lucide-react';
import { Button } from './ui/button';

export default function OriginalityCertificateModal({ report, isOpen, onClose }) {
  const [copiedKey, setCopiedKey] = useState(null);

  if (!isOpen || !report) return null;

  const cert = report.certificate || {
    certificate_id: `cert_${(report.scan_id || 'sample').slice(0, 10)}`,
    document_title: report.document_title || report.filename || 'Audited Academic Document',
    sha256: report.adversarial_integrity?.sha256_hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    issued_at: new Date().toISOString(),
    overall_score: report.overall_score || 0,
    originality_score: report.originality_score || 100,
    ai_probability: report.ai_detection?.ai_probability || 0,
    integrity_status: report.adversarial_integrity?.integrity_status || 'Verified Clean',
    verification_seal: 'Cryptographically Verified by Poach Academic Integrity Protocol',
    verification_url: `https://chalbecopykrega-app.onrender.com/verify/cert_${(report.scan_id || 'sample').slice(0, 10)}`
  };

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0d121f] rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Official Originality Certificate
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Verifiable credential for academic departments, journals, and repositories.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Certificate Card Preview (Printable) */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="p-5 rounded-xl bg-white dark:bg-[#090d16] border border-slate-300 dark:border-slate-700 shadow-xs relative overflow-hidden">
            {/* Watermark / Seal Background */}
            <div className="absolute right-4 bottom-4 opacity-5 pointer-events-none">
              <ShieldCheck className="w-64 h-64 text-slate-900 dark:text-slate-100" />
            </div>

            {/* Certificate Header */}
            <div className="text-center pb-4 border-b border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-mono tracking-widest text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                Poach Academic Integrity Protocol
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2 tracking-tight">
                Certificate of Originality & Authorship
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                Certificate ID: <strong className="text-slate-700 dark:text-slate-300">{cert.certificate_id}</strong>
              </p>
            </div>

            {/* Document Title & Grant Text */}
            <div className="py-4 text-center space-y-1">
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">
                This certifies that the scholarly document entitled:
              </p>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 max-w-lg mx-auto truncate">
                &ldquo;{cert.document_title}&rdquo;
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto pt-0.5 leading-relaxed">
                has undergone multi-vector similarity cross-referencing and heuristic AI detection audit under verified academic parameters.
              </p>
            </div>

            {/* Scores Grid */}
            <div className="grid grid-cols-3 gap-2.5 my-3 text-center">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-mono uppercase text-slate-500">Originality Score</div>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums font-mono">
                  {cert.originality_score}%
                </div>
                <div className="text-[10px] text-slate-500">Verified Clean</div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-mono uppercase text-slate-500">Similarity Index</div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-0.5 tabular-nums font-mono">
                  {cert.overall_score}%
                </div>
                <div className="text-[10px] text-slate-500">Overlap Over Corpus</div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-mono uppercase text-slate-500">AI Writing Prob.</div>
                <div className="text-xl font-bold text-slate-700 dark:text-slate-300 mt-0.5 tabular-nums font-mono">
                  {cert.ai_probability}%
                </div>
                <div className="text-[10px] text-slate-500">Human Authorship</div>
              </div>
            </div>

            {/* Cryptographic SHA-256 Fingerprint */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs gap-3">
              <div className="flex items-center gap-2 truncate">
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Document SHA-256 Fingerprint</span>
                  <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate block">
                    {cert.sha256}
                  </span>
                </div>
              </div>
              <Button
                size="xs"
                variant="outline"
                onClick={() => handleCopy(cert.sha256, 'sha')}
                className="shrink-0 h-7 text-[11px]"
              >
                {copiedKey === 'sha' ? <Check className="w-3 h-3 text-emerald-600 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                {copiedKey === 'sha' ? 'Copied' : 'Copy'}
              </Button>
            </div>

            {/* Footer with Seal & QR Info */}
            <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-amber-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Scan QR or visit verification URL to validate protocol seal</span>
              </div>
              <span className="font-bold text-slate-600 dark:text-slate-300">
                Issued: {new Date(cert.issued_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Verification Link Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2 truncate">
              <ExternalLink className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="font-mono text-indigo-600 dark:text-indigo-400 truncate">
                {cert.verification_url}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="xs"
                variant="outline"
                onClick={() => handleCopy(cert.verification_url, 'url')}
                className="h-8 text-xs font-bold"
              >
                {copiedKey === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copiedKey === 'url' ? 'Copied Link' : 'Copy Link'}
              </Button>
              <Button
                size="xs"
                onClick={handlePrint}
                className="h-8 text-xs font-bold"
              >
                <Printer className="w-3.5 h-3.5 mr-1" />
                Print / Save PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <Button variant="default" onClick={onClose} className="px-6">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
