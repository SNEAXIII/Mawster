'use client';

import { ReactNode, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/app/i18n';

type ConfirmationDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  children?: ReactNode;
  trigger?: ReactNode;
  requireConfirmText?: string;
}>;

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText,
  cancelText,
  variant = 'default',
  children,
  trigger,
  requireConfirmText,
}: ConfirmationDialogProps) {
  const { t } = useI18n();
  const [typedValue, setTypedValue] = useState('');

  function handleOpenChange(next: boolean) {
    if (!next) setTypedValue('');
    onOpenChange(next);
  }

  const canConfirm = !requireConfirmText || typedValue === requireConfirmText;

  return (
    <AlertDialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
          {children}
        </AlertDialogHeader>
        {requireConfirmText && (
          <Input
            value={typedValue}
            onChange={(e) => setTypedValue(e.target.value)}
            placeholder={requireConfirmText}
            data-cy='confirm-text-input'
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel data-cy='confirmation-dialog-cancel'>{cancelText ?? t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={!canConfirm}
            className={variant === 'destructive' ? 'bg-red-600 hover:bg-red-700 disabled:opacity-50' : ''}
            data-cy='confirmation-dialog-confirm'
          >
            {confirmText ?? t.common.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
