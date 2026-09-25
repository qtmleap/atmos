import type { Job } from '@/shared/types'

/**
 * Where a run stands for the page's notes: `waiting` is a running job that
 * has not reported anything yet (no metric or log line received).
 */
export type JobPhase = 'waiting' | 'running' | 'finished' | 'failed'

export const jobPhase = (status: Job['status'], lastReceivedAt: string | null): JobPhase =>
  status === 'running' ? (lastReceivedAt === null ? 'waiting' : 'running') : status

/** The note right of the section tabs. */
export const TOOLBAR_NOTES: Readonly<Record<JobPhase, string>> = {
  waiting: '受信待ち',
  running: '横軸：ステップ · 全期間',
  finished: '横軸：ステップ · 全期間',
  failed: '終了時点のデータ',
}

/** The note right of an ended run's pair chart, and of its title row. */
export const ENDED_NOTES: Readonly<Record<'finished' | 'failed', string>> = {
  finished: '最終結果',
  failed: '更新終了',
}

/** The note right of the log header. */
export const logHeaderNote = (phase: JobPhase, following: boolean): string => {
  switch (phase) {
    case 'waiting':
      return '未受信 · UTC'
    case 'running':
      return following ? '自動追従中 · UTC' : '追従停止中 · UTC'
    case 'finished':
      return '最終ログ · UTC'
    case 'failed':
      return '最終ログ · 更新終了 · UTC'
  }
}
