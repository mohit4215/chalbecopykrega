import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from './ui/button';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an unhandled rendering error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-slate-900 dark:text-slate-100 font-sans">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                Application Rendering Encountered an Issue
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                An unexpected interface error occurred. Your account and scan data remain completely safe.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-600 dark:text-slate-300 max-h-32 overflow-y-auto">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button onClick={this.handleReset} className="px-5">
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Reload Page
              </Button>
              <Button variant="outline" onClick={this.handleGoHome} className="px-5">
                <Home className="w-4 h-4 mr-1.5" />
                Return to Scanner
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
