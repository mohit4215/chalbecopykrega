'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { ConsentPreferences } from './CookieConsent';

export default function AnalyticsTracker() {
  const [canTrackAnalytics, setCanTrackAnalytics] = useState(false);
  const [canTrackMarketing, setCanTrackMarketing] = useState(false);

  useEffect(() => {
    const handleConsent = (e: Event) => {
      const customEvent = e as CustomEvent<ConsentPreferences>;
      if (customEvent.detail) {
        setCanTrackAnalytics(Boolean(customEvent.detail.analytics));
        setCanTrackMarketing(Boolean(customEvent.detail.marketing));
      }
    };

    window.addEventListener('poach_cookie_consent_updated', handleConsent);

    // Initial check on mount
    const stored = localStorage.getItem('poach_cookie_consent_v1');
    if (stored) {
      try {
        const parsed: ConsentPreferences = JSON.parse(stored);
        setCanTrackAnalytics(Boolean(parsed.analytics));
        setCanTrackMarketing(Boolean(parsed.marketing));
      } catch {
        // Fall back to blocked state
      }
    }

    return () => {
      window.removeEventListener('poach_cookie_consent_updated', handleConsent);
    };
  }, []);

  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <>
      {/* 
        GDPR Non-Essential Script Gatekeeper:
        Scripts below are NEVER evaluated or fetched unless canTrackAnalytics is explicitly TRUE.
      */}
      {canTrackAnalytics && gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}', {
                page_path: window.location.pathname,
                anonymize_ip: true
              });
            `}
          </Script>
        </>
      )}

      {canTrackMarketing && (
        <Script id="marketing-event-bridge" strategy="lazyOnload">
          {`
            // Consent granted: ready for privacy-compliant marketing conversion events
            window.__poach_marketing_consent = true;
          `}
        </Script>
      )}
    </>
  );
}
