import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, X, Send, CheckCircle2, Shield, AlertCircle, HelpCircle } from 'lucide-react';

/**
 * Enterprise In-App Customer Support Chat Widget.
 *
 * Integrates Crisp (or compatible live chat platform) into the React app layout.
 * Securely associates the authenticated user's email, unique ID, subscription tier,
 * and remaining credits so support agents immediately recognize customer context.
 *
 * Includes an automated fallback help panel if Crisp is blocked by adblockers or privacy shields.
 */
export default function SupportChatWidget() {
  const { user, isAuthenticated, authFetch } = useAuth();
  const [isFallbackOpen, setIsFallbackOpen] = useState(false);
  const [crispLoaded, setCrispLoaded] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const crispWebsiteId = import.meta.env.VITE_CRISP_WEBSITE_ID || '14917415-38b8-4d51-897c-9da57d904791';

  // 1. Initialize Crisp Script on Mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!window.$crisp) {
      window.$crisp = [];
      window.CRISP_WEBSITE_ID = crispWebsiteId;

      const script = document.createElement('script');
      script.src = 'https://client.crisp.chat/l.js';
      script.async = true;

      script.onload = () => {
        setCrispLoaded(true);
      };

      script.onerror = () => {
        console.warn('[SupportWidget] External chat script could not be loaded (likely ad-blocker or offline). Fallback UI enabled.');
        setCrispLoaded(false);
      };

      document.head.appendChild(script);
    } else {
      setCrispLoaded(true);
    }
  }, [crispWebsiteId]);

  // 2. Synchronize Authenticated User Identity
  useEffect(() => {
    if (typeof window === 'undefined' || !window.$crisp) return;

    try {
      if (isAuthenticated && user) {
        // Set user email
        window.$crisp.push(['set', 'user:email', [user.email]]);
        
        // Set friendly nickname
        const nickname = user.email ? user.email.split('@')[0] : 'User';
        window.$crisp.push(['set', 'user:nickname', [nickname]]);

        // Push contextual metadata for support reps
        const sessionData = [
          ['user_id', user.id || 'unknown'],
          ['subscription_tier', user.subscription_tier || 'free'],
          ['subscription_status', user.subscription_status || 'inactive'],
          ['scan_credits', String(user.scan_credits ?? 0)],
          ['is_admin', user.is_admin ? 'true' : 'false'],
        ];
        window.$crisp.push(['set', 'session:data', [sessionData]]);
      } else {
        // Reset session when user logs out to preserve data privacy
        window.$crisp.push(['do', 'session:reset']);
      }
    } catch (err) {
      console.warn('[SupportWidget] Error synchronizing user state with chat engine:', err);
    }
  }, [isAuthenticated, user]);

  const handleOpenChat = () => {
    if (window.$crisp && crispLoaded) {
      try {
        window.$crisp.push(['do', 'chat:open']);
        return;
      } catch (e) {
        // Fall back to built-in ticket panel
      }
    }
    setIsFallbackOpen(true);
  };

  const handleSendFallbackTicket = async (e) => {
    e.preventDefault();
    if (!ticketMessage.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Use existing feedback/support endpoint with 'bug_report' or 'support_inquiry'
      const payload = {
        chunk_text: ticketSubject.trim() || 'General Customer Support Inquiry',
        comment: ticketMessage.trim(),
        reason: 'support_inquiry',
        source_title: 'In-App Support Widget',
      };

      const res = await authFetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to deliver support message. Please try again.');
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        setTicketSubject('');
        setTicketMessage('');
        setSubmitSuccess(false);
        setIsFallbackOpen(false);
      }, 2500);
    } catch (err) {
      setSubmitError(err.message || 'Error sending inquiry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Action Button for Help & Support */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
        <button
          type="button"
          onClick={handleOpenChat}
          className="group flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold rounded-full shadow-xl hover:shadow-indigo-500/25 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 text-sm border border-indigo-400/30"
          aria-label="Open Customer Support Chat"
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5 text-indigo-100 group-hover:scale-110 transition" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
          </div>
          <span className="hidden sm:inline">Support</span>
        </button>
      </div>

      {/* Fallback Support Dialog (in case Crisp is blocked or user prefers direct messaging) */}
      {isFallbackOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <HelpCircle className="w-5 h-5 text-indigo-200" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Poach Customer Support</h3>
                  <p className="text-xs text-indigo-200">
                    {isAuthenticated ? `Logged in as: ${user?.email}` : 'We typically reply within a few hours'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFallbackOpen(false)}
                className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSendFallbackTicket} className="p-6 space-y-4">
              {submitSuccess ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                  <h4 className="font-bold text-slate-800 text-sm">Message Sent!</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Thank you for reaching out. Our support engineering team has received your ticket.
                  </p>
                </div>
              ) : (
                <>
                  {submitError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={ticketSubject}
                      onChange={(e) => setTicketSubject(e.target.value)}
                      placeholder="e.g. Question about billing or false-positive detection"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      How can we help? *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={ticketMessage}
                      onChange={(e) => setTicketMessage(e.target.value)}
                      placeholder="Describe your issue, suggestion, or bug report..."
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                    <Shield className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>User ID: <strong className="font-mono text-slate-700">{user?.id ? `${user.id.slice(0, 8)}...` : 'Guest Session'}</strong> • Tier: <strong className="capitalize text-slate-700">{user?.subscription_tier || 'Free'}</strong></span>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsFallbackOpen(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !ticketMessage.trim()}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSubmitting ? 'Sending...' : 'Send Message'}</span>
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
