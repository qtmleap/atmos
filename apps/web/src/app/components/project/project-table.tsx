import { Link } from '@tanstack/react-router'
import { ChevronRightIcon, FolderIcon } from 'lucide-react'
import type { Project } from '@/shared/types'
import { formatShortDateTimeUtc } from '../../lib/format'
import { projectLinkState } from '../../lib/project-link'
import { VisibilityBadge } from '../common/visibility-badge'
import { Button } from '../ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'

/** Header cells are 12px muted (the mock's `.list-table th`). */
const HEAD = 'text-xs text-muted-foreground'
/** Body rows are 50px tall (the mock's `.list-table td`). */
const CELL = 'h-[50px]'

/**
 * The project index of projects.html: name with a folder icon, visibility
 * badge, owner, job count, last update and a chevron to the job list. Dense
 * rows so hundreds stay scannable; the name is the link.
 */
export function ProjectTable({ projects }: { projects: Project[] }) {
  return (
    <Table aria-label="閲覧可能なプロジェクト" className="whitespace-nowrap">
      <TableHeader>
        <TableRow>
          <TableHead scope="col" className={HEAD}>
            プロジェクト名
          </TableHead>
          <TableHead scope="col" className={HEAD}>
            公開範囲
          </TableHead>
          <TableHead scope="col" className={HEAD}>
            所有者
          </TableHead>
          <TableHead scope="col" data-numeric="true" className={HEAD}>
            ジョブ数
          </TableHead>
          <TableHead scope="col" className={HEAD}>
            最終更新 ↓
          </TableHead>
          <TableHead scope="col" className={HEAD}>
            <span className="sr-only">詳細</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => (
          <TableRow key={project.id}>
            <TableCell className={CELL}>
              <Link
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                state={projectLinkState(project)}
                className="flex items-center gap-3 font-medium hover:underline hover:underline-offset-4"
              >
                <span className="text-muted-foreground">
                  <FolderIcon aria-hidden="true" className="size-4" />
                </span>
                {project.name}
              </Link>
            </TableCell>
            <TableCell className={CELL}>
              <VisibilityBadge visibility={project.visibility} />
            </TableCell>
            <TableCell className={CELL}>{project.owner.display_name}</TableCell>
            <TableCell data-numeric="true" className={`${CELL} font-mono`}>
              {project.job_count === undefined ? '—' : project.job_count}
            </TableCell>
            <TableCell className={`${CELL} font-mono text-xs text-muted-foreground`}>
              {project.updated_at === undefined ? (
                '—'
              ) : (
                <time dateTime={project.updated_at}>
                  {formatShortDateTimeUtc(project.updated_at)}
                </time>
              )}
            </TableCell>
            <TableCell className={CELL}>
              <Button variant="ghost" size="icon" asChild>
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: project.id }}
                  state={projectLinkState(project)}
                  aria-label={`${project.name}のジョブ一覧`}
                >
                  <ChevronRightIcon aria-hidden="true" />
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
