// Breadcrumb and heading of the pages under /projects/:projectId
// (`.breadcrumb` + `.page-header` of project-jobs.html): the project name
// with its visibility badge, the owner at the right, and a description line.

import { Link } from '@tanstack/react-router'
import { ChevronRightIcon } from 'lucide-react'
import type { ProjectHeading } from '../../hooks/use-project-jobs'
import { cn } from '../../lib/utils'
import { VisibilityBadge } from '../common/visibility-badge'

export interface ProjectHeaderProps {
  projectId: string
  /** null until the project is known; the id stands in. */
  project: ProjectHeading | null
  description: string
}

export function ProjectHeader({ projectId, project, description }: ProjectHeaderProps) {
  const name = project === null ? projectId : project.name
  return (
    <>
      <nav aria-label="パンくず">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <li className="inline-flex items-center gap-2">
            <Link to="/" className="hover:underline hover:underline-offset-4">
              プロジェクト
            </Link>
            <ChevronRightIcon aria-hidden="true" className="size-4" />
          </li>
          <li className="inline-flex items-center gap-2">
            <span
              aria-current="page"
              className={project === null ? 'font-mono' : 'text-foreground'}
            >
              {name}
            </span>
          </li>
        </ol>
      </nav>
      <header className="grid gap-4 border-b py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={cn('text-2xl leading-8', project === null && 'font-mono')}>{name}</h1>
            {project === null ? null : <VisibilityBadge visibility={project.visibility} />}
          </div>
          {project === null || project.owner === undefined ? null : (
            <span className="text-xs text-muted-foreground">
              所有者 {project.owner.display_name}
            </span>
          )}
        </div>
        <p className="leading-[22px] text-muted-foreground">{description}</p>
      </header>
    </>
  )
}
