import React, { useState } from 'react';
import { X, Code2, ShieldAlert, Cpu, ArrowRightLeft, FileCode, Binary } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

const DEFAULT_SAMPLE_CODE_A = `def compute_student_average(grades_list):
    # Sum all student grades and return normalized mean
    running_sum = 0
    for grade in grades_list:
        running_sum = running_sum + grade
    calculated_mean = running_sum / len(grades_list)
    return calculated_mean`;

const DEFAULT_SAMPLE_CODE_B = `def calculate_mean_score(exam_data):
    /* Renamed variables and modified comments to evade detection */
    accumulator = 0
    for item in exam_data:
        accumulator = accumulator + item
    final_score = accumulator / len(exam_data)
    return final_score`;

const SAMPLE_AST_TREE_A = `[FUNCTION_DEF: 'func_1']
  ├── PARAMS: ['param_1']
  └── BODY:
      ├── ASSIGN: 'var_1' = 0
      ├── FOR_LOOP: target='var_2', iter='param_1'
      │   └── ASSIGN: 'var_1' = (BINARY_OP: 'var_1' + 'var_2')
      ├── ASSIGN: 'var_3' = (BINARY_OP: 'var_1' / (CALL: 'func_len'('param_1')))
      └── RETURN: 'var_3'`;

const SAMPLE_AST_TREE_B = `[FUNCTION_DEF: 'func_1']   ← (Identical Structure)
  ├── PARAMS: ['param_1']   ← (Renamed from 'exam_data')
  └── BODY:
      ├── ASSIGN: 'var_1' = 0   ← (Renamed from 'accumulator')
      ├── FOR_LOOP: target='var_2', iter='param_1'
      │   └── ASSIGN: 'var_1' = (BINARY_OP: 'var_1' + 'var_2')
      ├── ASSIGN: 'var_3' = (BINARY_OP: 'var_1' / (CALL: 'func_len'('param_1')))
      └── RETURN: 'var_3'   ← (100% AST Token Equivalence)`;

export default function CodePlagiarismModal({ isOpen, onClose }) {
  const { authFetch } = useAuth();
  const [codeA, setCodeA] = useState(DEFAULT_SAMPLE_CODE_A);
  const [codeB, setCodeB] = useState(DEFAULT_SAMPLE_CODE_B);
  const [viewMode, setViewMode] = useState('raw'); // 'raw' | 'ast'
  const [result, setResult] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleCompare = async () => {
    setIsComparing(true);
    setError('');
    try {
      const res = await authFetch('/api/code/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code_a: codeA,
          code_b: codeB,
          filename_a: 'student_submission_a.py',
          filename_b: 'student_submission_b.py'
        })
      });

      if (!res.ok) throw new Error('Code comparison failed.');
      const data = await res.json();
      setResult(data.comparison);
    } catch (err) {
      setError(err.message || 'Comparison request failed.');
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Source Code Plagiarism & Renaming Inspector
                </h3>
                <span className="px-2 py-0.5 text-[10px] uppercase font-mono font-bold rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                  AST Normalization
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Defeats variable-renaming obfuscation, comment injection, and dummy reordering across Python, JS/TS, Java, and C++.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View Mode Toggle: Raw Code vs Normalized AST Tree */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-zinc-100/50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-1.5 p-0.5 bg-zinc-200/60 dark:bg-zinc-800 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('raw')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition',
                viewMode === 'raw'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              )}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Raw Code</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ast')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition',
                viewMode === 'ast'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              )}
            >
              <Binary className="w-3.5 h-3.5 text-indigo-500" />
              <span>Normalized AST Tree</span>
              <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                Poach Engine
              </span>
            </button>
          </div>

          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 hidden sm:inline">
            {viewMode === 'raw' ? 'Viewing unmodified submissions' : 'Showing canonical identifiers (v1, v2) & stripped comments'}
          </span>
        </div>

        {/* Comparison Result Banner */}
        {result && (
          <div className="px-6 py-3.5 bg-indigo-500/10 border-b border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white dark:bg-zinc-800 shadow-2xs">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Structural Overlap Score
                </p>
                <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums">
                  {result.similarity_score}% Match • <span className="text-rose-600 font-sans">{result.structural_match_verdict}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="px-3 py-1 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <span className="text-zinc-400">Shared k-grams: </span>
                <strong className="text-indigo-600 dark:text-indigo-400">{result.shared_kgrams_count}</strong>
              </div>
              <div className="px-3 py-1 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <span className="text-zinc-400">Normalized IDs: </span>
                <strong className="text-emerald-600">{result.identifiers_count_a}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Dual Panes */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-50/40 dark:bg-zinc-950/40">
          {/* Submission A */}
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider font-mono">
                Submission A (Reference Code)
              </label>
              <span className="text-[10px] font-mono text-zinc-400">Python / JS / C++</span>
            </div>
            {viewMode === 'raw' ? (
              <textarea
                value={codeA}
                onChange={(e) => setCodeA(e.target.value)}
                rows={12}
                className="w-full font-mono text-xs p-3.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500 outline-none leading-relaxed"
                placeholder="Paste first source code file..."
              />
            ) : (
              <pre className="w-full font-mono text-xs p-3.5 rounded-lg bg-zinc-950 text-emerald-400 border border-zinc-800 overflow-x-auto leading-relaxed h-[270px]">
                {SAMPLE_AST_TREE_A}
              </pre>
            )}
          </div>

          {/* Submission B */}
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider font-mono">
                Submission B (Suspect / Renamed Code)
              </label>
              <span className="text-[10px] font-mono text-zinc-400">
                {viewMode === 'raw' ? 'Renamed Variables' : 'Equivalent AST'}
              </span>
            </div>
            {viewMode === 'raw' ? (
              <textarea
                value={codeB}
                onChange={(e) => setCodeB(e.target.value)}
                rows={12}
                className="w-full font-mono text-xs p-3.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500 outline-none leading-relaxed"
                placeholder="Paste second source code file..."
              />
            ) : (
              <pre className="w-full font-mono text-xs p-3.5 rounded-lg bg-zinc-950 text-emerald-400 border border-zinc-800 overflow-x-auto leading-relaxed h-[270px]">
                {SAMPLE_AST_TREE_B}
              </pre>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-6 p-3 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs font-bold border border-rose-500/20">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-indigo-500" />
            <span>Identifier normalization maps variable names into canonical tokens (v1, v2...)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} size="sm">
              Close
            </Button>
            <Button
              onClick={handleCompare}
              disabled={isComparing || !codeA.trim() || !codeB.trim()}
              size="sm"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
              {isComparing ? 'Analyzing AST...' : 'Run Structural AST Diff'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
