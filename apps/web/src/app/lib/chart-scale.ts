// Axis math for the comparison chart's log-scale and zoom controls,
// independent of pixel size (docs/SPEC.md compare chart). `formatStepTick`,
// the x-axis label formatter, is already exported by
// hooks/use-compare-chart.ts and is not duplicated here.
import type { MetricPoint } from './metrics'

export type ScaleKind = 'linear' | 'log'

export interface AxisDomain {
  kind: ScaleKind
  lo: number
  hi: number
  /** Ascending, all within [lo, hi]. */
  ticks: number[]
}

/** 1, 2 or 5 times a power of ten, not above `raw`. */
const niceStep = (raw: number): number => {
  if (!(raw > 0) || !Number.isFinite(raw)) {
    return 1
  }
  const power = 10 ** Math.floor(Math.log10(raw))
  const candidates = [5, 2, 1].map((base) => base * power)
  const fitting = candidates.find((candidate) => candidate <= raw)
  return fitting === undefined ? power : fitting
}

/** Rounds away float dust at the precision `step` implies. */
const roundToStep = (value: number, step: number): number => {
  if (!(step > 0) || !Number.isFinite(value)) {
    return value
  }
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 2)
  return Number(value.toFixed(Math.min(decimals, 20)))
}

const evenlySpaced = (lo: number, hi: number, count: number): number[] => {
  if (count < 2 || !(hi > lo)) {
    return [lo]
  }
  const step = (hi - lo) / (count - 1)
  return Array.from({ length: count }, (_, index) => roundToStep(lo + step * index, step))
}

/** Keeps the first and last of `values` and thins the rest to at most `max` entries. */
const thinEvenly = (values: readonly number[], max: number): number[] => {
  if (values.length <= max || max < 2) {
    return [...values]
  }
  const step = (values.length - 1) / (max - 1)
  const seen = new Set<number>()
  const indices = Array.from({ length: max }, (_, index) => Math.round(index * step)).filter(
    (index) => {
      if (seen.has(index)) {
        return false
      }
      seen.add(index)
      return true
    },
  )
  return indices
    .map((index) => values[index])
    .filter((value): value is number => value !== undefined)
}

const powersOfTenBetween = (lo: number, hi: number): number[] => {
  const loExp = Math.round(Math.log10(lo))
  const hiExp = Math.round(Math.log10(hi))
  return Array.from({ length: hiExp - loExp + 1 }, (_, index) => 10 ** (loExp + index))
}

/**
 * The y range that holds `min..max` on round numbers with about `count`
 * ticks (a 1/2/5 step, as niceStep below). A flat series gets a unit of room
 * around it.
 */
const linearNiceDomain = (min: number, max: number, count: number): AxisDomain => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { kind: 'linear', lo: 0, hi: 1, ticks: evenlySpaced(0, 1, count) }
  }
  const span = max > min ? max - min : Math.abs(max) > 0 ? Math.abs(max) : 1
  const step = niceStep(span / Math.max(count - 1, 1))
  const lo = Math.floor(min / step) * step
  const hi = Math.max(Math.ceil(max / step) * step, lo + step)
  return { kind: 'linear', lo, hi, ticks: evenlySpaced(lo, hi, count) }
}

/**
 * The log range that holds `min..max` between two powers of ten, ticked at
 * every power in between (thinned to about six). Log scales need positive
 * values; anything else (no data, or nothing above zero) falls back to 1..10.
 */
const logNiceDomain = (min: number, max: number): AxisDomain => {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
    return { kind: 'log', lo: 1, hi: 10, ticks: [1, 10] }
  }
  const lo = 10 ** Math.floor(Math.log10(min))
  const rawHi = 10 ** Math.ceil(Math.log10(max))
  const hi = rawHi > lo ? rawHi : lo * 10
  return { kind: 'log', lo, hi, ticks: thinEvenly(powersOfTenBetween(lo, hi), 6) }
}

/** The axis for `min..max`, rounded outward onto round numbers (see the two scale-specific helpers above). */
export const niceDomain = (min: number, max: number, kind: ScaleKind, count = 4): AxisDomain =>
  kind === 'log' ? logNiceDomain(min, max) : linearNiceDomain(min, max, count)

const ticksInRange = (lo: number, hi: number, step: number): number[] => {
  if (!(step > 0) || !(hi > lo)) {
    return [lo]
  }
  const start = Math.ceil(lo / step) * step
  const ticks: number[] = []
  for (let value = start; value <= hi + step * 1e-9; value += step) {
    ticks.push(roundToStep(value, step))
  }
  return ticks.length > 0 ? ticks : [lo, hi]
}

const exactLinearDomain = (lo: number, hi: number, count: number): AxisDomain => {
  if (!(hi > lo)) {
    return { kind: 'linear', lo, hi, ticks: [lo] }
  }
  const step = niceStep((hi - lo) / Math.max(count - 1, 1))
  return { kind: 'linear', lo, hi, ticks: ticksInRange(lo, hi, step) }
}

const exactLogDomain = (lo: number, hi: number): AxisDomain => {
  if (!(lo > 0) || !(hi > lo)) {
    return { kind: 'log', lo, hi, ticks: [lo, hi] }
  }
  const loExp = Math.floor(Math.log10(lo))
  const hiExp = Math.ceil(Math.log10(hi))
  const powers = Array.from(
    { length: Math.max(hiExp - loExp + 1, 1) },
    (_, index) => 10 ** (loExp + index),
  ).filter((tick) => tick >= lo && tick <= hi)
  if (powers.length >= 2) {
    return { kind: 'log', lo, hi, ticks: powers }
  }
  const fine: number[] = []
  for (let exponent = loExp; exponent <= hiExp; exponent++) {
    for (const base of [1, 2, 5]) {
      const tick = base * 10 ** exponent
      if (tick >= lo && tick <= hi) {
        fine.push(tick)
      }
    }
  }
  fine.sort((a, b) => a - b)
  return fine.length >= 2
    ? { kind: 'log', lo, hi, ticks: fine }
    : { kind: 'log', lo, hi, ticks: [lo, hi] }
}

/**
 * The axis for a zoomed-in range: `lo`/`hi` kept exactly (from a drag), with
 * ticks placed on round numbers inside.
 */
export const exactDomain = (lo: number, hi: number, kind: ScaleKind, count = 4): AxisDomain =>
  kind === 'log' ? exactLogDomain(lo, hi) : exactLinearDomain(lo, hi, count)

/** Position of `value` along the axis, 0 at `lo` and 1 at `hi`. */
export const toUnit = (value: number, domain: AxisDomain): number => {
  if (domain.kind === 'log') {
    const lo = Math.log10(domain.lo)
    const hi = Math.log10(domain.hi)
    return hi === lo ? 0 : (Math.log10(value) - lo) / (hi - lo)
  }
  return domain.hi === domain.lo ? 0 : (value - domain.lo) / (domain.hi - domain.lo)
}

/** Inverse of `toUnit`: the value at position `t` (0 at `lo`, 1 at `hi`). */
export const fromUnit = (t: number, domain: AxisDomain): number => {
  if (domain.kind === 'log') {
    const lo = Math.log10(domain.lo)
    const hi = Math.log10(domain.hi)
    return 10 ** (lo + t * (hi - lo))
  }
  return domain.lo + t * (domain.hi - domain.lo)
}

/**
 * Points a chart can draw on the given scales: finite, and, on a log axis,
 * strictly positive on that axis (zero and negative values have no log).
 */
export const visibleForScale = (
  points: readonly MetricPoint[],
  xKind: ScaleKind,
  yKind: ScaleKind,
): MetricPoint[] =>
  points.filter(
    (point) =>
      Number.isFinite(point.step) &&
      Number.isFinite(point.value) &&
      (xKind !== 'log' || point.step > 0) &&
      (yKind !== 'log' || point.value > 0),
  )

/** Minimum drag width, as a fraction of the axis, that counts as a zoom rather than a click. */
const MIN_DRAG_UNIT = 0.01

/**
 * The data range a drag from unit position `aUnit` to `bUnit` covers, sorted
 * low to high, or null when the drag is too small to be a deliberate zoom.
 */
export const zoomRange = (
  aUnit: number,
  bUnit: number,
  domain: AxisDomain,
): { lo: number; hi: number } | null => {
  if (Math.abs(bUnit - aUnit) < MIN_DRAG_UNIT) {
    return null
  }
  const a = fromUnit(aUnit, domain)
  const b = fromUnit(bUnit, domain)
  return a <= b ? { lo: a, hi: b } : { lo: b, hi: a }
}

const tickGap = (ticks: readonly number[]): number => {
  let gap = Number.POSITIVE_INFINITY
  for (let index = 1; index < ticks.length; index++) {
    const previous = ticks[index - 1]
    const current = ticks[index]
    if (previous === undefined || current === undefined) {
      continue
    }
    const diff = current - previous
    if (diff > 0 && diff < gap) {
      gap = diff
    }
  }
  return Number.isFinite(gap) ? gap : 1
}

/**
 * A tick label with just enough digits to tell neighbouring ticks apart;
 * tiny ranges share one exponent, `2.0e-4 … 0.5e-4`.
 */
const linearFormatTick = (value: number, domain: AxisDomain): string => {
  const magnitude = Math.max(Math.abs(domain.hi), Math.abs(domain.lo))
  if (magnitude > 0 && magnitude < 1e-2) {
    const exponent = Math.floor(Math.log10(magnitude))
    return `${(value / 10 ** exponent).toFixed(1)}e${exponent}`
  }
  const decimals = Math.max(1, -Math.floor(Math.log10(tickGap(domain.ticks))))
  return value.toFixed(decimals)
}

/** Drops trailing zeros of a mantissa: `1.20e-4` -> `1.2e-4`, `1.00e-4` -> `1e-4`. */
const trimMantissa = (exponential: string): string =>
  exponential.replace(/\.?0+e/, 'e').replace(/^(-?\d+)e\+?0$/, '$1')

/** Plain number for 1e-2..1e4 (`0.01`, `1`, `10`), exponent form outside it (`1e-5`). */
const logFormatTick = (value: number): string => {
  const magnitude = Math.abs(value)
  if (magnitude === 0) {
    return '0'
  }
  if (magnitude >= 1e-2 && magnitude <= 1e4) {
    return String(Number(value.toPrecision(4)))
  }
  return trimMantissa(value.toExponential(2))
}

/** Tick label for either scale. */
export const formatTick = (value: number, domain: AxisDomain): string =>
  domain.kind === 'log' ? logFormatTick(value) : linearFormatTick(value, domain)
