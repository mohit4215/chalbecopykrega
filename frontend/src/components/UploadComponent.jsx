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
  X, 
  FileCheck2, 
  Cpu, 
  Layers, 
  Search, 
  Clock, 
  Loader2,
  ArrowRight,
  Shield,
  EyeOff,
  Code2,
  Database
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

const SAMPLE_CODE_TEXT = `# Algorithm: Binary Search and Array Normalization
def search_and_compute(data_array, target_value):
    """Performs binary lookup and normalizes scores."""
    low_idx = 0
    high_idx = len(data_array) - 1
    found_pos = -1
    while low_idx <= high_idx:
        mid_idx = (low_idx + high_idx) // 2
        if data_array[mid_idx] == target_value:
            found_pos = mid_idx
            break
        elif data_array[mid_idx] < target_value:
            low_idx = mid_idx + 1
        else:
            high_idx = mid_idx - 1
    return found_pos`;

const STAGES = [
  { key: 'extracting', label: 'Extracting text & OCR', icon: FileText, defaultPct: 25 },
  { key: 'vectorizing', label: 'Vectorizing & DB search', icon: Layers, defaultPct: 55 },
  { key: 'searching_web', label: 'Searching web & cross-referencing', icon: Search, defaultPct: 75 },
  { key: 'scoring', label: 'Similarity & NLP scoring', icon: Cpu, defaultPct: 92 },
];

export default function UploadComponent({ onScanComplete, isLoading, setIsLoading, onNeedLogin }) {
  const { token, authFetch, loginAsDemo } = useAuth();
  const [file, setFile] = useState(null);
  const [enableWeb, setEnableWeb] = useState(true);
  const [eslMode, setEslMode] = useState(false);
  const [ephemeralMode, setEphemeralMode] = useState(false);
  const [autoIndex, setAutoIndex] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Task & Progress state
  const [, setActiveTaskId] = useState(null);
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
        setErrorMessage('Unsupported format. Please upload a PDF, DOCX, TXT, or source code file (.py, .js, .cpp, .java).');
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
      'text/x-python': ['.py'],
      'text/javascript': ['.js', '.jsx'],
      'text/typescript': ['.ts', '.tsx'],
      'text/x-java-source': ['.java'],
      'text/x-c': ['.c', '.cpp', '.cs', '.go', '.rs'],
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

  const handleUseSampleCode = () => {
    const sampleBlob = new Blob([SAMPLE_CODE_TEXT], { type: 'text/plain' });
    const sampleFile = new File([sampleBlob], 'sample_algorithm.py', { type: 'text/plain' });
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

    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    const wsUrl = `${protocol}//${host}/ws/task-status/${taskId}${tokenQuery}`;
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

    setIsLoading(true);
    setErrorMessage('');
    setTaskProgress(5);

    // If unauthenticated, auto-authenticate with pre-seeded demo account or prompt login
    if (!token) {
      try {
        setStatusMessage('Initializing demo scan session (25 free Pro credits)...');
        await loginAsDemo();
      } catch (authErr) {
        setIsLoading(false);
        if (onNeedLogin) {
          onNeedLogin();
        } else {
          setErrorMessage('Please sign in or create an account to start scanning.');
        }
        return;
      }
    }

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
      formData.append('esl_mode', eslMode ? 'true' : 'false');
      formData.append('ephemeral_mode', ephemeralMode ? 'true' : 'false');
      formData.append('auto_index', (!ephemeralMode && autoIndex) ? 'true' : 'false');

      const response = await authFetch('/api/check-plagiarism', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Your session has expired. Please sign in or use the demo account to scan.');
        }
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
    <div className="bg-white dark:bg-[#0d121f] rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 max-w-2xl mx-auto transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-5 border-b border-slate-100 dark:border-slate-800 gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
            Document Ingestion & Analysis
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1 tracking-tight">
            Originality Audit
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md leading-relaxed">
            Upload student submissions, research manuscripts, or source code for multi-repository cross-comparison and citation auditing.
          </p>
        </div>

        {!isLoading && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleUseSampleDoc}
              className="text-xs font-medium"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              <span>Load Demo Paper</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleUseSampleCode}
              className="text-xs font-medium"
            >
              <Code2 className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              <span>Sample Code</span>
            </Button>
          </div>
        )}
      </div>

      {!token && !isLoading && (
        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span>Test scan session includes <strong>25 Free Credits</strong> with live reporting.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="xs"
              variant="outline"
              onClick={async () => {
                try {
                  await loginAsDemo();
                } catch {
                  if (onNeedLogin) onNeedLogin();
                }
              }}
              className="font-medium"
            >
              Demo Access
            </Button>
            {onNeedLogin && (
              <Button
                size="xs"
                onClick={onNeedLogin}
                className="font-medium"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="py-10 text-center space-y-4"
          >
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Audit Completed</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                Originality rating: <strong className="text-slate-900 dark:text-slate-100 font-bold">{Math.round(scanResult.originality_score ?? 100)}% Original</strong>
              </p>
            </div>

            <div className="inline-flex items-center gap-2 text-xs text-slate-400 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Loading detailed report viewer...</span>
            </div>
          </motion.div>
        ) : isLoading ? (
          /* Multi-Step Animated Progress State */
          <motion.div
            key="loading-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="py-6 space-y-5"
          >
            {/* Header info */}
            <div className="text-center space-y-1.5">
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg flex items-center justify-center mx-auto">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate max-w-sm mx-auto">
                {file?.name || 'Processing Document'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">{statusMessage}</p>
            </div>

            {/* Clean Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Pipeline Execution</span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300 tabular-nums">{taskProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-slate-900 dark:bg-slate-100 rounded-full"
                  initial={{ width: '5%' }}
                  animate={{ width: `${taskProgress}%` }}
                  transition={{ ease: 'easeOut', duration: 0.4 }}
                />
              </div>
            </div>

            {/* Pipeline Stage Indicators */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {STAGES.map((s, idx) => {
                const StageIcon = s.icon;
                const isPast = taskProgress >= s.defaultPct;
                const isCurrent = currentStep === s.key || (taskProgress >= s.defaultPct - 15 && taskProgress < s.defaultPct + 15);

                return (
                  <div
                    key={idx}
                    className={cn(
                      'p-2.5 rounded-lg border text-center transition-colors',
                      isPast
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                        : isCurrent
                        ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                        : 'bg-transparent border-slate-200/60 dark:border-slate-800/60 text-slate-400'
                    )}
                  >
                    <StageIcon className="w-4 h-4 mx-auto mb-1 shrink-0" />
                    <p className="text-[11px] font-medium leading-tight">{s.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Streaming Status Indicator */}
            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-400">
              <span className="flex items-center gap-1.5 text-[11px]">
                <Clock className="w-3.5 h-3.5" />
                <span>Estimated duration: 5-15s</span>
              </span>
              {isWsActive ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>WebSocket Active</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span>Direct Stream</span>
                </span>
              )}
            </div>
          </motion.div>
        ) : (
          /* Normal Upload Form with Clean Drag-and-Drop Zone */
          <motion.div
            key="upload-form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-5 space-y-5"
          >
            {/* Clean Drag-and-Drop Zone */}
            <div id="tour-upload-box">
              <div
                {...getRootProps()}
                className={cn(
                  'border border-dashed rounded-xl p-8 sm:p-10 text-center transition-colors cursor-pointer relative select-none',
                  isDragActive
                    ? 'border-slate-900 bg-slate-100/60 dark:border-slate-300 dark:bg-slate-800/50'
                    : file
                    ? 'border-emerald-300 bg-emerald-50/20 dark:border-emerald-800 dark:bg-emerald-950/10'
                    : 'border-slate-300 bg-slate-50/40 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/30 dark:hover:bg-slate-900/60'
                )}
              >
                <input {...getInputProps()} />

                {file ? (
                  <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 max-w-md mx-auto">
                    <div className="flex items-center gap-3 text-left truncate">
                      <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md shrink-0">
                        <FileCheck2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{file.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5 tabular-nums">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition ml-2"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-2">
                    <div className="w-12 h-12 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center mb-3 shadow-2xs">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {isDragActive ? 'Release to upload document' : 'Drag & drop your document here, or browse files'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                      PDF, DOCX, TXT, and source code files up to 10 MB
                    </p>
                    <div className="flex items-center gap-1.5 mt-3 text-[10px] font-mono text-slate-400">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">PDF</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">DOCX</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">TXT</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">CODE</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Audit Configuration Options */}
            <div className="space-y-3.5 pt-1">
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/90 dark:border-slate-800 rounded-lg bg-white dark:bg-[#0d121f]">
                {/* 1. Web search */}
                <label className="flex items-start gap-3 p-3 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={enableWeb}
                    onChange={(e) => setEnableWeb(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-slate-900 rounded border-slate-300"
                  />
                  <div className="flex-1">
                    <span className="block font-medium text-slate-800 dark:text-slate-200">Live Web & Scholar Cross-Referencing</span>
                    <span className="text-[11px] text-slate-400 font-normal">Cross-references open web pages and indexed scholarly databases</span>
                  </div>
                </label>

                {/* 2. ESL Student Bias Shield */}
                <label className="flex items-start gap-3 p-3 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={eslMode}
                    onChange={(e) => setEslMode(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-slate-900 rounded border-slate-300"
                  />
                  <div className="flex-1">
                    <span className="block font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-slate-500" />
                      ESL Student Bias Shield
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">Suppresses false-positive flags on non-native English writing patterns</span>
                  </div>
                </label>

                {/* 3. Auto-Index to Comparison Repository */}
                <label className={`flex items-start gap-3 p-3 text-xs select-none ${
                  ephemeralMode ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                }`}>
                  <input
                    type="checkbox"
                    checked={!ephemeralMode && autoIndex}
                    disabled={ephemeralMode}
                    onChange={(e) => setAutoIndex(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-slate-900 rounded border-slate-300"
                  />
                  <div className="flex-1">
                    <span className="block font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-slate-500" />
                      Auto-Index to Comparison Repository
                      <span className="px-1.5 py-0.2 rounded font-mono text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        Peer Match
                      </span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      {ephemeralMode 
                        ? 'Disabled: Zero-Knowledge Ephemeral Mode guarantees no repository indexing.'
                        : 'Stores anonymous fingerprints in the institutional database to detect student-to-student sharing.'}
                    </span>
                  </div>
                </label>

                {/* 4. Zero-Knowledge / Ephemeral Mode */}
                <label className="flex items-start gap-3 p-3 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={ephemeralMode}
                    onChange={(e) => setEphemeralMode(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-slate-900 rounded border-slate-300"
                  />
                  <div className="flex-1">
                    <span className="block font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                      Zero-Knowledge Ephemeral Mode
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      In-memory processing only. Document content is deleted immediately after the audit report is generated.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>4 Global Academic Sources Connected</span>
                </div>

                <Button
                  size="default"
                  disabled={!file}
                  onClick={handleUploadAndScan}
                  className="w-full sm:w-auto px-6 font-semibold"
                >
                  <span>Run Originality Audit</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-2" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
