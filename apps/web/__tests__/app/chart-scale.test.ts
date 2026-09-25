import { describe, expect, test } from 'bun:test'
import {
  type AxisDomain,
  exactDomain,
  formatTick,
  fromUnit,
  niceDomain,
  toUnit,
  visibleForScale,
  zoomRange,
} from '../../src/app/lib/chart-scale'

const ascending = (values: number[]): boolean =>
  values.every((value, index) => {
    if (index === 0) {
      return true
    }
    const previous = values[index - 1]
    return previous === undefined || value >= previous
  })

describe('niceDomain / linear', () => {
  test('covers min..max on round numbers, with about `count` ticks', () => {
    const domain = niceDomain(0.1759, 0.92, 'linear')
    expect(domain.kind).toBe('linear')
    expect(domain.lo).toBeLessThanOrEqual(0.1759)
    expect(domain.hi).toBeGreaterThanOrEqual(0.92)
    expect(domain.ticks.length).toBe(4)
    expect(ascending(domain.ticks)).toBe(true)
    expect(domain.ticks[0]).toBeCloseTo(domain.lo, 9)
    expect(domain.ticks.at(-1)).toBeCloseTo(domain.hi, 9)
  })

  test('honours a different tick count', () => {
    expect(niceDomain(0, 10, 'linear', 5).ticks.length).toBe(5)
  })

  test('a flat series gets room around it', () => {
    const domain = niceDomain(5, 5, 'linear')
    expect(domain.hi).toBeGreaterThan(domain.lo)
  })

  test('non-finite input falls back to a usable domain', () => {
    const domain = niceDomain(Number.NaN, Number.NaN, 'linear')
    expect(domain.hi).toBeGreaterThan(domain.lo)
    expect(domain.ticks.length).toBeGreaterThan(0)
  })
})

describe('niceDomain / log', () => {
  test('a tight range spanning three decades', () => {
    const domain = niceDomain(3e-5, 2e-3, 'log')
    expect(domain.kind).toBe('log')
    expect(domain.lo).toBeCloseTo(1e-5, 12)
    expect(domain.hi).toBeCloseTo(1e-2, 9)
    expect(domain.ticks).toEqual([1e-5, 1e-4, 1e-3, 1e-2])
  })

  test('falls back to 1..10 when there is no positive data', () => {
    expect(niceDomain(0, 5, 'log')).toEqual({ kind: 'log', lo: 1, hi: 10, ticks: [1, 10] })
    expect(niceDomain(-3, -1, 'log')).toEqual({ kind: 'log', lo: 1, hi: 10, ticks: [1, 10] })
    expect(niceDomain(Number.NaN, Number.NaN, 'log')).toEqual({
      kind: 'log',
      lo: 1,
      hi: 10,
      ticks: [1, 10],
    })
  })

  test('a wide range is thinned to about six ticks, keeping the ends', () => {
    const domain = niceDomain(1e-8, 1e8, 'log')
    expect(domain.ticks.length).toBeLessThanOrEqual(6)
    expect(domain.ticks[0]).toBe(domain.lo)
    expect(domain.ticks.at(-1)).toBe(domain.hi)
    expect(ascending(domain.ticks)).toBe(true)
  })
})

describe('exactDomain', () => {
  test('linear: keeps lo/hi exactly, ticks stay inside', () => {
    const domain = exactDomain(0.17, 0.92, 'linear')
    expect(domain.lo).toBe(0.17)
    expect(domain.hi).toBe(0.92)
    expect(ascending(domain.ticks)).toBe(true)
    for (const tick of domain.ticks) {
      expect(tick).toBeGreaterThanOrEqual(domain.lo)
      expect(tick).toBeLessThanOrEqual(domain.hi)
    }
  })

  test('log: powers of ten inside the range', () => {
    const domain = exactDomain(3e-5, 2e-3, 'log')
    expect(domain.lo).toBe(3e-5)
    expect(domain.hi).toBe(2e-3)
    expect(domain.ticks).toEqual([1e-4, 1e-3])
  })

  test('log: a zoom tight enough to hold no power of ten falls back to lo and hi', () => {
    const domain = exactDomain(1.0, 1.05, 'log')
    expect(domain.ticks).toEqual([1.0, 1.05])
  })
})

describe('toUnit / fromUnit', () => {
  test('linear round-trips', () => {
    const domain: AxisDomain = { kind: 'linear', lo: 0, hi: 100, ticks: [0, 50, 100] }
    expect(toUnit(25, domain)).toBeCloseTo(0.25, 9)
    expect(fromUnit(0.25, domain)).toBeCloseTo(25, 9)
  })

  test('log round-trips', () => {
    const domain: AxisDomain = { kind: 'log', lo: 1e-5, hi: 1e-2, ticks: [] }
    for (const value of [1e-5, 1e-4, 1e-3, 3.16e-4, 1e-2]) {
      const unit = toUnit(value, domain)
      expect(fromUnit(unit, domain)).toBeCloseTo(value, 12)
    }
    expect(toUnit(1e-5, domain)).toBeCloseTo(0, 9)
    expect(toUnit(1e-2, domain)).toBeCloseTo(1, 9)
  })
})

describe('visibleForScale', () => {
  const points = [
    { step: -1, value: 5 },
    { step: 0, value: 5 },
    { step: 1, value: -2 },
    { step: 2, value: 0 },
    { step: 3, value: Number.NaN },
    { step: 4, value: 8 },
  ]

  test('linear/linear keeps everything finite', () => {
    expect(visibleForScale(points, 'linear', 'linear').map((p) => p.step)).toEqual([-1, 0, 1, 2, 4])
  })

  test('log x drops step <= 0, log y drops value <= 0', () => {
    expect(visibleForScale(points, 'log', 'linear').map((p) => p.step)).toEqual([1, 2, 4])
    expect(visibleForScale(points, 'linear', 'log').map((p) => p.step)).toEqual([-1, 0, 4])
    expect(visibleForScale(points, 'log', 'log').map((p) => p.step)).toEqual([4])
  })
})

describe('zoomRange', () => {
  const domain: AxisDomain = { kind: 'linear', lo: 0, hi: 100, ticks: [] }

  test('the data range between two unit positions, sorted', () => {
    expect(zoomRange(0.2, 0.8, domain)).toEqual({ lo: 20, hi: 80 })
    expect(zoomRange(0.8, 0.2, domain)).toEqual({ lo: 20, hi: 80 })
  })

  test('a drag smaller than 1% of the axis is not a zoom', () => {
    expect(zoomRange(0.5, 0.505, domain)).toBeNull()
    expect(zoomRange(0.5, 0.5, domain)).toBeNull()
  })
})

describe('formatTick', () => {
  test('linear: enough decimals to tell ticks apart', () => {
    const domain = niceDomain(0.1759, 0.92, 'linear')
    const labels = new Set(domain.ticks.map((tick) => formatTick(tick, domain)))
    expect(labels.size).toBe(domain.ticks.length)
  })

  test('linear: a tiny range shares one exponent', () => {
    const domain: AxisDomain = { kind: 'linear', lo: 0, hi: 0.0003, ticks: [0, 0.00015, 0.0003] }
    expect(formatTick(0.00015, domain)).toBe('1.5e-4')
    expect(formatTick(0.0003, domain)).toBe('3.0e-4')
  })

  test('log: plain numbers inside 1e-2..1e4, exponent form outside', () => {
    const domain: AxisDomain = { kind: 'log', lo: 1e-5, hi: 1e4, ticks: [] }
    expect(formatTick(1e-4, domain)).toBe('1e-4')
    expect(formatTick(0.01, domain)).toBe('0.01')
    expect(formatTick(1, domain)).toBe('1')
    expect(formatTick(10, domain)).toBe('10')
  })
})
