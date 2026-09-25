// URL state of the "…" menu of a project or job heading and the dialogs it
// opens (designs/pages/project-jobs-menu.html, project-settings.html,
// project-delete.html, job-detail-menu.html, job-rename.html, job-delete.html):
//   ?menu=1     the menu is open
//   ?edit=1     "プロジェクトを変更" (project page)
//   ?rename=1   "名前を変更" (job page)
//   ?delete=1   the delete confirmation (either page)
// Like ?new=1 (project-search.ts) the value is the number 1, since the router
// runs query values through JSON.parse.
//
// The job page's own chart (lib/job-metric-view.ts) shares the comparison
// chart's controls, so `jobSearchSchema` also carries `chartViewSearchShape`
// (chart-view-search.ts): ?run=, ?smooth=, ?logx=/?logy=, ?size=, ?chart=
// (documented in full at the top of job-filter.ts, whose `jobsSearchSchema`
// carries the same shape).
import { z } from 'zod'
import { chartViewSearchShape } from './chart-view-search'

const flag = z.literal(1).optional().catch(undefined)

/** The keys of jobsSearchSchema (job-filter.ts) that belong to the project menu. */
export const projectActionsSearchShape = { menu: flag, edit: flag, delete: flag }

/** The search params of /projects/:projectId/jobs/:jobId. */
export const jobSearchSchema = z.object({
  menu: flag,
  rename: flag,
  delete: flag,
  ...chartViewSearchShape,
})

export type JobSearch = z.infer<typeof jobSearchSchema>

export type ProjectActionKey = 'menu' | 'edit' | 'delete'
export type JobActionKey = 'menu' | 'rename' | 'delete'

export const parseFlag = (value: unknown): boolean => value === 1
