// Form state and submission for /settings/profile (docs/SPEC.md §5).
// `validateProfileForm` / `validateAvatarFile` are pure so the validation
// rules can be tested without React or the network.
import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import {
  AVATAR_CONTENT_TYPES,
  AVATAR_MAX_BYTES,
  type AvatarContentType,
  HANDLE_PATTERN,
  type UpdateAvatarResponse,
  type UpdateProfileRequest,
  type UserWithEmail,
} from '@/shared/types'
import { apiFetch, errorMessage } from '../lib/api-client'
import { useCurrentUser } from './use-current-user'

const profileFormSchema = z.object({
  display_name: z.string().nonempty('表示名を入力してください'),
  handle: z
    .string()
    .nonempty('handleを入力してください')
    .regex(
      HANDLE_PATTERN,
      'handleは半角英数・ハイフン・アンダースコアのみ、3〜32文字で入力してください',
    ),
})

export interface ProfileFormInput {
  display_name: string
  handle: string
}

export type ProfileFormValidation =
  | { success: true; data: UpdateProfileRequest }
  | { success: false; message: string }

const firstIssueMessage = (error: z.ZodError): string => {
  const [issue] = error.issues
  return issue === undefined ? '入力内容を確認してください' : issue.message
}

/** Pure validation for the profile form; testable without React or the network. */
export const validateProfileForm = (input: ProfileFormInput): ProfileFormValidation => {
  const result = profileFormSchema.safeParse(input)
  if (!result.success) {
    return { success: false, message: firstIssueMessage(result.error) }
  }
  return { success: true, data: result.data }
}

const isAvatarContentType = (type: string): type is AvatarContentType =>
  AVATAR_CONTENT_TYPES.some((allowed) => allowed === type)

export type AvatarFileValidation = { valid: true } | { valid: false; message: string }

/** Pure client-side pre-check mirroring docs/SPEC.md §5's `PUT /api/settings/avatar` limits. */
export const validateAvatarFile = (file: { type: string; size: number }): AvatarFileValidation => {
  if (!isAvatarContentType(file.type)) {
    return { valid: false, message: 'PNG・JPEG・WebP形式の画像のみアップロードできます。' }
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { valid: false, message: 'ファイルサイズは2MBまでです。' }
  }
  return { valid: true }
}

export interface UseProfileFormResult {
  loadingUser: boolean
  loggedIn: boolean
  displayName: string
  setDisplayName: (value: string) => void
  handle: string
  setHandle: (value: string) => void
  saving: boolean
  saveError: string | null
  saveSuccess: boolean
  save: () => Promise<void>
  /** Puts the saved values back into the fields (the form's キャンセル). */
  reset: () => void
  avatarUrl: string | null
  uploadingAvatar: boolean
  avatarError: string | null
  uploadAvatar: (file: File) => Promise<void>
}

export function useProfileForm(): UseProfileFormResult {
  const { user, loading: loadingUser, refetch } = useCurrentUser()
  const [initialized, setInitialized] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  useEffect(() => {
    if (user !== null && !initialized) {
      setDisplayName(user.display_name)
      setHandle(user.handle)
      setAvatarUrl(user.avatar_url)
      setInitialized(true)
    }
  }, [user, initialized])

  const save = useCallback(async () => {
    const validation = validateProfileForm({ display_name: displayName, handle })
    if (!validation.success) {
      setSaveError(validation.message)
      setSaveSuccess(false)
      return
    }
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      await apiFetch<UserWithEmail>('/api/settings/profile', {
        method: 'PATCH',
        body: JSON.stringify(validation.data),
      })
      setSaveSuccess(true)
      refetch()
    } catch (err) {
      setSaveError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }, [displayName, handle, refetch])

  const reset = useCallback(() => {
    if (user !== null) {
      setDisplayName(user.display_name)
      setHandle(user.handle)
    }
    setSaveError(null)
    setSaveSuccess(false)
  }, [user])

  const uploadAvatar = useCallback(
    async (file: File) => {
      const validation = validateAvatarFile(file)
      if (!validation.valid) {
        setAvatarError(validation.message)
        return
      }
      setUploadingAvatar(true)
      setAvatarError(null)
      try {
        const body = new FormData()
        body.append('file', file)
        const response = await apiFetch<UpdateAvatarResponse>('/api/settings/avatar', {
          method: 'PUT',
          body,
        })
        setAvatarUrl(response.avatar_url)
        refetch()
      } catch (err) {
        setAvatarError(errorMessage(err))
      } finally {
        setUploadingAvatar(false)
      }
    },
    [refetch],
  )

  return {
    loadingUser,
    loggedIn: user !== null,
    displayName,
    setDisplayName,
    handle,
    setHandle,
    saving,
    saveError,
    saveSuccess,
    save,
    reset,
    avatarUrl,
    uploadingAvatar,
    avatarError,
    uploadAvatar,
  }
}
