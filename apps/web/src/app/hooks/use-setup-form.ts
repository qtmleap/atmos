// Form state and submission for /setup (docs/SPEC.md §2, docs/PLAN.md §4).
// Unlike the other pages, the error message here must be the server's own
// text verbatim (the delegation calls out `already_initialized`), so
// `setupErrorMessage` bypasses `errorMessage`'s generic 401/403/404 wording
// and only falls back to it for non-ApiError failures.
import { useCallback, useState } from 'react'
import { z } from 'zod'
import { HANDLE_PATTERN, type SetupRequest, type SetupResponse } from '@/shared/types'
import { ApiError, apiFetch, errorMessage } from '../lib/api-client'
import { useCurrentUser } from './use-current-user'
import { useSetupStatus } from './use-setup-status'

const setupFormSchema = z.object({
  init_admin_key: z.string().nonempty('初期化キーを入力してください'),
  handle: z
    .string()
    .nonempty('handleを入力してください')
    .regex(
      HANDLE_PATTERN,
      'handleは半角英数・ハイフン・アンダースコアのみ、3〜32文字で入力してください',
    ),
  display_name: z.string().nonempty('表示名を入力してください'),
})

export interface SetupFormInput {
  init_admin_key: string
  handle: string
  display_name: string
}

export type SetupFormValidation =
  | { success: true; data: SetupRequest }
  | { success: false; message: string }

/** Pure validation for the setup form; testable without React or the network. */
export const validateSetupForm = (input: SetupFormInput): SetupFormValidation => {
  const result = setupFormSchema.safeParse(input)
  if (!result.success) {
    const [issue] = result.error.issues
    return {
      success: false,
      message: issue === undefined ? '入力内容を確認してください' : issue.message,
    }
  }
  return { success: true, data: result.data }
}

/** `already_initialized` / `invalid_init_key` must reach the screen as the server wrote them. */
export const setupErrorMessage = (err: unknown): string =>
  err instanceof ApiError ? err.message : errorMessage(err)

export interface UseSetupFormResult {
  initAdminKey: string
  setInitAdminKey: (value: string) => void
  handle: string
  setHandle: (value: string) => void
  displayName: string
  setDisplayName: (value: string) => void
  submitting: boolean
  error: string | null
  result: SetupResponse | null
  submit: () => Promise<void>
  /** True while `GET /api/me` or `GET /api/setup` is still being answered. */
  loading: boolean
  /**
   * Setup is over: someone is already signed in (a user row exists, so the
   * server would refuse), the server answered `already_initialized`, or
   * `GET /api/setup` itself reports a registered user (so a signed-out
   * visitor who lands on /setup after the fact still moves on).
   */
  closed: boolean
}

export function useSetupForm(): UseSetupFormResult {
  const [initAdminKey, setInitAdminKey] = useState('')
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SetupResponse | null>(null)
  const [alreadyInitialized, setAlreadyInitialized] = useState(false)
  const { user, loading: userLoading, refetch } = useCurrentUser()
  const setupStatus = useSetupStatus()

  const submit = useCallback(async () => {
    const validation = validateSetupForm({
      init_admin_key: initAdminKey,
      handle,
      display_name: displayName,
    })
    if (!validation.success) {
      setError(validation.message)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const response = await apiFetch<SetupResponse>('/api/setup', {
        method: 'POST',
        body: JSON.stringify(validation.data),
      })
      setResult(response)
      // The setup response signs the caller in as the new admin; refetch
      // /api/me so every useCurrentUser() consumer (user menu, /admin,
      // /settings/*) reflects that without a reload.
      refetch()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'already_initialized') {
        setAlreadyInitialized(true)
      }
      setError(setupErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [initAdminKey, handle, displayName, refetch])

  return {
    initAdminKey,
    setInitAdminKey,
    handle,
    setHandle,
    displayName,
    setDisplayName,
    submitting,
    error,
    result,
    submit,
    loading: userLoading || setupStatus.loading,
    closed:
      alreadyInitialized ||
      (result === null && (user !== null || setupStatus.initialized === true)),
  }
}
