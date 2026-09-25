// /settings/tokens — issue/revoke the SDK access token (docs/SPEC.md §5,
// designs/pages/settings-tokens.html, designs/pages/settings-tokens-active.html,
// designs/pages/settings-tokens-reissue.html, settings-tokens-none.html,
// settings-tokens-revoked.html). GET /api/settings/tokens loads
// the current token's status on mount, so a reload shows what is actually
// stored instead of always inviting a fresh issue.
import { LoadingRows } from '../components/common/loading-rows'
import { SettingsShell, SettingsSignedOut } from '../components/settings/settings-shell'
import { TokenPanel } from '../components/settings/token-panel'
import { useAccessToken } from '../hooks/use-access-token'
import { useCurrentUser } from '../hooks/use-current-user'
import { useReissueDialog } from '../hooks/use-reissue-dialog'

export default function SettingsTokensPage() {
  const { user, loading: loadingUser } = useCurrentUser()
  const token = useAccessToken()
  const reissue = useReissueDialog()

  if (loadingUser || token.loading) {
    return <LoadingRows />
  }

  if (user === null) {
    return <SettingsSignedOut />
  }

  return (
    <SettingsShell current="tokens">
      <TokenPanel
        active={token.active}
        issuedToken={token.issuedToken}
        issuing={token.issuing}
        issueError={token.issueError}
        onIssue={() => void token.issue()}
        revoking={token.revoking}
        revokeError={token.revokeError}
        revokeMessage={token.revokeMessage}
        onRevoke={() => void token.revoke()}
        reissueOpen={reissue.open}
        onReissueOpenChange={reissue.onOpenChange}
      />
    </SettingsShell>
  )
}
