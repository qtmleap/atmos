// The "…" menu of a project heading (designs/pages/project-jobs-menu.html)
// and its two dialogs: "プロジェクトを変更" (project-settings.html,
// PATCH /api/projects/:project_id) and "プロジェクトを削除"
// (project-delete.html, DELETE). The checks and wording are pure, in
// lib/manage.ts.
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import type { Project } from '@/shared/types'
import { ApiError, apiFetch, errorMessage } from '../lib/api-client'
import {
  canManage,
  deleteConfirmed,
  type EditProjectFormInput,
  validateEditProjectForm,
} from '../lib/manage'
import type { ProjectActionKey } from '../lib/manage-search'
import { useActionFlags } from './use-action-flags'
import { useCurrentUser } from './use-current-user'
import { forgetCachedProject, updateCachedProject } from './use-project'
import type { ProjectHeading } from './use-project-jobs'

const projectPath = (projectId: string) => `/api/projects/${encodeURIComponent(projectId)}`

export interface ProjectActions {
  /** Only the owner or an admin gets the menu. */
  allowed: boolean
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  edit: {
    open: boolean
    onOpenChange: (open: boolean) => void
    form: EditProjectFormInput
    onChange: (form: EditProjectFormInput) => void
    submitting: boolean
    error: string | null
    submit: () => Promise<void>
  }
  remove: {
    open: boolean
    onOpenChange: (open: boolean) => void
    typed: string
    onTypedChange: (typed: string) => void
    confirmed: boolean
    submitting: boolean
    error: string | null
    submit: () => Promise<void>
  }
}

export function useProjectActions(project: ProjectHeading): ProjectActions {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const flags = useActionFlags<ProjectActionKey>()
  // null until edited: the form starts from the project as it is now.
  const [draft, setDraft] = useState<EditProjectFormInput | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [removeSubmitting, setRemoveSubmitting] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const form = draft === null ? { name: project.name, visibility: project.visibility } : draft

  const onEditOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setDraft(null)
        setEditError(null)
      }
      flags.setOpen('edit', open)
    },
    [flags.setOpen],
  )

  const onRemoveOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setTyped('')
        setRemoveError(null)
      }
      flags.setOpen('delete', open)
    },
    [flags.setOpen],
  )

  const submitEdit = useCallback(async () => {
    const validation = validateEditProjectForm(form)
    if (!validation.success) {
      setEditError(validation.message)
      return
    }
    setEditSubmitting(true)
    setEditError(null)
    try {
      const updated = await apiFetch<Project>(projectPath(project.id), {
        method: 'PATCH',
        body: JSON.stringify(validation.data),
      })
      updateCachedProject(updated)
      onEditOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'conflict') {
        setEditError('同じ名前のプロジェクトがすでにあります')
      } else {
        setEditError(errorMessage(err))
      }
    } finally {
      setEditSubmitting(false)
    }
  }, [form, project.id, onEditOpenChange])

  const confirmed = deleteConfirmed(typed, project.name)

  const submitRemove = useCallback(async () => {
    if (!confirmed) {
      return
    }
    setRemoveSubmitting(true)
    setRemoveError(null)
    try {
      await apiFetch<null>(projectPath(project.id), { method: 'DELETE' })
      forgetCachedProject(project.id)
      void navigate({ to: '/' })
    } catch (err) {
      setRemoveError(errorMessage(err))
      setRemoveSubmitting(false)
    }
  }, [confirmed, project.id, navigate])

  return {
    allowed: canManage(user, project.owner?.id),
    menuOpen: flags.isOpen('menu'),
    onMenuOpenChange: (open) => flags.setOpen('menu', open),
    onEdit: () => flags.openFromMenu('edit'),
    onDelete: () => flags.openFromMenu('delete'),
    edit: {
      open: flags.isOpen('edit'),
      onOpenChange: onEditOpenChange,
      form,
      onChange: setDraft,
      submitting: editSubmitting,
      error: editError,
      submit: submitEdit,
    },
    remove: {
      open: flags.isOpen('delete'),
      onOpenChange: onRemoveOpenChange,
      typed,
      onTypedChange: setTyped,
      confirmed,
      submitting: removeSubmitting,
      error: removeError,
      submit: submitRemove,
    },
  }
}
