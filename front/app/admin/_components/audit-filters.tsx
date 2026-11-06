'use client'

import { useI18n } from '@/app/i18n'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AUDIT_RESULTS, type AuditFilters } from '@/app/services/admin-audit'
import type { useAuditViewModel } from '../_viewmodels/use-audit-viewmodel'
import AuditSearchSelect from './audit-search-select'

const ALL = 'all'

interface FilterSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  allLabel: string
  options: { value: string; label: string }[]
  dataCy: string
}

function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  options,
  dataCy,
}: Readonly<FilterSelectProps>) {
  return (
    <Select
      value={value || ALL}
      onValueChange={(next) => onChange(next === ALL ? '' : next)}
    >
      <SelectTrigger
        className='h-8 w-full text-xs sm:w-44'
        aria-label={label}
        data-cy={dataCy}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          value={ALL}
          data-cy={`${dataCy}-all`}
        >
          {allLabel}
        </SelectItem>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            data-cy={`${dataCy}-${option.value}`}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

type AuditFiltersBarProps = Readonly<
  Pick<
    ReturnType<typeof useAuditViewModel>,
    'filters' | 'changeFilters' | 'options' | 'endpointOptions'
  >
>

export default function AuditFiltersBar({
  filters,
  changeFilters,
  options,
  endpointOptions,
}: AuditFiltersBarProps) {
  const { t } = useI18n()
  const s = t.admin.audit

  const dateInput = (key: keyof AuditFilters, label: string, dataCy: string) => (
    <label className='text-muted-foreground flex items-center gap-2 text-xs'>
      {label}
      <Input
        type='date'
        className='h-8 w-36 text-xs md:text-xs'
        value={filters[key]}
        onChange={(e) => changeFilters({ [key]: e.target.value })}
        data-cy={dataCy}
      />
    </label>
  )

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <FilterSelect
        label={s.router}
        value={filters.router}
        onChange={(router) => changeFilters({ router, endpoint: '' })}
        allLabel={s.allRouters}
        options={options.routers.map(({ name }) => ({ value: name, label: name }))}
        dataCy='audit-filter-router'
      />
      <AuditSearchSelect
        label={s.endpoint}
        value={filters.endpoint}
        onChange={(endpoint) => changeFilters({ endpoint })}
        allLabel={s.allRoutes}
        options={endpointOptions.map((endpoint) => ({ value: endpoint, label: endpoint }))}
        dataCy='audit-filter-route'
      />
      <FilterSelect
        label={s.result}
        value={filters.result}
        onChange={(result) => changeFilters({ result })}
        allLabel={s.allResults}
        options={AUDIT_RESULTS.map((result) => ({ value: result, label: s.results[result] }))}
        dataCy='audit-filter-result'
      />
      <AuditSearchSelect
        label={s.account}
        value={filters.userId}
        onChange={(userId) => changeFilters({ userId })}
        allLabel={s.allAccounts}
        options={options.accounts.map(({ id, login }) => ({ value: id, label: login }))}
        dataCy='audit-filter-account'
      />
      {dateInput('dateFrom', s.from, 'audit-filter-from')}
      {dateInput('dateTo', s.to, 'audit-filter-to')}
    </div>
  )
}
