// The project a job belongs to, for the breadcrumb and the "who started it"
// line. The link that led here carries the breadcrumb part in the router
// state (lib/project-link.ts) and is shown at once; the rest (and everything,
// for a pasted URL) comes from `GET /api/projects/:project_id`.
import type { ProjectOwner } from '@/shared/types'
import type { ProjectLinkState } from '../lib/project-link'
import { useProject } from './use-project'

export type LinkedProject = ProjectLinkState['project']

export interface JobProject {
  /** `linked` when the router state had it, else the fetched project (null until loaded). */
  project: LinkedProject | null
  /** The fetched project's owner; null until the project has loaded. */
  owner: ProjectOwner | null
}

export function useJobProject(projectId: string, linked: LinkedProject | null): JobProject {
  const { project } = useProject(projectId)
  const owner = project === null ? null : project.owner
  if (linked !== null) {
    return { project: linked, owner }
  }
  return {
    project:
      project === null
        ? null
        : { id: project.id, name: project.name, visibility: project.visibility },
    owner,
  }
}
