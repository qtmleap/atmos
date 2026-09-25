import { describe, expect, test } from 'bun:test'
import {
  dragToDomain,
  plotBox,
  toPlotPoints,
  toPolyline,
  unitInBox,
  xOf,
  yOf,
} from '../../src/app/lib/chart-geometry'
import type { AxisDomain } from '../../src/app/lib/chart-scale'

const linearDomain: AxisDomain = { kind: 'linear', lo: 0, hi: 100, ticks: [0, 50, 100] }

describe('plotBox', () => {
  test('lays out the mock margins inside a measured box', () => {
    const box = plotBox(460, 248)
    expect(box.width).toBe(460)
    expect(box.height).toBe(248)
    expect(box.left).toBe(44)
    expect(box.right).toBe(440)
    expect(box.top).toBe(24)
    expect(box.bottom).toBe(224)
    expect(box.axisTop).toBe(20)
    expect(box.labelY).toBe(242)
    expect(box.labelX).toBe(4)
  })

  test('falls back to the mock size before anything is measured', () => {
    expect(plotBox(0, 0)).toEqual(plotBox(460, 248))
  })
})

describe('xOf / yOf', () => {
  const box = plotBox(460, 248)

  test('places the domain ends at the plot edges', () => {
    expect(xOf(0, linearDomain, box)).toBeCloseTo(box.left, 9)
    expect(xOf(100, linearDomain, box)).toBeCloseTo(box.right, 9)
    expect(yOf(0, linearDomain, box)).toBeCloseTo(box.bottom, 9)
    expect(yOf(100, linearDomain, box)).toBeCloseTo(box.top, 9)
  })
})

describe('toPlotPoints / toPolyline', () => {
  test('projects points and renders them as an SVG points string', () => {
    const box = plotBox(460, 248)
    const points = toPlotPoints(
      [
        { step: 0, value: 0 },
        { step: 100, value: 100 },
      ],
      linearDomain,
      linearDomain,
      box,
    )
    expect(points).toHaveLength(2)
    expect(points[0]).toMatchObject({ step: 0, value: 0 })
    expect(toPolyline(points)).toBe(
      `${points[0]?.x.toFixed(1)},${points[0]?.y.toFixed(1)} ${points[1]?.x.toFixed(1)},${points[1]?.y.toFixed(1)}`,
    )
  })
})

describe('unitInBox', () => {
  test('0 at left/bottom, 1 at right/top', () => {
    const box = plotBox(460, 248)
    expect(unitInBox(box.left, box.bottom, box)).toEqual({ x: 0, y: 0 })
    expect(unitInBox(box.right, box.top, box)).toEqual({ x: 1, y: 1 })
  })

  test('clamps outside the plot rectangle', () => {
    const box = plotBox(460, 248)
    expect(unitInBox(box.left - 100, box.bottom + 100, box)).toEqual({ x: 0, y: 0 })
    expect(unitInBox(box.right + 100, box.top - 100, box)).toEqual({ x: 1, y: 1 })
  })
})

describe('dragToDomain', () => {
  const box = plotBox(460, 248)

  test('a real drag becomes an exact domain on each axis', () => {
    const rect = { x0: box.left, y0: box.bottom, x1: box.right, y1: box.top }
    const domain = dragToDomain(rect, linearDomain, linearDomain, box)
    expect(domain).not.toBeNull()
    expect(domain?.x.lo).toBeCloseTo(0, 9)
    expect(domain?.x.hi).toBeCloseTo(100, 9)
    expect(domain?.y.lo).toBeCloseTo(0, 9)
    expect(domain?.y.hi).toBeCloseTo(100, 9)
  })

  test('a drag too small on either axis is not a zoom', () => {
    const rect = { x0: box.left, y0: box.bottom, x1: box.left + 1, y1: box.top }
    expect(dragToDomain(rect, linearDomain, linearDomain, box)).toBeNull()
  })
})
