'use client';

import { FiX } from 'react-icons/fi';

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
      <div className={`text-red-500 text-sm py-2 ${className}`}>
        {message}
        {onDismiss && (
          <button className="ml-2 font-bold" onClick={onDismiss} aria-label="Dismiss">
            <FiX className="inline w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded flex items-center justify-between ${className}`}
    >
      <span>{message}</span>
      {onDismiss && (
        <button className="ml-2 font-bold text-red-700 hover:text-red-900" onClick={onDismiss} aria-label="Dismiss">
          <FiX className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
