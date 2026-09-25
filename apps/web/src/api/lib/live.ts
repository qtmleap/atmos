// Entry points to the live hub of the platform: the per-job JobLive Durable
// Object on Cloudflare, an in-process socket registry on the Bun server.
//
// Ingest routes, after writing to the database:
//   platform.waitUntil(notifyLive(platform.live, jobId, { type: 'metric', data: metric }))
// Batch ingest routes send the whole batch in one call:
//   platform.waitUntil(notifyLiveMany(platform.live, jobId, messages))
// The live route, after the visibility check:
//   return connectLive(platform.live, jobId, c.req.raw)
import type { LiveMessage } from '../../shared/types'
import type { NotifyResult } from '../durable-objects/job-live'
import type { LiveHub } from '../platform/types'

/**
 * Pushes `message` to every browser watching `jobId`. A `status` message for a
 * finished/failed job also closes their sockets with 1000.
 *
 * Live delivery is best effort: the data is already stored, so a failure here
 * is logged and reported as `{ delivered: 0 }` instead of failing the ingest.
 */
export const notifyLive = async (
  hub: LiveHub,
  jobId: string,
  message: LiveMessage,
): Promise<NotifyResult> => {
  try {
    return await hub.notify(jobId, message)
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
  hub: LiveHub,
  jobId: string,
  messages: readonly LiveMessage[],
): Promise<NotifyResult> => {
  if (messages.length === 0) {
    return { delivered: 0 }
  }
  try {
    return await hub.notifyMany(jobId, messages)
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
export const connectLive = (hub: LiveHub, jobId: string, request: Request): Promise<Response> =>
  hub.connect(jobId, request)
