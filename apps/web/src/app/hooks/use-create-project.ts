// The "新規プロジェクト" dialog of / (designs/pages/projects-new.html): open
// state lives in ?new=1 (lib/project-search.ts), the same way the job drawer
// does (use-compare-jobs.ts), so the dialog is shareable and back-button-able.
// `validateCreateProjectForm` is pure so it is testable without React or the
// network.
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { z } from 'zod'
import {
  type CreateProjectRequest,
  type Project,
  VISIBILITIES,
  type Visibility,
} from '@/shared/types'
import { ApiError, apiFetch, errorMessage } from '../lib/api-client'
import { projectLinkState } from '../lib/project-link'
import { parseCreateProjectOpen } from '../lib/project-search'

const createProjectFormSchema = z.object({
  name: z.string().nonempty('プロジェクト名を入力してください'),
})

export interface CreateProjectFormInput {
  name: string
  visibility: Visibility
}

/** Private, matching the mock's checked default (designs/pages/projects-new.html). */
const DEFAULT_FORM: CreateProjectFormInput = {
  name: '',
  visibility: 'private',
}

/** Narrows a radio input's `string` value to `Visibility` without a type assertion. */
export const isVisibility = (value: string): value is Visibility =>
  VISIBILITIES.some((visibility) => visibility === value)

export type CreateProjectFormValidation =
  | { success: true; data: CreateProjectRequest }
  | { success: false; message: string }

/** Pure validation for the "new project" form; testable without React or the network. */
export const validateCreateProjectForm = (
  input: CreateProjectFormInput,
): CreateProjectFormValidation => {
  const result = createProjectFormSchema.safeParse({ name: input.name })
  if (!result.success) {
    const [issue] = result.error.issues
    return {
      success: false,
      message: issue === undefined ? '入力内容を確認してください' : issue.message,
    }
  }
  return {
    success: true,
    data: { name: result.data.name, visibility: input.visibility },
  }
}

export interface UseCreateProjectResult {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: CreateProjectFormInput
  onChange: (form: CreateProjectFormInput) => void
  submitting: boolean
  error: string | null
  submit: () => Promise<void>
}

export function useCreateProject(): UseCreateProjectResult {
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const open = parseCreateProjectOpen(search.new)
  const [form, setForm] = useState<CreateProjectFormInput>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setForm(DEFAULT_FORM)
        setError(null)
      }
      void navigate({
        to: '.',
        search: (current) => ({ ...current, new: next ? 1 : undefined }),
        replace: true,
      })
    },
    [navigate],
  )

  const submit = useCallback(async () => {
    const validation = validateCreateProjectForm(form)
    if (!validation.success) {
      setError(validation.message)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const project = await apiFetch<Project>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(validation.data),
      })
      void navigate({
        to: '/projects/$projectId',
        params: { projectId: project.id },
        state: projectLinkState(project),
      })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'conflict') {
        setError('同じ名前のプロジェクトがすでにあります')
      } else {
        setError(errorMessage(err))
      }
    } finally {
      setSubmitting(false)
    }
  }, [form, navigate])

  return {
    open,
    onOpenChange,
    form,
    onChange: setForm,
    submitting,
    error,
    submit,
  }
}
