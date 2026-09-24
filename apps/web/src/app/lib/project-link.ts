// Pages under /projects/:projectId show the project's name in the breadcrumb
// and heading. They fetch it (`GET /api/projects/:project_id`, hooks/use-project.ts),
// but the link that led there also carries it in the router state so the
// heading is right on the first paint instead of after the request.
import type { Project } from '@/shared/types'

export interface ProjectLinkState {
  project: Pick<Project, 'id' | 'name' | 'visibility'>
}

export const projectLinkState = (project: ProjectLinkState['project']): ProjectLinkState => ({
  project: { id: project.id, name: project.name, visibility: project.visibility },
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** The project carried by `location.state`, if it is the one for `projectId`. */
export const readProjectLinkState = (
  state: unknown,
  projectId: string,
): ProjectLinkState['project'] | null => {
  if (!isRecord(state) || !isRecord(state.project)) {
    return null
  }
  const { id, name, visibility } = state.project
  if (
    id !== projectId ||
    typeof name !== 'string' ||
    (visibility !== 'public' && visibility !== 'private')
  ) {
    return null
  }
  return { id, name, visibility }
}
