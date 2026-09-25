// The "…" menu of a job heading (designs/pages/job-detail-menu.html) and its
// two dialogs: "名前を変更" (job-rename.html, PATCH …/jobs/:job_id) and
// "ジョブを削除" (job-delete.html, DELETE). The checks and wording are pure,
// in lib/manage.ts.
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import type { Job, ProjectOwner } from '@/shared/types'
import { apiFetch, errorMessage } from '../lib/api-client'
import { jobApiPath } from '../lib/job-paths'
import { canManage, validateRenameJobForm } from '../lib/manage'
import type { JobActionKey } from '../lib/manage-search'
import { useActionFlags } from './use-action-flags'
import { useCurrentUser } from './use-current-user'
import type { LinkedProject } from './use-job-project'

export interface JobActions {
  /** Only the project owner or an admin gets the menu. */
  allowed: boolean
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  onRename: () => void
  onDelete: () => void
  rename: {
    open: boolean
    onOpenChange: (open: boolean) => void
    name: string
    onNameChange: (name: string) => void
    submitting: boolean
    error: string | null
    submit: () => Promise<void>
  }
  remove: {
    open: boolean
    onOpenChange: (open: boolean) => void
    submitting: boolean
    error: string | null
    submit: () => Promise<void>
  }
}

export interface UseJobActionsInput {
  projectId: string
  project: LinkedProject | null
  /** The project owner; null until the project has loaded, which hides the menu. */
  owner: ProjectOwner | null
  job: Job
  /** Reloads the job after a rename. */
  refresh: () => void
}

export function useJobActions({
  projectId,
  project,
  owner,
  job,
  refresh,
}: UseJobActionsInput): JobActions {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const flags = useActionFlags<JobActionKey>()
  // null until edited: the field starts from the job's name as it is now.
  const [draft, setDraft] = useState<string | null>(null)
  const [renameSubmitting, setRenameSubmitting] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [removeSubmitting, setRemoveSubmitting] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  // An unnamed job starts from an empty field.
  const current = job.name === null ? '' : job.name
  const name = draft === null ? current : draft

  const onRenameOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setDraft(null)
        setRenameError(null)
      }
      flags.setOpen('rename', open)
    },
    [flags.setOpen],
  )

  const onRemoveOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setRemoveError(null)
      }
      flags.setOpen('delete', open)
    },
    [flags.setOpen],
  )

  const submitRename = useCallback(async () => {
    const validation = validateRenameJobForm(name)
    if (!validation.success) {
      setRenameError(validation.message)
      return
    }
    setRenameSubmitting(true)
    setRenameError(null)
    try {
      await apiFetch<Job>(jobApiPath(projectId, job.id), {
        method: 'PATCH',
        body: JSON.stringify(validation.data),
      })
      refresh()
      onRenameOpenChange(false)
    } catch (err) {
      setRenameError(errorMessage(err))
    } finally {
      setRenameSubmitting(false)
    }
  }, [name, projectId, job.id, refresh, onRenameOpenChange])

  const submitRemove = useCallback(async () => {
    setRemoveSubmitting(true)
    setRemoveError(null)
    try {
      await apiFetch<null>(jobApiPath(projectId, job.id), { method: 'DELETE' })
      void navigate({
        to: '/projects/$projectId',
        params: { projectId },
        state: project === null ? undefined : { project },
      })
    } catch (err) {
      setRemoveError(errorMessage(err))
      setRemoveSubmitting(false)
    }
  }, [projectId, job.id, project, navigate])

  return {
    allowed: canManage(user, owner?.id),
    menuOpen: flags.isOpen('menu'),
    onMenuOpenChange: (open) => flags.setOpen('menu', open),
    onRename: () => flags.openFromMenu('rename'),
    onDelete: () => flags.openFromMenu('delete'),
    rename: {
      open: flags.isOpen('rename'),
      onOpenChange: onRenameOpenChange,
      name,
      onNameChange: setDraft,
      submitting: renameSubmitting,
      error: renameError,
      submit: submitRename,
    },
    remove: {
      open: flags.isOpen('delete'),
      onOpenChange: onRemoveOpenChange,
      submitting: removeSubmitting,
      error: removeError,
      submit: submitRemove,
    },
  }
}
