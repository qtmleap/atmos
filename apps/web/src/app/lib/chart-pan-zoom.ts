// Pan and continuous zoom of a chart's domain, for the fullscreen dialog's
// drag-to-move, wheel and pinch (hooks/use-chart-pan-zoom.ts). Both work in
// unit space (lib/chart-scale.ts `toUnit`/`fromUnit`), so a log axis pans
// and zooms by decades rather than by raw value, and both re-tick the
// result with `exactDomain` at the chart's own tick count.
import { type AxisDomain, exactDomain, fromUnit } from './chart-scale'

/** Narrowest span, as a fraction of the domain being zoomed, one step may reach. */
const MIN_FACTOR = 1e-3
/** Widest a single step may grow the span. */
const MAX_FACTOR = 1e3

const rebuild = (loUnit: number, hiUnit: number, domain: AxisDomain, tickCount: number) => {
  const lo = fromUnit(loUnit, domain)
  const hi = fromUnit(hiUnit, domain)
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(hi > lo)) {
    return domain
  }
  return exactDomain(lo, hi, domain.kind, tickCount)
}

/** The domain shifted by `deltaUnit` of its own span (positive moves toward `hi`). */
export const panDomain = (domain: AxisDomain, deltaUnit: number, tickCount = 4): AxisDomain =>
  deltaUnit === 0 ? domain : rebuild(deltaUnit, 1 + deltaUnit, domain, tickCount)

/**
 * The domain scaled by `factor` about `anchorUnit` (0 at `lo`, 1 at `hi`),
 * which stays where it is: below 1 zooms in, above 1 zooms out.
 */
export const scaleDomain = (
  domain: AxisDomain,
  anchorUnit: number,
  factor: number,
  tickCount = 4,
): AxisDomain => {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) {
    return domain
  }
  const f = Math.min(Math.max(factor, MIN_FACTOR), MAX_FACTOR)
  return rebuild(anchorUnit * (1 - f), anchorUnit + (1 - anchorUnit) * f, domain, tickCount)
}

/** The zoom factor for one wheel event: a notch of about 100px zooms by ~20%. */
export const wheelFactor = (deltaY: number): number => Math.exp(deltaY * 0.002)
