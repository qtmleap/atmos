// Pixel geometry of the comparison chart, independent of the metric key or
// the axis scale. The mock's margins (project-jobs-compare.html `.chart-svg`:
// plot left 44px, top 24px, right/bottom margin 20/24px, x labels 6px above
// the bottom edge, y labels at x=4, axis line starting 4px above the first
// rule) carry over from the fixed 460x160 viewBox to whatever real pixel box
// the chart measures (hooks/use-element-size.ts). Drag-to-zoom turns a pixel
// rectangle into a domain via lib/chart-scale.ts.
import { type AxisDomain, exactDomain, toUnit, zoomRange } from './chart-scale'
import type { MetricPoint } from './metrics'

const MARGIN_LEFT = 44
const MARGIN_RIGHT = 20
const MARGIN_TOP = 24
const MARGIN_BOTTOM = 24
/** How far above the first rule the axis line's top sits. */
const AXIS_OVERSHOOT = 4
/** How far above the bottom edge the x labels' baseline sits. */
const X_LABEL_MARGIN = 6

/** Box before the first ResizeObserver measurement (the mock's own "m" size). */
export const DEFAULT_CHART_WIDTH = 460
export const DEFAULT_CHART_HEIGHT = 248

export interface PlotBox {
  width: number
  height: number
  left: number
  right: number
  top: number
  bottom: number
  /** Top of the vertical axis line. */
  axisTop: number
  /** Baseline of the x axis labels. */
  labelY: number
  /** x of the y axis labels. */
  labelX: number
}

/** The plot rectangle inside a measured (or, before that, default) box. */
export const plotBox = (width: number, height: number): PlotBox => {
  const w = width > 0 ? width : DEFAULT_CHART_WIDTH
  const h = height > 0 ? height : DEFAULT_CHART_HEIGHT
  return {
    width: w,
    height: h,
    left: MARGIN_LEFT,
    right: w - MARGIN_RIGHT,
    top: MARGIN_TOP,
    bottom: h - MARGIN_BOTTOM,
    axisTop: MARGIN_TOP - AXIS_OVERSHOOT,
    labelY: h - X_LABEL_MARGIN,
    labelX: 4,
  }
}

export const xOf = (step: number, domain: AxisDomain, box: PlotBox): number =>
  box.left + toUnit(step, domain) * (box.right - box.left)

export const yOf = (value: number, domain: AxisDomain, box: PlotBox): number =>
  box.bottom - toUnit(value, domain) * (box.bottom - box.top)

export interface PlotPoint {
  x: number
  y: number
  step: number
  value: number
}

export const toPlotPoints = (
  points: readonly MetricPoint[],
  xDomain: AxisDomain,
  yDomain: AxisDomain,
  box: PlotBox,
): PlotPoint[] =>
  points.map((point) => ({
    x: xOf(point.step, xDomain, box),
    y: yOf(point.value, yDomain, box),
    step: point.step,
    value: point.value,
  }))

export const toPolyline = (points: readonly PlotPoint[]): string =>
  points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')

/** Position within the plot rectangle, 0 at left/bottom and 1 at right/top, clamped. */
export const unitInBox = (x: number, y: number, box: PlotBox): { x: number; y: number } => {
  const clamp01 = (t: number): number => Math.min(Math.max(t, 0), 1)
  return {
    x: clamp01((x - box.left) / (box.right - box.left)),
    y: clamp01((box.bottom - y) / (box.bottom - box.top)),
  }
}

export interface PixelRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * The domain-space rectangle a pixel drag covers, or null when the drag is
 * too small on either axis to be a deliberate zoom (lib/chart-scale.ts
 * `zoomRange`). `tickCount` carries the chart's tick density (the grid's
 * default 4, or the fullscreen dialog's 8) into the zoomed-in domain too.
 */
export const dragToDomain = (
  rect: PixelRect,
  xDomain: AxisDomain,
  yDomain: AxisDomain,
  box: PlotBox,
  tickCount = 4,
): { x: AxisDomain; y: AxisDomain } | null => {
  const from = unitInBox(rect.x0, rect.y0, box)
  const to = unitInBox(rect.x1, rect.y1, box)
  const x = zoomRange(from.x, to.x, xDomain)
  const y = zoomRange(from.y, to.y, yDomain)
  if (x === null || y === null) {
    return null
  }
  return {
    x: exactDomain(x.lo, x.hi, xDomain.kind, tickCount),
    y: exactDomain(y.lo, y.hi, yDomain.kind, tickCount),
  }
}
