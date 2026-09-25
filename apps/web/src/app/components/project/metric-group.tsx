// One grouped, collapsible section of metric charts (project-jobs-compare.html
// `.metric-group`): a toggle header with a label (mono, or plain for "その他"
// or a pair group) and a count, a chevron that rotates when collapsed, then
// the chart grid. Collapse is local state (compare-layout.tsx,
// components/job/metric-charts.tsx), not the URL. The comparison chart
// passes `group` (lib/metric-groups.ts) and gets its label/mono/count from
// it; the job page's own metric charts (whose groups are not
// prefix-derived the same way) pass `title`/`mono`/`count` directly and
// omit `group`.
import { ChevronDownIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useId } from 'react'
import { type MetricGroup, metricGroupLabel } from '../../lib/metric-groups'
import { cn } from '../../lib/utils'

export interface MetricGroupSectionProps {
  /** Omit when `title`/`mono`/`count` are supplied directly instead. */
  group?: MetricGroup
  /** Overrides the label computed from `group.prefix` (lib/metric-groups.ts). */
  title?: string
  /** Overrides whether the label is drawn in mono; normally `group.prefix !== null`. */
  mono?: boolean
  /** Overrides the count after the label; normally `group.keys.length`. */
  count?: number
  collapsed: boolean
  onToggle: () => void
  gridClassName: string
  children: ReactNode
}

export function MetricGroupSection({
  group,
  title,
  mono,
  count,
  collapsed,
  onToggle,
  gridClassName,
  children,
}: MetricGroupSectionProps) {
  const gridId = useId()
  const label = title === undefined ? (group === undefined ? '' : metricGroupLabel(group)) : title
  const isMono = mono === undefined ? group !== undefined && group.prefix !== null : mono
  const itemCount = count === undefined ? (group === undefined ? 0 : group.keys.length) : count
  return (
    <section aria-labelledby={`${gridId}-title`}>
      <h3 id={`${gridId}-title`} className="pt-4 pb-1 text-sm font-semibold">
        <button
          type="button"
          className="inline-flex items-center gap-2 bg-transparent p-0 text-inherit"
          aria-expanded={!collapsed}
          aria-controls={gridId}
          onClick={onToggle}
        >
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              collapsed && '-rotate-90',
            )}
          />
          {isMono ? <span className="font-mono">{label}</span> : label}
          <span className="text-xs font-normal text-muted-foreground">{itemCount}</span>
        </button>
      </h3>
      <div id={gridId} hidden={collapsed} className={cn('grid gap-x-8 gap-y-6', gridClassName)}>
        {children}
      </div>
    </section>
  )
}
