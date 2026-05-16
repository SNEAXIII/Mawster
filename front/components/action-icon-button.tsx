'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

const VARIANT_CLASSES = {
  default: '',
  danger: 'text-red-500 hover:text-red-700',
  success: 'text-green-600 hover:text-green-800',
  info: 'text-blue-500 hover:text-blue-700',
} as const;

type ActionIconButtonProps = Readonly<{
  icon: React.ReactNode;
  onClick: () => void;
  title?: string;
  variant?: keyof typeof VARIANT_CLASSES;
  disabled?: boolean;
  className?: string;
  'data-cy'?: string;
}>;

export function ActionIconButton({
  icon,
  onClick,
  title,
  variant = 'default',
  disabled = false,
  className = '',
  'data-cy': dataCy,
}: ActionIconButtonProps) {
  return (
    <Button
      variant='ghost'
      size='sm'
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`${VARIANT_CLASSES[variant]} ${className}`}
      data-cy={dataCy}
    >
      {icon}
    </Button>
  );
}
