import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../context/AuthContext';
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
  Loader2
} from 'lucide-react';

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
  { key: 'extracting', label: 'Text Extraction & OCR', icon: FileText, defaultPct: 20 },
  { key: 'vectorizing', label: 'Vector Embedding & DB', icon: Layers, defaultPct: 55 },
  { key: 'searching_web', label: 'Internet Cross-Referencing', icon: Search, defaultPct: 75 },
  { key: 'scoring', label: 'Similarity & NLP Scoring', icon: Cpu, defaultPct: 92 }
];

export default function UploadComponent({ onScanComplete, isLoading, setIsLoading }) {
  const { authFetch } = useAuth();
  const [file, setFile] = useState(null);
  const [enableWeb, setEnableWeb] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Asynchronous Task Polling State
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [taskProgress, setTaskProgress] = useState(5);
  const [currentStep, setCurrentStep] = useState('extracting');
  const [statusMessage, setStatusMessage] = useState('Submitting document to asynchronous task queue...');
  
  const pollIntervalRef = useRef(null);

  // Clear polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setErrorMessage('');
    if (rejectedFiles && rejectedFiles.length > 0) {
      setErrorMessage('Please upload a valid PDF (.pdf), Word (.docx), or plain text (.txt) file under 10 MB.');
      return;
    }
    if (acceptedFiles && acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt', '.md']
    },
    maxFiles: 1,
    multiple: false,
    maxSize: 10 * 1024 * 1024
  });

  const handleRemoveFile = (e) => {
    e.stopPropagation();
    setFile(null);
    setErrorMessage('');
  };

  const handleUseSampleDoc = async () => {
    const blob = new Blob([SAMPLE_DEMO_TEXT], { type: 'text/plain' });
    const sampleFile = new File([blob], 'NLP_Research_Sample_Paper.txt', { type: 'text/plain' });
    setFile(sampleFile);
    setErrorMessage('');
  };

  // Poll Celery task status endpoint every 3 seconds
  const startTaskPolling = (taskId) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    setActiveTaskId(taskId);
    setTaskProgress(15);
    setStatusMessage('Queued in distributed Celery worker pool...');

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await authFetch(`/api/task-status/${taskId}`);
        if (!res.ok) {
          throw new Error(`Polling status returned HTTP ${res.status}`);
        }
        const data = await res.json();

        if (data.status === 'processing' || data.status === 'pending') {
          setTaskProgress(data.progress || 50);
          if (data.step) setCurrentStep(data.step);
          if (data.message) setStatusMessage(data.message);
        } else if (data.status === 'success') {
          // Completed!
          clearInterval(pollIntervalRef.current);
          setTaskProgress(100);
          setStatusMessage('Analysis complete! Rendering originality report...');
          setTimeout(() => {
            setIsLoading(false);
            onScanComplete(data.report);
          }, 600);
        } else if (data.status === 'failure') {
          // Failed
          clearInterval(pollIntervalRef.current);
          setIsLoading(false);
          setErrorMessage(data.error || data.message || 'Background document scan failed.');
        }
      } catch (err) {
        // Tolerant network retry during polling
        console.warn('Task polling ping failed:', err);
      }
    }, 3000);
  };

  const handleUploadAndScan = async () => {
    if (!file) {
      setErrorMessage('Please select or drop a document to scan.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setTaskProgress(10);
    setStatusMessage('Uploading document and validating MIME signatures...');

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

      // Check if asynchronous task_id was returned
      if (resData.task_id) {
        startTaskPolling(resData.task_id);
      } else if (resData.report || resData.overall_score !== undefined) {
        // Direct synchronous response fallback
        onScanComplete(resData.report || resData);
        setIsLoading(false);
      } else {
        throw new Error('Unexpected server response format.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage(err.message || 'An error occurred during scanning. Please verify your connection.');
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 max-w-2xl mx-auto transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            Asynchronous Distributed Pipeline
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            Check Plagiarism & Originality
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Accepts PDF (digital & scanned OCR), Word (.docx), and plain text (.txt) up to 10 MB.
          </p>
        </div>

        {!isLoading && (
          <button
            type="button"
            onClick={handleUseSampleDoc}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition border border-indigo-200 self-start sm:self-auto shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Load Demo File
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Dynamic Asynchronous Loading Screen */}
      {isLoading ? (
        <div className="py-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h3 className="text-lg font-black text-slate-900">{file?.name || 'Processing Document'}</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">{statusMessage}</p>
          </div>

          {/* Animated Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-500">Pipeline Execution</span>
              <span className="text-indigo-600">{taskProgress}%</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${taskProgress}%` }}
              />
            </div>
          </div>

          {/* Pipeline Stages Stepper */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {STAGES.map((s, idx) => {
              const StageIcon = s.icon;
              const isPast = taskProgress >= s.defaultPct;
              const isCurrent = currentStep === s.key || (taskProgress >= s.defaultPct - 15 && taskProgress < s.defaultPct + 15);

              return (
                <div 
                  key={idx}
                  className={`p-3 rounded-2xl border text-center transition ${
                    isPast
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                      : isCurrent
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm'
                      : 'bg-slate-50 border-slate-200/60 text-slate-400 opacity-60'
                  }`}
                >
                  <StageIcon className={`w-5 h-5 mx-auto mb-1.5 ${
                    isPast ? 'text-emerald-600' : isCurrent ? 'text-indigo-600 animate-bounce' : 'text-slate-400'
                  }`} />
                  <p className="text-[11px] font-bold leading-tight">{s.label}</p>
                </div>
              );
            })}
          </div>

          <div className="text-center pt-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
              <Clock className="w-3 h-3" />
              <span>Celery Worker Job: <strong className="font-mono text-slate-600">{activeTaskId?.slice(0, 12)}...</strong></span>
            </span>
          </div>
        </div>
      ) : (
        /* Normal Upload Form */
        <>
          {/* Drag & Drop Area using React Dropzone */}
          <div className="mt-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer relative ${
                isDragActive
                  ? 'border-indigo-500 bg-indigo-50/60 scale-[1.01]'
                  : file
                  ? 'border-emerald-300 bg-emerald-50/30 hover:border-emerald-400'
                  : 'border-slate-300 bg-slate-50/60 hover:bg-slate-50 hover:border-indigo-400'
              }`}
            >
              <input {...getInputProps()} />

              {file ? (
                <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-emerald-200 shadow-sm max-w-md mx-auto">
                  <div className="flex items-center gap-3 text-left truncate">
                    <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                      <FileCheck2 className="w-6 h-6" />
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-bold text-slate-900 truncate">{file.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition ml-2"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                    <Upload className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">
                    {isDragActive ? 'Drop your document here...' : 'Drag & drop your document here, or browse'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Supports PDF (with automatic OCR for scanned pages), Word (.docx), and TXT files up to 10 MB.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="mt-5 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between">
            <label className="flex items-center gap-3 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={enableWeb}
                onChange={(e) => setEnableWeb(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <span>Cross-reference live web sources (SerpAPI / Bing Search)</span>
            </label>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
              Celery Worker Ready
            </span>
          </div>

          {/* Submit Button */}
          <div className="mt-6">
            <button
              type="button"
              onClick={handleUploadAndScan}
              disabled={!file}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center gap-2.5 text-sm"
            >
              <Cpu className="w-4 h-4" />
              <span>Submit Document for Asynchronous Analysis</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
