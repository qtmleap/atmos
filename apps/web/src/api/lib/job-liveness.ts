import dayjs from 'dayjs'
import { and, eq, lt } from 'drizzle-orm'
import { type Db, jobs } from '#schema'
import type { LiveHub } from '../platform/types'
import { toIsoString } from './ids'
import { notifyLive } from './live'

export const JOB_STALE_AFTER_SECONDS = 15 * 60

/** Fail running jobs whose heartbeat and data have been silent for 15 minutes. */
export const failStaleJobs = async (
  db: Db,
  live: LiveHub,
  currentTime: Date = dayjs().toDate(),
): Promise<number> => {
  const cutoff = dayjs(currentTime).subtract(JOB_STALE_AFTER_SECONDS, 'second').toDate()
  const stale = await db
    .update(jobs)
    .set({ status: 'failed', finishedAt: currentTime })
    .where(and(eq(jobs.status, 'running'), lt(jobs.lastActivityAt, cutoff)))
    .returning({ id: jobs.id })
  await Promise.all(
    stale.map(({ id }) =>
      notifyLive(live, id, {
        type: 'status',
        data: { status: 'failed', finished_at: toIsoString(currentTime) },
      }),
    ),
  )
  return stale.length
}
