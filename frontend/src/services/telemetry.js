/**
 * Unified Telemetry & Product Analytics Service for Poach SaaS.
 * 
 * Supports PostHog and Google Analytics 4 with automatic conversion funnel tracking,
 * session identification, and strict GDPR cookie consent compliance.
 */

class TelemetryService {
  constructor() {
    this.posthog = null;
    this.isPosthogReady = false;
    this.isGaReady = false;
    this.queuedEvents = [];
    this.currentUserId = null;
    this.isDev = Boolean(import.meta.env?.DEV);

    // Default configuration from environment variables
    this.config = {
      posthogKey: import.meta.env?.VITE_POSTHOG_KEY || 'phc_mock_key_poach_saas_analytics',
      posthogHost: import.meta.env?.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      gaId: import.meta.env?.VITE_GA_MEASUREMENT_ID || 'G-POACHDEMO123',
    };
  }

  /**
   * Evaluates user cookie consent state under GDPR / CCPA policies.
   * Returns true only if the user has explicitly consented to analytics trackers.
   */
  hasAnalyticsConsent() {
    if (typeof window === 'undefined') return false;
    try {
      const v1 = localStorage.getItem('poach_cookie_consent_v1');
      if (v1) {
        const parsed = JSON.parse(v1);
        return Boolean(parsed.analytics);
      }
      const legacy = localStorage.getItem('poach_cookie_consent');
      return legacy === 'all';
    } catch {
      return false;
    }
  }

  /**
   * Initializes PostHog and GA4 clients.
   */
  async init() {
    if (typeof window === 'undefined') return;

    // Listen for real-time cookie consent updates
    if (!this._listenerAttached && typeof window !== 'undefined') {
      window.addEventListener('poach_cookie_consent_updated', (e) => {
        if (e.detail?.analytics) {
          this.onConsentGiven();
        }
      });
      this._listenerAttached = true;
    }

    if (!this.hasAnalyticsConsent()) {
      if (this.isDev) {
        console.log('[Telemetry] Awaiting explicit user cookie consent before activating trackers.');
      }
      return;
    }

    // 1. Initialize PostHog
    if (this.config.posthogKey && !this.isPosthogReady) {
      try {
        const posthogModule = await import('posthog-js');
        const posthog = posthogModule.default || posthogModule;

        posthog.init(this.config.posthogKey, {
          api_host: this.config.posthogHost,
          autocapture: true,
          capture_pageview: true,
          capture_pageleave: true,
          disable_session_recording: false,
          persistence: 'localStorage',
          loaded: () => {
            this.isPosthogReady = true;
            this.posthog = posthog;
            if (this.isDev) console.log('[Telemetry] PostHog initialized successfully.');
            this.flushQueue();
          },
        });
      } catch (err) {
        if (this.isDev) {
          console.warn('[Telemetry] PostHog module import failed or blocked (using stub fallback):', err.message);
        }
        this.isPosthogReady = true; // allow fallback tracking to console/queue
      }
    }

    // 2. Initialize Google Analytics 4 (if configured)
    if (this.config.gaId && !this.isGaReady && typeof window !== 'undefined') {
      try {
        if (!window.dataLayer) {
          window.dataLayer = [];
          const gtag = function () {
            window.dataLayer.push(arguments);
          };
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', this.config.gaId, {
            anonymize_ip: true,
            cookie_flags: 'SameSite=None;Secure',
          });

          // Inject gtag script
          const script = document.createElement('script');
          script.async = true;
          script.src = `https://www.googletagmanager.com/gtag/js?id=${this.config.gaId}`;
          document.head.appendChild(script);
        }
        this.isGaReady = true;
      } catch (err) {
        if (this.isDev) console.warn('[Telemetry] GA4 setup notice:', err.message);
      }
    }
  }

  /**
   * Identifies an authenticated user in PostHog and GA4.
   */
  identify(userId, traits = {}) {
    if (!userId) return;
    this.currentUserId = userId;

    if (this.isDev) {
      console.log(`[Telemetry Identify] User: ${userId}`, traits);
    }

    if (this.posthog && this.isPosthogReady) {
      try {
        this.posthog.identify(userId, traits);
      } catch (e) {
        console.warn('[Telemetry] PostHog identify error:', e);
      }
    }

    if (typeof window !== 'undefined' && window.gtag) {
      try {
        window.gtag('set', 'user_properties', traits);
        window.gtag('config', this.config.gaId, { user_id: userId });
      } catch (e) {
        // ignore
      }
    }
  }

  /**
   * Clears user identity and resets session on logout.
   */
  reset() {
    this.currentUserId = null;
    if (this.posthog && this.isPosthogReady) {
      try {
        this.posthog.reset();
      } catch (e) {
        // ignore
      }
    }
    if (this.isDev) console.log('[Telemetry] Session reset.');
  }

  /**
   * Emits a custom product telemetry event.
   *
   * Critical Conversion Funnel Events:
   *  - "File Upload Started"
   *  - "Scan Completed"
   *  - "Stripe Checkout Initiated"
   *  - "PDF Report Downloaded"
   */
  track(eventName, properties = {}) {
    const payload = {
      ...properties,
      timestamp: properties.timestamp || new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      platform: 'web',
      user_id: this.currentUserId || properties.user_id || 'anonymous',
    };

    if (this.isDev) {
      console.log(`%c[Telemetry Event] ${eventName}`, 'color: #6366f1; font-weight: bold;', payload);
    }

    if (!this.hasAnalyticsConsent()) {
      // Store in memory queue until consent is granted
      this.queuedEvents.push({ eventName, payload });
      return;
    }

    // Dispatch to PostHog
    if (this.posthog && this.isPosthogReady) {
      try {
        this.posthog.capture(eventName, payload);
      } catch (e) {
        console.warn('[Telemetry] PostHog capture error:', e);
      }
    }

    // Dispatch to Google Analytics 4
    if (typeof window !== 'undefined' && window.gtag) {
      try {
        // Convert event name to snake_case for GA4
        const gaEventName = eventName.toLowerCase().replace(/[\s-]+/g, '_');
        window.gtag('event', gaEventName, payload);
      } catch (e) {
        // ignore
      }
    }
  }

  /**
   * Flushes queued events once cookie consent has been verified.
   */
  flushQueue() {
    if (!this.hasAnalyticsConsent() || this.queuedEvents.length === 0) return;

    if (this.isDev) {
      console.log(`[Telemetry] Flushing ${this.queuedEvents.length} queued events...`);
    }

    while (this.queuedEvents.length > 0) {
      const item = this.queuedEvents.shift();
      this.track(item.eventName, item.payload);
    }
  }

  /**
   * Hook to notify telemetry when user updates consent preferences.
   */
  onConsentGiven() {
    this.init();
    this.flushQueue();
  }
}

export const telemetry = new TelemetryService();
export default telemetry;
