import React, { useState } from 'react';
import { 
  X, 
  Users, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { Button } from './ui/button';

export default function CohortCollusionModal({ isOpen, onClose }) {
  const [threshold, setThreshold] = useState(35);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [collusionResult, setCollusionResult] = useState(null);

  const DEMO_COHORT = [
    {
      id: 'sub_1',
      student_name: 'Alice Smith',
      title: 'Neural Network Architectures',
      text: 'Deep neural networks utilize backpropagation and stochastic gradient descent to optimize loss functions across multi-layered perceptual layers. Convolutional filters effectively extract spatial features from high-dimensional matrix representations.'
    },
    {
      id: 'sub_2',
      student_name: 'David Miller',
      title: 'Deep Learning Review',
      text: 'Deep neural networks utilize backpropagation and stochastic gradient descent to optimize loss functions across multi-layered perceptual layers. Convolutional filters effectively extract spatial features from high-dimensional visual matrices.'
    },
    {
      id: 'sub_3',
      student_name: 'Bob Johnson',
      title: 'Support Vector Machines in ML',
      text: 'Support vector machines identify optimal hyperplanes that maximize margins between disparate classification categories. Kernel transformations map non-linear boundary constraints into elevated Euclidean subspaces.'
    },
    {
      id: 'sub_4',
      student_name: 'Charlie Brown',
      title: 'Reinforcement Learning Principles',
      text: 'Markov decision processes frame reinforcement learning algorithms through reward functions and policy value iteration. Bellman equations dictate temporal difference updates for autonomous exploratory agents.'
    }
  ];

  const [submissions, setSubmissions] = useState(DEMO_COHORT);

  if (!isOpen) return null;

  const handleLoadDemo = () => {
    setSubmissions(DEMO_COHORT);
    setCollusionResult(null);
    setErrorMsg('');
  };

  const handleAddSubmission = () => {
    setSubmissions([
      ...submissions,
      {
        id: `sub_${Date.now()}`,
        student_name: `Student ${submissions.length + 1}`,
        title: `Paper ${submissions.length + 1}`,
        text: ''
      }
    ]);
  };

  const handleRemoveSubmission = (index) => {
    if (submissions.length <= 2) {
      setErrorMsg('At least 2 submissions are required to compute a cross-cohort matrix.');
      return;
    }
    const updated = [...submissions];
    updated.splice(index, 1);
    setSubmissions(updated);
  };

  const handleUpdateSubmission = (index, field, value) => {
    const updated = [...submissions];
    updated[index] = { ...updated[index], [field]: value };
    setSubmissions(updated);
  };

  const handleRunAnalysis = async () => {
    setErrorMsg('');
    const valid = submissions.filter(s => s.text && s.text.trim().length >= 10);
    if (valid.length < 2) {
      setErrorMsg('Please ensure at least 2 submissions have at least 10 characters of text.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/cohort/collusion-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threshold: parseFloat(threshold),
          submissions: valid
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      setCollusionResult(data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to analyze cohort collusion.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Cross-Cohort Collusion Matrix & Peer Ring Detector
                </h3>
                <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 uppercase">
                  Turnitin Alternative
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cross-references an entire classroom or assignment batch simultaneously to uncover peer sharing rings.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/40 dark:bg-slate-950/40">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-4">
              <Button size="sm" variant="outline" onClick={handleLoadDemo} className="text-xs font-bold">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Load Sample 4-Student Ring
              </Button>
              <Button size="sm" variant="secondary" onClick={handleAddSubmission} className="text-xs font-bold">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Student
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Flag Threshold: <strong className="text-indigo-600 dark:text-indigo-400">{threshold}%</strong>
              </label>
              <input
                type="range"
                min="15"
                max="80"
                step="5"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-28 accent-indigo-600"
              />
              <Button
                size="sm"
                onClick={handleRunAnalysis}
                isLoading={isAnalyzing}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Compute Collusion Matrix
              </Button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Results Display */}
          {collusionResult && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Overall Risk Card */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                collusionResult.overall_cohort_risk.includes('High')
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  : collusionResult.overall_cohort_risk.includes('Moderate')
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              }`}>
                <div className="flex items-center gap-3">
                  {collusionResult.overall_cohort_risk.includes('High') ? (
                    <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-black text-sm">Cohort Verdict: {collusionResult.overall_cohort_risk}</h4>
                    <p className="text-xs opacity-90 mt-0.5">
                      Analyzed {collusionResult.cohort_size} student submissions simultaneously. Collusion sensitivity threshold: {collusionResult.threshold_used}%.
                    </p>
                  </div>
                </div>

                {collusionResult.collusion_clusters?.length > 0 && (
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">Collusion Rings Discovered</span>
                    <p className="text-sm font-black">{collusionResult.collusion_clusters.length} Cluster(s)</p>
                  </div>
                )}
              </div>

              {/* N x N Matrix Heatmap */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Pairwise Overlap Heatmap Matrix ({collusionResult.cohort_size} × {collusionResult.cohort_size}):
                </h4>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-center border-collapse">
                    <thead>
                      <tr>
                        <th className="p-2 text-left font-bold text-slate-400 border-b border-slate-200 dark:border-slate-700">Student</th>
                        {collusionResult.submissions_summary.map((s, idx) => (
                          <th key={idx} className="p-2 font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                            {s.student_name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {collusionResult.matrix.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="p-2 text-left font-bold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700">
                            {collusionResult.submissions_summary[rIdx].student_name}
                          </td>
                          {row.map((score, cIdx) => {
                            const isSelf = rIdx === cIdx;
                            const isHigh = score >= collusionResult.threshold_used;
                            const isMod = score >= 20 && !isHigh;
                            return (
                              <td
                                key={cIdx}
                                className={`p-2 font-mono font-bold transition ${
                                  isSelf
                                    ? 'bg-slate-100 dark:bg-slate-900 text-slate-400'
                                    : isHigh
                                    ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                                    : isMod
                                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                                title={`${collusionResult.submissions_summary[rIdx].student_name} vs ${collusionResult.submissions_summary[cIdx].student_name}: ${score}%`}
                              >
                                {score}%
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Suspicious Pairs Breakdown */}
              {collusionResult.suspicious_pairs?.length > 0 && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Flagged Collusion Pairs ({collusionResult.suspicious_pairs.length})
                  </h4>

                  <div className="space-y-2">
                    {collusionResult.suspicious_pairs.map((pair, pIdx) => (
                      <div key={pIdx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 dark:text-slate-100">{pair.student_a}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-extrabold text-slate-800 dark:text-slate-100">{pair.student_b}</span>
                            <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 uppercase">
                              {pair.similarity_score}% Shared
                            </span>
                          </div>
                          {pair.sample_overlapping_phrases?.length > 0 && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                              Sample overlap: &ldquo;{pair.sample_overlapping_phrases[0]}&rdquo;
                            </p>
                          )}
                        </div>
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400 self-start md:self-auto">
                          {pair.verdict}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submissions Editor Accordion / Cards */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Cohort Submissions ({submissions.length})</span>
              <span className="text-[11px] font-normal text-slate-400">Edit or paste student texts below</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {submissions.map((sub, idx) => (
                <div key={sub.id || idx} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={sub.student_name}
                      onChange={(e) => handleUpdateSubmission(idx, 'student_name', e.target.value)}
                      placeholder="Student Name"
                      className="font-bold text-slate-900 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 outline-none px-1 py-0.5"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSubmission(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      title="Remove submission"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={sub.title}
                    onChange={(e) => handleUpdateSubmission(idx, 'title', e.target.value)}
                    placeholder="Paper Title"
                    className="w-full text-slate-500 dark:text-slate-400 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 outline-none px-1 py-0.5 text-[11px]"
                  />

                  <textarea
                    rows={4}
                    value={sub.text}
                    onChange={(e) => handleUpdateSubmission(idx, 'text', e.target.value)}
                    placeholder="Paste student submission text here..."
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-serif leading-relaxed text-slate-800 dark:text-slate-200"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Cohort Matrix Analysis powered by Poach Multi-Vector Jaccard Containment
          </div>
          <Button onClick={onClose} variant="secondary" size="sm" className="font-bold">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
