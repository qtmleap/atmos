import { SearchIcon } from 'lucide-react'
import type * as React from 'react'
import { useId } from 'react'
import { cn } from '../../lib/utils'
import { Input } from '../ui/input'

export interface ListToolbarProps {
  /** Accessible name of the search box; also its visible placeholder unless `placeholder` is set. */
  searchLabel: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  /** Width of the search box; the mocks use 320px next to filters and 360px alone. */
  searchWidth?: 'default' | 'wide'
  /** Filters (NativeSelect) placed after the search box. */
  children?: React.ReactNode
  /** Small muted text at the right edge. */
  note?: React.ReactNode
  /** Accessible name of the whole toolbar (`role="search"`). */
  label?: string
  className?: string
}

/**
 * Search plus filters above a list (the mock's `.list-toolbar`): a 32px
 * search box with a magnifier inside, the filters 12px apart, and a note
 * pushed to the right. Presentational: the page owns the filter state.
 */
export function ListToolbar({
  searchLabel,
  placeholder = searchLabel,
  value,
  onChange,
  searchWidth = 'default',
  children,
  note,
  label,
  className,
}: ListToolbarProps) {
  const id = useId()
  return (
    <search aria-label={label} className={cn('flex items-center gap-3 py-4', className)}>
      <div className={cn('relative', searchWidth === 'wide' ? 'w-[360px]' : 'w-[320px]')}>
        <label htmlFor={id} className="sr-only">
          {searchLabel}
        </label>
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground"
        />
        <Input
          id={id}
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pl-[34px]"
        />
      </div>
      {children}
      {note === undefined ? null : (
        <span className="ml-auto text-xs text-muted-foreground">{note}</span>
      )}
    </search>
  )
}
