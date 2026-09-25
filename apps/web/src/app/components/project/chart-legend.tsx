// The legend under one comparison chart's heading (project-jobs-compare.html
// `.chart-legend`): a short line-colour swatch and job name per run actually
// drawn in that chart, in the same order as its polylines (so a run the job
// filter removed, or that lacks this metric, never shows up — the runs this
// receives already went through that in
// hooks/use-compare-chart.ts/hooks/use-chart-interaction.ts). Hovering or
// focusing an item highlights its line the same way hovering the line
// itself does, with no tooltip; the highlight state itself lives in
// hooks/use-chart-interaction.ts (`resolveHighlight`,
// `useLegendHighlight`), so this file is pure presentation.
import { runColor } from '../../lib/chart-colors'
import { cn } from '../../lib/utils'

export interface ChartLegendRun {
  jobId: string
  label: string
  color: number
}

export interface ChartLegendProps {
  runs: readonly ChartLegendRun[]
  onEnter: (jobId: string) => void
  onLeave: () => void
  className?: string
}

export function ChartLegend({ runs, onEnter, onLeave, className }: ChartLegendProps) {
  if (runs.length === 0) {
    return null
  }
  return (
    <ul className={cn('flex flex-wrap gap-x-3 gap-y-1 py-2', className)}>
      {runs.map((run) => (
        <li
          key={run.jobId}
          title={run.label}
          className="flex max-w-40 min-w-0 cursor-default items-center gap-1.5 outline-none"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: hovering/focusing an item highlights its line, same as hovering the line itself
          tabIndex={0}
          onPointerEnter={() => onEnter(run.jobId)}
          onPointerLeave={onLeave}
          onFocus={() => onEnter(run.jobId)}
          onBlur={onLeave}
        >
          <span
            aria-hidden="true"
            className="h-0.5 w-3 shrink-0"
            style={{ backgroundColor: runColor(run.color) }}
          />
          <span className="truncate text-xs text-muted-foreground">{run.label}</span>
        </li>
      ))}
    </ul>
  )
}
