'use client';

import React, { forwardRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/app/lib/utils';

type SearchInputProps = Readonly<{
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  'data-cy'?: string;
}>;

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ placeholder = 'Search...', value, onChange, className = '', 'data-cy': dataCy }, ref) => {
    return (
      <div className={cn('relative', className)}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          ref={ref}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9"
          data-cy={dataCy}
        />
      </div>
    );
  },
);

SearchInput.displayName = 'SearchInput';
