import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUiStore } from '../store/useUiStore';

/**
 * GPU-Accelerated SVG Bezier Connector (Phase 4).
 * Draws an interactive spring-physics curved connector between the hovered
 * text highlight span and its ranked Match Card in the Sources Sidebar.
 * Purely declarative and non-blocking (pointer-events: none).
 */
export default function SvgBezierConnector() {
  const activeHoverCoords = useUiStore((state) => state.activeHoverCoords);
  const isBezierActive = useUiStore((state) => state.isBezierActive);

  if (!isBezierActive || !activeHoverCoords) {
    return null;
  }

  const { x1, y1, x2, y2 } = activeHoverCoords;

  // Compute smooth cubic bezier control points
  const dx = Math.abs(x2 - x1);
  const cx1 = x1 + Math.max(30, dx * 0.45);
  const cy1 = y1;
  const cx2 = x2 - Math.max(30, dx * 0.45);
  const cy2 = y2;

  const pathData = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

  return (
    <svg
      className="fixed inset-0 pointer-events-none z-40 hidden lg:block overflow-visible w-full h-full"
      style={{ width: '100vw', height: '100vh' }}
    >
      <defs>
        <linearGradient id="poach-bezier-glow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#818cf8" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.9" />
        </linearGradient>
        <filter id="bezier-drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#6366f1" floodOpacity="0.5" />
        </filter>
      </defs>

      <AnimatePresence>
        <g key="bezier-group">
          {/* Main animated connecting curve */}
          <motion.path
            d={pathData}
            fill="none"
            stroke="url(#poach-bezier-glow)"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#bezier-drop-shadow)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 450,
              damping: 32,
              mass: 0.8,
            }}
          />

          {/* Source node anchor circle (Left Highlight endpoint) */}
          <motion.circle
            cx={x1}
            cy={y1}
            r="4.5"
            fill="#6366f1"
            stroke="#ffffff"
            strokeWidth="1.5"
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Target node anchor circle (Right Card endpoint) */}
          <motion.circle
            cx={x2}
            cy={y2}
            r="4.5"
            fill="#4f46e5"
            stroke="#ffffff"
            strokeWidth="1.5"
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
          />
        </g>
      </AnimatePresence>
    </svg>
  );
}
