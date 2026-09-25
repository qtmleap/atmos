import { describe, expect, test } from 'bun:test'
import {
  formatStepTick,
  type LoadedJobSeries,
  metricCharts,
  nearestPoint,
  projectChartRuns,
  type RenderedRun,
  resolveHighlight,
} from '../../src/app/hooks/use-compare-chart'
import { plotBox, toPlotPoints } from '../../src/app/lib/chart-geometry'

describe('formatStepTick', () => {
  test('rounds to the nearest thousand above 1000', () => {
    expect(formatStepTick(1500)).toBe('2k')
    expect(formatStepTick(12000)).toBe('12k')
  })

  test('leaves small steps as a plain rounded number', () => {
    expect(formatStepTick(0)).toBe('0')
    expect(formatStepTick(42.4)).toBe('42')
    expect(formatStepTick(999)).toBe('999')
  })
})

describe('metricCharts', () => {
  const loaded: LoadedJobSeries[] = [
    {
      jobId: 'j1',
      series: [
        {
          key: 'train/loss',
          points: [
            { step: 0, value: 1 },
            { step: 10, value: 0.5 },
          ],
          latest: { step: 10, value: 0.5 },
          min: 0.5,
          max: 1,
        },
      ],
    },
    {
      jobId: 'j2',
      series: [
        {
          key: 'train/loss',
          points: [
            { step: 0, value: 2 },
            { step: 10, value: 1 },
          ],
          latest: { step: 10, value: 1 },
          min: 1,
          max: 2,
        },
      ],
    },
  ]
  const labels = new Map([
    ['j1', 'job one'],
    ['j2', 'job two'],
  ])
  const order = new Map([
    ['j1', 0],
    ['j2', 1],
  ])

  test('builds one chart per key, one run per visible job, on a shared domain', () => {
    const charts = metricCharts(
      ['train/loss'],
      loaded,
      labels,
      order,
      new Set(['j1', 'j2']),
      'linear',
      'linear',
      0,
    )
    expect(charts).toHaveLength(1)
    const [chart] = charts
    expect(chart?.key).toBe('train/loss')
    expect(chart?.runs.map((run) => run.jobId)).toEqual(['j1', 'j2'])
    expect(chart?.runs.map((run) => run.label)).toEqual(['job one', 'job two'])
    // yMin/yMax across both jobs is 0.5..2, so the domain covers it.
    expect(chart?.yDomain.lo).toBeLessThanOrEqual(0.5)
    expect(chart?.yDomain.hi).toBeGreaterThanOrEqual(2)
    // no smoothing: the smoothed line is the same as raw
    expect(chart?.runs[0]?.smoothed).toEqual(chart?.runs[0]?.raw)
  })

  test('a job outside visibleJobIds (filtered out by name) is dropped', () => {
    const charts = metricCharts(
      ['train/loss'],
      loaded,
      labels,
      order,
      new Set(['j1']),
      'linear',
      'linear',
      0,
    )
    expect(charts[0]?.runs.map((run) => run.jobId)).toEqual(['j1'])
  })

  test('smoothing above 0 lags a step change (matches lib/smoothing.ts directly)', () => {
    // A step function spread over many points, as lib/smoothing.ts's own test
    // uses: two points a full training run apart barely smooth at all, so a
    // dense series is needed to see the effect.
    const steps = Array.from({ length: 101 }, (_, index) => index * 10)
    const points = steps.map((step) => ({ step, value: step < 500 ? 0 : 10 }))
    const latest = points.at(-1)
    if (latest === undefined) {
      throw new Error('expected a last point')
    }
    const dense: LoadedJobSeries[] = [
      { jobId: 'j1', series: [{ key: 'train/loss', points, latest, min: 0, max: 10 }] },
    ]
    const charts = metricCharts(
      ['train/loss'],
      dense,
      labels,
      order,
      new Set(['j1']),
      'linear',
      'linear',
      0.9,
    )
    const run = charts[0]?.runs[0]
    if (run === undefined) {
      throw new Error('expected a run')
    }
    expect(run.smoothed).not.toEqual(run.raw)
    expect(run.smoothed).toHaveLength(run.raw.length)
    const atTheJump = steps.indexOf(510)
    expect(run.smoothed[atTheJump]?.value).toBeLessThan(10)
    expect(run.smoothed[atTheJump]?.value).toBeGreaterThan(0)
  })

  test('a job whose id has no colour order or is not loaded for the key produces no run', () => {
    const charts = metricCharts(
      ['does/not-exist'],
      loaded,
      labels,
      order,
      new Set(['j1', 'j2']),
      'linear',
      'linear',
      0,
    )
    expect(charts[0]?.runs).toEqual([])
  })
})

describe('nearestPoint', () => {
  const box = plotBox(460, 248)
  const xDomain = { kind: 'linear' as const, lo: 0, hi: 100, ticks: [] }
  const yDomain = { kind: 'linear' as const, lo: 0, hi: 100, ticks: [] }
  const runs = projectChartRuns(
    [
      {
        jobId: 'j1',
        label: 'job one',
        color: 0,
        raw: [{ step: 50, value: 50 }],
        smoothed: [{ step: 50, value: 50 }],
      },
    ],
    xDomain,
    yDomain,
    box,
  )
  const [target] = toPlotPoints([{ step: 50, value: 50 }], xDomain, yDomain, box)

  test('picks the point within the hit radius', () => {
    if (target === undefined) {
      throw new Error('expected a projected point')
    }
    const hit = nearestPoint(runs, target.x + 2, target.y - 2)
    expect(hit?.run.jobId).toBe('j1')
    expect(hit?.point.step).toBe(50)
  })

  test('returns null when nothing is within reach', () => {
    expect(nearestPoint(runs, 0, 0)).toBeNull()
  })
})

describe('resolveHighlight', () => {
  const run: RenderedRun = {
    jobId: 'j1',
    label: 'job one',
    color: 0,
    raw: [],
    points: [],
  }
  const hover = { run, point: { x: 0, y: 0, step: 50, value: 50 } }

  test('a pointer hover wins over a legend highlight', () => {
    expect(resolveHighlight(hover, 'someone-else')).toBe(run.jobId)
  })

  test('falls back to the legend highlight when nothing is hovered', () => {
    expect(resolveHighlight(null, 'j2')).toBe('j2')
  })

  test('is null when neither the pointer nor the legend is highlighting anything', () => {
    expect(resolveHighlight(null, null)).toBeNull()
  })
})
