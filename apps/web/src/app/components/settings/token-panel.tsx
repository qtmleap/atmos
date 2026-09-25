// The token section of /settings/tokens (designs/pages/settings-tokens.html,
// designs/pages/settings-tokens-active.html, designs/pages/settings-tokens-
// reissue.html). Three states: the plaintext just issued (shown once), an
// active token from a previous visit (only its first and last characters,
// reissuing asks for confirmation), or no token at all (issuing needs no confirmation).
// Presentational; state lives in useAccessToken and, for the reissue
// confirmation, in ?dialog=reissue (useReissueDialog).
import { CircleCheckIcon, CopyIcon, KeyRoundIcon } from 'lucide-react'
import { useState } from 'react'
import type { AccessToken, AccessTokenCreated } from '@/shared/types'
import { formatIssuedAt } from '../../hooks/use-access-token'
import { Alert, AlertBody, AlertDescription, AlertTitle } from '../ui/alert'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { ReissueTokenDialog } from './reissue-token-dialog'

export interface TokenPanelProps {
  active: AccessToken | null
  issuedToken: AccessTokenCreated | null
  issuing: boolean
  issueError: string | null
  onIssue: () => void
  revoking: boolean
  revokeError: string | null
  revokeMessage: string | null
  onRevoke: () => void
  /** The reissue confirmation, open while the URL has ?dialog=reissue. */
  reissueOpen: boolean
  onReissueOpenChange: (open: boolean) => void
}

/** Stand-in for tokens issued before the hint column existed. */
const HINT_UNKNOWN = '（先頭と末尾の文字は記録されていません）'

const SDK_EXAMPLE = [
  'export ATMOS_API_URL="https://atmos.example.com"',
  'export ATMOS_TOKEN="ここにコピーしたトークンを貼り付け"',
  'python train.py',
].join('\n')

function IssuedToken({ token }: { token: AccessTokenCreated }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="grid gap-3">
      <Alert role="status">
        <CircleCheckIcon aria-hidden="true" />
        <AlertBody>
          <AlertTitle>トークンを発行しました</AlertTitle>
          <AlertDescription>
            平文トークンはこの一度だけ表示されます。ページを離れると二度と表示できません。今すぐコピーし、安全な場所に保存してください。
          </AlertDescription>
        </AlertBody>
      </Alert>
      <div className="flex items-center gap-4 border-y bg-muted px-4 py-3">
        <code className="min-w-0 flex-1 font-mono text-xs [overflow-wrap:anywhere]">
          {token.token}
        </code>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(token.token).then(() => setCopied(true))
          }}
        >
          <CopyIcon aria-hidden="true" />
          {copied ? 'コピーしました' : 'コピー'}
        </Button>
      </div>
      <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
        <span>発行日時：{formatIssuedAt(token.issued_at)}</span>
      </div>
    </div>
  )
}

function ActiveToken({
  active,
  issueError,
  onReissue,
}: {
  active: AccessToken
  issueError: string | null
  onReissue: () => void
}) {
  return (
    <div className="grid gap-3">
      <Alert role="status">
        <KeyRoundIcon aria-hidden="true" />
        <AlertBody>
          <AlertTitle>有効なトークンがあります</AlertTitle>
          <AlertDescription>トークンは発行時にしか表示されません。</AlertDescription>
        </AlertBody>
      </Alert>
      <div className="flex items-center gap-4 border-y bg-muted px-4 py-3">
        {active.hint === null ? (
          <code className="min-w-0 flex-1 font-mono text-xs text-muted-foreground">
            {HINT_UNKNOWN}
          </code>
        ) : (
          <code className="min-w-0 flex-1 font-mono text-xs">{active.hint}</code>
        )}
        <Button type="button" variant="outline" onClick={onReissue}>
          新しいトークンを発行
        </Button>
      </div>
      <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
        <span>発行日時：{formatIssuedAt(active.issued_at)}</span>
        {issueError !== null ? (
          <span role="alert" className="text-destructive">
            {issueError}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function TokenPanel({
  active,
  issuedToken,
  issuing,
  issueError,
  onIssue,
  revoking,
  revokeError,
  revokeMessage,
  onRevoke,
  reissueOpen,
  onReissueOpenChange,
}: TokenPanelProps) {
  const handleReissueConfirm = () => {
    onReissueOpenChange(false)
    onIssue()
  }

  return (
    <section aria-labelledby="tokens-title" className="grid gap-4">
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-4">
          <h2 id="tokens-title" className="text-xl leading-7 font-semibold tracking-tight">
            アクセストークン
          </h2>
          {active === null ? null : <Badge variant="outline">有効なトークン 1 / 1</Badge>}
        </div>
        <p className="leading-[22px] text-muted-foreground">
          Python SDK から実験データを送信するための認証情報です。
        </p>
      </div>

      {issuedToken !== null ? (
        <IssuedToken key={issuedToken.id} token={issuedToken} />
      ) : active !== null ? (
        <ActiveToken
          active={active}
          issueError={issueError}
          onReissue={() => onReissueOpenChange(true)}
        />
      ) : (
        <div className="grid gap-3">
          <Alert role="status">
            {revokeMessage === null ? (
              <KeyRoundIcon aria-hidden="true" />
            ) : (
              <CircleCheckIcon aria-hidden="true" />
            )}
            <AlertBody>
              <AlertTitle>
                {revokeMessage === null ? 'トークンを発行できます' : revokeMessage}
              </AlertTitle>
              <AlertDescription>
                発行した平文トークンはその一度だけ表示されます。ページを離れると二度と表示できません。発行後すぐにコピーし、安全な場所に保存してください。
              </AlertDescription>
            </AlertBody>
          </Alert>
          <div className="flex items-center gap-4 border-y bg-muted px-4 py-3">
            <code className="min-w-0 flex-1 font-mono text-xs text-muted-foreground">
              平文トークンは発行直後にここに表示されます
            </code>
            <Button type="button" onClick={onIssue} disabled={issuing}>
              新しいトークンを発行
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
            <span>発行日時：まだ発行していません</span>
            {issueError !== null ? (
              <span role="alert" className="text-destructive">
                {issueError}
              </span>
            ) : null}
          </div>
        </div>
      )}

      {active === null ? null : (
        <ReissueTokenDialog
          open={reissueOpen}
          onOpenChange={onReissueOpenChange}
          issuedAt={formatIssuedAt(active.issued_at)}
          hint={active.hint}
          issuing={issuing}
          onConfirm={handleReissueConfirm}
        />
      )}

      <section aria-labelledby="sdk-title" className="grid gap-3 border-t pt-4">
        <div className="grid gap-2">
          <h3 id="sdk-title" className="leading-5 font-semibold">
            SDK での使い方
          </h3>
          <p className="leading-[22px] text-muted-foreground">
            実行環境に接続先と、コピーしたトークンを設定します。
          </p>
        </div>
        <pre className="overflow-x-auto bg-muted p-4 font-mono text-xs leading-6">
          <code>{SDK_EXAMPLE}</code>
        </pre>
        <p className="text-xs text-muted-foreground">
          接続先は実際の atmos の URL に置き換えてください。
          <br />
          トークンをソースコードや Git リポジトリに含めないでください。
        </p>
      </section>

      <section aria-labelledby="revoke-title" className="grid gap-3 border-t pt-4">
        <div className="flex items-center justify-between gap-4">
          <h3 id="revoke-title" className="leading-5 font-semibold">
            トークンの失効
          </h3>
          <Button
            type="button"
            variant="outline"
            className="text-destructive"
            onClick={onRevoke}
            disabled={revoking || active === null}
          >
            トークンを失効
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          失効すると、このトークンを使った SDK からの送信はできなくなります。
          <br />
          有効なトークンは1ユーザーにつき1つです。新しく発行すると旧トークンは自動失効します。
        </p>
        {revokeError !== null ? (
          <p role="alert" className="text-xs text-destructive">
            {revokeError}
          </p>
        ) : null}
      </section>
    </section>
  )
}
