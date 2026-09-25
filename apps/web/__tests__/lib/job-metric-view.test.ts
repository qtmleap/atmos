import { describe, expect, test } from 'bun:test'
import {
  type JobChartOptions,
  jobChartGroups,
  PAIR_GROUP_TITLE,
} from '../../src/app/lib/job-metric-view'
import type { MetricSeries } from '../../src/app/lib/metrics'

const series = (key: string, points: MetricSeries['points']): MetricSeries => {
  const latest = points.at(-1)
  if (latest === undefined) {
    throw new Error('expected at least one point')
  }
  const values = points.map((point) => point.value)
  return { key, points, latest, min: Math.min(...values), max: Math.max(...values) }
}

const ALL_SERIES: MetricSeries[] = [
  series('train/loss', [
    { step: 0, value: 1 },
    { step: 10, value: 0.5 },
  ]),
  series('val/loss', [
    { step: 0, value: 2 },
    { step: 10, value: 1 },
  ]),
  series('train/acc', [
    { step: 0, value: 0.1 },
    { step: 10, value: 0.9 },
  ]),
  series('lr', [
    { step: 0, value: 1e-3 },
    { step: 10, value: 5e-4 },
  ]),
  series('grad_norm', [
    { step: 0, value: -1 },
    { step: 10, value: 2 },
  ]),
]

const options = (overrides: Partial<JobChartOptions> = {}): JobChartOptions => ({
  filter: '',
  smooth: 0,
  xKind: 'linear',
  yKind: 'linear',
  ...overrides,
})

describe('jobChartGroups', () => {
  test('no series produces no groups', () => {
    expect(jobChartGroups([], options())).toEqual([])
  })

  test('a leading pair group, then one group per key prefix in display order', () => {
    const groups = jobChartGroups(ALL_SERIES, options())
    expect(groups.map((group) => group.id)).toEqual(['pair', 'train', 'val', 'other'])
    expect(groups[0]?.title).toBe(PAIR_GROUP_TITLE)
    expect(groups[0]?.mono).toBe(false)
    // train/loss is drawn in the pair above and again on its own here.
    expect(groups[1]?.charts.map((chart) => chart.id)).toEqual(['train/loss', 'train/acc'])
    expect(groups[1]?.mono).toBe(true)
    expect(groups[2]?.charts.map((chart) => chart.id)).toEqual(['val/loss'])
    // no-prefix keys: loss-like first, then rates, then the rest alphabetically.
    expect(groups[3]?.charts.map((chart) => chart.id)).toEqual(['lr', 'grad_norm'])
  })

  test('the pair chart pairs train first and val dashed second', () => {
    const [pairGroup] = jobChartGroups(ALL_SERIES, options())
    const pairChart = pairGroup?.charts[0]
    expect(pairChart?.lines.map((line) => line.key)).toEqual(['train/loss', 'val/loss'])
    expect(pairChart?.lines.map((line) => line.color)).toEqual([0, 1])
    expect(pairChart?.lines.map((line) => line.dashed)).toEqual([false, true])
  })

  test('a single chart is coloured by seriesColor: rates navy, the rest orange', () => {
    const groups = jobChartGroups(ALL_SERIES, options())
    const other = groups.find((group) => group.id === 'other')
    const lr = other?.charts.find((chart) => chart.id === 'lr')
    const gradNorm = other?.charts.find((chart) => chart.id === 'grad_norm')
    expect(lr?.lines[0]?.color).toBe(2)
    expect(gradNorm?.lines[0]?.color).toBe(0)
  })

  test('the filter keeps only groups with a matching key, case-insensitive', () => {
    const groups = jobChartGroups(ALL_SERIES, options({ filter: ' LOSS ' }))
    expect(groups.map((group) => group.id)).toEqual(['pair', 'train', 'val'])
    expect(groups[1]?.charts.map((chart) => chart.id)).toEqual(['train/loss'])
    expect(groups[2]?.charts.map((chart) => chart.id)).toEqual(['val/loss'])
  })

  test('a pair survives the filter when only one side matches', () => {
    const groups = jobChartGroups(ALL_SERIES, options({ filter: 'train/loss' }))
    expect(groups[0]?.id).toBe('pair')
    expect(groups[0]?.charts[0]?.lines.map((line) => line.key)).toEqual(['train/loss', 'val/loss'])
  })

  test('a filter matching nothing produces no groups', () => {
    expect(jobChartGroups(ALL_SERIES, options({ filter: 'does-not-exist' }))).toEqual([])
  })

  test('a log axis drops zero and negative points', () => {
    const groups = jobChartGroups(ALL_SERIES, options({ filter: 'grad_norm', yKind: 'log' }))
    const chart = groups[0]?.charts[0]
    expect(chart?.lines[0]?.raw).toEqual([{ step: 10, value: 2 }])
  })

  test('smooth 0 draws the raw points unsmoothed', () => {
    const groups = jobChartGroups(ALL_SERIES, options({ filter: 'train/acc' }))
    const line = groups[0]?.charts[0]?.lines[0]
    expect(line?.smoothed).toEqual(line?.raw)
  })

  test('smooth above 0 lags a step change (lib/smoothing.ts directly)', () => {
    const steps = Array.from({ length: 101 }, (_, index) => index * 10)
    const dense = [
      series(
        'metric',
        steps.map((step) => ({ step, value: step < 500 ? 0 : 10 })),
      ),
    ]
    const groups = jobChartGroups(dense, options({ smooth: 0.9 }))
    const line = groups[0]?.charts[0]?.lines[0]
    if (line === undefined) {
      throw new Error('expected a line')
    }
    expect(line.smoothed).not.toEqual(line.raw)
    expect(line.smoothed).toHaveLength(line.raw.length)
    const atTheJump = steps.indexOf(510)
    expect(line.smoothed[atTheJump]?.value).toBeLessThan(10)
    expect(line.smoothed[atTheJump]?.value).toBeGreaterThan(0)
  })

  test('the domain covers every raw point of the chart', () => {
    const groups = jobChartGroups(ALL_SERIES, options({ filter: 'train/loss' }))
    const chart = groups[0]?.charts[0]
    expect(chart?.yDomain.lo).toBeLessThanOrEqual(0.5)
    expect(chart?.yDomain.hi).toBeGreaterThanOrEqual(2)
    expect(chart?.xDomain.lo).toBeLessThanOrEqual(0)
    expect(chart?.xDomain.hi).toBeGreaterThanOrEqual(10)
  })

  test('a chart with no visible points (all filtered by a log axis) still has a domain', () => {
    const negative = [series('always-negative', [{ step: 0, value: -1 }])]
    const groups = jobChartGroups(negative, options({ yKind: 'log' }))
    const chart = groups[0]?.charts[0]
    expect(chart?.lines[0]?.raw).toEqual([])
    expect(Number.isFinite(chart?.yDomain.lo)).toBe(true)
    expect(Number.isFinite(chart?.yDomain.hi)).toBe(true)
  })
})
