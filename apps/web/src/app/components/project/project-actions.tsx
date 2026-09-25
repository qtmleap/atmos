// The "…" menu of a project heading with the settings and delete dialogs it
// opens, wired to hooks/use-project-actions.ts. Renders nothing for those
// who cannot manage the project.
import { useProjectActions } from '../../hooks/use-project-actions'
import type { ProjectHeading } from '../../hooks/use-project-jobs'
import { projectDeleteDescription } from '../../lib/manage'
import { ActionsMenu } from '../common/actions-menu'
import { DeleteProjectDialog } from './delete-project-dialog'
import { EditProjectDialog } from './edit-project-dialog'

export function ProjectActions({ project }: { project: ProjectHeading }) {
  const actions = useProjectActions(project)
  if (!actions.allowed) {
    return null
  }
  return (
    <>
      <ActionsMenu
        label="プロジェクトの操作"
        editLabel="名前と公開範囲を変更"
        deleteLabel="プロジェクトを削除"
        open={actions.menuOpen}
        onOpenChange={actions.onMenuOpenChange}
        onEdit={actions.onEdit}
        onDelete={actions.onDelete}
      />
      <EditProjectDialog
        open={actions.edit.open}
        onOpenChange={actions.edit.onOpenChange}
        form={actions.edit.form}
        onChange={actions.edit.onChange}
        submitting={actions.edit.submitting}
        error={actions.edit.error}
        onSubmit={() => void actions.edit.submit()}
      />
      <DeleteProjectDialog
        open={actions.remove.open}
        onOpenChange={actions.remove.onOpenChange}
        name={project.name}
        description={projectDeleteDescription(project.name, project.job_count)}
        typed={actions.remove.typed}
        onTypedChange={actions.remove.onTypedChange}
        confirmed={actions.remove.confirmed}
        submitting={actions.remove.submitting}
        error={actions.remove.error}
        onConfirm={() => void actions.remove.submit()}
      />
    </>
  )
}
