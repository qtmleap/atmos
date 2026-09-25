// The metrics tab of job-detail.tsx: a single job's own metric charts, with
// the same drag-to-zoom, log axes, name filter, display size and smoothing
// as the project comparison view (components/project/compare-chart.tsx),
// scoped to this job's metric names instead of other jobs
// (lib/job-metric-view.ts `jobChartGroups`). State lives in the URL
// (hooks/use-chart-view.ts); only which groups are collapsed is local.
import { RotateCcwIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useChartInteraction } from '../../hooks/use-chart-interaction'
import { useChartView } from '../../hooks/use-chart-view'
import type { ChartRun } from '../../hooks/use-compare-chart'
import type { ScaleKind } from '../../lib/chart-scale'
import { CHART_HEIGHT_CLASS, jobChartGridColsClass } from '../../lib/chart-size'
import { type JobChart, type JobChartLine, jobChartGroups } from '../../lib/job-metric-view'
import { ENDED_NOTES, type JobPhase } from '../../lib/job-phase'
import { formatMetricShort, formatStep, METRIC_LABELS, type MetricSeries } from '../../lib/metrics'
import { ChartControls } from '../project/chart-controls'
import { ChartSvg } from '../project/chart-svg'
import { MetricGroupSection } from '../project/metric-group'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'
import { formatUtcClock } from './format-utc'
import { LiveIndicator } from './live-indicator'
import { ChartLegend, type ChartLine, jobLineColor } from './metric-chart'
import { WidgetHeader } from './widget-header'

/** The 18px mono latest value on the right of a single-series header. */
export function MetricValue({ value }: { value: number }) {
  return (
    <span className="shrink-0 font-mono text-lg leading-7 tracking-tight tabular-nums">
      {formatMetricShort(value)}
    </span>
  )
}

const toChartRuns = (lines: readonly JobChartLine[]): ChartRun[] =>
  lines.map((line) => ({
    jobId: line.key,
    label: line.key,
    color: line.color,
    dashed: line.dashed,
    raw: line.raw,
    smoothed: line.smoothed,
  }))

const toLegendLines = (lines: readonly JobChartLine[]): ChartLine[] =>
  lines.map((line) => ({ key: line.key, color: line.color, dashed: line.dashed }))

export interface MetricFigureProps {
  chart: JobChart
  heightClassName: string
  /** Above 0 draws each line's raw points dim under its smoothed line. */
  smooth: number
  /** Subtitle under the title; a pair defaults to its own, a single series has none. */
  subtitle?: string
  /** The pair chart's right-hand note: live while running, `endedNote` after. */
  live: boolean
  /** The note of an ended run's pair chart. */
  endedNote?: string
  /** When the pair's latest point was received, for its footnote. */
  lastReceivedAt: string | null
}

/** One chart with its header, legend and (for a pair) footnote. */
export function MetricFigure({
  chart,
  heightClassName,
  smooth,
  subtitle,
  live,
  endedNote = ENDED_NOTES.failed,
  lastReceivedAt,
}: MetricFigureProps) {
  const runs = useMemo(() => toChartRuns(chart.lines), [chart.lines])
  const interaction = useChartInteraction(runs, chart.xDomain, chart.yDomain)
  const first = chart.spec.series[0]
  if (first === undefined) {
    return null
  }
  const pair = chart.spec.series.length > 1
  return (
    <figure className="min-w-0">
      <WidgetHeader
        as="figcaption"
        title={chart.spec.title}
        mono={chart.spec.mono}
        subtitle={subtitle === undefined && pair ? '学習と検証 · 全期間' : subtitle}
        aside={
          <div className="flex items-center gap-2">
            {pair ? (
              live ? (
                <LiveIndicator>ライブ更新中</LiveIndicator>
              ) : (
                <span className="text-xs text-muted-foreground">{endedNote}</span>
              )
            ) : (
              <MetricValue value={first.latest.value} />
            )}
            {interaction.zoomed ? (
              <Button
                variant="ghost"
                size="icon-xs"
                type="button"
                aria-label="ズームを戻す"
                onClick={interaction.onZoomReset}
                className="text-muted-foreground"
              >
                <RotateCcwIcon />
              </Button>
            ) : null}
          </div>
        }
      />
      <ChartSvg
        metricKey={chart.spec.title}
        sizeRef={interaction.sizeRef}
        box={interaction.box}
        xDomain={interaction.xDomain}
        yDomain={interaction.yDomain}
        runs={interaction.runs}
        hover={interaction.hover}
        highlightedJobId={null}
        drag={interaction.drag}
        smooth={smooth}
        heightClassName={heightClassName}
        colorOf={jobLineColor}
        markLatest={pair && live}
        onPointerDown={interaction.svgHandlers.onPointerDown}
        onPointerMove={interaction.svgHandlers.onPointerMove}
        onPointerUp={interaction.svgHandlers.onPointerUp}
        onPointerLeave={interaction.svgHandlers.onPointerLeave}
        onDoubleClick={interaction.svgHandlers.onDoubleClick}
      />
      <ChartLegend lines={toLegendLines(chart.lines)} />
      {pair ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {lastReceivedAt === null ? '' : `最終受信 ${formatUtcClock(lastReceivedAt)} · `}step{' '}
          {formatStep(first.latest.step)}
        </p>
      ) : null}
    </figure>
  )
}

/** A chart still fetching its history. */
export function MetricFigureLoading({ title, height }: { title: string; height: number }) {
  return (
    <div className="min-w-0" aria-busy="true">
      <WidgetHeader
        title={title}
        mono
        aside={<span className="text-xs text-muted-foreground">読み込み中</span>}
      />
      <Skeleton
        role="status"
        aria-label={`${title}を読み込み中`}
        className="my-6"
        style={{ height: height - 48 }}
      />
      <p className="text-xs text-muted-foreground">履歴を取得しています…</p>
    </div>
  )
}

/** A key nothing has been logged for yet. */
export function MetricFigureEmpty({ title, height }: { title: string; height?: number }) {
  return (
    <div className="min-w-0">
      <WidgetHeader
        title={title}
        mono
        aside={<span className="text-xs text-muted-foreground">未受信</span>}
      />
      <div
        className="grid place-content-center gap-2 text-center text-muted-foreground"
        style={height === undefined ? { aspectRatio: '460 / 180' } : { minHeight: height }}
      >
        <h3>データはまだありません</h3>
        <p className="text-xs">このキーの最初のメトリクスを待っています。</p>
      </div>
    </div>
  )
}

export interface MetricChartsProps {
  series: MetricSeries[]
  loading: boolean
  error: string | null
  onRetry: () => void
  phase: JobPhase
  lastReceivedAt: string | null
}

/** The keys the SDK examples log, drawn empty while a run waits for its first report. */
const WAITING_KEYS = Object.keys(METRIC_LABELS)

/** The metrics tab: filterable, zoomable charts grouped by `/`-prefix (lib/job-metric-view.ts), two abreast by default. */
export function MetricCharts({
  series,
  loading,
  error,
  onRetry,
  phase,
  lastReceivedAt,
}: MetricChartsProps) {
  const chartView = useChartView()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const xKind: ScaleKind = chartView.logX ? 'log' : 'linear'
  const yKind: ScaleKind = chartView.logY ? 'log' : 'linear'
  const groups = useMemo(
    () => jobChartGroups(series, { filter: chartView.run, smooth: chartView.smooth, xKind, yKind }),
    [series, chartView.run, chartView.smooth, xKind, yKind],
  )

  if (series.length === 0 && phase === 'waiting' && !loading) {
    return (
      <div className="grid grid-cols-1 gap-x-7 gap-y-4 sm:grid-cols-2">
        {WAITING_KEYS.map((key) => (
          <MetricFigureEmpty key={key} title={key} />
        ))}
      </div>
    )
  }
  if (series.length === 0) {
    return (
      <p className="py-8 text-xs text-muted-foreground">
        {loading ? 'メトリクスを読み込んでいます。' : 'メトリクスはまだ記録されていません。'}
      </p>
    )
  }
  const live = phase === 'running' || phase === 'waiting'
  const endedNote = phase === 'finished' ? ENDED_NOTES.finished : ENDED_NOTES.failed

  return (
    <div className="@container">
      <ChartControls
        searchLabel="メトリクス名で絞り込み"
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
      {error === null ? null : (
        <p role="alert" className="pb-3 text-xs text-destructive">
          {error}{' '}
          <button type="button" onClick={onRetry} className="underline underline-offset-4">
            続きを読み込む
          </button>
        </p>
      )}
      {groups.length === 0 ? (
        <p className="py-10 text-center text-xs text-muted-foreground">
          一致するメトリクスはありません。
        </p>
      ) : (
        groups.map((group) => (
          <MetricGroupSection
            key={group.id}
            title={group.title}
            mono={group.mono}
            count={group.charts.length}
            collapsed={collapsed[group.id] === true}
            onToggle={() =>
              setCollapsed((current) => ({ ...current, [group.id]: current[group.id] !== true }))
            }
            gridClassName={jobChartGridColsClass(chartView.size)}
          >
            {group.charts.map((chart) => (
              <MetricFigure
                key={chart.id}
                chart={chart}
                smooth={chartView.smooth}
                heightClassName={CHART_HEIGHT_CLASS[chartView.size]}
                live={live}
                endedNote={endedNote}
                lastReceivedAt={lastReceivedAt}
              />
            ))}
          </MetricGroupSection>
        ))
      )}
    </div>
  )
}
