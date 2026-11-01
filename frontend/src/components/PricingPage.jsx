import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Check, Sparkles, Zap, Shield, ArrowRight, CreditCard } from 'lucide-react';
import telemetry from '../services/telemetry';

export default function PricingPage({ onBillingSuccess, onNeedLogin }) {
  const { user, isAuthenticated, authFetch } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState('');

  const handleCheckout = async (planId) => {
    setError('');
    if (!isAuthenticated) {
      if (onNeedLogin) onNeedLogin();
      return;
    }

    setLoadingPlan(planId);
    
    // Telemetry: Funnel Step 3 - Stripe Checkout Initiated
    telemetry.track('Stripe Checkout Initiated', {
      plan_id: planId,
      user_id: user?.id,
      user_email: user?.email,
      subscription_tier: user?.subscription_tier || 'free',
      current_credits: user?.scan_credits || 0,
    });

    try {
      const res = await authFetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: planId,
          success_url: `${window.location.origin}`,
          cancel_url: `${window.location.origin}`
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to initialize Stripe checkout session.');
      }

      const data = await res.json();
      if (data.checkout_url) {
        // Redirect to official Stripe Hosted Checkout page
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      setError(err.message || 'Error redirecting to Stripe checkout.');
      setLoadingPlan(null);
    }
  };

  return (
    <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
      {/* Title */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
          Transparent SaaS Pricing
        </span>
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-3 tracking-tight">
          Originality Verification Plans
        </h2>
        <p className="text-sm text-slate-500 mt-2">
          Choose a monthly subscription for unlimited scans, or top up with credit packages that never expire.
        </p>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 text-center max-w-lg mx-auto">
          {error}
        </div>
      )}

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {/* Tier 1: Free Trial */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Starter</span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">Free</span>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-black text-slate-900">$0</span>
              <span className="text-xs text-slate-400 font-semibold">/forever</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Ideal for trying out the scanner on academic essays.</p>

            <ul className="mt-6 space-y-3 text-xs text-slate-600 border-t border-slate-100 pt-6">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong>3 Free Document Scans</strong> included</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>PDF, Word (.docx), & Plain Text</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Internal Vector Database Matching</span>
              </li>
              <li className="flex items-center gap-2.5 text-slate-400">
                <span className="w-4 h-4 text-center">—</span>
                <span>Standard OCR processing priority</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <button
              disabled
              className="w-full py-3 bg-slate-100 text-slate-500 font-bold rounded-xl text-xs cursor-default"
            >
              {user?.subscription_tier === 'free' ? 'Current Free Tier' : 'Included with Account'}
            </button>
          </div>
        </div>

        {/* Tier 2: Pro Subscription (Featured) */}
        <div className="bg-slate-900 text-white rounded-3xl p-8 border-2 border-indigo-500 shadow-2xl flex flex-col justify-between relative overflow-hidden transform md:-translate-y-2">
          <div className="absolute top-0 right-0 bg-gradient-to-l from-indigo-500 to-indigo-600 text-white text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-bl-xl shadow-sm">
            Most Popular
          </div>

          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Pro Unlimited</span>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-5xl font-black text-white">$19</span>
              <span className="text-xs text-slate-400 font-semibold">/month</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">For educators, researchers, and professional writers.</p>

            <ul className="mt-6 space-y-3 text-xs text-slate-300 border-t border-slate-800 pt-6">
              <li className="flex items-center gap-2.5 font-semibold text-white">
                <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                <span><strong>Unlimited Document Scans</strong></span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Live Web Cross-Referencing (Bing / SERP)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Automatic 300 DPI Scanned OCR</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Priority Qdrant Vector Clustering</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Stripe Customer Portal & Cancel Anytime</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800">
            <button
              type="button"
              onClick={() => handleCheckout('pro_monthly')}
              disabled={loadingPlan === 'pro_monthly' || user?.has_active_subscription}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-extrabold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
            >
              {loadingPlan === 'pro_monthly' ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : user?.has_active_subscription ? (
                'Current Active Plan'
              ) : (
                <>
                  <span>Upgrade to Pro ($19/mo)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tier 3: Credit Pack (Pay As You Go) */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pay-As-You-Go</span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">No Subscription</span>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-black text-slate-900">$9</span>
              <span className="text-xs text-slate-400 font-semibold">/one-time</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">25 document scan credits. Credits never expire.</p>

            <ul className="mt-6 space-y-3 text-xs text-slate-600 border-t border-slate-100 pt-6">
              <li className="flex items-center gap-2.5 font-semibold text-slate-900">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong>25 Full Document Scans</strong></span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Credits never expire</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Full Turnitin Highlight Reports</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Live Internet Search Included</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 space-y-2">
            <button
              type="button"
              onClick={() => handleCheckout('credits_25')}
              disabled={loadingPlan === 'credits_25'}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2"
            >
              {loadingPlan === 'credits_25' ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Buy 25 Credits ($9)</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleCheckout('credits_100')}
              disabled={loadingPlan === 'credits_100'}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
            >
              Or Buy 100 Credits ($29)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
