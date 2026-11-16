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
  Loader2,
  ArrowRight,
  Shield,
  Code2,
  Database,
  Lock
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
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xs border border-zinc-200 dark:border-zinc-800 p-6 sm:p-7 max-w-2xl mx-auto transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-5 border-b border-zinc-100 dark:border-zinc-800 gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-mono">
            Document Ingestion & Analysis
          </span>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 tracking-tight">
            Originality Audit
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md leading-relaxed">
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
              <FileText className="w-3.5 h-3.5 mr-1.5 text-zinc-500" />
              <span>Load Demo Paper</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleUseSampleCode}
              className="text-xs font-medium"
            >
              <Code2 className="w-3.5 h-3.5 mr-1.5 text-zinc-500" />
              <span>Sample Code</span>
            </Button>
          </div>
        )}
      </div>

      {!token && !isLoading && (
        <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
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
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Audit Completed</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 tabular-nums">
                Originality rating: <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{Math.round(scanResult.originality_score ?? 100)}% Original</strong>
              </p>
            </div>

            <div className="inline-flex items-center gap-2 text-xs text-zinc-400 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Loading detailed report viewer...</span>
            </div>
          </motion.div>
        ) : isLoading ? (
          /* Live Stepper UI (Linear / Terminal Checklist Standard) */
          <motion.div
            key="loading-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="py-5 space-y-4"
          >
            {/* Terminal-style Checklist Card */}
            <div className="bg-zinc-950 dark:bg-black rounded-lg border border-zinc-800 p-4 font-mono text-xs text-zinc-300 space-y-3 shadow-sm">
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800 text-[11px] text-zinc-400">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-zinc-200 font-semibold">Pipeline Execution</span>
                  <span className="text-zinc-500">•</span>
                  <span className="text-zinc-400 truncate max-w-xs">{file?.name || 'Document'}</span>
                  <span className="text-zinc-600 dark:text-zinc-500 font-mono text-[10px]">[{currentStep}]</span>
                </span>
                <span className="tabular-nums font-bold text-emerald-400">{taskProgress}%</span>
              </div>

              {/* Terminal Checklist Items */}
              <div className="space-y-2 pt-1 font-mono text-xs leading-relaxed">
                {/* Step 1: Text extraction */}
                <div className="flex items-center gap-2">
                  {taskProgress >= 25 ? (
                    <span className="text-emerald-400 font-bold">[✓]</span>
                  ) : (
                    <span className="text-indigo-400 font-bold animate-cursor-blink">[ ]</span>
                  )}
                  <span className={taskProgress >= 25 ? 'text-zinc-200' : 'text-zinc-400'}>
                    Extracting text & OCR & Code AST...
                  </span>
                  {taskProgress < 25 && (
                    <span className="inline-block w-1.5 h-3.5 bg-emerald-400 animate-cursor-blink ml-1"></span>
                  )}
                </div>

                {/* Step 2: SWA Winnowing */}
                <div className="flex items-center gap-2">
                  {taskProgress >= 55 ? (
                    <span className="text-emerald-400 font-bold">[✓]</span>
                  ) : taskProgress >= 25 ? (
                    <span className="text-indigo-400 font-bold animate-cursor-blink">[ ]</span>
                  ) : (
                    <span className="text-zinc-600 font-bold">[ ]</span>
                  )}
                  <span className={taskProgress >= 55 ? 'text-zinc-200' : taskProgress >= 25 ? 'text-zinc-300' : 'text-zinc-600'}>
                    Vectorizing & DB search: SWA Winnowing & Hash Clustering...
                  </span>
                  {taskProgress >= 25 && taskProgress < 55 && (
                    <span className="inline-block w-1.5 h-3.5 bg-emerald-400 animate-cursor-blink ml-1"></span>
                  )}
                </div>

                {/* Step 3: Web & Academic query */}
                <div className="flex items-center gap-2">
                  {taskProgress >= 75 ? (
                    <span className="text-emerald-400 font-bold">[✓]</span>
                  ) : taskProgress >= 55 ? (
                    <span className="text-indigo-400 font-bold animate-cursor-blink">[ ]</span>
                  ) : (
                    <span className="text-zinc-600 font-bold">[ ]</span>
                  )}
                  <span className={taskProgress >= 75 ? 'text-zinc-200' : taskProgress >= 55 ? 'text-zinc-300' : 'text-zinc-600'}>
                    Searching web & cross-referencing OpenAlex, arXiv & DOIs (600M+ works)...
                  </span>
                  {taskProgress >= 55 && taskProgress < 75 && (
                    <span className="inline-block w-1.5 h-3.5 bg-emerald-400 animate-cursor-blink ml-1"></span>
                  )}
                </div>

                {/* Step 4: Scoring */}
                <div className="flex items-center gap-2">
                  {taskProgress >= 90 ? (
                    <span className="text-emerald-400 font-bold">[✓]</span>
                  ) : taskProgress >= 75 ? (
                    <span className="text-indigo-400 font-bold animate-cursor-blink">[ ]</span>
                  ) : (
                    <span className="text-zinc-600 font-bold">[ ]</span>
                  )}
                  <span className={taskProgress >= 90 ? 'text-zinc-200' : taskProgress >= 75 ? 'text-zinc-300' : 'text-zinc-600'}>
                    Similarity & NLP scoring and disjoint interval merging...
                  </span>
                  {taskProgress >= 75 && taskProgress < 90 && (
                    <span className="inline-block w-1.5 h-3.5 bg-emerald-400 animate-cursor-blink ml-1"></span>
                  )}
                </div>
              </div>

              {/* Terminal status line */}
              <div className="pt-2 border-t border-zinc-900 text-[11px] text-zinc-500 flex items-center justify-between">
                <span>{statusMessage}</span>
                {isWsActive ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>WebSocket Live</span>
                  </span>
                ) : (
                  <span>Direct Stream</span>
                )}
              </div>
            </div>

            {/* Stepper Progress Bar */}
            <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full"
                initial={{ width: '5%' }}
                animate={{ width: `${taskProgress}%` }}
                transition={{ ease: 'easeOut', duration: 0.4 }}
              />
            </div>
          </motion.div>
        ) : (
          /* Normal Upload Form with Massive Dashed Dropzone */
          <motion.div
            key="upload-form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-5 space-y-4"
          >
            {/* Massive Dashed Drag-and-Drop Zone */}
            <div id="tour-upload-box">
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-9 sm:p-12 text-center transition-all cursor-pointer relative select-none',
                  isDragActive
                    ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 ring-4 ring-indigo-500/10'
                    : file
                    ? 'border-emerald-400 bg-emerald-50/20 dark:border-emerald-800 dark:bg-emerald-950/10'
                    : 'border-zinc-300 bg-zinc-50/50 hover:bg-zinc-100/60 dark:border-zinc-700 dark:bg-zinc-900/40 dark:hover:bg-zinc-900/80 hover:border-zinc-400 dark:hover:border-zinc-600'
                )}
              >
                <input {...getInputProps()} />

                {file ? (
                  <div className="flex items-center justify-between bg-white dark:bg-zinc-800 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 max-w-md mx-auto shadow-2xs">
                    <div className="flex items-center gap-3 text-left truncate">
                      <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-md shrink-0">
                        <FileCheck2 className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{file.name}</p>
                        <p className="text-[11px] text-zinc-400 font-mono mt-0.5 tabular-nums">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition ml-2"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-3">
                    <div className="w-12 h-12 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg flex items-center justify-center mb-3 shadow-2xs">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {isDragActive
                        ? 'Release to upload document'
                        : 'Drag and drop your manuscript, PDF, or code archive.'}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Drag & drop your document here, or browse files (PDF, DOCX, TXT, Source Code up to 10 MB)
                    </p>
                    <div className="flex items-center gap-1.5 mt-4 text-[10px] font-mono text-zinc-500">
                      <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">PDF</span>
                      <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">DOCX</span>
                      <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">TXT</span>
                      <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">PY / JS / C++ / JAVA</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Distinct Physical-looking Toggle Switch: Zero-Knowledge Ephemeral Mode */}
            <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <div className={`p-1.5 rounded-md mt-0.5 ${
                  ephemeralMode
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                    : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Zero-Knowledge Ephemeral Mode
                    </span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-medium ${
                      ephemeralMode
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                        : 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700'
                    }`}>
                      {ephemeralMode ? 'Zero-Retention Active' : 'Off'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                    Evaluated in-memory only. Document text and hashes are permanently discarded post-audit; never indexed or retained.
                  </p>
                </div>
              </div>

              {/* Physical Sliding Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={ephemeralMode}
                onClick={() => setEphemeralMode(!ephemeralMode)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  ephemeralMode ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
                title="Toggle Zero-Knowledge Ephemeral Mode"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    ephemeralMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Audit Options Panel */}
            <div className="space-y-3 pt-1">
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200/90 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900">
                {/* 1. Web search */}
                <label className="flex items-start gap-3 p-3 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={enableWeb}
                    onChange={(e) => setEnableWeb(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-zinc-900 rounded border-zinc-300"
                  />
                  <div className="flex-1">
                    <span className="block font-medium text-zinc-800 dark:text-zinc-200">Live Web & Scholar Cross-Referencing</span>
                    <span className="text-[11px] text-zinc-500 font-normal">Cross-references open web pages and indexed scholarly databases</span>
                  </div>
                </label>

                {/* 2. ESL Student Bias Shield */}
                <label className="flex items-start gap-3 p-3 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={eslMode}
                    onChange={(e) => setEslMode(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-zinc-900 rounded border-zinc-300"
                  />
                  <div className="flex-1">
                    <span className="block font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-zinc-500" />
                      ESL Student Bias Shield
                    </span>
                    <span className="text-[11px] text-zinc-500 font-normal">Suppresses false-positive flags on non-native English writing patterns</span>
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
                    className="w-4 h-4 mt-0.5 accent-zinc-900 rounded border-zinc-300"
                  />
                  <div className="flex-1">
                    <span className="block font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-zinc-500" />
                      Auto-Index to Comparison Repository
                      <span className="px-1.5 py-0.2 rounded font-mono text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                        Peer Match
                      </span>
                    </span>
                    <span className="text-[11px] text-zinc-500 font-normal">
                      {ephemeralMode 
                        ? 'Disabled: Zero-Knowledge Ephemeral Mode guarantees no repository indexing.'
                        : 'Stores anonymous fingerprints in the institutional database to detect student-to-student sharing.'}
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
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
