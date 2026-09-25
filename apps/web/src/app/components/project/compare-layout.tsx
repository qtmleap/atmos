// The comparison of project-jobs-compare.html (`.compare-layout`): the
// selection line with the "ジョブを選ぶ" button, the chart controls
// (chart-controls.tsx), and one collapsible section per metric group
// (metric-group.tsx, lib/metric-groups.ts). The chart named by the `chart`
// URL param (hooks/use-chart-view.ts) opens fullscreen in chart-dialog.tsx
// (project-jobs-compare-expanded.html) instead of growing in place; this
// component resolves that key to a chart — built at a higher tick count
// (chart-dialog.tsx `FULLSCREEN_TICK_COUNT`) than the grid's — or leaves the
// dialog closed when the key names nothing. hooks/use-compare-metrics.ts
// supplies the series, hooks/use-compare-chart.ts turns them into charts,
// and hooks/use-chart-view.ts is the URL state of the controls and of which
// chart is open fullscreen.
import { ChevronRightIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Job } from '@/shared/types'
import { useChartView } from '../../hooks/use-chart-view'
import { metricCharts } from '../../hooks/use-compare-chart'
import type { CompareMetrics } from '../../hooks/use-compare-metrics'
import { CHART_GRID_COLS_CLASS, CHART_HEIGHT_CLASS } from '../../lib/chart-size'
import { selectedJobRows } from '../../lib/compare-selection'
import { jobDisplayName } from '../../lib/format'
import { COMPARE_MAX_JOBS, filterChartJobs } from '../../lib/job-filter'
import { groupMetricKeys, type MetricGroup } from '../../lib/metric-groups'
import { Button } from '../ui/button'
import { ChartControls } from './chart-controls'
import { ChartDialog, FULLSCREEN_TICK_COUNT } from './chart-dialog'
import { CompareChart } from './compare-chart'
import { CompareNoMetrics, CompareUnselected } from './compare-empty'
import { MetricGroupSection } from './metric-group'

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

/** A stable, collision-free key for a group's collapse state. */
const groupStateKey = (group: MetricGroup): string =>
  group.prefix === null ? '\u0000other' : group.prefix

export function CompareLayout({
  jobs,
  selected,
  defaultSelection,
  metrics,
  onOpenDrawer,
}: CompareLayoutProps) {
  const chartView = useChartView()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const labels = useMemo(() => new Map(jobs.map((job) => [job.id, jobDisplayName(job)])), [jobs])
  const order = useMemo(() => new Map(selected.map((id, index) => [id, index])), [selected])
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const visibleJobIds = useMemo(() => {
    const matched = filterChartJobs(jobs, chartView.run)
    return new Set(matched.filter((job) => selectedSet.has(job.id)).map((job) => job.id))
  }, [jobs, chartView.run, selectedSet])
  const xKind = chartView.logX ? 'log' : 'linear'
  const yKind = chartView.logY ? 'log' : 'linear'
  const charts = useMemo(
    () =>
      metricCharts(
        metrics.keys,
        metrics.loaded,
        labels,
        order,
        visibleJobIds,
        xKind,
        yKind,
        chartView.smooth,
      ),
    [metrics.keys, metrics.loaded, labels, order, visibleJobIds, xKind, yKind, chartView.smooth],
  )
  const chartsByKey = useMemo(() => new Map(charts.map((chart) => [chart.key, chart])), [charts])
  const groups = useMemo(() => groupMetricKeys(metrics.keys), [metrics.keys])
  const rows = useMemo(
    () => selectedJobRows(jobs, selected, metrics.loaded),
    [jobs, selected, metrics.loaded],
  )
  const dialogChart = useMemo(() => {
    if (chartView.chart === undefined || !chartsByKey.has(chartView.chart)) {
      return undefined
    }
    return metricCharts(
      [chartView.chart],
      metrics.loaded,
      labels,
      order,
      visibleJobIds,
      xKind,
      yKind,
      chartView.smooth,
      FULLSCREEN_TICK_COUNT,
    )[0]
  }, [
    chartView.chart,
    chartsByKey,
    metrics.loaded,
    labels,
    order,
    visibleJobIds,
    xKind,
    yKind,
    chartView.smooth,
  ])

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
      {selected.length === 0 && !metrics.loading ? (
        <CompareUnselected onOpenDrawer={onOpenDrawer} />
      ) : charts.length === 0 && !metrics.loading && metrics.error === null ? (
        <CompareNoMetrics rows={rows} />
      ) : (
        <section className="@container" aria-label="選んだジョブのメトリクス比較">
          <ChartControls
            run={chartView.run}
            onRunChange={chartView.setRun}
            smooth={chartView.smooth}
            onSmoothChange={chartView.setSmooth}
            logX={chartView.logX}
            onLogXChange={chartView.setLogX}
            logY={chartView.logY}
            onLogYChange={chartView.setLogY}
            size={chartView.size}
            onSizeChange={chartView.setSize}
          />
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
              {metrics.loading ? 'メトリクスを読み込んでいます…' : ''}
            </p>
          ) : (
            groups.map((group) => {
              const key = groupStateKey(group)
              return (
                <MetricGroupSection
                  key={key}
                  group={group}
                  collapsed={collapsed[key] === true}
                  onToggle={() =>
                    setCollapsed((current) => ({ ...current, [key]: current[key] !== true }))
                  }
                  gridClassName={CHART_GRID_COLS_CLASS[chartView.size]}
                >
                  {group.keys.flatMap((metricKey) => {
                    const chart = chartsByKey.get(metricKey)
                    if (chart === undefined) {
                      return []
                    }
                    return [
                      <CompareChart
                        key={chart.key}
                        metricKey={chart.key}
                        runs={chart.runs}
                        xDomain={chart.xDomain}
                        yDomain={chart.yDomain}
                        smooth={chartView.smooth}
                        heightClassName={CHART_HEIGHT_CLASS[chartView.size]}
                        onEnlarge={() => chartView.openChart(chart.key)}
                      />,
                    ]
                  })}
                </MetricGroupSection>
              )
            })
          )}
        </section>
      )}
      <ChartDialog
        open={dialogChart !== undefined}
        chart={dialogChart}
        smooth={chartView.smooth}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            chartView.closeChart()
          }
        }}
      />
    </div>
  )
}
