import { describe, expect, test } from 'bun:test'
import type { MetricPoint } from '../../src/app/lib/metrics'
import { smoothTimeWeightedEma } from '../../src/app/lib/smoothing'

const points = (values: number[], steps?: number[]): MetricPoint[] =>
  values.map((value, index) => {
    const step = steps === undefined ? index : steps[index]
    return { step: step === undefined ? index : step, value }
  })

const valueAt = (series: readonly MetricPoint[], index: number): number => {
  const point = series[index]
  if (point === undefined) {
    throw new Error(`expected a point at index ${index}`)
  }
  return point.value
}

describe('smoothTimeWeightedEma', () => {
  test('weight 0 or below returns the finite points unchanged', () => {
    const series = points([1, 2, 3])
    expect(smoothTimeWeightedEma(series, 0)).toEqual(series)
    expect(smoothTimeWeightedEma(series, -1)).toEqual(series)
  })

  test('drops non-finite values before smoothing, at any weight', () => {
    const series: MetricPoint[] = [
      { step: 0, value: 1 },
      { step: 1, value: Number.NaN },
      { step: 2, value: Number.POSITIVE_INFINITY },
      { step: 3, value: 3 },
    ]
    expect(smoothTimeWeightedEma(series, 0).map((p) => p.step)).toEqual([0, 3])
    expect(smoothTimeWeightedEma(series, 0.6).map((p) => p.step)).toEqual([0, 3])
  })

  test('empty and single-point series', () => {
    expect(smoothTimeWeightedEma([], 0.6)).toEqual([])
    expect(smoothTimeWeightedEma(points([5]), 0.6)).toEqual([{ step: 0, value: 5 }])
  })

  test('the first point is always the raw value, whatever the weight', () => {
    const series = points([10, 0, 0, 0, 0])
    for (const weight of [0.1, 0.5, 0.9, 0.99, 5]) {
      expect(smoothTimeWeightedEma(series, weight)[0]).toEqual({ step: 0, value: 10 })
    }
  })

  test('a constant series stays constant', () => {
    const series = points([5, 5, 5, 5, 5])
    const smoothed = smoothTimeWeightedEma(series, 0.7)
    for (const point of smoothed) {
      expect(point.value).toBeCloseTo(5, 9)
    }
  })

  test('weight is clamped into [0, 0.99]: above the ceiling behaves like the ceiling', () => {
    const series = points([0, 10, 0, 10, 0])
    expect(smoothTimeWeightedEma(series, 5)).toEqual(smoothTimeWeightedEma(series, 0.99))
    expect(smoothTimeWeightedEma(series, 0.99)).not.toEqual(smoothTimeWeightedEma(series, 0.6))
  })

  test('a heavier weight lags a step change more than a lighter one', () => {
    // A step function spread over the full viewport scale (VIEWPORT_SCALE is
    // 1000), so a single step's decay is a moderate, comparable fraction of
    // it for both weights below.
    const steps = Array.from({ length: 101 }, (_, index) => index * 10)
    const series = points(
      steps.map((step) => (step < 500 ? 0 : 10)),
      steps,
    )
    const light = smoothTimeWeightedEma(series, 0.1)
    const heavy = smoothTimeWeightedEma(series, 0.9)
    const atTheJump = steps.indexOf(510)
    const heavyValue = valueAt(heavy, atTheJump)
    const lightValue = valueAt(light, atTheJump)
    expect(heavyValue).toBeLessThan(lightValue)
    expect(heavyValue).toBeGreaterThan(0)
    expect(lightValue).toBeLessThan(10)
  })

  test('uneven step spacing gives the same curve shape as even spacing when the steps scale uniformly', () => {
    const values = [1, 4, 2, 8, 5, 9, 3]
    const even = points(values)
    const scaled = points(
      values,
      values.map((_, index) => index * 10),
    )
    const smoothedEven = smoothTimeWeightedEma(even, 0.6)
    const smoothedScaled = smoothTimeWeightedEma(scaled, 0.6)
    smoothedEven.forEach((point, index) => {
      expect(smoothedScaled[index]?.value).toBeCloseTo(point.value, 9)
    })
  })
})
