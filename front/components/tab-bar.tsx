'use client';

import clsx from 'clsx';

export interface TabItem<T extends string | number> {
  value: T;
  label: string;
  cy?: string;
}

interface TabBarProps<T extends string | number> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (tab: T) => void;
}

export default function TabBar<T extends string | number>({
  tabs,
  value,
  onChange,
}: Readonly<TabBarProps<T>>) {
  return (
    <div className="border-b mb-6">
      <nav className="-mb-px flex gap-6">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            data-cy={tab.cy ?? `tab-${tab.value}`}
            className={clsx(
              'pb-3 text-sm font-medium border-b-2 transition-colors',
              value === tab.value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
