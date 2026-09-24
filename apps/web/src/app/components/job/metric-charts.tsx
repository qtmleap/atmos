import { useMemo } from 'react'
import {
  arrangeMetricCharts,
  formatMetricShort,
  formatStep,
  type MetricChartSpec,
  type MetricSeries,
  seriesColor,
} from '../../lib/metrics'
import { Skeleton } from '../ui/skeleton'
import { formatUtcClock } from './format-utc'
import { LiveIndicator } from './live-indicator'
import { ChartLegend, type ChartLine, MetricChart } from './metric-chart'
import { WidgetHeader } from './widget-header'

/** The 18px mono latest value on the right of a single-series header. */
export function MetricValue({ value }: { value: number }) {
  return (
    <span className="shrink-0 font-mono text-lg leading-7 tracking-tight tabular-nums">
      {formatMetricShort(value)}
    </span>
  )
}

export interface MetricFigureProps {
  spec: MetricChartSpec
  height: number
  /** Subtitle under the title; defaults to the latest step. */
  subtitle?: string
  /** The pair chart's right-hand note: live while running, "更新終了" after. */
  live: boolean
  /** When the pair's latest point was received, for its footnote. */
  lastReceivedAt: string | null
}

const toLines = (spec: MetricChartSpec): ChartLine[] =>
  spec.series.length > 1
    ? spec.series.map((series, index) => ({ series, color: index, dashed: index === 1 }))
    : spec.series.map((series) => ({ series, color: seriesColor(series.key), dashed: false }))

/** One chart with its header, legend and (for a pair) footnote. */
export function MetricFigure({ spec, height, subtitle, live, lastReceivedAt }: MetricFigureProps) {
  const lines = useMemo(() => toLines(spec), [spec])
  const first = spec.series[0]
  if (first === undefined) {
    return null
  }
  const pair = spec.series.length > 1
  return (
    <figure className="min-w-0">
      <WidgetHeader
        as="figcaption"
        title={spec.title}
        mono={spec.mono}
        subtitle={
          subtitle === undefined
            ? pair
              ? '学習と検証 · 全期間'
              : `ステップ ${formatStep(first.latest.step)}`
            : subtitle
        }
        aside={
          pair ? (
            live ? (
              <LiveIndicator>ライブ更新中</LiveIndicator>
            ) : (
              <span className="text-xs text-muted-foreground">更新終了</span>
            )
          ) : (
            <MetricValue value={first.latest.value} />
          )
        }
      />
      <MetricChart lines={lines} height={height} live={pair} />
      <ChartLegend lines={lines} />
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
export function MetricFigureEmpty({ title, height }: { title: string; height: number }) {
  return (
    <div className="min-w-0">
      <WidgetHeader
        title={title}
        mono
        aside={<span className="text-xs text-muted-foreground">未受信</span>}
      />
      <div
        className="grid place-content-center gap-2 text-center text-muted-foreground"
        style={{ minHeight: height }}
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
  running: boolean
  lastReceivedAt: string | null
}

/** Chart height on the run page (the catalog uses the 180px default). */
export const PAGE_CHART_HEIGHT = 144

/** The metrics tab: charts two abreast in the arranged order. */
export function MetricCharts({
  series,
  loading,
  error,
  onRetry,
  running,
  lastReceivedAt,
}: MetricChartsProps) {
  const specs = useMemo(() => arrangeMetricCharts(series), [series])
  if (series.length === 0) {
    return (
      <p className="py-8 text-xs text-muted-foreground">
        {loading ? 'メトリクスを読み込んでいます。' : 'メトリクスはまだ記録されていません。'}
      </p>
    )
  }
  return (
    <div>
      {error === null ? null : (
        <p role="alert" className="pb-3 text-xs text-destructive">
          {error}{' '}
          <button type="button" onClick={onRetry} className="underline underline-offset-4">
            続きを読み込む
          </button>
        </p>
      )}
      <div className="grid grid-cols-1 gap-x-7 gap-y-4 sm:grid-cols-2">
        {specs.map((spec) => (
          <MetricFigure
            key={spec.id}
            spec={spec}
            height={PAGE_CHART_HEIGHT}
            live={running}
            lastReceivedAt={lastReceivedAt}
          />
        ))}
      </div>
    </div>
  )
}
