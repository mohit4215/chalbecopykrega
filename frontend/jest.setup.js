require('@testing-library/jest-dom');
const React = require('react');

// Polyfill window.matchMedia for JSDOM
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Polyfill ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Global Mock for framer-motion in JSDOM
jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }) => children,
  motion: new Proxy({}, {
    get: (_, tag) => React.forwardRef((props, ref) => {
      const {
        animate,
        initial,
        exit,
        transition,
        whileHover,
        whileTap,
        whileFocus,
        variants,
        layout,
        layoutId,
        onAnimationComplete,
        ...rest
      } = props;
      return React.createElement(tag, { ...rest, ref });
    })
  })
}));

// Global Mock for posthog-js in JSDOM
jest.mock('posthog-js', () => ({
  init: jest.fn(),
  identify: jest.fn(),
  capture: jest.fn(),
  reset: jest.fn(),
  opt_in_capturing: jest.fn(),
  opt_out_capturing: jest.fn(),
  has_opted_in_capturing: jest.fn().mockReturnValue(true),
  has_opted_out_capturing: jest.fn().mockReturnValue(false),
}));

// Global Mock for react-joyride
jest.mock('react-joyride', () => {
  return function Joyride() {
    return null;
  };
});
