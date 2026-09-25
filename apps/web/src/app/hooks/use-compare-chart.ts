// Data assembly of the comparison chart (project-jobs-compare.html
// `.metric-chart`): for each metric key, the raw and smoothed points of
// every job that passes the name filter, on the domain (lib/chart-scale.ts)
// that holds them for whichever scale (linear/log) is active, at whichever
// tick count the caller wants (the grid's default 4, or the fullscreen
// dialog's 8). Pixel geometry lives in lib/chart-geometry.ts;
// `projectChartRuns` turns one chart's runs into pixel positions once a
// chart component has measured its box. `useChartHover` turns a pointer
// position over that box into the nearest point of any run; `resolveHighlight`
// and `useLegendHighlight` are the same idea for
// components/project/chart-legend.tsx, which has no state of its own.
import { type PointerEvent, useCallback, useEffect, useState } from 'react'
import {
  type PlotBox,
  type PlotPoint,
  toPlotPoints,
  toPolyline as toPolylineGeometry,
} from '../lib/chart-geometry'
import { type AxisDomain, niceDomain, type ScaleKind, visibleForScale } from '../lib/chart-scale'
import type { MetricPoint, MetricSeries } from '../lib/metrics'
import { smoothTimeWeightedEma } from '../lib/smoothing'

export type { PlotPoint }
export { toPolylineGeometry as toPolyline }

export const formatStepTick = (step: number): string =>
  step >= 1000 ? `${Math.round(step / 1000)}k` : String(Math.round(step))

export interface ChartRun {
  jobId: string
  label: string
  /** Index into the colour list. */
  color: number
  raw: MetricPoint[]
  /** Same as `raw` when smoothing is 0. */
  smoothed: MetricPoint[]
  /** Drawn dashed (components/project/chart-svg.tsx), e.g. a pair chart's validation line. */
  dashed?: boolean
}

export interface MetricChart {
  key: string
  runs: ChartRun[]
  xDomain: AxisDomain
  yDomain: AxisDomain
}

/** What the charts need of one loaded job: its id and its series. */
export interface LoadedJobSeries {
  jobId: string
  series: readonly MetricSeries[]
}

const smallestPositiveStep = (points: readonly MetricPoint[]): number =>
  points.reduce(
    (min, point) => (point.step > 0 && point.step < min ? point.step : min),
    Number.POSITIVE_INFINITY,
  )

/**
 * One chart per metric key across the jobs `visibleJobIds` names: raw points
 * filtered to what the active scale can draw, the domain over them (before
 * smoothing), and the smoothed line (lib/smoothing.ts) when `smooth` is
 * above 0.
 */
export const metricCharts = (
  keys: readonly string[],
  loaded: readonly LoadedJobSeries[],
  labels: ReadonlyMap<string, string>,
  order: ReadonlyMap<string, number>,
  visibleJobIds: ReadonlySet<string>,
  xKind: ScaleKind,
  yKind: ScaleKind,
  smooth: number,
  /** Ticks per axis; the grid uses the default 4, the fullscreen dialog 8. */
  tickCount = 4,
): MetricChart[] =>
  keys.map((key) => {
    const perJob = loaded.flatMap((entry) => {
      const series = entry.series.find((s) => s.key === key)
      const color = order.get(entry.jobId)
      if (series === undefined || color === undefined || !visibleJobIds.has(entry.jobId)) {
        return []
      }
      return [{ jobId: entry.jobId, color, points: visibleForScale(series.points, xKind, yKind) }]
    })
    const allPoints = perJob.flatMap((job) => job.points)
    const yMin = allPoints.reduce((m, p) => Math.min(m, p.value), Number.POSITIVE_INFINITY)
    const yMax = allPoints.reduce((m, p) => Math.max(m, p.value), Number.NEGATIVE_INFINITY)
    const xMin = xKind === 'log' ? smallestPositiveStep(allPoints) : 0
    const xMax = allPoints.reduce((m, p) => Math.max(m, p.step), 0)
    const xDomain = niceDomain(xMin, xMax, xKind, tickCount)
    const yDomain = niceDomain(yMin, yMax, yKind, tickCount)
    const runs = perJob.map(({ jobId, color, points }) => {
      const label = labels.get(jobId)
      const smoothed = smooth > 0 ? smoothTimeWeightedEma(points, smooth) : points
      return {
        jobId,
        label: label === undefined ? jobId : label,
        color,
        raw: points,
        smoothed,
      }
    })
    return { key, runs, xDomain, yDomain }
  })

export interface RenderedRun {
  jobId: string
  label: string
  color: number
  raw: PlotPoint[]
  /** The line the tooltip and hit testing use (smoothed when drawn dual). */
  points: PlotPoint[]
  dashed?: boolean
}

/** Projects one chart's runs onto a measured box, on the domain in effect (zoomed or not). */
export const projectChartRuns = (
  runs: readonly ChartRun[],
  xDomain: AxisDomain,
  yDomain: AxisDomain,
  box: PlotBox,
): RenderedRun[] =>
  runs.map((run) => ({
    jobId: run.jobId,
    label: run.label,
    color: run.color,
    raw: toPlotPoints(run.raw, xDomain, yDomain, box),
    points: toPlotPoints(run.smoothed, xDomain, yDomain, box),
    dashed: run.dashed,
  }))

export interface ChartHover {
  run: RenderedRun
  point: PlotPoint
}

/** How far (in pixels) the pointer may be from a point and still pick it. */
const HIT_RADIUS = 10

/** The point nearest to (x, y) among all runs, or null when none is within reach. */
export const nearestPoint = (
  runs: readonly RenderedRun[],
  x: number,
  y: number,
): ChartHover | null => {
  const hits = runs.flatMap((run) =>
    run.points.map((point) => ({ run, point, distance: Math.hypot(point.x - x, point.y - y) })),
  )
  const nearest = hits.reduce<{ run: RenderedRun; point: PlotPoint; distance: number } | null>(
    (best, hit) => (best === null || hit.distance < best.distance ? hit : best),
    null,
  )
  return nearest === null || nearest.distance >= HIT_RADIUS
    ? null
    : { run: nearest.run, point: nearest.point }
}

/**
 * Pointer position over the plot, turned into the nearest point of any run.
 * Disabled (and cleared) while a drag-to-zoom is in progress.
 */
export function useChartHover(
  runs: readonly RenderedRun[],
  disabled: boolean,
): {
  hover: ChartHover | null
  onPointerMove: (event: PointerEvent<SVGSVGElement>) => void
  onPointerLeave: () => void
} {
  const [hover, setHover] = useState<ChartHover | null>(null)
  const onPointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (disabled) {
        return
      }
      const box = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - box.left
      const y = event.clientY - box.top
      setHover(nearestPoint(runs, x, y))
    },
    [runs, disabled],
  )
  const onPointerLeave = useCallback(() => setHover(null), [])
  useEffect(() => {
    if (disabled) {
      setHover(null)
    }
  }, [disabled])
  return { hover, onPointerMove, onPointerLeave }
}

/**
 * Which run to draw emphasized (components/project/chart-svg.tsx `dimmed`/
 * `lifted`): a real pointer hover always wins over a legend item's hover or
 * focus, so moving the pointer off the plot doesn't leave a stale legend
 * highlight in charge.
 */
export const resolveHighlight = (
  hover: ChartHover | null,
  legendJobId: string | null,
): string | null => (hover === null ? legendJobId : hover.run.jobId)

/**
 * The run a legend item (components/project/chart-legend.tsx) is hovered or
 * focused on, if any. Combined with a chart's own pointer hover by
 * `resolveHighlight` above.
 */
export function useLegendHighlight(): {
  jobId: string | null
  onEnter: (jobId: string) => void
  onLeave: () => void
} {
  const [jobId, setJobId] = useState<string | null>(null)
  const onEnter = useCallback((next: string) => setJobId(next), [])
  const onLeave = useCallback(() => setJobId(null), [])
  return { jobId, onEnter, onLeave }
}
