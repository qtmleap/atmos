// Geometry of the comparison chart (designs/pages/project-jobs-compare.html
// `.chart-svg`): a 460x160 drawing stretched to its box, the plot area at
// x 44..440 and y 24..136, four horizontal rules, four labels on each axis.
// Pure functions first, then the hover hook the chart component uses.
import { type PointerEvent, useCallback, useState } from 'react'
import type { MetricPoint, MetricSeries } from '../lib/metrics'

export const CHART_WIDTH = 460
export const CHART_HEIGHT = 160
export const PLOT_LEFT = 44
export const PLOT_RIGHT = 440
export const PLOT_TOP = 24
export const PLOT_BOTTOM = 136
/** Top of the vertical axis line, a little above the first rule. */
export const AXIS_TOP = 20
/** Baseline of the x axis labels. */
export const X_LABEL_Y = 154
/** Baseline offset of a y label below its rule. */
export const Y_LABEL_OFFSET = 4
const RULES = 4

export interface ChartDomain {
  lo: number
  hi: number
  /** Distance between two rules, in data units. */
  step: number
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

/**
 * The y range that holds `min..max` between the first and the last of the
 * four rules, on round numbers. A flat series gets a unit of room around it.
 */
export const chartDomain = (min: number, max: number): ChartDomain => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { lo: 0, hi: 1, step: 1 / (RULES - 1) }
  }
  const span = max > min ? max - min : Math.abs(max) > 0 ? Math.abs(max) : 1
  const step = niceStep(span / (RULES - 1))
  const lo = Math.floor(min / step) * step
  const hi = Math.max(Math.ceil(max / step) * step, lo + step)
  return { lo, hi, step: (hi - lo) / (RULES - 1) }
}

/** The value at each rule, top to bottom. */
export const yTicks = ({ lo, hi }: ChartDomain): number[] =>
  Array.from({ length: RULES }, (_, index) => hi - ((hi - lo) * index) / (RULES - 1))

/** Four step marks from 0 to the last step, evenly spaced (0, 80k, 160k, 240k for 240,000). */
export const xTicks = (maxStep: number): { max: number; ticks: number[] } => {
  const max = maxStep > 0 ? maxStep : 1
  return { max, ticks: Array.from({ length: RULES }, (_, index) => (max * index) / (RULES - 1)) }
}

export const formatStepTick = (step: number): string =>
  step >= 1000 ? `${Math.round(step / 1000)}k` : String(Math.round(step))

/**
 * A tick label with just enough digits to tell neighbouring rules apart. Tiny
 * ranges (a learning rate) share one exponent, `2.0e-4 … 0.5e-4`, so the
 * labels line up.
 */
export const formatValueTick = (value: number, domain: ChartDomain): string => {
  const magnitude = Math.max(Math.abs(domain.hi), Math.abs(domain.lo))
  if (magnitude > 0 && magnitude < 1e-2) {
    const exponent = Math.floor(Math.log10(magnitude))
    return `${(value / 10 ** exponent).toFixed(1)}e${exponent}`
  }
  const decimals = Math.max(1, -Math.floor(Math.log10(domain.step)))
  return value.toFixed(decimals)
}

export const yOf = (value: number, { lo, hi }: ChartDomain): number =>
  PLOT_BOTTOM - ((value - lo) / (hi - lo)) * (PLOT_BOTTOM - PLOT_TOP)

export const xOf = (step: number, maxStep: number): number =>
  PLOT_LEFT + (step / maxStep) * (PLOT_RIGHT - PLOT_LEFT)

export interface PlotPoint {
  x: number
  y: number
  step: number
  value: number
}

export const toPlotPoints = (
  points: readonly MetricPoint[],
  domain: ChartDomain,
  maxStep: number,
): PlotPoint[] =>
  points
    .filter((point) => Number.isFinite(point.value))
    .map((point) => ({
      x: xOf(point.step, maxStep),
      y: yOf(point.value, domain),
      step: point.step,
      value: point.value,
    }))

export const toPolyline = (points: readonly PlotPoint[]): string =>
  points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')

export interface ChartRun {
  jobId: string
  label: string
  /** Index into the colour list. */
  color: number
  points: PlotPoint[]
}

export interface MetricChart {
  key: string
  runs: ChartRun[]
  domain: ChartDomain
}

/** What the charts need of one loaded job: its id and its series. */
export interface LoadedJobSeries {
  jobId: string
  series: readonly MetricSeries[]
}

/**
 * One chart per metric key across the loaded jobs: the lines of every job
 * that logged the key, coloured by selection order and labelled by display
 * name, on the y range that holds all of them and the shared x axis.
 */
export const metricCharts = (
  keys: readonly string[],
  loaded: readonly LoadedJobSeries[],
  maxStep: number,
  labels: ReadonlyMap<string, string>,
  order: ReadonlyMap<string, number>,
): MetricChart[] => {
  const xMax = xTicks(maxStep).max
  return keys.map((key) => {
    const perJob = loaded.flatMap((entry) => {
      const series = entry.series.find((s) => s.key === key)
      const color = order.get(entry.jobId)
      return series === undefined || color === undefined ? [] : [{ entry, series, color }]
    })
    const min = perJob.reduce((m, { series }) => Math.min(m, series.min), Number.POSITIVE_INFINITY)
    const max = perJob.reduce((m, { series }) => Math.max(m, series.max), Number.NEGATIVE_INFINITY)
    const domain = chartDomain(min, max)
    const runs = perJob.map(({ entry, series, color }) => {
      const label = labels.get(entry.jobId)
      return {
        jobId: entry.jobId,
        label: label === undefined ? entry.jobId : label,
        color,
        points: toPlotPoints(series.points, domain, xMax),
      }
    })
    return { key, runs, domain }
  })
}

export interface ChartHover {
  run: ChartRun
  point: PlotPoint
}

/** How far (in drawing units) the pointer may be from a point and still pick it. */
const HIT_RADIUS = 10

/** The point nearest to (x, y) among all runs, or null when none is within reach. */
export const nearestPoint = (
  runs: readonly ChartRun[],
  x: number,
  y: number,
  // The drawing is stretched, so a unit is not the same length on both axes.
  aspect: { x: number; y: number },
): ChartHover | null => {
  const best: { hit: ChartHover | null; distance: number } = { hit: null, distance: HIT_RADIUS }
  for (const run of runs) {
    for (const point of run.points) {
      const dx = (point.x - x) * aspect.x
      const dy = (point.y - y) * aspect.y
      const distance = Math.hypot(dx, dy)
      if (distance < best.distance) {
        best.distance = distance
        best.hit = { run, point }
      }
    }
  }
  return best.hit
}

/**
 * Pointer position over the stretched drawing, turned into the nearest
 * point of any run. Callers spread the handlers onto the <svg>.
 */
export function useChartHover(runs: readonly ChartRun[]): {
  hover: ChartHover | null
  onPointerMove: (event: PointerEvent<SVGSVGElement>) => void
  onPointerLeave: () => void
} {
  const [hover, setHover] = useState<ChartHover | null>(null)
  const onPointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const box = event.currentTarget.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) {
        return
      }
      const scaleX = box.width / CHART_WIDTH
      const scaleY = box.height / CHART_HEIGHT
      const x = (event.clientX - box.left) / scaleX
      const y = (event.clientY - box.top) / scaleY
      setHover(nearestPoint(runs, x, y, { x: scaleX, y: scaleY }))
    },
    [runs],
  )
  const onPointerLeave = useCallback(() => setHover(null), [])
  return { hover, onPointerMove, onPointerLeave }
}
