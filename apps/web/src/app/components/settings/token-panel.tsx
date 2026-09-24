// The token section of /settings/tokens (designs/pages/settings-tokens.html).
// There is no "current token" endpoint, so the top block is either the
// plaintext just issued (shown once) or the button that issues one.
// Presentational; state lives in useAccessToken.
import { CircleCheckIcon, CopyIcon, KeyRoundIcon } from 'lucide-react'
import { useState } from 'react'
import type { AccessTokenCreated } from '@/shared/types'
import { formatIssuedAt } from '../../hooks/use-access-token'
import { Alert, AlertBody, AlertDescription, AlertTitle } from '../ui/alert'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'

export interface TokenPanelProps {
  issuedToken: AccessTokenCreated | null
  issuing: boolean
  issueError: string | null
  onIssue: () => void
  revoking: boolean
  revokeError: string | null
  revokeMessage: string | null
  onRevoke: () => void
}

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

export function TokenPanel({
  issuedToken,
  issuing,
  issueError,
  onIssue,
  revoking,
  revokeError,
  revokeMessage,
  onRevoke,
}: TokenPanelProps) {
  return (
    <section aria-labelledby="tokens-title" className="grid gap-4">
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-4">
          <h2 id="tokens-title" className="text-xl leading-7 font-semibold tracking-tight">
            アクセストークン
          </h2>
          {issuedToken === null ? null : <Badge variant="outline">有効なトークン 1 / 1</Badge>}
        </div>
        <p className="leading-[22px] text-muted-foreground">
          Python SDK から実験データを送信するための認証情報です。
        </p>
      </div>

      {issuedToken === null ? (
        <div className="grid gap-3">
          <Alert role="status">
            <KeyRoundIcon aria-hidden="true" />
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
      ) : (
        <IssuedToken key={issuedToken.id} token={issuedToken} />
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
            disabled={revoking}
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
