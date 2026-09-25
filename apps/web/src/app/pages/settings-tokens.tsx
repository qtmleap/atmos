// /settings/tokens — issue/revoke the SDK access token (docs/SPEC.md §5,
// designs/pages/settings-tokens.html). There is no "current token" endpoint,
// so the screen only ever shows what the last Issue/Revoke action returned.
import { LoadingRows } from '../components/common/loading-rows'
import { SettingsShell, SettingsSignedOut } from '../components/settings/settings-shell'
import { TokenPanel } from '../components/settings/token-panel'
import { useAccessToken } from '../hooks/use-access-token'
import { useCurrentUser } from '../hooks/use-current-user'

export default function SettingsTokensPage() {
  const { user, loading: loadingUser } = useCurrentUser()
  const token = useAccessToken()

  if (loadingUser) {
    return <LoadingRows />
  }

  if (user === null) {
    return <SettingsSignedOut />
  }

  return (
    <SettingsShell current="tokens">
      <TokenPanel
        issuedToken={token.issuedToken}
        issuing={token.issuing}
        issueError={token.issueError}
        onIssue={() => void token.issue()}
        revoking={token.revoking}
        revokeError={token.revokeError}
        revokeMessage={token.revokeMessage}
        onRevoke={() => void token.revoke()}
      />
    </SettingsShell>
  )
}
