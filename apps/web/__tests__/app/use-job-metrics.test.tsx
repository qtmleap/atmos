import { afterEach, describe, expect, test } from 'bun:test'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useJobMetrics } from '../../src/app/hooks/use-job-metrics'
import { METRICS_PAGINATION_MAX_LIMIT, type Metric } from '../../src/shared/types'
import { installFetch, restoreFetch } from './fetch-stub'

const path = '/api/projects/project/jobs/job/metrics'
const metric = (id: number): Metric => ({
  id: String(id),
  job_id: 'job',
  step: id,
  key: 'train/loss',
  value: 1 / id,
  logged_at: '2026-09-24T00:00:00.000Z',
})

afterEach(() => {
  cleanup()
  restoreFetch()
})

describe('useJobMetrics', () => {
  test('loads more than 100 rows in one initial request and uses a cursor for catch-up', async () => {
    const items = Array.from({ length: 250 }, (_, index) => metric(index + 1))
    const requests = installFetch({
      [path]: (url) =>
        url.searchParams.has('cursor')
          ? { items: [metric(251)], next_cursor: null }
          : { items, next_cursor: null },
    })
    const { result } = renderHook(() => useJobMetrics('project', 'job'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
    expect(result.current.count).toBe(250)
    expect(requests).toEqual([`${path}?limit=${METRICS_PAGINATION_MAX_LIMIT}`])

    act(() => result.current.catchUp())
    await waitFor(() => expect(result.current.count).toBe(251))
    expect(requests[1]).toBe(`${path}?limit=100&cursor=250`)
  })

  test('keeps the large page size across initial history pages without losing rows', async () => {
    const items = Array.from({ length: METRICS_PAGINATION_MAX_LIMIT }, (_, index) =>
      metric(index + 1),
    )
    const requests = installFetch({
      [path]: (url) =>
        url.searchParams.has('cursor')
          ? { items: [metric(METRICS_PAGINATION_MAX_LIMIT + 1)], next_cursor: null }
          : { items, next_cursor: 'history-next' },
    })
    const { result } = renderHook(() => useJobMetrics('project', 'job'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.count).toBe(METRICS_PAGINATION_MAX_LIMIT + 1)
    expect(requests).toEqual([
      `${path}?limit=${METRICS_PAGINATION_MAX_LIMIT}`,
      `${path}?limit=${METRICS_PAGINATION_MAX_LIMIT}&cursor=history-next`,
    ])
  })
})
