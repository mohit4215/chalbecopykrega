import React, { useState, useCallback } from 'react';
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
  Cpu
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

export default function UploadComponent({ onScanComplete, isLoading, setIsLoading }) {
  const { authFetch } = useAuth();
  const [file, setFile] = useState(null);
  const [enableWeb, setEnableWeb] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadProgressMsg, setUploadProgressMsg] = useState('Processing Document...');

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setErrorMessage('');
    if (rejectedFiles && rejectedFiles.length > 0) {
      setErrorMessage('Please upload a valid PDF (.pdf), Word (.docx), or plain text (.txt) file.');
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
    multiple: false
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

  const handleUploadAndScan = async () => {
    if (!file) {
      setErrorMessage('Please select or drop a document to scan.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setUploadProgressMsg('Extracting text & applying OCR fallback if scanned...');

    const timer1 = setTimeout(() => {
      setUploadProgressMsg('Generating dense vector embeddings with SentenceTransformers...');
    }, 1800);

    const timer2 = setTimeout(() => {
      setUploadProgressMsg('Querying Qdrant Vector DB & live internet search APIs...');
    }, 3800);

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

      const reportData = await response.json();
      onScanComplete(reportData);
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred during scanning. Please ensure the backend is running.');
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 max-w-2xl mx-auto transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            Document Ingestion Pipeline
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            Check Plagiarism & Originality
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Accepts PDF (digital & scanned OCR), Word (.docx), and plain text (.txt).
          </p>
        </div>

        <button
          type="button"
          onClick={handleUseSampleDoc}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition border border-indigo-200 self-start sm:self-auto shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          Load Demo File
        </button>
      </div>

      {errorMessage && (
        <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

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
                Supports PDF (with automatic OCR for scanned pages), Word (.docx), and TXT files.
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
          <span>Cross-reference live web sources (SerpAPI / Bing Web Search)</span>
        </label>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
          Qdrant Active
        </span>
      </div>

      {/* Submit Button & Progress State */}
      <div className="mt-6">
        <button
          type="button"
          onClick={handleUploadAndScan}
          disabled={!file || isLoading}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center gap-2.5 text-sm"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{uploadProgressMsg}</span>
            </>
          ) : (
            <>
              <Cpu className="w-4 h-4" />
              <span>Scan Document for Plagiarism</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
