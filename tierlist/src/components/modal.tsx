import { useEffect, type ReactNode } from 'react'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { cn } from '@/lib/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  closeLabel: string
  className?: string
}

/**
 * Centred dialog on desktop, bottom sheet on phones. Plain markup rather than a
 * headless-ui dependency — the app only needs Escape, a backdrop click and a
 * close button.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  closeLabel,
  className,
}: Readonly<ModalProps>) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className='fixed inset-0 z-50 flex items-end justify-center sm:items-center'>
      <button
        type='button'
        aria-label={closeLabel}
        onClick={onClose}
        className='absolute inset-0 bg-black/70'
      />
      <div
        role='dialog'
        aria-modal='true'
        className={cn(
          'relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-xl border border-border bg-card shadow-2xl',
          'sm:max-w-lg sm:rounded-xl',
          className
        )}
      >
        <header className='flex items-center justify-between gap-2 border-b border-border px-4 py-3'>
          <h2 className='text-sm font-bold uppercase tracking-wide'>{title}</h2>
          <button
            type='button'
            onClick={onClose}
            aria-label={closeLabel}
            className='rounded p-1 text-muted-foreground hover:text-foreground'
          >
            <XMarkIcon className='h-5 w-5' />
          </button>
        </header>
        <div className='overflow-y-auto p-4'>{children}</div>
      </div>
    </div>
  )
}
