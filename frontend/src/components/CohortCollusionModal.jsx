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
  RotateCcw,
  Network
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
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Cross-Cohort Collusion Matrix & Peer Ring Detector
                </h3>
                <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 uppercase">
                  O(N²) Jaccard Engine
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Simultaneously cross-examines student submissions within an assignment cohort to detect unauthorized peer sharing rings.
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

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-zinc-50/40 dark:bg-zinc-950/40">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={handleLoadDemo} className="text-xs font-semibold">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Load Sample 4-Student Ring
              </Button>
              <Button size="sm" variant="secondary" onClick={handleAddSubmission} className="text-xs font-semibold">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Student
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 font-mono">
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
                className="text-xs font-semibold"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Compute Collusion Matrix
              </Button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-700 dark:text-rose-400 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Results Display */}
          {collusionResult && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Overall Risk Card */}
              <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                collusionResult.overall_cohort_risk.includes('High')
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
                  : collusionResult.overall_cohort_risk.includes('Moderate')
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
              }`}>
                <div className="flex items-center gap-3">
                  {collusionResult.overall_cohort_risk.includes('High') ? (
                    <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm">Cohort Verdict: {collusionResult.overall_cohort_risk}</h4>
                    <p className="text-xs opacity-90 mt-0.5">
                      Analyzed {collusionResult.cohort_size} student submissions simultaneously. Collusion sensitivity threshold: {collusionResult.threshold_used}%.
                    </p>
                  </div>
                </div>

                {collusionResult.collusion_clusters?.length > 0 && (
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-mono tracking-wider opacity-75">Identified Cartels</span>
                    <p className="text-sm font-bold font-mono">{collusionResult.collusion_clusters.length} Cluster(s)</p>
                  </div>
                )}
              </div>

              {/* Two-Column Analytical Split: Heatmap Grid (65%) & Cartels Sidebar (35%) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left (7 cols): Pairwise Overlap Heatmap Grid */}
                <div className="lg:col-span-7 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Pairwise Overlap Heatmap Matrix ({collusionResult.cohort_size} × {collusionResult.cohort_size})
                    </h4>
                    <span className="text-[10px] font-mono text-zinc-400">Dark red = Collusion risk</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs text-center border-collapse">
                      <thead>
                        <tr>
                          <th className="p-2 text-left font-semibold text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">Student</th>
                          {collusionResult.submissions_summary.map((s, idx) => (
                            <th key={idx} className="p-2 font-semibold text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800 truncate max-w-[90px]">
                              {s.student_name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {collusionResult.matrix.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2 text-left font-semibold text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-zinc-800 truncate max-w-[100px]">
                              {collusionResult.submissions_summary[rIdx].student_name}
                            </td>
                            {row.map((score, cIdx) => {
                              const isSelf = rIdx === cIdx;
                              const isHigh = score >= collusionResult.threshold_used;
                              const isMod = score >= 20 && !isHigh;
                              return (
                                <td
                                  key={cIdx}
                                  className={`p-2 font-mono font-semibold tabular-nums transition border border-zinc-100 dark:border-zinc-800/50 ${
                                    isSelf
                                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                                      : isHigh
                                      ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold'
                                      : isMod
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                      : 'text-zinc-500 dark:text-zinc-400'
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

                {/* Right (5 cols): "Identified Cartels & Rings" Sidebar */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Identified Cartels */}
                  <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
                    <h4 className="text-[11px] font-mono uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <Network className="w-4 h-4" />
                      <span>Identified Cartels ({collusionResult.collusion_clusters?.length || 0})</span>
                    </h4>

                    {collusionResult.collusion_clusters && collusionResult.collusion_clusters.length > 0 ? (
                      <div className="space-y-2">
                        {collusionResult.collusion_clusters.map((cluster, cIdx) => (
                          <div key={cIdx} className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-rose-700 dark:text-rose-300">Cluster #{cIdx + 1}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-800 dark:text-rose-200">
                                &gt;{threshold}% Overlap
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {cluster.members?.map((m, mIdx) => (
                                <span key={mIdx} className="px-2 py-0.5 rounded text-[11px] font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                        No auto-grouped cartels exceeding {threshold}% mutual overlap detected.
                      </p>
                    )}
                  </div>

                  {/* Flagged Suspicious Pairs */}
                  {collusionResult.suspicious_pairs?.length > 0 && (
                    <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
                      <h4 className="text-[11px] font-mono uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        <span>Flagged Collusion Pairs ({collusionResult.suspicious_pairs.length})</span>
                      </h4>

                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {collusionResult.suspicious_pairs.map((pair, pIdx) => (
                          <div key={pIdx} className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="font-bold text-zinc-800 dark:text-zinc-100 truncate">{pair.student_a}</span>
                                <ArrowRight className="w-3 h-3 text-zinc-400 shrink-0" />
                                <span className="font-bold text-zinc-800 dark:text-zinc-100 truncate">{pair.student_b}</span>
                              </div>
                              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 uppercase shrink-0 ml-2">
                                {pair.similarity_score}% Shared
                              </span>
                            </div>
                            {pair.sample_overlapping_phrases?.length > 0 && (
                              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate font-mono">
                                &ldquo;{pair.sample_overlapping_phrases[0]}&rdquo;
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Submissions Editor Accordion / Cards */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
              <span>Cohort Submissions ({submissions.length})</span>
              <span className="text-[11px] font-normal text-zinc-400">Edit or paste student texts below</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {submissions.map((sub, idx) => (
                <div key={sub.id || idx} className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={sub.student_name}
                      onChange={(e) => handleUpdateSubmission(idx, 'student_name', e.target.value)}
                      placeholder="Student Name"
                      className="font-bold text-zinc-900 dark:text-zinc-100 bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-indigo-500 outline-none px-1 py-0.5"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSubmission(idx)}
                      className="p-1 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-rose-500/10 transition"
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
                    className="w-full text-zinc-500 dark:text-zinc-400 bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-indigo-500 outline-none px-1 py-0.5 text-[11px]"
                  />

                  <textarea
                    rows={4}
                    value={sub.text}
                    onChange={(e) => handleUpdateSubmission(idx, 'text', e.target.value)}
                    placeholder="Paste student submission text here..."
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-serif leading-relaxed text-zinc-800 dark:text-zinc-200"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            Cohort Matrix Analysis powered by Poach Multi-Vector Jaccard Containment
          </div>
          <Button onClick={onClose} variant="secondary" size="sm" className="font-semibold">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
