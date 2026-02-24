'use client';

import React, { forwardRef } from 'react';
import { FiSearch } from 'react-icons/fi';
import { Input } from '@/components/ui/input';

type SearchInputProps = Readonly<{
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}>;

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ placeholder = 'Search...', value, onChange, className = '' }, ref) => {
    return (
      <div className={`relative ${className}`}>
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          ref={ref}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9"
        />
      </div>
    );
  },
);

SearchInput.displayName = 'SearchInput';
