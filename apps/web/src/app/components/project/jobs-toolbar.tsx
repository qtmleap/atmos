// Search box and status filter above a job list (the mock's `.list-toolbar`
// in project-jobs.html and, narrower, inside `.job-drawer`). Presentational;
// the page owns both values. Same shape as common/list-toolbar.tsx and could
// be folded into it once that grows a compact size.
import { SearchIcon } from 'lucide-react'
import type * as React from 'react'
import { useId } from 'react'
import { STATUS_LABELS } from '../../lib/format'
import { STATUS_FILTERS, type StatusFilter } from '../../lib/job-filter'
import { cn } from '../../lib/utils'
import { Input } from '../ui/input'
import { NativeSelect, NativeSelectOption } from '../ui/native-select'

const FILTER_LABELS: Record<StatusFilter, string> = { all: 'すべての状態', ...STATUS_LABELS }

export interface JobsToolbarProps {
  query: string
  onQueryChange: (value: string) => void
  filter: StatusFilter
  onFilterChange: (value: string) => void
  /** 320px search and 176px filter on the page; 200px and 148px in the drawer. */
  size?: 'default' | 'compact'
  /** Small muted text at the right edge (the page only). */
  note?: React.ReactNode
}

export function JobsToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  size = 'default',
  note,
}: JobsToolbarProps) {
  const searchId = useId()
  const compact = size === 'compact'
  return (
    <search aria-label="ジョブの検索と絞り込み" className="flex items-center gap-3 py-4">
      <div className={cn('relative', compact ? 'w-[200px]' : 'w-[320px]')}>
        <label htmlFor={searchId} className="sr-only">
          ジョブ名またはIDを検索
        </label>
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground"
        />
        <Input
          id={searchId}
          type="search"
          placeholder="ジョブ名・IDで検索…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="pl-[34px]"
        />
      </div>
      <NativeSelect
        aria-label="ジョブの状態"
        value={filter}
        onChange={(event) => onFilterChange(event.target.value)}
        className={compact ? 'w-[148px]' : 'w-[176px]'}
      >
        {STATUS_FILTERS.map((value) => (
          <NativeSelectOption key={value} value={value}>
            {FILTER_LABELS[value]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {note === undefined ? null : (
        <span className="ml-auto text-xs text-muted-foreground">{note}</span>
      )}
    </search>
  )
}
