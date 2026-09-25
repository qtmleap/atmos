// Time Weighted EMA smoothing for a metric series, the same curve Weights &
// Biases draws under its "smoothing" slider (docs/SPEC.md compare chart).
import type { MetricPoint } from './metrics'

/** The slider maps 0..1 onto this, so the heaviest smoothing still tracks a step change. */
const MAX_WEIGHT = 0.99

/** Steps are rescaled onto this range before the decay, so uneven spacing does not skew it. */
const VIEWPORT_SCALE = 1000

const isFinitePoint = (point: MetricPoint): boolean =>
  Number.isFinite(point.step) && Number.isFinite(point.value)

/**
 * Time Weighted EMA, W&B's smoothing: each point's weight decays with how far
 * (in a 0..1000 viewport spanning the series) it sits from the previous one,
 * so a gap in the steps does not stretch that point's pull on the curve. The
 * result is de-biased (divided by the accumulated weight) so it starts at the
 * first value rather than climbing from 0.
 *
 * `weight` is clamped into [0, 0.99]; 0 (or below) returns the finite points
 * unchanged. Non-finite points are dropped before smoothing; steps are kept.
 */
export const smoothTimeWeightedEma = (
  points: readonly MetricPoint[],
  weight: number,
): MetricPoint[] => {
  const finite = points.filter(isFinitePoint)
  const clamped = Math.min(Math.max(weight, 0), MAX_WEIGHT)
  const first = finite[0]
  if (clamped <= 0 || first === undefined) {
    return [...finite]
  }
  const smoothingWeight = Math.min(Math.sqrt(clamped), 0.999)
  const last = finite[finite.length - 1]
  const rangeOfX = last === undefined ? 0 : last.step - first.step
  let lastY = 0
  let debias = 0
  let prevStep = first.step
  return finite.map((point) => {
    const changeInX = rangeOfX === 0 ? 1 : ((point.step - prevStep) / rangeOfX) * VIEWPORT_SCALE
    const adj = smoothingWeight ** changeInX
    lastY = lastY * adj + point.value
    debias = debias * adj + 1
    prevStep = point.step
    return { step: point.step, value: lastY / debias }
  })
}
