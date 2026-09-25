// The "…" menu of a job heading with the rename and delete dialogs it opens,
// wired to hooks/use-job-actions.ts. Renders nothing for those who cannot
// manage the project.
import { type UseJobActionsInput, useJobActions } from '../../hooks/use-job-actions'
import { jobDisplayName } from '../../lib/format'
import { jobDeleteDescription } from '../../lib/manage'
import { ActionsMenu } from '../common/actions-menu'
import { DeleteJobDialog } from './delete-job-dialog'
import { RenameJobDialog } from './rename-job-dialog'

export function JobActions(props: UseJobActionsInput) {
  const actions = useJobActions(props)
  if (!actions.allowed) {
    return null
  }
  return (
    <>
      <ActionsMenu
        label="ジョブの操作"
        editLabel="名前を変更"
        deleteLabel="ジョブを削除"
        open={actions.menuOpen}
        onOpenChange={actions.onMenuOpenChange}
        onEdit={actions.onRename}
        onDelete={actions.onDelete}
      />
      <RenameJobDialog
        open={actions.rename.open}
        onOpenChange={actions.rename.onOpenChange}
        name={actions.rename.name}
        onNameChange={actions.rename.onNameChange}
        submitting={actions.rename.submitting}
        error={actions.rename.error}
        onSubmit={() => void actions.rename.submit()}
      />
      <DeleteJobDialog
        open={actions.remove.open}
        onOpenChange={actions.remove.onOpenChange}
        description={jobDeleteDescription(jobDisplayName(props.job))}
        submitting={actions.remove.submitting}
        error={actions.remove.error}
        onConfirm={() => void actions.remove.submit()}
      />
    </>
  )
}
