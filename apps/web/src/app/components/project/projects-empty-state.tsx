// The first-run project index (designs/pages/projects-empty.html): no project
// exists yet, so the only next step is creating one. Presentational; the
// dialog's open state lives in ?new=1 (hooks/use-create-project.ts).
import { FolderIcon, PlusIcon } from 'lucide-react'
import { Button } from '../ui/button'
import { EmptyState, EmptyStateDescription } from '../ui/empty-state'

export interface ProjectsEmptyStateProps {
  /** Opens the "新規プロジェクト" dialog; null when nobody is signed in. */
  onCreate: (() => void) | null
}

export function ProjectsEmptyState({ onCreate }: ProjectsEmptyStateProps) {
  if (onCreate === null) {
    return (
      <EmptyState>
        <FolderIcon aria-hidden="true" />
        <h2>公開プロジェクトはありません</h2>
        <EmptyStateDescription>
          チームのプロジェクトを表示するには、ログインしてください。
        </EmptyStateDescription>
      </EmptyState>
    )
  }
  return (
    <EmptyState>
      <FolderIcon aria-hidden="true" />
      <h2>プロジェクトはまだありません</h2>
      <EmptyStateDescription>
        プロジェクトを作成し、SDK から最初のジョブを送信してください。
      </EmptyStateDescription>
      <Button type="button" onClick={onCreate}>
        <PlusIcon aria-hidden="true" />
        新規プロジェクト
      </Button>
    </EmptyState>
  )
}
