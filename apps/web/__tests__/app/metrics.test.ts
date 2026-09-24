import { describe, expect, test } from 'bun:test'
import { yAxisDesignWidth } from '../../src/app/components/job/metric-chart'
import {
  arrangeMetricCharts,
  downsample,
  formatMetricShort,
  formatMetricStat,
  formatStep,
  formatStepShort,
  formatTicks,
  groupMetricsBySeries,
  lastLoggedAt,
  latestStep,
  niceTicks,
  reuseUnchangedSeries,
  seriesColor,
  summaryStats,
} from '../../src/app/lib/metrics'
import { metric } from './fixtures'

describe('groupMetricsBySeries', () => {
  test('one series per key, sorted by key and by step', () => {
    const series = groupMetricsBySeries([
      metric(3, 'loss', 2, 0.5),
      metric(1, 'loss', 1, 0.9),
      metric(2, 'acc', 1, 0.1),
    ])
    expect(series.map((s) => s.key)).toEqual(['acc', 'loss'])
    expect(series[1]?.points).toEqual([
      { step: 1, value: 0.9 },
      { step: 2, value: 0.5 },
    ])
    expect(series[1]?.latest).toEqual({ step: 2, value: 0.5 })
    expect(series[1]?.min).toBe(0.5)
    expect(series[1]?.max).toBe(0.9)
  })

  test('a step logged twice keeps the later write (larger id), ids compared numerically', () => {
    const series = groupMetricsBySeries([metric(10, 'loss', 1, 2), metric(9, 'loss', 1, 1)])
    expect(series[0]?.points).toEqual([{ step: 1, value: 2 }])
  })

  test('min and max work for series longer than the spread argument limit', () => {
    const many = Array.from({ length: 200_000 }, (_, i) => metric(i + 1, 'x', i, i))
    const [series] = groupMetricsBySeries(many)
    expect(series?.min).toBe(0)
    expect(series?.max).toBe(199_999)
  })
})

describe('downsample', () => {
  const points = Array.from({ length: 101 }, (_, i) => ({ step: i, value: i }))

  test('keeps short series as they are', () => {
    expect(downsample(points, 200)).toBe(points)
  })

  test('keeps the first and last point', () => {
    const thinned = downsample(points, 11)
    expect(thinned.length).toBe(11)
    expect(thinned[0]?.step).toBe(0)
    expect(thinned.at(-1)?.step).toBe(100)
  })
})

describe('reuseUnchangedSeries', () => {
  test('returns the old object when nothing changed and the new one otherwise', () => {
    const before = groupMetricsBySeries([metric(1, 'a', 1, 1), metric(2, 'b', 1, 1)])
    const after = groupMetricsBySeries([
      metric(1, 'a', 1, 1),
      metric(2, 'b', 1, 1),
      metric(3, 'b', 2, 0.5),
    ])
    const reused = reuseUnchangedSeries(before, after)
    expect(reused[0]).toBe(before[0])
    expect(reused[1]).toBe(after[1])
  })
})

describe('arrangeMetricCharts', () => {
  const series = groupMetricsBySeries([
    metric(1, 'train/loss', 1, 1),
    metric(2, 'val/loss', 1, 1),
    metric(3, 'lr', 1, 1),
    metric(4, 'grad_norm', 1, 1),
    metric(5, 'val/acc', 1, 1),
  ])

  test('pairs train/x with val/x first, then losses, rates, the rest by name', () => {
    const specs = arrangeMetricCharts(series)
    expect(specs.map((s) => s.id)).toEqual([
      'pair:loss',
      'train/loss',
      'lr',
      'grad_norm',
      'val/acc',
    ])
    expect(specs[0]?.title).toBe('学習・検証損失')
    expect(specs[0]?.mono).toBe(false)
    expect(specs[0]?.series.map((s) => s.key)).toEqual(['train/loss', 'val/loss'])
    expect(specs[1]?.mono).toBe(true)
  })

  test('learning rates take the third colour', () => {
    expect(seriesColor('lr')).toBe(2)
    expect(seriesColor('train/learning_rate')).toBe(2)
    expect(seriesColor('train/loss')).toBe(0)
  })
})

describe('summaryStats', () => {
  test('prefers train/loss, val/loss and lr, filling with the rest', () => {
    const series = groupMetricsBySeries([
      metric(1, 'grad_norm', 1, 2),
      metric(2, 'train/loss', 1, 0.5),
      metric(3, 'lr', 1, 1e-4),
    ])
    expect(summaryStats(series, 3)).toEqual([
      { key: 'train/loss', label: '学習損失', value: 0.5 },
      { key: 'lr', label: '学習率', value: 1e-4 },
      { key: 'grad_norm', label: '勾配ノルム', value: 2 },
    ])
  })

  test('lists the preferred keys with null before anything is logged', () => {
    expect(summaryStats([], 3).map((s) => [s.key, s.value])).toEqual([
      ['train/loss', null],
      ['val/loss', null],
      ['lr', null],
    ])
  })

  test('latestStep and lastLoggedAt read the newest row', () => {
    const rows = [
      metric(1, 'a', 5, 1),
      { ...metric(2, 'b', 9, 1), logged_at: '2026-09-24T01:00:00Z' },
    ]
    expect(latestStep(groupMetricsBySeries(rows))).toBe(9)
    expect(lastLoggedAt(rows)).toBe('2026-09-24T01:00:00Z')
    expect(latestStep([])).toBeNull()
    expect(lastLoggedAt([])).toBeNull()
  })
})

describe('formatting', () => {
  test('steps', () => {
    expect(formatStep(48000)).toBe('48,000')
    expect(formatStepShort(16000)).toBe('16k')
    expect(formatStepShort(15333)).toBe('15.3k')
    expect(formatStepShort(800)).toBe('800')
  })

  test('values: trimmed mantissa in charts, three digits in the summary', () => {
    expect(formatMetricShort(0.1824)).toBe('0.1824')
    expect(formatMetricShort(1.2e-4)).toBe('1.2e-4')
    expect(formatMetricShort(3e-4)).toBe('3e-4')
    expect(formatMetricStat(1.2e-4)).toBe('1.20e-4')
    expect(formatMetricStat(0.21084)).toBe('0.2108')
  })
})

describe('niceTicks', () => {
  test('rules the axis the way the mocks do', () => {
    expect(niceTicks(0.1759, 0.92)).toEqual([0.1, 0.4, 0.7, 1])
    expect(niceTicks(0, 2.98e-4)).toEqual([0, 0.00015, 0.0003])
    expect(niceTicks(1.68, 5.2)).toEqual([0, 3, 6])
  })

  test('a flat series is one tick; labels share their decimals', () => {
    expect(niceTicks(0.5, 0.5)).toEqual([0.5])
    const ticks = niceTicks(0.1759, 0.92)
    expect(ticks.map(formatTicks(ticks))).toEqual(['0.1', '0.4', '0.7', '1.0'])
    const rates = niceTicks(0, 2.98e-4)
    expect(rates.map(formatTicks(rates))).toEqual(['0', '1.5e-4', '3e-4'])
  })
})

describe('yAxisDesignWidth', () => {
  test('keeps the mocks 44px for short labels and widens to their 52px for 1.5e-4', () => {
    expect(yAxisDesignWidth(['0.1', '0.4', '0.7', '1.0'])).toBe(44)
    expect(yAxisDesignWidth(['0', '3', '6'])).toBe(44)
    expect(yAxisDesignWidth([])).toBe(44)
    expect(yAxisDesignWidth(['0', '1.5e-4', '3e-4'])).toBe(52)
    expect(yAxisDesignWidth(['1.2e+10', '2.4e+10'])).toBeGreaterThan(52)
  })
})
