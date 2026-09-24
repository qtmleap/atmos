// Issue/revoke for /settings/tokens (docs/SPEC.md §5). There is no "current
// token" GET endpoint, so the page can only show what the last action
// returned: the plaintext token right after issuing, or a revoke result.
import dayjs from 'dayjs'
import { useCallback, useState } from 'react'
import type { AccessTokenCreated } from '@/shared/types'
import { apiFetch, errorMessage } from '../lib/api-client'
import { formatDateJaUtc } from '../lib/format'

/** Issue time as the token page prints it: `2026年9月24日 09:42 UTC`. */
export const formatIssuedAt = (iso: string): string =>
  `${formatDateJaUtc(iso)} ${dayjs.utc(iso).format('HH:mm')} UTC`

export interface UseAccessTokenResult {
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
      setRevokeMessage('トークンを失効しました。')
    } catch (err) {
      setRevokeError(errorMessage(err))
    } finally {
      setRevoking(false)
    }
  }, [])

  return { issuedToken, issuing, issueError, issue, revoking, revokeError, revokeMessage, revoke }
}
