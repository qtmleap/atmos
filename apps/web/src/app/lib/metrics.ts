// Turns the flat `Metric` rows of a job into chartable series, and arranges
// them the way the run page draws them (docs/mock-diff/designs/pages/job-detail.html).
import type { Metric } from '@/shared/types'
import { compareSerialId } from './serial-id'

export interface MetricPoint {
  step: number
  value: number
}

export interface MetricSeries {
  key: string
  points: MetricPoint[]
  /** Value at the highest step. */
  latest: MetricPoint
  min: number
  max: number
}

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Groups metrics by key (sorted by key), each ordered by step. When the same
 * (key, step) was logged more than once, the row with the larger id (the
 * later write) wins.
 */
export const groupMetricsBySeries = (metrics: Metric[]): MetricSeries[] => {
  const byKey = new Map<string, Map<number, Metric>>()
  for (const metric of metrics) {
    const steps = byKey.get(metric.key)
    const bucket = steps === undefined ? new Map<number, Metric>() : steps
    if (steps === undefined) {
      byKey.set(metric.key, bucket)
    }
    const previous = bucket.get(metric.step)
    if (previous === undefined || compareSerialId(previous.id, metric.id) < 0) {
      bucket.set(metric.step, metric)
    }
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => compareText(a, b))
    .flatMap(([key, bucket]) => {
      const points = [...bucket.values()]
        .map((metric) => ({ step: metric.step, value: metric.value }))
        .sort((a, b) => a.step - b.step)
      const latest = points.at(-1)
      if (latest === undefined) {
        return []
      }
      const values = points.map((point) => point.value).filter(Number.isFinite)
      return [
        {
          key,
          points,
          latest,
          // reduce rather than Math.min(...values): spreading a long series
          // overflows the argument limit.
          min: values.reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY),
          max: values.reduce((a, b) => Math.max(a, b), Number.NEGATIVE_INFINITY),
        },
      ]
    })
}

/** The latest `logged_at` among the rows, or null when there are none. */
export const lastLoggedAt = (metrics: Metric[]): string | null =>
  metrics.reduce<string | null>(
    (latest, metric) => (latest === null || metric.logged_at > latest ? metric.logged_at : latest),
    null,
  )

/**
 * Thins a series to at most `maxPoints` points for drawing, keeping the first
 * and the last point and an even stride in between. Charts with tens of
 * thousands of SVG points freeze the page.
 */
export const downsample = (points: MetricPoint[], maxPoints: number): MetricPoint[] => {
  if (points.length <= maxPoints || maxPoints < 2) {
    return points
  }
  const stride = (points.length - 1) / (maxPoints - 1)
  return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * stride)]).filter(
    (point): point is MetricPoint => point !== undefined,
  )
}

const sameSeries = (a: MetricSeries, b: MetricSeries): boolean =>
  a.key === b.key &&
  a.points.length === b.points.length &&
  a.latest.step === b.latest.step &&
  Object.is(a.latest.value, b.latest.value) &&
  Object.is(a.min, b.min) &&
  Object.is(a.max, b.max) &&
  a.points.every((point, index) => {
    const other = b.points[index]
    return other !== undefined && other.step === point.step && Object.is(other.value, point.value)
  })

/**
 * Keeps the previous object for every series whose points did not change, so
 * memoized charts only redraw the series a live update touched.
 */
export const reuseUnchangedSeries = (
  previous: MetricSeries[],
  next: MetricSeries[],
): MetricSeries[] => {
  const byKey = new Map(previous.map((series) => [series.key, series]))
  return next.map((series) => {
    const old = byKey.get(series.key)
    return old !== undefined && sameSeries(old, series) ? old : series
  })
}

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

/** `48000` -> `48,000` */
export const formatStep = (step: number): string => step.toLocaleString('en-US')

/** Axis form of a step: `16000` -> `16k`, `15333` -> `15.3k`, `800` -> `800`. */
export const formatStepShort = (step: number): string =>
  Math.abs(step) >= 1000 ? `${Number((step / 1000).toPrecision(3))}k` : String(step)

const isExtreme = (value: number): boolean => {
  const magnitude = Math.abs(value)
  return magnitude !== 0 && (magnitude < 1e-3 || magnitude >= 1e6)
}

/** Drops trailing zeros of a mantissa: `1.20e-4` -> `1.2e-4`, `3.00e-4` -> `3e-4`. */
const trimMantissa = (exponential: string): string =>
  exponential.replace(/\.?0+e/, 'e').replace(/^(-?\d+)e\+?0$/, '$1')

/**
 * Compact metric value for chart headers and axis ticks: four significant
 * digits, exponent form for extremes with a trimmed mantissa (`1.2e-4`).
 */
export const formatMetricShort = (value: number): string => {
  if (!Number.isFinite(value)) {
    return String(value)
  }
  if (isExtreme(value)) {
    return trimMantissa(value.toExponential(2))
  }
  return String(Number(value.toPrecision(4)))
}

/**
 * Metric value for the summary tiles: like `formatMetricShort` but the
 * exponent form keeps three significant digits (`1.20e-4`).
 */
export const formatMetricStat = (value: number): string => {
  if (!Number.isFinite(value)) {
    return String(value)
  }
  return isExtreme(value) ? value.toExponential(2) : String(Number(value.toPrecision(4)))
}

// ---------------------------------------------------------------------------
// Axis ticks
// ---------------------------------------------------------------------------

const roundTo = (value: number, unit: number): number => {
  const decimals = Math.max(0, -Math.floor(Math.log10(unit)) + 1)
  return Number(value.toFixed(Math.min(decimals, 20)))
}

/** Whether a span of `units` divides into two or three equal, readable intervals. */
const divides = (units: number): boolean => units <= 3 || units % 2 === 0 || units % 3 === 0

/**
 * Y-axis ticks the way the mocks rule their charts. The unit is the power of
 * ten below the range; the top is `max` rounded up to it, the bottom `min`
 * rounded down, dropped to 0 when that divides better (grad_norm 1.68..5.2
 * becomes 0..6 rather than 1..6). The span is then cut in two, or in three
 * when only three divides it: 1.0/0.7/0.4/0.1, 3e-4/1.5e-4/0, 6/3/0. A flat
 * series gets a single tick.
 */
export const niceTicks = (min: number, max: number): number[] => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return []
  }
  if (max <= min) {
    return [min]
  }
  const unit = 10 ** Math.floor(Math.log10(max - min))
  const high = Math.ceil(max / unit) * unit
  const floored = Math.floor(min / unit) * unit
  const unitsFrom = (low: number): number => Math.round((high - low) / unit)
  const low = min >= 0 && !divides(unitsFrom(floored)) && divides(unitsFrom(0)) ? 0 : floored
  const units = unitsFrom(low)
  const intervals = units <= 3 || units % 2 === 0 || units % 3 !== 0 ? 2 : 3
  return Array.from({ length: intervals + 1 }, (_, index) =>
    roundTo(low + ((high - low) * index) / intervals, unit / 10),
  )
}

/** Decimal places that show every tick exactly, so `1` reads `1.0` beside `0.7`. */
const tickDecimals = (ticks: number[]): number =>
  ticks.reduce((most, tick) => {
    const text = String(tick)
    const dot = text.indexOf('.')
    return Math.max(most, dot === -1 || text.includes('e') ? 0 : text.length - dot - 1)
  }, 0)

/**
 * Labels for a set of axis ticks: extreme values in exponent form, the rest
 * with the decimal places the finest tick needs.
 */
export const formatTicks = (ticks: number[]): ((value: number) => string) => {
  if (ticks.some((tick) => isExtreme(tick))) {
    return formatMetricShort
  }
  const decimals = tickDecimals(ticks)
  return (value) => value.toFixed(decimals)
}

/** `count` ticks evenly spaced from `min` to `max` (whole steps). */
export const evenTicks = (min: number, max: number, count: number): number[] => {
  if (count < 2 || max <= min) {
    return [min]
  }
  return Array.from({ length: count }, (_, index) =>
    Math.round(min + ((max - min) * index) / (count - 1)),
  )
}

// ---------------------------------------------------------------------------
// Chart arrangement
// ---------------------------------------------------------------------------

export interface MetricChartSpec {
  /** Unique among the specs; the key for single charts. */
  id: string
  /** Heading; `mono` when it is a metric key. */
  title: string
  mono: boolean
  /** One series, or the train/val pair (train first). */
  series: MetricSeries[]
}

const TRAIN_PREFIX = 'train/'
const VAL_PREFIX = 'val/'

/** Human names for the keys the SDK examples log. */
export const METRIC_LABELS: Readonly<Record<string, string>> = {
  'train/loss': '学習損失',
  'val/loss': '検証損失',
  lr: '学習率',
  grad_norm: '勾配ノルム',
}

const isLossKey = (key: string): boolean => /(^|\/)loss$/.test(key)
const isRateKey = (key: string): boolean => /(^|\/)(lr|learning_rate)$/.test(key)

/**
 * Palette slot of a series: learning rates in the third colour (navy), so a
 * rate never looks like a loss; everything else in the first (orange). The
 * second (teal) is reserved for the validation line of a pair.
 */
export const seriesColor = (key: string): number => (isRateKey(key) ? 2 : 0)

/** Loss-like keys, then learning rates, then the rest by name. */
const rank = (key: string): number => (isLossKey(key) ? 0 : isRateKey(key) ? 1 : 2)

const compareForDisplay = (a: string, b: string): number => rank(a) - rank(b) || compareText(a, b)

/**
 * Charts in the order the run page draws them: every `train/x` with a
 * matching `val/x` becomes one two-line chart first; then one chart per
 * remaining series (paired `val/` keys excluded), losses first, learning
 * rates next, the rest alphabetically.
 */
export const arrangeMetricCharts = (series: MetricSeries[]): MetricChartSpec[] => {
  const byKey = new Map(series.map((item) => [item.key, item]))
  const pairs: MetricChartSpec[] = []
  const pairedVal = new Set<string>()
  for (const item of series) {
    if (!item.key.startsWith(TRAIN_PREFIX)) {
      continue
    }
    const suffix = item.key.slice(TRAIN_PREFIX.length)
    const val = byKey.get(`${VAL_PREFIX}${suffix}`)
    if (val === undefined) {
      continue
    }
    pairedVal.add(val.key)
    pairs.push({
      id: `pair:${suffix}`,
      title: suffix === 'loss' ? '学習・検証損失' : `学習・検証 ${suffix}`,
      mono: false,
      series: [item, val],
    })
  }
  const singles = series
    .filter((item) => !pairedVal.has(item.key))
    .sort((a, b) => compareForDisplay(a.key, b.key))
    .map((item) => ({ id: item.key, title: item.key, mono: true, series: [item] }))
  return [...pairs, ...singles]
}

export interface SummaryStat {
  key: string
  /** Japanese name when the key is a known one. */
  label: string | null
  /** null when the job has not logged this key. */
  value: number | null
}

const PREFERRED_STATS = ['train/loss', 'val/loss', 'lr'] as const

/**
 * The `slots` headline values of the summary row: train/loss, val/loss and lr
 * when logged, the remaining slots filled with the other series in display
 * order. With nothing logged yet the preferred keys are listed with null.
 */
export const summaryStats = (series: MetricSeries[], slots = 3): SummaryStat[] => {
  const byKey = new Map(series.map((item) => [item.key, item]))
  const preferred = PREFERRED_STATS.filter((key) => byKey.has(key))
  const others = series
    .map((item) => item.key)
    .filter((key) => !PREFERRED_STATS.some((preferredKey) => preferredKey === key))
    .sort(compareForDisplay)
  const keys = [...preferred, ...others].slice(0, slots)
  const padded = [...keys, ...PREFERRED_STATS.filter((key) => !keys.includes(key))].slice(0, slots)
  return padded.map((key) => {
    const found = byKey.get(key)
    const label = METRIC_LABELS[key]
    return {
      key,
      label: label === undefined ? null : label,
      value: found === undefined ? null : found.latest.value,
    }
  })
}

/** Highest step any series reached, or null with no data. */
export const latestStep = (series: MetricSeries[]): number | null =>
  series.reduce<number | null>(
    (max, item) => (max === null || item.latest.step > max ? item.latest.step : max),
    null,
  )
