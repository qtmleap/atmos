import { describe, expect, test } from 'bun:test'
import { panDomain, scaleDomain, wheelFactor } from '../../src/app/lib/chart-pan-zoom'
import type { AxisDomain } from '../../src/app/lib/chart-scale'

const linear: AxisDomain = { kind: 'linear', lo: 0, hi: 100, ticks: [0, 50, 100] }
const log: AxisDomain = { kind: 'log', lo: 1, hi: 1000, ticks: [1, 10, 100, 1000] }

describe('panDomain', () => {
  test('shifts a linear domain by a fraction of its span', () => {
    const moved = panDomain(linear, 0.25)
    expect(moved.lo).toBeCloseTo(25, 9)
    expect(moved.hi).toBeCloseTo(125, 9)
    expect(moved.ticks.every((tick) => tick >= moved.lo && tick <= moved.hi)).toBe(true)
  })

  test('shifts a log domain by decades', () => {
    const moved = panDomain(log, 1 / 3)
    expect(moved.lo).toBeCloseTo(10, 9)
    expect(moved.hi).toBeCloseTo(10000, 6)
  })

  test('no movement returns the same domain', () => {
    expect(panDomain(linear, 0)).toBe(linear)
  })
})

describe('scaleDomain', () => {
  test('zooms in about the anchor, which stays put', () => {
    const zoomed = scaleDomain(linear, 0.25, 0.5)
    expect(zoomed.lo).toBeCloseTo(12.5, 9)
    expect(zoomed.hi).toBeCloseTo(62.5, 9)
  })

  test('zooms out past the original ends', () => {
    const zoomed = scaleDomain(linear, 0.5, 2)
    expect(zoomed.lo).toBeCloseTo(-50, 9)
    expect(zoomed.hi).toBeCloseTo(150, 9)
  })

  test('a log domain keeps the anchor decade', () => {
    const zoomed = scaleDomain(log, 0.5, 1 / 3)
    expect(Math.log10(zoomed.lo)).toBeCloseTo(1, 9)
    expect(Math.log10(zoomed.hi)).toBeCloseTo(2, 9)
  })

  test('ignores an unusable factor', () => {
    expect(scaleDomain(linear, 0.5, 0)).toBe(linear)
    expect(scaleDomain(linear, 0.5, Number.NaN)).toBe(linear)
  })
})

describe('wheelFactor', () => {
  test('scrolling down zooms out, up zooms in', () => {
    expect(wheelFactor(100)).toBeGreaterThan(1)
    expect(wheelFactor(-100)).toBeLessThan(1)
    expect(wheelFactor(0)).toBe(1)
  })
})
