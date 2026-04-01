'use client';

import { useEffect } from 'react';
import Button from '@/components/ui/Button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error boundary for the entire app.
 * Catches unexpected errors and displays a user-friendly UI.
 */
export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to monitoring service (e.g., Sentry) in production
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle size={40} className="text-red-600 dark:text-red-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Something went wrong</h2>
          <p className="text-muted-foreground">
            We apologize for the inconvenience. An unexpected error occurred.
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-left">
            <p className="text-sm font-mono text-red-800 dark:text-red-200 break-words">
              {error.message}
            </p>
            {error.stack && (
              <pre className="mt-2 text-xs text-red-600 dark:text-red-300 overflow-auto max-h-48">
                {error.stack}
              </pre>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button onClick={reset} size="lg" className="gap-2">
            <RefreshCw size={18} />
            Try Again
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
            variant="secondary"
            size="lg"
            className="gap-2"
          >
            <Home size={18} />
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
