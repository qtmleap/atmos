// Object storage (R2, or the media volume of the Bun server) cleanup for
// job/project deletion (docs/SPEC.md §7/§6 DELETE).
//
// D1 foreign keys are declared `onDelete: 'cascade'` (src/db/schema.ts) and
// deleting the parent row does cascade through jobs -> metrics/logs/media_assets
// in this environment (verified against the miniflare-backed D1 used by the
// route tests; PostgreSQL cascades the same way), so a DELETE handler only has to remove the D1 row itself.
// R2 never sees that cascade, so every `media_assets.r2_key` under the job(s)
// being deleted must be removed from the bucket explicitly, before or after
// the D1 delete.
import { eq } from 'drizzle-orm'
import { type Db, jobs, mediaAssets } from '#schema'
import type { ObjectStorage } from '../platform/types'

/** R2Bucket.delete accepts at most 1000 keys per call (ObjectStorage.delete keeps that limit). */
const R2_DELETE_BATCH_SIZE = 1000

const deleteKeys = async (bucket: ObjectStorage, keys: readonly string[]): Promise<void> => {
  for (let i = 0; i < keys.length; i += R2_DELETE_BATCH_SIZE) {
    await bucket.delete(keys.slice(i, i + R2_DELETE_BATCH_SIZE))
  }
}

/** Deletes every R2 object backing `jobId`'s media assets. Call before deleting the job row. */
export const deleteJobMedia = async (
  bucket: ObjectStorage,
  db: Db,
  jobId: string,
): Promise<void> => {
  const rows = await db
    .select({ r2Key: mediaAssets.r2Key })
    .from(mediaAssets)
    .where(eq(mediaAssets.jobId, jobId))
  await deleteKeys(
    bucket,
    rows.map((row) => row.r2Key),
  )
}

/** Deletes every R2 object backing `projectId`'s jobs' media assets. Call before deleting the project row. */
export const deleteProjectMedia = async (
  bucket: ObjectStorage,
  db: Db,
  projectId: string,
): Promise<void> => {
  // A join rather than `inArray(jobIds)`: D1 caps bound parameters at 100 per
  // query, which a project with many jobs would exceed.
  const rows = await db
    .select({ r2Key: mediaAssets.r2Key })
    .from(mediaAssets)
    .innerJoin(jobs, eq(mediaAssets.jobId, jobs.id))
    .where(eq(jobs.projectId, projectId))
  await deleteKeys(
    bucket,
    rows.map((row) => row.r2Key),
  )
}
