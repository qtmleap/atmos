import { CircleAlertIcon } from 'lucide-react'
import type { LogLine } from '@/shared/types'
import { configNumber } from '../../lib/config'
import { summarizeFailure } from '../../lib/log-state'
import {
  formatMetricStat,
  formatStep,
  latestStep,
  type MetricSeries,
  summaryStats,
} from '../../lib/metrics'
import { Alert, AlertBody, AlertDescription, AlertTitle } from '../ui/alert'

export interface JobSummaryProps {
  series: MetricSeries[]
  config: Record<string, unknown>
}

/** Config keys that name the planned number of steps, first match wins. */
const MAX_STEP_KEYS = ['max_steps', 'total_steps', 'num_steps'] as const

const plannedSteps = (config: Record<string, unknown>): number | null =>
  MAX_STEP_KEYS.reduce<number | null>(
    (found, key) => (found === null ? configNumber(config, key) : found),
    null,
  )

/**
 * The four headline numbers under the header: the latest step (over the
 * planned total when the config names one and a step has arrived) and three
 * metric values.
 */
export function JobSummary({ series, config }: JobSummaryProps) {
  const step = latestStep(series)
  const total = plannedSteps(config)
  const stats = summaryStats(series, 3)
  return (
    <dl className="m-0 grid grid-cols-4 border-b py-5">
      <div>
        <dt className="text-xs text-muted-foreground">最終受信ステップ</dt>
        <dd className="mt-1 font-mono text-2xl leading-[30px] tabular-nums">
          {step === null ? '—' : formatStep(step)}
          {step === null || total === null ? null : (
            <span className="text-xs text-muted-foreground"> / {formatStep(total)}</span>
          )}
        </dd>
      </div>
      {stats.map((stat) => (
        <div key={stat.key} className="border-l pl-7">
          <dt className="text-xs text-muted-foreground">
            {stat.label === null ? null : `${stat.label} `}
            <span className="font-mono">{stat.key}</span>
          </dt>
          <dd className="mt-1 font-mono text-2xl leading-[30px] tabular-nums">
            {stat.value === null ? '—' : formatMetricStat(stat.value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** The failed job's notice between the header and the summary. */
export function JobFailure({ lines }: { lines: LogLine[] }) {
  const summary = summarizeFailure(lines)
  return (
    <Alert variant="destructive" role="alert" className="mt-4">
      <CircleAlertIcon aria-hidden="true" />
      <AlertBody>
        <AlertTitle>{summary.title}</AlertTitle>
        <AlertDescription className="text-xs">{summary.description}</AlertDescription>
      </AlertBody>
    </Alert>
  )
}
