import { Link } from '@tanstack/react-router'
import { ChevronRightIcon } from 'lucide-react'
import type { Project } from '@/shared/types'
import { formatDateJaUtc, formatDateUtc } from '../../lib/format'
import { projectLinkState } from '../../lib/project-link'
import { VisibilityBadge } from '../common/visibility-badge'

/**
 * The project rows of user-profile.html: each row is one link with the name
 * over its creation date, the visibility badge, the date and a chevron.
 */
export function OwnedProjectList({ projects }: { projects: Project[] }) {
  return (
    <div className="border-t">
      {projects.map((project) => (
        <Link
          key={project.id}
          to="/projects/$projectId"
          params={{ projectId: project.id }}
          state={projectLinkState(project)}
          className="grid min-h-[72px] grid-cols-[minmax(0,1fr)_100px_130px_16px] items-center gap-4 border-b px-2 py-3 outline-none hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          <div className="grid gap-2">
            <p className="font-medium [overflow-wrap:anywhere]">{project.name}</p>
            <p className="text-xs text-muted-foreground">
              作成日 {formatDateJaUtc(project.created_at)}
            </p>
          </div>
          <div className="justify-self-start">
            <VisibilityBadge visibility={project.visibility} plain />
          </div>
          <time className="text-xs text-muted-foreground" dateTime={project.created_at}>
            {formatDateUtc(project.created_at)}
          </time>
          <ChevronRightIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        </Link>
      ))}
    </div>
  )
}
