import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import telemetry from '../services/telemetry';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  X, 
  FileCheck2, 
  Cpu, 
  Layers, 
  Search, 
  CheckCircle, 
  Clock, 
  Loader2,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

const SAMPLE_DEMO_TEXT = `Title: Survey on Attention Mechanisms and Natural Language Processing

1. Introduction
Deep learning is a subset of machine learning, which is essentially a neural network with three or more layers. These neural networks attempt to simulate the behavior of the human brain.

2. Transformer Breakthroughs
Attention Is All You Need introduced the Transformer architecture based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.

3. Paraphrased Synthesis
The landmark Transformer paradigm discarded recurrent modules completely, depending exclusively on self-attention calculations to model contextual relationships.

4. Public Knowledge & Web Citations
The Python programming language was conceived by Guido van Rossum in the late 1980s at Centrum Wiskunde and Informatica.

5. Original Empirical Contributions
In our 14-epoch experimental study using 4-bit quantized Low-Rank Adaptation (LoRA), we achieved a 68% reduction in GPU VRAM consumption while preserving validation perplexity within 0.04 of the full-precision baseline.`;

const STAGES = [
  { key: 'extracting', label: 'Extracting text & OCR', icon: FileText, defaultPct: 25 },
  { key: 'vectorizing', label: 'Vectorizing & DB search', icon: Layers, defaultPct: 55 },
  { key: 'searching_web', label: 'Searching web & cross-referencing', icon: Search, defaultPct: 75 },
  { key: 'scoring', label: 'Similarity & NLP scoring', icon: Cpu, defaultPct: 92 },
];

export default function UploadComponent({ onScanComplete, isLoading, setIsLoading, onNeedLogin }) {
  const { token, authFetch } = useAuth();
  const [file, setFile] = useState(null);
  const [enableWeb, setEnableWeb] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Task & Progress state
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [taskProgress, setTaskProgress] = useState(5);
  const [currentStep, setCurrentStep] = useState('extracting');
  const [statusMessage, setStatusMessage] = useState('Submitting document to neural processing pipeline...');
  const [isWsActive, setIsWsActive] = useState(false);
  const [scanResult, setScanResult] = useState(null); // For success reveal stage

  const pollIntervalRef = useRef(null);
  const wsRef = useRef(null);

  // Clear polling & WebSocket on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setErrorMessage('');
    if (rejectedFiles && rejectedFiles.length > 0) {
      const rej = rejectedFiles[0];
      if (rej.errors && rej.errors[0]?.code === 'file-too-large') {
        setErrorMessage('File size exceeds the 10 MB limit. Please upload a smaller document.');
      } else {
        setErrorMessage('Unsupported format. Please upload a PDF, DOCX, or plain text file.');
      }
      return;
    }

    if (acceptedFiles && acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    disabled: isLoading,
  });

  const handleUseSampleDoc = () => {
    const sampleBlob = new Blob([SAMPLE_DEMO_TEXT], { type: 'text/plain' });
    const sampleFile = new File([sampleBlob], 'Sample_NLP_Survey_Paper.txt', { type: 'text/plain' });
    setFile(sampleFile);
    setErrorMessage('');
  };

  const handleRemoveFile = (e) => {
    e.stopPropagation();
    setFile(null);
    setErrorMessage('');
  };

  /**
   * Completes scan and triggers the animated success reveal.
   */
  const handleSuccessReveal = (reportData) => {
    setScanResult(reportData);
    setTaskProgress(100);
    setStatusMessage('Audit complete! Rendering originality report...');

    // Smooth delay before handing control to the Document Viewer
    setTimeout(() => {
      onScanComplete(reportData);
      setIsLoading(false);
      setScanResult(null);
    }, 1800);
  };

  /**
   * Real-time WebSocket task progress listener.
   */
  const startTaskWebSocket = (taskId) => {
    setActiveTaskId(taskId);
    setIsWsActive(true);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const rawEnv = (import.meta.env.VITE_API_URL || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const host = rawEnv || (window.location.hostname.includes('render.com') ? 'chalbecopykrega-api.onrender.com' : window.location.host);

    const wsUrl = `${protocol}//${host}/ws/task-status/${taskId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.progress !== undefined) setTaskProgress(data.progress);
        if (data.step) setCurrentStep(data.step);
        if (data.message) setStatusMessage(data.message);

        if (data.status === 'success') {
          ws.close();
          handleSuccessReveal(data.report);
        } else if (data.status === 'failure') {
          ws.close();
          setIsLoading(false);
          setErrorMessage(data.error || 'Plagiarism analysis failed.');
        }
      } catch (err) {
        console.error('WebSocket parse error:', err);
      }
    };

    ws.onerror = () => {
      ws.close();
      setIsWsActive(false);
      startPollingFallback(taskId);
    };

    ws.onclose = () => {
      setIsWsActive(false);
    };
  };

  /**
   * Resilient HTTP Polling Fallback.
   */
  const startPollingFallback = (taskId) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await authFetch(`/api/task-status/${taskId}`);
        if (!res.ok) throw new Error('Polling error');
        const data = await res.json();

        if (data.progress !== undefined) setTaskProgress(data.progress);
        if (data.step) setCurrentStep(data.step);
        if (data.message) setStatusMessage(data.message);

        if (data.status === 'success') {
          clearInterval(pollIntervalRef.current);
          handleSuccessReveal(data.report);
        } else if (data.status === 'failure') {
          clearInterval(pollIntervalRef.current);
          setIsLoading(false);
          setErrorMessage(data.error || 'Plagiarism analysis failed.');
        }
      } catch (err) {
        console.warn('Polling error:', err);
      }
    }, 1500);
  };

  /**
   * Document upload trigger.
   */
  const handleUploadAndScan = async () => {
    if (!file) {
      setErrorMessage('Please select or drop a document to scan.');
      return;
    }

    if (!token) {
      if (onNeedLogin) {
        onNeedLogin();
      } else {
        setErrorMessage('Please sign in or create a free account to scan documents.');
      }
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setTaskProgress(10);
    setStatusMessage('Uploading document and validating MIME signatures...');

    telemetry.track('File Upload Started', {
      file_name: file.name,
      file_size_bytes: file.size,
      file_type: file.type || file.name.split('.').pop() || 'unknown',
      enable_web_search: enableWeb,
      is_sample_demo: file.name === 'Sample_NLP_Survey_Paper.txt',
    });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('enable_web_search', enableWeb ? 'true' : 'false');

      const response = await authFetch('/api/check-plagiarism', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Upload failed with status: ${response.status}`);
      }

      const resData = await response.json();

      if (resData.task_id) {
        startTaskWebSocket(resData.task_id);
      } else if (resData.report || resData.overall_score !== undefined) {
        handleSuccessReveal(resData.report || resData);
      } else {
        throw new Error('Unexpected server response format.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage(err.message || 'An error occurred during scanning. Please verify your connection.');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 max-w-2xl mx-auto transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800 gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Distributed Vector & Web Pipeline
          </span>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
            Originality Verification
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Accepts PDF (digital & scanned OCR), Word (.docx), and plain text (.txt) up to 10 MB.
          </p>
        </div>

        {!isLoading && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleUseSampleDoc}
            className="self-start sm:self-auto border-indigo-200 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/40"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            <span>Load Demo Paper</span>
          </Button>
        )}
      </div>

      {!token && !isLoading && (
        <div className="mt-4 p-3 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-800/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Sign in or register to get <strong>3 free AI & Web Plagiarism checks</strong> with full source matches.</span>
          </div>
          {onNeedLogin && (
            <Button
              size="sm"
              onClick={onNeedLogin}
              className="shrink-0 h-7 text-xs font-bold shadow-sm"
            >
              Sign In to Scan
            </Button>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="mt-5 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Interactive Container with Framer Motion AnimatePresence */}
      <AnimatePresence mode="wait">
        {scanResult ? (
          /* Success Reveal State */
          <motion.div
            key="success-reveal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.4 }}
            className="py-10 text-center space-y-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.1 }}
              className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20"
            >
              <CheckCircle2 className="w-10 h-10" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Audit Completed!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Originality index computed: <strong className="text-indigo-600 dark:text-indigo-400 font-black">{Math.round(scanResult.originality_score ?? 100)}% Original</strong>
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-400"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              <span>Opening interactive report viewer...</span>
            </motion.div>
          </motion.div>
        ) : isLoading ? (
          /* Multi-Step Animated Progress State */
          <motion.div
            key="loading-state"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="py-8 space-y-6"
          >
            {/* Header info */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 truncate max-w-sm mx-auto">
                {file?.name || 'Processing Document'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">{statusMessage}</p>
            </div>

            {/* Glowing Multi-Stage Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500 dark:text-slate-400">Pipeline Execution</span>
                <span className="text-indigo-600 dark:text-indigo-400">{taskProgress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 rounded-full shadow-sm"
                  initial={{ width: '5%' }}
                  animate={{ width: `${taskProgress}%` }}
                  transition={{ ease: 'easeOut', duration: 0.5 }}
                />
              </div>
            </div>

            {/* Multi-Step Progress Indicator Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {STAGES.map((s, idx) => {
                const StageIcon = s.icon;
                const isPast = taskProgress >= s.defaultPct;
                const isCurrent = currentStep === s.key || (taskProgress >= s.defaultPct - 15 && taskProgress < s.defaultPct + 15);

                return (
                  <div
                    key={idx}
                    className={cn(
                      'p-3 rounded-2xl border text-center transition-all',
                      isPast
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                        : isCurrent
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 text-indigo-900 dark:text-indigo-200 shadow-sm ring-1 ring-indigo-400 animate-pulse'
                        : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
                    )}
                  >
                    <StageIcon className="w-5 h-5 mx-auto mb-1.5 shrink-0" />
                    <p className="text-[11px] font-bold leading-tight">{s.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Streaming Status Indicator */}
            <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100 dark:border-slate-800 text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Estimated duration: 5-15s</span>
              </span>
              {isWsActive ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 font-semibold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Live WebSocket Feed</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Direct Pipeline</span>
                </span>
              )}
            </div>
          </motion.div>
        ) : (
          /* Normal Upload Form with Framer Motion Drag-and-Drop Zone */
          <motion.div
            key="upload-form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-6 space-y-6"
          >
            {/* Framer Motion Drag-and-Drop Zone */}
            <div id="tour-upload-box">
              <motion.div
                {...getRootProps()}
                whileHover={{ scale: 1.01 }}
                animate={
                  isDragActive
                    ? {
                        scale: 1.02,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(238, 242, 255, 0.6)',
                        boxShadow: '0 0 25px rgba(99, 102, 241, 0.25)',
                      }
                    : {
                        scale: 1,
                        borderColor: file ? '#86efac' : '#cbd5e1',
                        backgroundColor: file ? 'rgba(240, 253, 244, 0.4)' : 'rgba(248, 250, 252, 0.6)',
                      }
                }
                transition={{ duration: 0.2 }}
                className={cn(
                  'border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center transition-colors cursor-pointer relative select-none',
                  'dark:bg-slate-900/60 dark:border-slate-700'
                )}
              >
                <input {...getInputProps()} />

                {file ? (
                  <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-sm max-w-md mx-auto">
                    <div className="flex items-center gap-3 text-left truncate">
                      <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl shrink-0">
                        <FileCheck2 className="w-6 h-6" />
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{file.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition ml-2"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4">
                    <motion.div
                      animate={isDragActive ? { scale: 1.25, rotate: -6 } : { scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                      className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-3 shadow-inner"
                    >
                      <Upload className="w-8 h-8" />
                    </motion.div>
                    <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                      {isDragActive ? 'Release to upload document...' : 'Drag & drop your document here, or browse files'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      Supports PDF (with automatic OCR for scanned pages), Word (.docx), and TXT files up to 10 MB.
                    </p>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Options & Action Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={enableWeb}
                  onChange={(e) => setEnableWeb(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300"
                />
                <span>Cross-reference billions of real-time web pages</span>
              </label>

              <Button
                size="lg"
                disabled={!file}
                onClick={handleUploadAndScan}
                className="w-full sm:w-auto px-8 shadow-indigo-500/25"
              >
                <span>Run Originality Audit</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
