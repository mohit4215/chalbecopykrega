import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

const SAMPLE_PAPER = `Title: Modern Natural Language Processing Paradigms

1. Introduction to Deep Neural Networks
Deep learning is a subset of machine learning, which is essentially a neural network with three or more layers. These neural networks attempt to simulate the behavior of the human brain, allowing it to learn from large amounts of data. While a single-layer neural network can still make approximate predictions, additional hidden layers can help optimize accuracy.

2. The Evolution of Attention
Convolutional neural networks are commonly used for image classification, while transformers have revolutionized natural language processing. Attention Is All You Need introduced the Transformer architecture based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.

3. Student's Own Original Synthesis
In our empirical investigation across small language model fine-tuning, we discovered that quantization reduces GPU VRAM consumption by 68% with negligible degradation in perplexity. Our custom low-rank adaptation matrix demonstrated stable convergence on a single consumer RTX 4090 GPU over 14 epochs.

4. Quoted Remarks
According to Alan Turing, "A computer would deserve to be called intelligent if it could deceive a human into believing that it was human."

References
1. Vaswani et al., 2017. Attention is all you need.
2. LeCun et al., 2015. Deep learning nature survey.`;

export default function FileUpload({ onScanComplete, isLoading, setIsLoading }) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'paste'
  const [file, setFile] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [excludeQuotes, setExcludeQuotes] = useState(false);
  const [excludeBib, setExcludeBib] = useState(true);
  const [enableWeb, setEnableWeb] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!docTitle) {
        setDocTitle(selected.name.replace(/\.[^/.]+$/, ""));
      }
      setErrorMsg('');
    }
  };

  const handleLoadSample = () => {
    setActiveTab('paste');
    setTextInput(SAMPLE_PAPER);
    setDocTitle('Sample Research Paper: Deep Learning & Attention');
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (activeTab === 'upload' && !file) {
      setErrorMsg('Please select a PDF, DOCX, or TXT file to upload.');
      return;
    }
    if (activeTab === 'paste' && (!textInput || textInput.trim().length < 30)) {
      setErrorMsg('Please paste at least 30 characters of text to scan.');
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      if (activeTab === 'upload' && file) {
        formData.append('file', file);
      } else {
        formData.append('raw_text_input', textInput);
      }
      formData.append('title', docTitle || (file ? file.name : 'Untitled Submission'));
      formData.append('exclude_quotes', excludeQuotes ? 'true' : 'false');
      formData.append('exclude_bibliography', excludeBib ? 'true' : 'false');
      formData.append('enable_web_search', enableWeb ? 'true' : 'false');

      const rawApi = (import.meta.env.VITE_API_URL || 'https://chalbecopykrega-api.onrender.com').trim();
      const cleanBase = (rawApi.startsWith('http://') || rawApi.startsWith('https://'))
        ? rawApi.replace(/\/+$/, '')
        : `https://${rawApi}`.replace(/\/+$/, '');
      const apiEndpoint = `${cleanBase}/api/scan`;

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to scan document.');
      }

      const report = await response.json();
      onScanComplete(report);
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred during scanning. Ensure backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-3xl mx-auto">
      {/* Header and Sample CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Scan Document for Originality</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare against academic vector database, peer papers, and live internet sources.
          </p>
        </div>
        <button
          type="button"
          onClick={handleLoadSample}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Load Demo Plagiarized Paper
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mt-6 mb-4 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`pb-3 text-sm font-semibold transition border-b-2 ${
            activeTab === 'upload'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Upload Document (PDF, DOCX, TXT)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('paste')}
          className={`pb-3 text-sm font-semibold transition border-b-2 ${
            activeTab === 'paste'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Paste Plain Text
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Document Title */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            Assignment / Document Title
          </label>
          <input
            type="text"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            placeholder="e.g., Final Thesis - Modern NLP Architectures"
            className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>

        {/* Tab 1: File Dropzone */}
        {activeTab === 'upload' && (
          <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer relative">
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                <Upload className="w-6 h-6" />
              </div>
              {file ? (
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>{file.name}</span>
                  <span className="text-xs text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-700">
                    Click to browse or drag & drop your document
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports PDF, Microsoft Word (.docx), and plain text (.txt)
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Textarea */}
        {activeTab === 'paste' && (
          <div>
            <textarea
              rows={8}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste submission text directly here to scan for originality..."
              className="w-full p-4 text-sm font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent leading-relaxed"
            />
            <div className="text-right text-xs text-slate-400 mt-1">
              {textInput.length} characters • {textInput.trim() ? textInput.trim().split(/\s+/).length : 0} words
            </div>
          </div>
        )}

        {/* Turnitin Filtering Options */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Turnitin Filter & Search Preferences
          </span>
          <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={excludeBib}
              onChange={(e) => setExcludeBib(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Exclude Bibliography / References Section</span>
          </label>
          <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={excludeQuotes}
              onChange={(e) => setExcludeQuotes(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Exclude Direct Quoted Passages (&quot;...&quot;)</span>
          </label>
          <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={enableWeb}
              onChange={(e) => setEnableWeb(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Enable Live Web Cross-Referencing (Bing / SERP API)</span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2 text-sm"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Analyzing Document across NLP Pipeline...</span>
            </>
          ) : (
            <span>Run Multi-Stage Plagiarism Check</span>
          )}
        </button>
      </form>
    </div>
  );
}
