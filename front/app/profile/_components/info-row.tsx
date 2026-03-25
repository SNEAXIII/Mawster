import React from 'react';

export function InfoRow({
  icon,
  label,
  value,
  fallback = 'N/A',
  dataCy,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  fallback?: string;
  dataCy?: string;
}>) {
  return (
    <div
      className='flex items-start gap-3 p-3 rounded-lg bg-muted/50'
      data-cy={dataCy}
    >
      <div className='mt-0.5 text-muted-foreground'>{icon}</div>
      <div className='min-w-0'>
        <p className='text-xs font-medium text-muted-foreground'>{label}</p>
        <p className='mt-0.5 text-sm truncate'>{value ?? fallback}</p>
      </div>
    </div>
  );
}
