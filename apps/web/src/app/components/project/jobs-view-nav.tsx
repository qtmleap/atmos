// The "一覧 / グラフで比較" switch under the project heading (`.jobs-view` in
// project-jobs.html and project-jobs-compare.html). Two links rather than
// Radix tabs: each view has its own URL (`?view=compare`), so the switch is
// navigation, pushed to the history, and the router marks the current one
// with aria-current. The look is the tab list's (ui/tabs.tsx). `children`
// sit on the same line after it: the comparison puts its "ジョブを選ぶ" there.
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { tabsListVariants } from '../ui/tabs'

const TRIGGER_CLASS =
  'inline-flex h-full items-center justify-center rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:bg-background aria-[current=page]:text-foreground dark:aria-[current=page]:border-input dark:aria-[current=page]:bg-input/30'

export interface JobsViewNavProps {
  className?: string
  children?: ReactNode
}

export function JobsViewNav({ className, children }: JobsViewNavProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <nav aria-label="ジョブの表示">
        {/* The list's own h-9 only applies inside <Tabs>. */}
        <div className={cn(tabsListVariants(), 'h-9')}>
          {/* The rest of the search (status, the pick, the chart settings)
              stays, so going back restores the other view as it was. The
              list link has no `view` to match on, so `view: undefined` must
              count or it would be current on both views. */}
          <Link
            to="."
            search={(current) => ({ ...current, view: undefined })}
            state
            activeOptions={{ explicitUndefined: true }}
            className={TRIGGER_CLASS}
          >
            一覧
          </Link>
          <Link
            to="."
            search={(current) => ({ ...current, view: 'compare' as const })}
            state
            className={TRIGGER_CLASS}
          >
            グラフで比較
          </Link>
        </div>
      </nav>
      {children}
    </div>
  )
}
