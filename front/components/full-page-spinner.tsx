'use client';

import { Loader } from 'lucide-react';

type FullPageSpinnerProps = Readonly<{
  className?: string;
}>;

export function FullPageSpinner({ className }: FullPageSpinnerProps) {
  return (
    <div className={`flex justify-center items-center h-full ${className ?? ''}`}>
      <Loader className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  );
}
