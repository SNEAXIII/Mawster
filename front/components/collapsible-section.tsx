'use client';

import React, { ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/app/lib/utils';

type CollapsibleSectionProps = Readonly<{
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Controlled mode — when provided, overrides internal state */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}>;

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className = '',
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  function handleOpenChange(nextOpen: boolean) {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={handleOpenChange}
      className={cn('rounded-lg border', className)}
    >
      <CollapsibleTrigger asChild>
        <button
          className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors font-semibold text-left rounded-t-lg"
          type="button"
          data-cy={`collapsible-${title.replace(/[\s/]+/g, '-').toLowerCase()}`}
        >
          <span>{title}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t">
        <div className="p-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
