// Worker-side entry points to the per-job JobLive Durable Object.
//
// Ingest routes, after writing to D1:
//   c.executionCtx.waitUntil(notifyLive(c.env, jobId, { type: 'metric', data: metric }))
// Batch ingest routes send the whole batch in one call:
//   c.executionCtx.waitUntil(notifyLiveMany(c.env, jobId, messages))
// The live route, after the visibility check:
//   return connectLive(c.env, jobId, c.req.raw)
import type { LiveMessage } from '../../shared/types'
import type { JobLive, NotifyResult } from '../durable-objects/job-live'

export interface LiveEnv {
  JOB_LIVE: DurableObjectNamespace<JobLive>
}

const stubFor = (env: LiveEnv, jobId: string) => env.JOB_LIVE.get(env.JOB_LIVE.idFromName(jobId))

/**
 * Pushes `message` to every browser watching `jobId`. A `status` message for a
 * finished/failed job also closes their sockets with 1000.
 *
 * Live delivery is best effort: the data is already in D1, so a failure here
 * is logged and reported as `{ delivered: 0 }` instead of failing the ingest.
 */
export const notifyLive = async (
  env: LiveEnv,
  jobId: string,
  message: LiveMessage,
): Promise<NotifyResult> => {
  try {
    return await stubFor(env, jobId).notify(message)
  } catch (error) {
    console.error('notifyLive failed', jobId, error)
    return { delivered: 0 }
  }
}

/**
 * Pushes `messages`, in order, to every browser watching `jobId` with a single
 * RPC to the job's Durable Object. Batch ingest uses this instead of calling
 * `notifyLive` per row: one subrequest per request instead of one per row, and
 * one stub, so the frames keep the insertion order.
 *
 * Best effort like `notifyLive`; an empty batch makes no RPC.
 */
export const notifyLiveMany = async (
  env: LiveEnv,
  jobId: string,
  messages: readonly LiveMessage[],
): Promise<NotifyResult> => {
  if (messages.length === 0) {
    return { delivered: 0 }
  }
  try {
    return await stubFor(env, jobId).notifyMany(messages)
  } catch (error) {
    console.error('notifyLiveMany failed', jobId, error)
    return { delivered: 0 }
  }
}

/**
 * Hands a WebSocket upgrade request over to the job's Durable Object and
 * returns its 101 response. Authentication and visibility must already be
 * checked (docs/SPEC.md §11): the Durable Object does not check anything.
 */
export const connectLive = (env: LiveEnv, jobId: string, request: Request): Promise<Response> =>
  stubFor(env, jobId).fetch(request)
