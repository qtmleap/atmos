// Whether the "新規プロジェクト" dialog is open lives in the URL, like
// job-filter.ts's ?view=/?drawer=: a link with ?new=1 reopens it, and the
// browser's back button closes it.
//
// The value is the number 1, not the string '1': the router's default search
// codec (defaultParseSearch in @tanstack/router-core) runs every query value
// through JSON.parse, so `?new=1` arrives as `1`, not `"1"`.
import { z } from 'zod'

export const projectsSearchSchema = z.object({
  new: z.literal(1).optional().catch(undefined),
})

export type ProjectsSearch = z.infer<typeof projectsSearchSchema>

export const parseCreateProjectOpen = (value: number | undefined): boolean => value === 1
