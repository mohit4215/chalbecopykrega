import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Check, ArrowRight, ShieldCheck } from 'lucide-react';
import telemetry from '../services/telemetry';

export default function PricingPage({ _onBillingSuccess, onNeedLogin }) {
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
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      setError(err.message || 'Error redirecting to Stripe checkout.');
      setLoadingPlan(null);
    }
  };

  return (
    <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
      {/* Title */}
      <div className="text-center max-w-xl mx-auto mb-10">
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700">
          Institutional & Researcher Plans
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2.5 tracking-tight">
          Transparent, Fixed Pricing
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
          Monthly subscriptions for high-volume research and institutions, or pay-as-you-go credit packs that never expire.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300 text-center max-w-lg mx-auto">
          {error}
        </div>
      )}

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Tier 1: Free Starter */}
        <div className="bg-white dark:bg-[#0d121f] rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">Starter</span>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Free</span>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">$0</span>
              <span className="text-xs text-slate-400">/forever</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">For initial evaluation and demo audits.</p>

            <ul className="mt-5 space-y-2.5 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800/80 pt-5">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span><strong>3 Free Document Audits</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>PDF, DOCX, TXT & Source Code</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Interactive Side-by-Side Diff Viewer</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              disabled
              className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 font-medium rounded-lg text-xs cursor-default"
            >
              {user?.subscription_tier === 'free' ? 'Current Active Tier' : 'Included Tier'}
            </button>
          </div>
        </div>

        {/* Tier 2: Pro Subscription (Featured) */}
        <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-slate-800 text-slate-300 text-[10px] font-mono uppercase tracking-wider px-3 py-1 rounded-bl-lg border-l border-b border-slate-700">
            Institutional Choice
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">Pro Unlimited</span>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white tabular-nums">$19</span>
              <span className="text-xs text-slate-400">/month</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">For departments, researchers, and professional reviewers.</p>

            <ul className="mt-5 space-y-2.5 text-xs text-slate-300 border-t border-slate-800 pt-5">
              <li className="flex items-center gap-2 font-medium text-white">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span><strong>Unlimited Document Audits</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Live Web & Academic Cross-Referencing</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Full OCR Document Extraction</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Cross-Cohort Collusion Matrix Analysis</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Signed PDF Originality Certificates</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => handleCheckout('pro_monthly')}
              disabled={loadingPlan === 'pro_monthly' || user?.has_active_subscription}
              className="w-full py-2.5 bg-white text-slate-900 hover:bg-slate-100 disabled:bg-slate-700 disabled:text-slate-400 font-semibold rounded-lg text-xs transition flex items-center justify-center gap-1.5"
            >
              {loadingPlan === 'pro_monthly' ? (
                <div className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : user?.has_active_subscription ? (
                'Current Active Plan'
              ) : (
                <>
                  <span>Subscribe ($19/mo)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tier 3: Credit Pack (Pay As You Go) */}
        <div className="bg-white dark:bg-[#0d121f] rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">Credit Pack</span>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">One-Time</span>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">$9</span>
              <span className="text-xs text-slate-400">/25 scans</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Pay-as-you-go. Credits never expire.</p>

            <ul className="mt-5 space-y-2.5 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800/80 pt-5">
              <li className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span><strong>25 Full Document Audits</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Permanent Credit Retention</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Live Web & Reference Comparisons</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <button
              type="button"
              onClick={() => handleCheckout('credits_25')}
              disabled={loadingPlan === 'credits_25'}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 font-semibold rounded-lg text-xs transition flex items-center justify-center gap-1.5"
            >
              {loadingPlan === 'credits_25' ? (
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>Buy 25 Credits ($9)</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleCheckout('credits_100')}
              disabled={loadingPlan === 'credits_100'}
              className="w-full py-1.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-medium rounded-lg text-xs transition"
            >
              Buy 100 Credits ($29)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
