import React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import HowItWorks from '../components/HowItWorks';
import Pricing from '../components/Pricing';
import Footer from '../components/Footer';
import { 
  ShieldCheck, 
  FileCheck, 
  Search, 
  Cpu, 
  Lock, 
  Download, 
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

const FAQS = [
  {
    q: 'Does Poach save or store my uploaded documents in a public database?',
    a: 'Never. Unlike legacy checkers that feed student manuscripts into internal repositories for resale, Poach maintains a strict zero-retention policy. Your file is temporarily parsed in RAM, scanned, and immediately purged.',
  },
  {
    q: 'Can Poach scan scanned or low-quality photocopied PDFs?',
    a: 'Yes. Our ingestion pipeline includes automated OCR fallback powered by Tesseract and PyMuPDF. If a PDF contains image-only scans without raw digital text layers, OCR automatically extracts every word.',
  },
  {
    q: 'How does live web search work compared to internal database search?',
    a: 'Poach uses a hybrid architecture: it simultaneously queries local vector embeddings of reference literature (via Qdrant) and fires automated search API queries across Google, Bing, and arXiv for non-indexed web sources.',
  },
  {
    q: 'How do Stripe subscriptions and credit packs work?',
    a: 'You can choose between a Pro monthly subscription ($19/mo) for unlimited audits or buy pay-as-you-go credit packs ($9 for 25 scans, $29 for 100 scans) that never expire. All payments are securely processed by Stripe.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1">
        {/* 1. Hero Section */}
        <Hero />

        {/* 2. How It Works Grid */}
        <HowItWorks />

        {/* 3. Core Feature Highlights */}
        <section id="features" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                Engineered for Academic Rigor
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Everything You Need for Originality Audits
              </h2>
              <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
                Purpose-built for researchers, universities, and students who demand verified accuracy without compromising their intellectual privacy.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200/80 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <FileCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Dual-Engine OCR</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Automatically extracts text from digital PDFs, Word documents, and image-based scanned textbooks with full character-level offset tracking.
                </p>
              </div>

              <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200/80 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Cpu className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">ONNX Neural Embeddings</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Processes text using INT8 quantized SentenceTransformers with intra-op CPU vectorization, detecting synonym swaps and clever paraphrasing.
                </p>
              </div>

              <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200/80 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Zero Paper Retention</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  GDPR & FERPA compliant. Your research remains your exclusive property. Uploads are purged from worker memory immediately after reporting.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Pricing Component linked to Stripe */}
        <Pricing />

        {/* 5. FAQ Section */}
        <section id="faq" className="py-24 bg-white border-t border-slate-200/80">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-3 mb-16">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                Frequently Asked Questions
              </span>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Common Questions About Poach
              </h2>
            </div>

            <div className="space-y-6">
              {FAQS.map((faq, i) => (
                <div
                  key={i}
                  className="bg-slate-50 rounded-2xl p-6 border border-slate-200/80 space-y-2"
                >
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-start gap-2.5">
                    <HelpCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <span>{faq.q}</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed pl-7">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Final High-Converting CTA Banner */}
        <section className="py-20 bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 text-white relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Ready to verify originality with complete privacy?
            </h2>
            <p className="text-sm sm:text-base text-indigo-100 max-w-xl mx-auto font-normal">
              Join thousands of academic researchers, professors, and university students. Start your first document scan in seconds.
            </p>
            <div className="pt-2">
              <Link
                href="/app"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-indigo-700 font-extrabold text-sm rounded-xl shadow-xl hover:bg-indigo-50 transition transform hover:-translate-y-0.5"
              >
                <span>Audit Your First Document Free</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
