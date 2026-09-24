import { useCallback, useMemo } from 'react'
import type { LiveMessage } from '@/shared/types'
import { liveUrl } from '../lib/live'
import { useJob } from './use-job'
import { useJobLive } from './use-job-live'
import { useJobLogs } from './use-job-logs'
import { useJobMedia } from './use-job-media'
import { useJobMetrics } from './use-job-metrics'
import { type LinkedProject, useJobProject } from './use-job-project'
import { useNow } from './use-now'

/** The later of two ISO instants; null only when both are null. */
const later = (a: string | null, b: string | null): string | null =>
  a === null ? b : b === null || a > b ? a : b

/**
 * Everything the run page shows, loaded over REST and, while the job is
 * running, kept current through the live WebSocket. `linkedProject` is the
 * project carried by the router state, when the page was reached by a link.
 */
export function useJobDetail(
  projectId: string,
  jobId: string,
  linkedProject: LinkedProject | null,
) {
  const job = useJob(projectId, jobId)
  const metrics = useJobMetrics(projectId, jobId)
  const logs = useJobLogs(projectId, jobId)
  const images = useJobMedia(projectId, jobId, 'image')
  const audio = useJobMedia(projectId, jobId, 'audio')
  const { project, owner } = useJobProject(projectId, linkedProject)
  // Only the project owner can create a job (`POST /:project_id/jobs` is
  // behind canWriteProject), so `Job.created_by` is always the owner. If that
  // ever loosens, look the creator up by `job.created_by` instead.
  const creator = owner

  const running = job.job !== null && job.job.status === 'running'
  const url = useMemo(
    () => (running ? liveUrl(window.location, projectId, jobId) : null),
    [running, projectId, jobId],
  )

  const onMessage = useCallback(
    (message: LiveMessage) => {
      switch (message.type) {
        case 'metric':
          metrics.pushLive(message.data)
          return
        case 'log':
          logs.pushLive(message.data)
          return
        case 'media':
          if (message.data.kind === 'image') {
            images.pushLive(message.data)
          } else {
            audio.pushLive(message.data)
          }
          return
        case 'status':
          job.applyStatus(message.data)
          return
      }
    },
    [metrics.pushLive, logs.pushLive, images.pushLive, audio.pushLive, job.applyStatus],
  )

  // The REST loads and the socket race each other: whatever was logged between
  // a finished REST load and the socket opening (or while reconnecting) is
  // fetched here. Merging by id makes the overlap harmless.
  const onOpen = useCallback(() => {
    job.refresh()
    metrics.catchUp()
    if (logs.lines.length > 0) {
      logs.loadNewer()
    }
    images.refreshHead()
    audio.refreshHead()
  }, [
    job.refresh,
    metrics.catchUp,
    logs.lines.length,
    logs.loadNewer,
    images.refreshHead,
    audio.refreshHead,
  ])

  const connection = useJobLive(url, { onMessage, onOpen, onEnded: job.refresh })
  const now = useNow(1000, running)

  /** When the newest metric or log line held was logged ("最終受信"). */
  const lastLine = logs.lines.at(-1)
  const lastReceivedAt = later(
    metrics.lastLoggedAt,
    lastLine === undefined ? null : lastLine.logged_at,
  )

  return {
    job,
    project,
    creator,
    metrics,
    logs,
    images,
    audio,
    connection,
    now,
    lastReceivedAt,
  }
}

export type JobDetail = ReturnType<typeof useJobDetail>
