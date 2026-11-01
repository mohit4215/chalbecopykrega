'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  FileCheck2, 
  Zap, 
  Search, 
  CheckCircle2, 
  FileText 
} from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-tr from-indigo-100/60 via-purple-50/40 to-transparent blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          {/* Trust Badge / Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-xs font-semibold text-indigo-700 shadow-sm animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Next-Gen MLOps & Vector Semantic Engine</span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            <span className="text-slate-500 font-normal">v2.4 Live</span>
          </div>

          {/* Main High-Converting Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12]">
            Originality Verification{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 bg-clip-text text-transparent">
              Without the Bloat.
            </span>
          </h1>

          {/* Subheadline with high clarity and benefit focus */}
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
            Audit academic research papers, student essays, and scanned PDFs against billions of web pages 
            and private repositories. Get instant sentence-level match analysis with strict zero data retention.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <Link
              href="/app"
              className="w-full sm:w-auto px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/25 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              <span>Scan Document Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl border border-slate-200 transition shadow-sm flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Explore How It Works</span>
            </a>
          </div>

          {/* Social Proof & Guarantees */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              No credit card required
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              3 Free scans on sign-up
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Zero paper database selling
            </span>
          </div>
        </div>

        {/* Product Visual Mockup / Floating Card */}
        <div className="mt-14 max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-6 sm:p-8 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <FileCheck2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Survey_on_Attention_Mechanisms.pdf
                  </h2>
                  <p className="text-xs text-slate-400">Processed in 2.1s • 1,480 words • 18 chunks</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                  98.2% Original
                </span>
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-semibold">
                  Zero Exact Plagiarism
                </span>
              </div>
            </div>

            {/* Mocked Sentence Highlight Viewer */}
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs sm:text-sm text-slate-700 leading-relaxed font-serif">
                <p>
                  "Deep learning is a subset of machine learning, which is essentially a neural network with three or more layers.{' '}
                  <span className="bg-amber-100 text-amber-900 border-b-2 border-amber-400 px-1 py-0.5 rounded">
                    Attention Is All You Need introduced the Transformer architecture based solely on attention mechanisms,
                    dispensing with recurrence and convolutions entirely.
                  </span>{' '}
                  In our 14-epoch experimental study using 4-bit quantized Low-Rank Adaptation (LoRA), we achieved a 68% reduction
                  in GPU VRAM consumption while preserving validation perplexity within 0.04 of the full-precision baseline."
                </p>
              </div>

              {/* Matched Source Inspector Pill */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-amber-900 font-medium">
                  <Search className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Matched Source: <strong>arXiv:1706.03762 (Vaswani et al., 2017)</strong></span>
                </div>
                <span className="px-2 py-0.5 bg-amber-200/60 text-amber-800 font-bold rounded text-[11px]">
                  94% Semantic Similarity
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 text-center border-t border-slate-200/60 pt-10">
          <div>
            <div className="text-3xl font-black text-slate-900">99.8%</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Classification Precision</div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">&lt; 3.0s</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Average Audit Latency</div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">10B+</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Web Pages & Papers Indexed</div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">0%</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Student Data Retention</div>
          </div>
        </div>
      </div>
    </section>
  );
}
