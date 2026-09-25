import { describe, expect, test } from 'bun:test'
import { jobPhase, logHeaderNote, TOOLBAR_NOTES } from '../../src/app/lib/job-phase'

describe('jobPhase', () => {
  test('a running job that has received nothing is waiting', () => {
    expect(jobPhase('running', null)).toBe('waiting')
  })

  test('a running job with data is running', () => {
    expect(jobPhase('running', '2026-09-24T09:42:18Z')).toBe('running')
  })

  test('ended jobs keep their status whatever was received', () => {
    expect(jobPhase('finished', null)).toBe('finished')
    expect(jobPhase('failed', '2026-09-24T09:42:18Z')).toBe('failed')
  })
})

describe('notes', () => {
  test('the toolbar note of each phase', () => {
    expect(TOOLBAR_NOTES.waiting).toBe('受信待ち')
    expect(TOOLBAR_NOTES.failed).toBe('終了時点のデータ')
  })

  test('the log header note follows the phase and the follow state', () => {
    expect(logHeaderNote('waiting', true)).toBe('未受信 · UTC')
    expect(logHeaderNote('running', true)).toBe('自動追従中 · UTC')
    expect(logHeaderNote('running', false)).toBe('追従停止中 · UTC')
    expect(logHeaderNote('finished', true)).toBe('最終ログ · UTC')
    expect(logHeaderNote('failed', false)).toBe('最終ログ · 更新終了 · UTC')
  })
})
