'use client';

import React, { ReactNode, useState } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

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

  function toggle() {
    const next = !isOpen;
    setInternalOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors font-semibold text-left"
        onClick={toggle}
        type="button"
      >
        <span>{title}</span>
        {isOpen ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
      </button>
      {isOpen && <div className="p-4 border-t bg-white">{children}</div>}
    </div>
  );
}
