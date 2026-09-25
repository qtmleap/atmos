// Data assembly of the job detail chart (job-detail.html `.metric-chart`,
// once it grows the comparison chart's controls): a metric-name filter,
// Time Weighted EMA smoothing (lib/smoothing.ts), log axes
// (lib/chart-scale.ts) and grouped display (lib/metric-groups.ts) applied to
// a single job's own series. Mirrors hooks/use-compare-chart.ts's
// `metricCharts`, but arranges one job's charts the way lib/metrics.ts's
// `arrangeMetricCharts` does (a leading train/val pair group, then one chart
// per remaining key) instead of one chart per key across many jobs.
import { type AxisDomain, niceDomain, type ScaleKind, visibleForScale } from './chart-scale'
import { groupMetricKeys, metricGroupLabel } from './metric-groups'
import {
  arrangeMetricCharts,
  compareForDisplay,
  type MetricChartSpec,
  type MetricPoint,
  type MetricSeries,
  seriesColor,
} from './metrics'
import { smoothTimeWeightedEma } from './smoothing'

export interface JobChartLine {
  key: string
  /** Index into the palette. */
  color: number
  dashed: boolean
  raw: MetricPoint[]
  /** Same as `raw` when smoothing is 0. */
  smoothed: MetricPoint[]
}

export interface JobChart {
  id: string
  title: string
  mono: boolean
  spec: MetricChartSpec
  lines: JobChartLine[]
  xDomain: AxisDomain
  yDomain: AxisDomain
}

export interface JobChartGroup {
  id: string
  title: string
  mono: boolean
  charts: JobChart[]
}

export interface JobChartOptions {
  /** Metric-key substring filter, matched case-insensitively. */
  filter: string
  /** Time Weighted EMA weight, 0..0.99; 0 draws the raw points. */
  smooth: number
  xKind: ScaleKind
  yKind: ScaleKind
}

/** Title of the leading group of train/val pair charts. */
export const PAIR_GROUP_TITLE = '学習と検証'

/** Id of the group of keys with no `/` prefix (lib/metric-groups.ts `OTHER_GROUP_LABEL`). */
const OTHER_GROUP_ID = 'other'

const matchesFilter = (key: string, needle: string): boolean =>
  needle === '' || key.toLocaleLowerCase().includes(needle)

const smallestPositiveStep = (points: readonly MetricPoint[]): number =>
  points.reduce(
    (min, point) => (point.step > 0 && point.step < min ? point.step : min),
    Number.POSITIVE_INFINITY,
  )

const toLine = (
  series: MetricSeries,
  color: number,
  dashed: boolean,
  options: JobChartOptions,
): JobChartLine => {
  const raw = visibleForScale(series.points, options.xKind, options.yKind)
  const smoothed = options.smooth > 0 ? smoothTimeWeightedEma(raw, options.smooth) : raw
  return { key: series.key, color, dashed, raw, smoothed }
}

/** A pair's lines are coloured by position (train first, val dashed); a single line by its key. */
const buildLines = (spec: MetricChartSpec, options: JobChartOptions): JobChartLine[] =>
  spec.series.length > 1
    ? spec.series.map((series, index) => toLine(series, index, index === 1, options))
    : spec.series.map((series) => toLine(series, seriesColor(series.key), false, options))

const xDomainOf = (lines: readonly JobChartLine[], kind: ScaleKind): AxisDomain => {
  const points = lines.flatMap((line) => line.raw)
  const min = kind === 'log' ? smallestPositiveStep(points) : 0
  const max = points.reduce((most, point) => Math.max(most, point.step), 0)
  return niceDomain(min, max, kind)
}

const yDomainOf = (lines: readonly JobChartLine[], kind: ScaleKind): AxisDomain => {
  const points = lines.flatMap((line) => line.raw)
  const min = points.reduce((most, point) => Math.min(most, point.value), Number.POSITIVE_INFINITY)
  const max = points.reduce((most, point) => Math.max(most, point.value), Number.NEGATIVE_INFINITY)
  return niceDomain(min, max, kind)
}

const buildChart = (spec: MetricChartSpec, options: JobChartOptions): JobChart => {
  const lines = buildLines(spec, options)
  return {
    id: spec.id,
    title: spec.title,
    mono: spec.mono,
    spec,
    lines,
    xDomain: xDomainOf(lines, options.xKind),
    yDomain: yDomainOf(lines, options.yKind),
  }
}

const singleSpec = (series: MetricSeries): MetricChartSpec => ({
  id: series.key,
  title: series.key,
  mono: true,
  series: [series],
})

/**
 * The job detail page's charts: a leading `pair` group of every train/val
 * pair (lib/metrics.ts `arrangeMetricCharts`) that survives the filter, then
 * one group per key prefix (lib/metric-groups.ts), each key drawn on its own
 * chart even when it also appears in the pair group above. Groups the
 * filter empties out are omitted.
 */
export const jobChartGroups = (
  series: readonly MetricSeries[],
  options: JobChartOptions,
): JobChartGroup[] => {
  const needle = options.filter.trim().toLocaleLowerCase()
  const byKey = new Map(series.map((item) => [item.key, item]))

  const pairs = arrangeMetricCharts([...series])
    .filter((spec) => spec.series.length > 1)
    .filter((spec) => spec.series.some((item) => matchesFilter(item.key, needle)))
  const pairGroup: JobChartGroup[] =
    pairs.length === 0
      ? []
      : [
          {
            id: 'pair',
            title: PAIR_GROUP_TITLE,
            mono: false,
            charts: pairs.map((spec) => buildChart(spec, options)),
          },
        ]

  const remainingKeys = series
    .map((item) => item.key)
    .filter((key) => matchesFilter(key, needle))
    .sort(compareForDisplay)
  const otherGroups = groupMetricKeys(remainingKeys).map((group) => ({
    id: group.prefix === null ? OTHER_GROUP_ID : group.prefix,
    title: metricGroupLabel(group),
    mono: group.prefix !== null,
    charts: group.keys.flatMap((key) => {
      const item = byKey.get(key)
      return item === undefined ? [] : [buildChart(singleSpec(item), options)]
    }),
  }))

  return [...pairGroup, ...otherGroups]
}
