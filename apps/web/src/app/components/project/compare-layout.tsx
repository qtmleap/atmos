// The comparison of project-jobs-compare.html (`.compare-layout`): a line
// about the selection with the "ジョブを選ぶ" button, a hint, and one chart per
// metric key in two columns. Presentational; hooks/use-compare-metrics.ts
// supplies the series and hooks/use-compare-chart.ts turns them into charts.
import { ChevronRightIcon } from 'lucide-react'
import { useMemo } from 'react'
import type { Job } from '@/shared/types'
import { metricCharts, xTicks } from '../../hooks/use-compare-chart'
import type { CompareMetrics } from '../../hooks/use-compare-metrics'
import { jobDisplayName } from '../../lib/format'
import { COMPARE_MAX_JOBS } from '../../lib/job-filter'
import { Button } from '../ui/button'
import { CompareChart } from './compare-chart'

export interface CompareLayoutProps {
  /** Every job of the project, newest first. */
  jobs: Job[]
  /** Ids drawn, in the order of `jobs`. */
  selected: string[]
  /** True while `selected` is the default pick, which the toolbar line explains. */
  defaultSelection: boolean
  metrics: CompareMetrics
  onOpenDrawer: () => void
}

export function CompareLayout({
  jobs,
  selected,
  defaultSelection,
  metrics,
  onOpenDrawer,
}: CompareLayoutProps) {
  const labels = useMemo(() => new Map(jobs.map((job) => [job.id, jobDisplayName(job)])), [jobs])
  const order = useMemo(() => new Map(selected.map((id, index) => [id, index])), [selected])
  const maxStep = xTicks(metrics.maxStep).max
  const charts = useMemo(
    () => metricCharts(metrics.keys, metrics.loaded, metrics.maxStep, labels, order),
    [metrics.keys, metrics.loaded, metrics.maxStep, labels, order],
  )

  return (
    <div className="flex flex-col gap-4 border-b pt-2 pb-6">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-muted-foreground">
          比較対象 {selected.length} / {jobs.length}件
          {defaultSelection ? ` ・ 既定は失敗を除く新しい${COMPARE_MAX_JOBS}件です` : ''}
        </span>
        <Button variant="outline" type="button" aria-haspopup="dialog" onClick={onOpenDrawer}>
          ジョブを選ぶ
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>
      <section aria-label="選んだジョブのメトリクス比較">
        <p className="pb-3 text-xs text-muted-foreground">
          横軸はステップ · 線にカーソルを合わせるとジョブ名が分かります
        </p>
        {metrics.error === null ? null : (
          <p role="alert" className="pb-3 text-xs text-destructive">
            {metrics.error}
          </p>
        )}
        {charts.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            {metrics.loading
              ? 'メトリクスを読み込んでいます…'
              : selected.length === 0
                ? 'ジョブを選ぶと、ここにメトリクスが重なって表示されます。'
                : '選んだジョブにはまだメトリクスがありません。'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
            {charts.map((chart) => (
              <CompareChart
                key={chart.key}
                metricKey={chart.key}
                runs={chart.runs}
                domain={chart.domain}
                maxStep={maxStep}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
