'use client';

import Button from '@/components/ui/Button';
import { Home, Search } from 'lucide-react';
import Link from 'next/link';

/**
 * 404 Not Found page
 * Displays when a user navigates to a non-existent route
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-lg w-full space-y-8 text-center">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <h1 className="text-9xl font-bold text-rise/20">404</h1>
              <div className="absolute inset-0 flex items-center justify-center">
                <Search size={64} className="text-rise" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Page not found</h2>
            <p className="text-muted-foreground">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button
            onClick={() => window.location.href = '/'}
            size="lg"
            className="gap-2"
          >
            <Home size={18} />
            Back to Dashboard
          </Button>
          <Button
            onClick={() => window.history.back()}
            variant="secondary"
            size="lg"
          >
            Go Back
          </Button>
        </div>

        <div className="pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Need help? Check the <Link href="/" className="text-rise hover:underline">RISE app</Link> navigation.
          </p>
        </div>
      </div>
    </div>
  );
}
