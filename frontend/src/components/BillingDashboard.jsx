import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  CreditCard, 
  ExternalLink, 
  Zap, 
  ShieldCheck, 
  Layers, 
  Sparkles, 
  ArrowRight,
  AlertCircle 
} from 'lucide-react';

export default function BillingDashboard({ onNavigateToPricing }) {
  const { user, authFetch, refreshUser } = useAuth();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState('');

  const handleOpenCustomerPortal = async () => {
    setError('');
    setLoadingPortal(true);
    try {
      const res = await authFetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ return_url: window.location.href })
      });

      if (!res.ok) {
        throw new Error('Failed to create Stripe customer portal session.');
      }

      const data = await res.json();
      if (data.portal_url) {
        window.location.href = data.portal_url;
      }
    } catch (err) {
      setError(err.message || 'Error opening Stripe customer portal.');
      setLoadingPortal(false);
    }
  };

  const isPro = user?.has_active_subscription || user?.subscription_tier === 'pro';

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 max-w-4xl w-full mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Billing & Subscription Management</h2>
            <p className="text-xs text-slate-500">
              Manage your billing profile, remaining scan credits, and Stripe invoices.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCustomerPortal}
          disabled={loadingPortal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-xs rounded-xl shadow-sm transition self-start sm:self-auto"
        >
          {loadingPortal ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>Stripe Customer Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
        {/* Card 1: Subscription Tier */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Plan</span>
            <div className="flex items-center gap-2 mt-1">
              <h3 className="text-2xl font-black text-slate-900 uppercase">
                {isPro ? 'Pro Unlimited' : 'Free Tier'}
              </h3>
              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                isPro ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {user?.subscription_status || 'Active'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {isPro
                ? 'Your account has unlimited access to high-precision document plagiarism checks.'
                : 'Limited to remaining scan credits. Upgrade for unlimited scans and priority OCR.'}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200/60">
            {!isPro ? (
              <button
                type="button"
                onClick={onNavigateToPricing}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-1.5"
              >
                <span>Upgrade to Pro ($19/mo)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenCustomerPortal}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                Modify or Cancel Subscription →
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Remaining Scan Credits */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Available Credits</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black text-indigo-600">
                {isPro ? '∞' : user?.scan_credits || 0}
              </span>
              <span className="text-xs font-bold text-slate-500">
                {isPro ? 'Unlimited Pro Access' : 'Scans Remaining'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Each document scan consumes 1 credit. Free tier accounts can top up anytime.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200/60">
            <button
              type="button"
              onClick={onNavigateToPricing}
              className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Purchase Additional Credit Pack</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stripe Security & Guarantee Banner */}
      <div className="mt-8 p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex items-center justify-between text-xs text-indigo-900">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
          <span>
            Payments and subscriptions are securely processed by <strong>Stripe, Inc.</strong> Card details are never stored on our servers.
          </span>
        </div>
      </div>
    </div>
  );
}
