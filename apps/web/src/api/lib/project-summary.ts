import { count, inArray, max } from 'drizzle-orm'
import { type Db, jobs, type ProjectRow } from '#schema'

export interface ProjectSummary {
  jobCount: number
  updatedAt: Date
}

/** Summarizes only the projects returned to the viewer, in one query. */
export const loadProjectSummaries = async (
  db: Db,
  projects: ProjectRow[],
): Promise<Map<string, ProjectSummary>> => {
  const summaries = new Map<string, ProjectSummary>(
    projects.map((project) => [project.id, { jobCount: 0, updatedAt: project.createdAt }]),
  )
  if (projects.length === 0) {
    return summaries
  }
  const rows = await db
    .select({
      projectId: jobs.projectId,
      jobCount: count(),
      startedAt: max(jobs.startedAt).mapWith(jobs.startedAt),
      finishedAt: max(jobs.finishedAt).mapWith(jobs.finishedAt),
      lastActivityAt: max(jobs.lastActivityAt).mapWith(jobs.lastActivityAt),
    })
    .from(jobs)
    .where(
      inArray(
        jobs.projectId,
        projects.map((project) => project.id),
      ),
    )
    .groupBy(jobs.projectId)
  for (const row of rows) {
    const summary = summaries.get(row.projectId)
    if (summary === undefined) {
      continue
    }
    let updatedAt = summary.updatedAt
    for (const at of [row.startedAt, row.finishedAt, row.lastActivityAt]) {
      if (at !== null && at > updatedAt) {
        updatedAt = at
      }
    }
    summaries.set(row.projectId, { jobCount: row.jobCount, updatedAt })
  }
  return summaries
}
