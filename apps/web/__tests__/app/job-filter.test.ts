import { describe, expect, test } from 'bun:test'
import {
  COMPARE_MAX_JOBS,
  defaultCompareSelection,
  filterJobs,
  parseCompareSelection,
  serializeCompareSelection,
} from '../../src/app/lib/job-filter'
import { job } from './fixtures'

// Newest first, as the API lists them: j1 is the newest.
const rows = [
  job({ id: 'j1', name: 'newest', status: 'running', finished_at: null }),
  job({ id: 'j2', name: 'broken', status: 'failed' }),
  job({ id: 'j3', name: 'older' }),
  job({ id: 'j4', name: null }),
]

describe('compare selection in the URL', () => {
  test('an explicit ?jobs= keeps the ids in list order', () => {
    expect(parseCompareSelection('j3,j1', rows)).toEqual(['j1', 'j3'])
  })

  test('ids the list does not have are dropped', () => {
    expect(parseCompareSelection('j1,ghost', rows)).toEqual(['j1'])
  })

  test('an empty ?jobs= means no job', () => {
    expect(parseCompareSelection('', rows)).toEqual([])
    expect(parseCompareSelection(',', rows)).toEqual([])
  })

  test('an absent parameter means the default: the newest jobs that did not fail', () => {
    expect(parseCompareSelection(undefined, rows)).toEqual(['j1', 'j3', 'j4'])
    expect(defaultCompareSelection(rows)).toEqual(['j1', 'j3', 'j4'])
  })

  test('the default stops at the colour count', () => {
    const many = Array.from({ length: COMPARE_MAX_JOBS + 5 }, (_, index) =>
      job({ id: `job-${index}` }),
    )
    const picked = defaultCompareSelection(many)
    expect(picked).toHaveLength(COMPARE_MAX_JOBS)
    expect(picked[0]).toBe('job-0')
    expect(picked[COMPARE_MAX_JOBS - 1]).toBe(`job-${COMPARE_MAX_JOBS - 1}`)
  })

  test('serialize is the inverse of parse for known ids', () => {
    const value = serializeCompareSelection(['j1', 'j3'])
    expect(value).toBe('j1,j3')
    expect(parseCompareSelection(value, rows)).toEqual(['j1', 'j3'])
    expect(serializeCompareSelection([])).toBe('')
  })
})

describe('filterJobs', () => {
  test('matches an unnamed job by its displayed name, not the word null', () => {
    expect(filterJobs(rows, 'all', '名前なし').map((row) => row.id)).toEqual(['j4'])
    expect(filterJobs(rows, 'all', 'null')).toEqual([])
  })

  test('matches by id and by name regardless of case, within the status', () => {
    expect(filterJobs(rows, 'all', 'J3').map((row) => row.id)).toEqual(['j3'])
    expect(filterJobs(rows, 'all', 'NEW').map((row) => row.id)).toEqual(['j1'])
    expect(filterJobs(rows, 'failed', 'j').map((row) => row.id)).toEqual(['j2'])
  })
})
