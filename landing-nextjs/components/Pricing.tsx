'use client';

import React, { useState } from 'react';
import { Check, Sparkles, Loader2, Zap, ArrowRight, ShieldCheck } from 'lucide-react';
import { redirectToStripeCheckout } from '../lib/stripe';

interface PlanCard {
  id: string;
  name: string;
  price: string;
  cadence: string;
  description: string;
  badge?: string;
  popular?: boolean;
  features: string[];
  ctaText: string;
  isStripe: boolean;
}

const SUBSCRIPTION_PLANS: PlanCard[] = [
  {
    id: 'starter_free',
    name: 'Free Starter',
    price: '$0',
    cadence: 'forever',
    description: 'Perfect for testing our originality engine on quick essays or thesis drafts.',
    features: [
      '3 Free document audits on sign-up',
      'Digital PDF & Plain Text extraction',
      'Qdrant internal vector repository search',
      'In-browser interactive match viewer',
      'Zero paper repository retention',
    ],
    ctaText: 'Start Free',
    isStripe: false,
  },
  {
    id: 'pro_monthly',
    name: 'Student & Researcher Pro',
    price: '$19',
    cadence: 'per month',
    description: 'Unlimited document audits with priority OCR fallback and live web search.',
    popular: true,
    badge: 'Most Popular',
    features: [
      'Unlimited document & thesis scans',
      'Dual PyMuPDF + Tesseract OCR for scanned papers',
      'Live Internet cross-referencing (SerpAPI & Bing)',
      'Exportable certified PDF originality reports',
      'Priority Celery worker execution queue',
      'Cancel or pause anytime with 1 click',
    ],
    ctaText: 'Subscribe with Stripe',
    isStripe: true,
  },
];

const CREDIT_PACKS: PlanCard[] = [
  {
    id: 'credits_25',
    name: '25 Document Pack',
    price: '$9',
    cadence: 'one-time purchase',
    description: 'Pay once, scan whenever you need. Credits never expire.',
    features: [
      '25 High-accuracy document scans',
      'Full OCR fallback on scanned documents',
      'Live web & scientific repository cross-referencing',
      'Standard PDF originality report export',
      'Credits never expire',
    ],
    ctaText: 'Purchase 25 Scans',
    isStripe: true,
  },
  {
    id: 'credits_100',
    name: '100 Document Pack',
    price: '$29',
    cadence: 'one-time purchase',
    description: 'Best value for academic labs, tutors, and departmental review committees.',
    badge: 'Best Value',
    features: [
      '100 High-accuracy document scans',
      'Full OCR fallback on scanned documents',
      'Live web & scientific repository cross-referencing',
      'Downloadable white-labeled PDF reports',
      'Priority Celery processing lane',
      'Volume bulk rate ($0.29 / document)',
    ],
    ctaText: 'Purchase 100 Scans',
    isStripe: true,
  },
];

export default function Pricing() {
  const [activeTab, setActiveTab] = useState<'subscription' | 'credits'>('subscription');
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSelectPlan = async (plan: PlanCard) => {
    if (!plan.isStripe) {
      window.location.href = '/app';
      return;
    }

    setLoadingPlanId(plan.id);
    setErrorMessage('');

    try {
      // Check for user auth token in localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      await redirectToStripeCheckout({
        planId: plan.id,
        token,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initiate Stripe checkout. Please try again.');
      setLoadingPlanId(null);
    }
  };

  const activePlans = activeTab === 'subscription' ? SUBSCRIPTION_PLANS : CREDIT_PACKS;

  return (
    <section id="pricing" className="py-24 bg-slate-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
            Transparent Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Simple, Fair Plans for Every Researcher
          </h2>
          <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
            Choose between an unlimited monthly subscription or pay-as-you-go credit packs. 
            All checkouts are encrypted and managed via official Stripe Checkout.
          </p>

          {/* Toggle Switch */}
          <div className="pt-4 flex justify-center">
            <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm inline-flex">
              <button
                type="button"
                onClick={() => setActiveTab('subscription')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition ${
                  activeTab === 'subscription'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly Subscription
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('credits')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition ${
                  activeTab === 'credits'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                One-Time Credit Packs
              </button>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-8 max-w-md mx-auto p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 text-center">
            {errorMessage}
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {activePlans.map((plan) => {
            const isLoading = loadingPlanId === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-8 transition-all flex flex-col justify-between ${
                  plan.popular
                    ? 'bg-white border-2 border-indigo-600 shadow-2xl scale-[1.02]'
                    : 'bg-white border border-slate-200 shadow-md hover:border-slate-300'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-indigo-600 text-white text-[11px] font-extrabold rounded-full uppercase tracking-wider shadow-md">
                    {plan.badge}
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs">{plan.description}</p>
                    </div>
                  </div>

                  <div className="mt-6 flex items-baseline gap-1.5 pb-6 border-b border-slate-100">
                    <span className="text-4xl sm:text-5xl font-black text-slate-900">{plan.price}</span>
                    <span className="text-xs font-semibold text-slate-400">/ {plan.cadence}</span>
                  </div>

                  {/* Features List */}
                  <div className="mt-6 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Included Capabilities:
                    </span>
                    <ul className="space-y-2.5 text-xs text-slate-600">
                      {plan.features.map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleSelectPlan(plan)}
                    disabled={isLoading}
                    className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm ${
                      plan.popular
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Redirecting to Stripe...</span>
                      </>
                    ) : (
                      <>
                        <span>{plan.ctaText}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-slate-400 mt-2 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-slate-400" />
                    <span>256-Bit SSL Encrypted Checkout via Stripe</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
