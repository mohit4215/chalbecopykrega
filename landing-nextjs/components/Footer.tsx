'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, Cookie } from 'lucide-react';

export default function Footer() {
  const handleOpenCookieSettings = () => {
    localStorage.removeItem('poach_cookie_consent_v1');
    window.location.reload();
  };

  return (
    <footer className="bg-slate-900 text-slate-400 py-16 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-slate-800">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-white tracking-tight">Poach</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Turnitin-grade originality and plagiarism verification designed for researchers, 
              universities, and student authors. Powered by neural ONNX vector embeddings and real-time web indexing.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#how-it-works" className="hover:text-white transition">How It Works</a></li>
              <li><a href="#pricing" className="hover:text-white transition">Pricing & Plans</a></li>
              <li><Link href="/app" className="hover:text-white transition">Document Scanner</Link></li>
              <li><a href="https://github.com/mohit4215/chalbecopykrega" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">GitHub Repository</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Privacy & Legal</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition">Terms of Service</Link></li>
              <li><Link href="/gdpr" className="hover:text-white transition">GDPR Compliance</Link></li>
              <li>
                <button
                  type="button"
                  onClick={handleOpenCookieSettings}
                  className="hover:text-white transition flex items-center gap-1 text-left"
                >
                  <Cookie className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Cookie Preferences</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} Poach Technologies. All rights reserved.</p>
          <p className="flex items-center gap-2">
            <span>Encrypted with 256-bit SSL</span>
            <span>•</span>
            <span>Zero Student Paper Retention</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
