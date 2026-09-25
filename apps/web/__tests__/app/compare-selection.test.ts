import { describe, expect, test } from 'bun:test'
import { selectedJobRows } from '../../src/app/lib/compare-selection'
import { groupMetricsBySeries } from '../../src/app/lib/metrics'
import { job, metric } from './fixtures'

describe('selectedJobRows', () => {
  const a = job({ id: 'job_a', name: 'a' })
  const b = job({ id: 'job_b', name: 'b' })

  test('keeps the selection order and skips unknown ids', () => {
    const rows = selectedJobRows([a, b], ['job_b', 'job_missing', 'job_a'], [])
    expect(rows.map((row) => row.job.id)).toEqual(['job_b', 'job_a'])
  })

  test('the last step is null without series and the highest step with them', () => {
    const series = groupMetricsBySeries([metric(1, 'loss', 100, 1), metric(2, 'lr', 300, 0.1)])
    const rows = selectedJobRows(
      [a, b],
      ['job_a', 'job_b'],
      [
        { jobId: 'job_a', series, keyOrder: ['loss', 'lr'] },
        { jobId: 'job_b', series: [], keyOrder: [] },
      ],
    )
    expect(rows.map((row) => row.lastStep)).toEqual([300, null])
  })
})
