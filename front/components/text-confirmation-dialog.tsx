'use client';

import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader } from 'lucide-react';
import { useI18n } from '@/app/i18n';

type TextConfirmationDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  /** The word the user must type to enable the confirm button */
  confirmationWord: string;
  /** Label displayed above the input field */
  inputLabel?: string;
  /** Placeholder for the input (defaults to confirmationWord) */
  inputPlaceholder?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  /** Show a loading spinner inside the confirm button */
  isLoading?: boolean;
  /** Error message to display below the input */
  error?: string;
}>;

export function TextConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmationWord,
  inputLabel,
  inputPlaceholder,
  confirmText,
  cancelText,
  variant = 'destructive',
  isLoading = false,
  error,
}: TextConfirmationDialogProps) {
  const { t } = useI18n();
  const [inputValue, setInputValue] = useState('');

  // Reset input when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setInputValue('');
    }
  }, [open]);

  const isMatch = inputValue.toLowerCase() === confirmationWord.toLowerCase();

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!isLoading) onOpenChange(v); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
          <div className="mt-3 space-y-2">
            {inputLabel && (
              <Label className="text-sm text-gray-600">{inputLabel}</Label>
            )}
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputPlaceholder ?? confirmationWord}
              disabled={isLoading}
              autoFocus
              autoComplete="off"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading} onClick={() => setInputValue('')}>
            {cancelText ?? t.common.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={variant === 'destructive' ? 'bg-red-600 hover:bg-red-700 disabled:opacity-50' : ''}
            disabled={!isMatch || isLoading}
            onClick={onConfirm}
          >
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                {confirmText ?? t.common.confirm}
              </>
            ) : (
              confirmText ?? t.common.confirm
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
