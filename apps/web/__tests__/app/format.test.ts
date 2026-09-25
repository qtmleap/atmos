import { describe, expect, test } from 'bun:test'
import { flattenConfig } from '../../src/app/lib/config'
import {
  formatBytes,
  formatDuration,
  formatMetricValue,
  jobDisplayName,
} from '../../src/app/lib/format'
import { jobsListPath, parseStatusFilter } from '../../src/app/lib/job-filter'
import { groupMediaByLabel, mergeMedia, sortMediaNewestFirst } from '../../src/app/lib/media'
import { canLoadMore, initialPagedList, pagedListReducer } from '../../src/app/lib/paged-list'
import { projectLinkState, readProjectLinkState } from '../../src/app/lib/project-link'
import { media, PROJECT_ID, project } from './fixtures'

describe('format', () => {
  test('formatDuration', () => {
    const start = '2026-09-24T00:00:00.000Z'
    expect(formatDuration(start, '2026-09-24T01:02:03.000Z', start)).toBe('01:02:03')
    expect(formatDuration(start, null, '2026-09-24T00:03:04.000Z')).toBe('00:03:04')
    expect(formatDuration(start, null, '2026-09-24T00:00:05.000Z')).toBe('00:00:05')
    expect(formatDuration(start, '2026-09-25T03:05:09.000Z', start)).toBe('27:05:09')
  })

  test('formatBytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(25 * 1024 * 1024)).toBe('25.0 MB')
  })

  test('formatMetricValue', () => {
    expect(formatMetricValue(0.123456)).toBe('0.1235')
    expect(formatMetricValue(0)).toBe('0')
    expect(formatMetricValue(0.00001234)).toBe('1.234e-5')
    expect(formatMetricValue(12345678)).toBe('1.235e+7')
    expect(formatMetricValue(Number.NaN)).toBe('NaN')
  })

  test('jobDisplayName falls back to the id head', () => {
    expect(jobDisplayName({ id: 'abcdef0123', name: null })).toBe('名前なし abcdef01')
    expect(jobDisplayName({ id: 'x', name: 'exp1' })).toBe('exp1')
  })
})

describe('flattenConfig', () => {
  test('nested objects and arrays become dotted paths', () => {
    expect(
      flattenConfig({
        lr: 0.001,
        opt: { name: 'adam', betas: [0.9, 0.99] },
        tags: [],
        extra: {},
        on: true,
        x: null,
      }),
    ).toEqual([
      { path: 'lr', value: '0.001', kind: 'number' },
      { path: 'opt.name', value: 'adam', kind: 'string' },
      { path: 'opt.betas.0', value: '0.9', kind: 'number' },
      { path: 'opt.betas.1', value: '0.99', kind: 'number' },
      { path: 'tags', value: '[]', kind: 'empty' },
      { path: 'extra', value: '{}', kind: 'empty' },
      { path: 'on', value: 'true', kind: 'boolean' },
      { path: 'x', value: 'null', kind: 'null' },
    ])
  })
})

describe('job filter', () => {
  test('unknown status values mean all', () => {
    expect(parseStatusFilter('running')).toBe('running')
    expect(parseStatusFilter('bogus')).toBe('all')
    expect(parseStatusFilter(undefined)).toBe('all')
  })

  test('jobsListPath', () => {
    expect(jobsListPath('p 1', 'all')).toBe('/api/projects/p%201/jobs')
    expect(jobsListPath('p', 'failed')).toBe('/api/projects/p/jobs?status=failed')
  })
})

describe('pagedListReducer', () => {
  test('appends pages and tracks the cursor', () => {
    const first = pagedListReducer(initialPagedList<number>(), {
      type: 'page',
      page: { items: [1, 2], next_cursor: 'c1' },
    })
    expect(canLoadMore(first)).toBe(true)
    const loading = pagedListReducer(first, { type: 'request' })
    expect(canLoadMore(loading)).toBe(false)
    const second = pagedListReducer(loading, {
      type: 'page',
      page: { items: [3], next_cursor: null },
    })
    expect(second.items).toEqual([1, 2, 3])
    expect(canLoadMore(second)).toBe(false)
  })

  test('a failure ends the initial state and keeps items', () => {
    const failed = pagedListReducer(initialPagedList<number>(), { type: 'failure', message: 'x' })
    expect(failed.initial).toBe(false)
    expect(failed.error).toBe('x')
  })
})

describe('project link state', () => {
  test('round trips and rejects a state for another project', () => {
    const state = projectLinkState(project())
    expect(readProjectLinkState(state, PROJECT_ID)?.name).toBe('音声合成の実験')
    expect(readProjectLinkState(state, 'other')).toBeNull()
    expect(readProjectLinkState(null, PROJECT_ID)).toBeNull()
    expect(readProjectLinkState({ project: { id: PROJECT_ID } }, PROJECT_ID)).toBeNull()
  })
})

describe('media', () => {
  test('groups by label, each ordered by step', () => {
    const groups = groupMediaByLabel([media('a', 'z', 2), media('b', 'a', 1), media('c', 'z', 1)])
    expect(groups.map((g) => g.label)).toEqual(['a', 'z'])
    expect(groups[1]?.assets.map((m) => m.id)).toEqual(['c', 'a'])
  })

  test('merge by id and newest first', () => {
    const merged = mergeMedia([media('a', 'x', 1)], [media('a', 'x', 1), media('b', 'x', 3)])
    expect(merged.length).toBe(2)
    expect(sortMediaNewestFirst(merged).map((m) => m.id)).toEqual(['b', 'a'])
  })
})
