/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border, 214.3 31.8% 91.4%))',
        input: 'hsl(var(--input, 214.3 31.8% 91.4%))',
        ring: 'hsl(var(--ring, 238.7 83.5% 66.7%))',
        background: 'hsl(var(--background, 0 0% 100%))',
        foreground: 'hsl(var(--foreground, 222.2 84% 4.9%))',
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        primary: {
          DEFAULT: '#4f46e5',
          foreground: '#ffffff',
          hover: '#4338ca',
        },
        secondary: {
          DEFAULT: '#f1f5f9',
          foreground: '#0f172a',
          hover: '#e2e8f0',
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff',
          subtle: '#fef2f2',
        },
        warning: {
          DEFAULT: '#f59e0b',
          foreground: '#ffffff',
          subtle: '#fffbeb',
        },
        success: {
          DEFAULT: '#10b981',
          foreground: '#ffffff',
          subtle: '#ecfdf5',
        },
        muted: {
          DEFAULT: '#f8fafc',
          foreground: '#64748b',
        },
        card: {
          DEFAULT: '#ffffff',
          foreground: '#0f172a',
        },
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '0.75rem',
        '3xl': '0.75rem',
        '4xl': '1rem',
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'sm': '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.07), 0 4px 6px -4px rgba(0, 0, 0, 0.07)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.07), 0 8px 10px -6px rgba(0, 0, 0, 0.07)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.10)',
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'Fira Code', 'monospace'],
        serif: ['Merriweather', 'Georgia', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out forwards',
        'slide-up': 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-subtle': 'pulseSubtle 2s infinite ease-in-out',
        'cursor-blink': 'cursorBlink 0.9s step-start infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.99)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        cursorBlink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
