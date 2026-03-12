'use client';

import { AlertCircle, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/app/lib/utils';

type ErrorBannerProps = Readonly<{
  message: string;
  onDismiss?: () => void;
  /** 'inline' = small red text, 'banner' = full red box (default) */
  variant?: 'inline' | 'banner';
  className?: string;
}>;

export function ErrorBanner({
  message,
  onDismiss,
  variant = 'banner',
  className = '',
}: ErrorBannerProps) {
  if (!message) return null;

  if (variant === 'inline') {
    return (
      <p className={cn('text-sm text-destructive flex items-center gap-1 py-1', className)}>
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {message}
        {onDismiss && (
          <button className="ml-1" onClick={onDismiss} aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </p>
    );
  }

  return (
    <Alert variant="destructive" className={cn('flex items-center justify-between', className)}>
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <AlertDescription>{message}</AlertDescription>
      </div>
      {onDismiss && (
        <button
          className="shrink-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </Alert>
  );
}
