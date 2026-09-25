// Issue/revoke for /settings/tokens (docs/SPEC.md §5). GET /api/settings/tokens
// loads the caller's current token (never the plaintext) on mount, so a reload
// shows what is actually stored instead of always inviting a fresh issue.
// Under the dev fixture API, ?scenario=issued and ?scenario=revoked replay the
// POST or DELETE once loaded (lib/token-search.ts).
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import type { AccessToken, AccessTokenCreated, AccessTokenStatus } from '@/shared/types'
import { apiFetch, errorMessage } from '../lib/api-client'
import { formatDateJaUtc } from '../lib/format'
import { devTokenPreview } from '../lib/token-search'

/** Issue time as the token page prints it: `2026年9月24日 09:42 UTC`. */
export const formatIssuedAt = (iso: string): string =>
  `${formatDateJaUtc(iso)} ${dayjs.utc(iso).format('HH:mm')} UTC`

export interface UseAccessTokenResult {
  /** The current token's metadata (no plaintext), from GET or after issue/revoke. */
  active: AccessToken | null
  loading: boolean
  loadError: string | null
  issuedToken: AccessTokenCreated | null
  issuing: boolean
  issueError: string | null
  issue: () => Promise<void>
  revoking: boolean
  revokeError: string | null
  revokeMessage: string | null
  revoke: () => Promise<void>
}

export function useAccessToken(): UseAccessTokenResult {
  const [active, setActive] = useState<AccessToken | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [issuedToken, setIssuedToken] = useState<AccessTokenCreated | null>(null)
  const [issuing, setIssuing] = useState(false)
  const [issueError, setIssueError] = useState<string | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [revokeError, setRevokeError] = useState<string | null>(null)
  const [revokeMessage, setRevokeMessage] = useState<string | null>(null)

  const issue = useCallback(async () => {
    setIssuing(true)
    setIssueError(null)
    setRevokeMessage(null)
    try {
      const token = await apiFetch<AccessTokenCreated>('/api/settings/tokens', { method: 'POST' })
      setIssuedToken(token)
      setActive({
        id: token.id,
        issued_at: token.issued_at,
        revoked_at: token.revoked_at,
        hint: token.hint,
      })
    } catch (err) {
      setIssueError(errorMessage(err))
    } finally {
      setIssuing(false)
    }
  }, [])

  const revoke = useCallback(async () => {
    setRevoking(true)
    setRevokeError(null)
    setRevokeMessage(null)
    try {
      await apiFetch<null>('/api/settings/tokens', { method: 'DELETE' })
      setIssuedToken(null)
      setActive(null)
      setRevokeMessage('トークンを失効しました。')
    } catch (err) {
      setRevokeError(errorMessage(err))
    } finally {
      setRevoking(false)
    }
  }, [])

  useEffect(() => {
    const controller = { cancelled: false }
    const preview = import.meta.env.DEV ? devTokenPreview(window.location.search) : null
    setLoading(true)
    apiFetch<AccessTokenStatus>('/api/settings/tokens')
      .then(async (status) => {
        if (controller.cancelled) {
          return
        }
        setActive(status.active)
        if (preview === 'issue') {
          await issue()
        } else if (preview === 'revoke') {
          await revoke()
        }
      })
      .catch((caught: unknown) => {
        if (!controller.cancelled) {
          setLoadError(errorMessage(caught))
        }
      })
      .finally(() => {
        if (!controller.cancelled) {
          setLoading(false)
        }
      })
    return () => {
      controller.cancelled = true
    }
  }, [issue, revoke])

  return {
    active,
    loading,
    loadError,
    issuedToken,
    issuing,
    issueError,
    issue,
    revoking,
    revokeError,
    revokeMessage,
    revoke,
  }
}
