import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../context/AuthContext';
import telemetry from '../services/telemetry';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  FileCheck2, 
  Loader2,
  ArrowRight,
  Shield,
  Code2,
  Globe,
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
  const [statusMessage, setStatusMessage] = useState('Submitting document to originality analysis engine...');
  const [isWsActive, setIsWsActive] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const pollIntervalRef = useRef(null);
  const wsRef = useRef(null);

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

  const handleSuccessReveal = (reportData) => {
    setScanResult(reportData);
    setTaskProgress(100);
    setStatusMessage('Audit complete! Opening report...');

    setTimeout(() => {
      onScanComplete(reportData);
      setIsLoading(false);
      setScanResult(null);
    }, 1200);
  };

  const startTaskWebSocket = (taskId) => {
    setActiveTaskId(taskId);
    setIsWsActive(true);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let host = window.location.host;
    if (window.location.hostname.includes('render.com')) {
      host = 'chalbecopykrega-api.onrender.com';
    } else if (window.location.port === '5173') {
      host = `${window.location.hostname}:8000`;
    }

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

  const handleUploadAndScan = async () => {
    if (!file) {
      setErrorMessage('Please select or drop a document to scan.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setTaskProgress(5);

    if (!token) {
      try {
        setStatusMessage('Starting scan session...');
        await loginAsDemo();
      } catch (authErr) {
        setIsLoading(false);
        if (onNeedLogin) {
          onNeedLogin();
        } else {
          setErrorMessage('Please sign in to scan documents.');
        }
        return;
      }
    }

    setTaskProgress(15);
    setStatusMessage('Uploading document for originality analysis...');

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
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8 max-w-2xl mx-auto transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-6 border-b border-slate-100 dark:border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Originality Audit
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md leading-relaxed">
            Upload your paper, essay, or code to check for similarity across web sources, academic publications, and student repositories.
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
        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span>Free demo session includes <strong>25 scan credits</strong>.</span>
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
        <div className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {scanResult ? (
        /* Scan Success State */
        <div className="py-12 text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800 shadow-xs">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Audit Completed</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Originality Rating: <strong className="text-slate-900 dark:text-slate-100 font-semibold">{Math.round(scanResult.originality_score ?? 100)}% Original</strong>
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs text-slate-400 font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
            <span>Opening detailed report...</span>
          </div>
        </div>
      ) : isLoading ? (
        /* Clean Academic Progress Stepper */
        <div className="py-6 space-y-5">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-700/80 text-xs">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-semibold text-slate-900 dark:text-white">Pipeline Execution</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-600 dark:text-slate-400 truncate max-w-xs">{file?.name || 'Document'}</span>
                <span className="text-slate-400 font-mono text-[11px]">({currentStep})</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{taskProgress}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-900 dark:bg-white rounded-full transition-all duration-300 ease-out"
                style={{ width: `${taskProgress}%` }}
              />
            </div>

            {/* Stages Checklist */}
            <div className="space-y-2.5 pt-1 text-xs">
              {/* Step 1: Text extraction */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {taskProgress >= 25 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    </div>
                  )}
                  <span className={taskProgress >= 25 ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-500 dark:text-slate-400'}>
                    Extracting text & OCR
                  </span>
                </span>
                <span className="text-[11px] text-slate-400">{taskProgress >= 25 ? 'Completed' : 'Extracting structure...'}</span>
              </div>

              {/* Step 2: Vectorizing & DB search */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {taskProgress >= 55 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : taskProgress >= 25 ? (
                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-200 dark:border-slate-700 shrink-0" />
                  )}
                  <span className={taskProgress >= 55 ? 'text-slate-900 dark:text-slate-100 font-medium' : taskProgress >= 25 ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}>
                    Vectorizing & DB search
                  </span>
                </span>
                <span className="text-[11px] text-slate-400">{taskProgress >= 55 ? 'Completed' : taskProgress >= 25 ? 'Matching corpus...' : 'Pending'}</span>
              </div>

              {/* Step 3: Web & Academic query */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {taskProgress >= 75 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : taskProgress >= 55 ? (
                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-200 dark:border-slate-700 shrink-0" />
                  )}
                  <span className={taskProgress >= 75 ? 'text-slate-900 dark:text-slate-100 font-medium' : taskProgress >= 55 ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}>
                    Searching Web & Academic Sources
                  </span>
                </span>
                <span className="text-[11px] text-slate-400">{taskProgress >= 75 ? 'Completed' : taskProgress >= 55 ? 'Querying OpenAlex & arXiv...' : 'Pending'}</span>
              </div>

              {/* Step 4: Scoring */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {taskProgress >= 90 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : taskProgress >= 75 ? (
                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-200 dark:border-slate-700 shrink-0" />
                  )}
                  <span className={taskProgress >= 90 ? 'text-slate-900 dark:text-slate-100 font-medium' : taskProgress >= 75 ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}>
                    Similarity & NLP scoring
                  </span>
                </span>
                <span className="text-[11px] text-slate-400">{taskProgress >= 90 ? 'Completed' : taskProgress >= 75 ? 'Analyzing overlap...' : 'Pending'}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-500 flex items-center justify-between">
              <span>{statusMessage}</span>
              <span className="text-slate-400">{isWsActive ? 'Live updates' : 'Processing'}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Normal Upload Form */
        <div className="mt-6 space-y-5">
          {/* Dropzone Card */}
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 sm:p-10 text-center transition-all cursor-pointer relative select-none',
              isDragActive
                ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20'
                : file
                ? 'border-emerald-400 bg-emerald-50/20 dark:border-emerald-800 dark:bg-emerald-950/10'
                : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 hover:bg-slate-100/60 dark:bg-slate-800/30 dark:hover:bg-slate-800/60 hover:border-slate-400'
            )}
          >
            <input {...getInputProps()} />

            {file ? (
              <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 max-w-md mx-auto shadow-xs">
                <div className="flex items-center gap-3 text-left truncate">
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-lg shrink-0">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{file.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition ml-2"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-2">
                <div className="w-12 h-12 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center mb-3 shadow-xs">
                  <UploadCloud className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isDragActive
                    ? 'Drop your document here'
                    : 'Drag & drop your document here, or browse files'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Supports PDF, Word (.docx), Plain text (.txt), and Source code up to 10 MB
                </p>
                <div className="flex items-center gap-1.5 mt-4 text-[10px] text-slate-500">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">PDF</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">DOCX</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">TXT</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">PYTHON / JS / JAVA</span>
                </div>
              </div>
            )}
          </div>

          {/* Scan Options */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 text-xs">
            {/* 1. Web search */}
            <label className="flex items-start gap-3 p-3.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enableWeb}
                onChange={(e) => setEnableWeb(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-slate-900 rounded border-slate-300"
              />
              <div className="flex-1">
                <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  Check Web & Scholarly Databases
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Cross-reference against open web sources, OpenAlex, and preprint archives
                </span>
              </div>
            </label>

            {/* 2. ESL Student Bias Shield */}
            <label className="flex items-start gap-3 p-3.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={eslMode}
                onChange={(e) => setEslMode(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-slate-900 rounded border-slate-300"
              />
              <div className="flex-1">
                <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  ESL Bias Protection
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Reduces false-positive AI flags for non-native English writing patterns
                </span>
              </div>
            </label>

            {/* 3. Auto-Index */}
            <label className={`flex items-start gap-3 p-3.5 select-none ${
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
                <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-slate-400" />
                  Add to Institutional Comparison Repository
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Allows future papers to detect peer collusion without publicly sharing full text
                </span>
              </div>
            </label>

            {/* 4. Zero-Retention Ephemeral Mode */}
            <label className="flex items-start gap-3 p-3.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={ephemeralMode}
                onChange={(e) => setEphemeralMode(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-slate-900 rounded border-slate-300"
              />
              <div className="flex-1">
                <span className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  Private Scan (Zero Retention)
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Evaluated in-memory only; text and hashes are not saved in the repository
                </span>
              </div>
            </label>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Academic databases connected</span>
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
      )}
    </div>
  );
}
