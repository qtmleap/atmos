import type { Job } from '@/shared/types'
import type { JobSeries } from '../hooks/use-compare-metrics'
import { latestStep } from './metrics'

/** One row of the "選択中のジョブ" table. */
export interface SelectedJobRow {
  job: Job
  /** Highest step received for the job; null before its metrics arrive or when it has none. */
  lastStep: number | null
}

/** The selected jobs in `selected` order, each with the last step its loaded series reached. */
export const selectedJobRows = (
  jobs: readonly Job[],
  selected: readonly string[],
  loaded: readonly JobSeries[],
): SelectedJobRow[] => {
  const byId = new Map(jobs.map((job) => [job.id, job]))
  const seriesById = new Map(loaded.map((entry) => [entry.jobId, entry.series]))
  return selected.flatMap((id) => {
    const job = byId.get(id)
    if (job === undefined) {
      return []
    }
    const series = seriesById.get(id)
    return [{ job, lastStep: series === undefined ? null : latestStep(series) }]
  })
}
