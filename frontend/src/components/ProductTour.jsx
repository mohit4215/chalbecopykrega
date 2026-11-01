import React, { useState, useEffect } from 'react';
import Joyride, { STATUS, ACTIONS, EVENTS } from 'react-joyride';
import { useAuth } from '../context/AuthContext';
import { telemetry } from '../services/telemetry';

/**
 * 4-Step Interactive Product Tour using react-joyride.
 * 
 * Automatically prompts new users on their first login, introducing:
 *  1. Document Upload Box (#tour-upload-box)
 *  2. Scan Credits Counter (#tour-credits-counter)
 *  3. Settings & Privacy Menu (#tour-settings-menu)
 *  4. In-App Customer Support Chat (#tour-support-chat)
 */
export default function ProductTour({ manualRun = false, onTourEnd }) {
  const { user, isAuthenticated } = useAuth();
  const [runTour, setRunTour] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const tourKey = user?.id ? `poach_tour_completed_${user.id}` : 'poach_tour_completed_guest';

  // 1. Check first-time login trigger
  useEffect(() => {
    if (manualRun) {
      setStepIndex(0);
      setRunTour(true);
      return;
    }

    if (isAuthenticated && user) {
      const hasCompleted = localStorage.getItem(tourKey);
      if (!hasCompleted) {
        // Wait for DOM elements to mount cleanly
        const timer = setTimeout(() => {
          setStepIndex(0);
          setRunTour(true);
          telemetry.track('Tour Started', { user_id: user.id, email: user.email });
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [isAuthenticated, user, manualRun, tourKey]);

  // 2. Define the 4 Core Onboarding Steps
  const steps = [
    {
      target: '#tour-upload-box',
      title: '1. Smart Document Ingestion',
      content: (
        <div className="space-y-1.5 text-left">
          <p className="text-xs text-slate-600 leading-relaxed">
            Drag & drop your research paper, essay, or dissertation here. Supports <strong>PDF</strong> (with automatic OCR for scanned pages), <strong>Word (.docx)</strong>, and <strong>TXT</strong> up to 10 MB.
          </p>
          <span className="inline-block text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
            Dense ONNX Embeddings + Live Web Search
          </span>
        </div>
      ),
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '#tour-credits-counter',
      title: '2. Scan Credits & Plans',
      content: (
        <div className="space-y-1.5 text-left">
          <p className="text-xs text-slate-600 leading-relaxed">
            Track your remaining verification credits or active <strong>Pro Plan</strong> subscription. Click this counter anytime to top up credits or manage billing.
          </p>
          <span className="inline-block text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
            New accounts receive 3 free credits
          </span>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '#tour-settings-menu',
      title: '3. History, Billing & Privacy',
      content: (
        <div className="space-y-1.5 text-left">
          <p className="text-xs text-slate-600 leading-relaxed">
            Access previous scan reports with downloadable PDFs, review Stripe invoices, or exercise your <strong>GDPR Right to Erasure</strong> in Privacy Settings.
          </p>
          <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            Zero paper retention policy
          </span>
        </div>
      ),
      placement: 'bottom-start',
    },
    {
      target: '#tour-support-chat',
      title: '4. Instant Support & False Positives',
      content: (
        <div className="space-y-1.5 text-left">
          <p className="text-xs text-slate-600 leading-relaxed">
            Need help or want to flag an incorrect citation match? Click here to chat directly with our engineering and support team.
          </p>
          <span className="inline-block text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
            Live Chat • Monitored 24/7
          </span>
        </div>
      ),
      placement: 'top-end',
    },
  ];

  // 3. Handle Joyride events
  const handleJoyrideCallback = (data) => {
    const { action, index, status, type } = data;

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRunTour(false);
      localStorage.setItem(tourKey, 'true');

      if (status === STATUS.FINISHED) {
        telemetry.track('Tour Completed', { total_steps: steps.length });
      } else {
        telemetry.track('Tour Skipped', { step_index: index });
      }

      if (onTourEnd) onTourEnd();
    } else if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
      telemetry.track('Tour Step Viewed', {
        step_index: index,
        step_title: steps[index]?.title,
        target: steps[index]?.target,
      });
    }
  };

  return (
    <Joyride
      steps={steps}
      run={runTour}
      stepIndex={stepIndex}
      continuous={true}
      showProgress={true}
      showSkipButton={true}
      callback={handleJoyrideCallback}
      locale={{
        back: 'Back',
        close: 'Got it',
        last: 'Finish Tour',
        next: 'Next',
        skip: 'Skip Tour',
      }}
      styles={{
        options: {
          arrowColor: '#ffffff',
          backgroundColor: '#ffffff',
          overlayColor: 'rgba(15, 23, 42, 0.65)',
          primaryColor: '#4f46e5',
          textColor: '#0f172a',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: '1.25rem',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          padding: '1.5rem',
          border: '1px solid #e2e8f0',
        },
        tooltipTitle: {
          fontSize: '1rem',
          fontWeight: 800,
          color: '#0f172a',
          marginBottom: '0.5rem',
        },
        buttonNext: {
          backgroundColor: '#4f46e5',
          borderRadius: '0.75rem',
          fontSize: '0.75rem',
          fontWeight: 700,
          padding: '0.5rem 1rem',
          outline: 'none',
        },
        buttonBack: {
          color: '#64748b',
          fontSize: '0.75rem',
          fontWeight: 700,
          marginRight: '0.5rem',
        },
        buttonSkip: {
          color: '#94a3b8',
          fontSize: '0.75rem',
          fontWeight: 600,
        },
        tooltipFooter: {
          marginTop: '1rem',
        },
      }}
    />
  );
}
