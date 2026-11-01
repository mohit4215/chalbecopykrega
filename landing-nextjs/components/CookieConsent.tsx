'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cookie, Settings, X, Check, Lock } from 'lucide-react';

export interface ConsentPreferences {
  necessary: boolean; // Always true
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: string;
}

const STORAGE_KEY = 'poach_cookie_consent_v1';
const CURRENT_POLICY_VERSION = '1.0.0';

export default function CookieConsent() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);
  const [marketingAllowed, setMarketingAllowed] = useState(false);

  useEffect(() => {
    // Check if consent has already been granted
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Delay showing banner slightly for smooth UX
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    } else {
      try {
        const parsed: ConsentPreferences = JSON.parse(stored);
        if (parsed.version !== CURRENT_POLICY_VERSION) {
          // Policy updated: re-request consent
          setIsOpen(true);
        } else {
          // Re-apply existing preferences
          dispatchConsentEvent(parsed);
        }
      } catch {
        setIsOpen(true);
      }
    }
  }, []);

  const dispatchConsentEvent = (prefs: ConsentPreferences) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('poach_cookie_consent_updated', {
          detail: prefs,
        })
      );
    }
  };

  const saveConsent = (analytics: boolean, marketing: boolean) => {
    const preferences: ConsentPreferences = {
      necessary: true,
      analytics,
      marketing,
      timestamp: new Date().toISOString(),
      version: CURRENT_POLICY_VERSION,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    dispatchConsentEvent(preferences);
    setIsOpen(false);
    setShowPreferences(false);
  };

  const handleAcceptAll = () => {
    saveConsent(true, true);
  };

  const handleRejectNonEssential = () => {
    saveConsent(false, false);
  };

  const handleSavePreferences = () => {
    saveConsent(analyticsAllowed, marketingAllowed);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6 transition-all duration-300">
      <div className="max-w-4xl mx-auto bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8">
        {!showPreferences ? (
          /* Main Consent Banner */
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 shrink-0">
                <Cookie className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">We Respect Your Privacy</h3>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-full">
                    GDPR & ePrivacy
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  Poach uses strictly necessary cookies to keep you signed in and authenticate API requests.
                  We block all non-essential analytics and marketing trackers by default until you grant explicit consent.
                  Read our{' '}
                  <a href="/privacy" className="underline hover:text-indigo-400 transition">
                    Privacy Policy
                  </a>.
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto shrink-0">
              <button
                type="button"
                onClick={() => setShowPreferences(true)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 rounded-xl border border-slate-700 transition flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                Customize
              </button>
              <button
                type="button"
                onClick={handleRejectNonEssential}
                className="px-4 py-2 text-xs font-bold text-slate-200 bg-slate-800/80 hover:bg-slate-700 rounded-xl border border-slate-600 transition"
              >
                Reject Non-Essential
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition"
              >
                Accept All
              </button>
            </div>
          </div>
        ) : (
          /* Granular Preferences Drawer */
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Manage Cookie & Tracker Preferences</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPreferences(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Category 1: Strictly Necessary */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Strictly Necessary</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    Always Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Required for core authentication, CSRF defense, and document processing queues. Cannot be disabled.
                </p>
              </div>

              {/* Category 2: Performance & Analytics */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Analytics & Performance</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={analyticsAllowed}
                      onChange={(e) => setAnalyticsAllowed(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Helps us understand scan speed, OCR failure rates, and load bottlenecks anonymously.
                </p>
              </div>

              {/* Category 3: Marketing & Retargeting */}
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Marketing & Attribution</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marketingAllowed}
                      onChange={(e) => setMarketingAllowed(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Measures referral conversion from research publications and academic partner links.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPreferences(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePreferences}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Save My Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
