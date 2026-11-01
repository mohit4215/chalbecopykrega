import React from 'react';
import { 
  UploadCloud, 
  Cpu, 
  Globe2, 
  FileSpreadsheet, 
  Layers, 
  Search, 
  CheckCircle,
  FileText
} from 'lucide-react';

const STEPS = [
  {
    step: '01',
    title: 'Multi-Modal Ingestion & OCR',
    subtitle: 'Upload any PDF, Word doc, or scanned paper',
    description:
      'Upload digital PDFs, DOCX files, or scanned images. Our dual-engine pipeline applies PyMuPDF for digital text and Tesseract OCR for scanned pages, capturing clean tokens with character offsets intact.',
    icon: UploadCloud,
    badge: 'OCR & Digital PDF',
  },
  {
    step: '02',
    title: 'ONNX Vector Embedding',
    subtitle: 'Sub-millisecond dense semantic mapping',
    description:
      'Documents are segmented into sliding-window 60-word chunks with 20-word overlap. Optimized ONNX Runtime generates 384-dimensional unit vectors in process memory, querying Qdrant in <50ms.',
    icon: Cpu,
    badge: 'Neural ONNX',
  },
  {
    step: '03',
    title: 'Live Web Cross-Referencing',
    subtitle: 'Billions of live pages, journals, and preprints',
    description:
      'Unmatched passages are cross-referenced across billions of live internet web pages, arXiv publications, academic repositories, and Wikipedia using automated SerpAPI & Bing queries.',
    icon: Globe2,
    badge: 'Real-Time Web',
  },
  {
    step: '04',
    title: 'Originality Score & PDF Report',
    subtitle: 'Side-by-side match diff and accredited sources',
    description:
      'Our hybrid scoring engine merges N-gram Jaccard matching with cosine similarity matrices. Review color-coded sentence highlights, inspect matched URLs, and export certified PDF reports.',
    icon: FileSpreadsheet,
    badge: 'Instant Report',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-white border-y border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200/80">
            Intelligent Pipeline
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            How Poach Detects Originality in Seconds
          </h2>
          <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
            Our multi-stage verification pipeline blends computer vision OCR, optimized ONNX neural embeddings, 
            and real-time search indexing without storing your intellectual property.
          </p>
        </div>

        {/* 4-Step Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className="relative bg-slate-50/70 hover:bg-white rounded-3xl p-7 border border-slate-200/80 hover:border-indigo-300 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Step Number + Badge */}
                  <div className="flex items-center justify-between pb-6">
                    <span className="text-2xl font-black text-slate-300 group-hover:text-indigo-600 transition-colors">
                      {s.step}
                    </span>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                      {s.badge}
                    </span>
                  </div>

                  {/* Icon */}
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-200/70 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all mb-5">
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Content */}
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {s.title}
                  </h3>
                  <p className="text-xs font-semibold text-indigo-600/90 mt-0.5 mb-3">
                    {s.subtitle}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {s.description}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-200/60 flex items-center gap-1.5 text-[11px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Fully Automated</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
