import { describe, expect, test } from 'bun:test'
import { chartGridColsClass } from '../../src/app/lib/chart-size'

describe('chartGridColsClass', () => {
  test('uses the size columns when the group fills them', () => {
    expect(chartGridColsClass('s', 3)).toBe('grid-cols-3')
    expect(chartGridColsClass('m', 3)).toBe('grid-cols-2 @6xl:grid-cols-3')
    expect(chartGridColsClass('l', 5)).toBe('grid-cols-1')
  })

  test('widens a lone chart to the full row', () => {
    expect(chartGridColsClass('s', 1)).toBe('grid-cols-1')
    expect(chartGridColsClass('m', 1)).toBe('grid-cols-1')
  })

  test('splits two charts in half even where three columns would fit', () => {
    expect(chartGridColsClass('s', 2)).toBe('grid-cols-2')
    expect(chartGridColsClass('m', 2)).toBe('grid-cols-2')
  })
})
