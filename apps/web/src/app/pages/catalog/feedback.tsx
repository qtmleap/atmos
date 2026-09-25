import {
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CopyIcon,
  FolderIcon,
  GlobeIcon,
  ImageIcon,
  InfoIcon,
  PlayIcon,
} from 'lucide-react'
import type * as React from 'react'
import { Alert, AlertBody, AlertDescription, AlertTitle } from '../../components/ui/alert'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { EmptyState, EmptyStateDescription, ErrorCode } from '../../components/ui/empty-state'
import { Separator } from '../../components/ui/separator'
import { CatalogPage, SampleCaption, Specimen } from './catalog-section'

const empties = [
  {
    caption: 'ログイン済み / プロジェクトなし',
    icon: <FolderIcon aria-hidden="true" />,
    title: 'プロジェクトはまだありません',
    text: 'アクセストークンを発行し、SDKから最初のジョブを開始してください。',
    action: <Button>アクセストークンを管理</Button>,
  },
  {
    caption: '未ログイン / 公開プロジェクトなし',
    icon: <GlobeIcon aria-hidden="true" />,
    title: '公開プロジェクトはありません',
    text: 'チームのプロジェクトを表示するには、ログインしてください。',
    action: <Button variant="outline">ログイン</Button>,
  },
  {
    caption: 'プロジェクト内 / ジョブなし',
    icon: <PlayIcon aria-hidden="true" />,
    title: 'ジョブはまだありません',
    text: 'SDKで「音声合成 v4」のジョブを開始すると、ここに表示されます。',
    action: null,
  },
  {
    caption: 'ジョブ内 / メディアなし',
    icon: <ImageIcon aria-hidden="true" />,
    title: 'メディアはまだありません',
    text: '画像や音声を受信すると、stepとラベルを付けて表示します。',
    action: null,
  },
]

const errors = [
  {
    code: '404',
    title: '見つかりませんでした',
    text: '指定されたページが見つからないか、表示できません。URLを確認してください。',
    slug: 'not_found',
  },
  {
    code: '403',
    title: 'アクセス権限がありません',
    text: 'この操作には管理者権限が必要です。必要な場合はチームの管理者にお問い合わせください。',
    slug: 'forbidden',
  },
]

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}

function TokenRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 border-b py-4">{children}</div>
}

export default function FeedbackCatalog() {
  return (
    <CatalogPage
      slug="feedback"
      eyebrow="COMPONENTS / 07"
      title="フィードバック"
      description="空・権限・成功・失敗を区別し、次の行動を短く伝えます。ボタンは操作しない静止見本です。"
      footer={['atmos · コンポーネント層 / 静止見本', '07 / 07 · フィードバック']}
    >
      <Specimen
        title="空状態"
        codes={['.empty-state']}
        note="箱ではなく余白で区画。作成操作はSDKで行う前提です。"
        className="grid grid-cols-2 gap-6"
      >
        {empties.map((item) => (
          <div key={item.caption}>
            <SampleCaption>{item.caption}</SampleCaption>
            <EmptyState>
              {item.icon}
              <h3>{item.title}</h3>
              <EmptyStateDescription>{item.text}</EmptyStateDescription>
              {item.action}
            </EmptyState>
          </div>
        ))}
      </Specimen>
      <Specimen
        title="エラー状態"
        codes={['.error-state / .error-code']}
        note="404では存在や公開範囲を明かしません。403は権限不足の操作に使用。"
        className="grid grid-cols-2 gap-6"
      >
        {errors.map((item) => (
          <EmptyState key={item.code}>
            <ErrorCode>{item.code}</ErrorCode>
            <h3>{item.title}</h3>
            <EmptyStateDescription>{item.text}</EmptyStateDescription>
            <Button variant="outline">プロジェクト一覧へ</Button>
            <span className="font-mono text-xs text-muted-foreground">{item.slug}</span>
          </EmptyState>
        ))}
      </Specimen>
      <Specimen
        title="発行直後"
        codes={['.token-block / .alert']}
        note="平文は発行レスポンスにのみ含まれます。この見本は無効なダミー値です。"
        className="grid gap-4"
      >
        <div className="flex items-center justify-between gap-4 border-b py-3">
          <h3>アクセストークンを発行しました</h3>
          <Badge variant="secondary">発行直後</Badge>
        </div>
        <Alert>
          <InfoIcon aria-hidden="true" />
          <AlertBody>
            <AlertTitle>このトークンは一度だけ表示されます</AlertTitle>
            <AlertDescription>
              この表示を閉じると再確認できません。今すぐコピーし、安全な場所に保管してください。ソースコードや共有ログには記載しないでください。
            </AlertDescription>
          </AlertBody>
        </Alert>
        <div className="flex items-center gap-4 rounded-md border bg-muted px-4 py-3">
          <code className="min-w-0 flex-1 font-mono text-xs [overflow-wrap:anywhere]">
            atmos_demo_NOT_A_REAL_TOKEN_7f2c9a4e81b0d6
          </code>
          <Button variant="outline">
            <CopyIcon />
            コピー
          </Button>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Muted>発行 2026-09-24 09:45 UTC · 所有者 田中 美咲</Muted>
          <Button>安全な場所に保存しました</Button>
        </div>
        <Muted>表示値はモック専用です。実際の認証には利用できません。</Muted>
        <Separator />
        <SampleCaption>コピー後 / コピー失敗の静止見本</SampleCaption>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary">
            <CheckIcon />
            コピーしました
          </Button>
          <span role="status" className="text-xs text-muted-foreground">
            クリップボードにコピーしました。
          </span>
        </div>
        <Alert variant="destructive" role="alert">
          <CircleAlertIcon aria-hidden="true" />
          <AlertBody>
            <AlertTitle>コピーできませんでした</AlertTitle>
            <AlertDescription>
              トークンの文字列を選択して、手動でコピーしてください。
            </AlertDescription>
          </AlertBody>
        </Alert>
      </Specimen>
      <Specimen
        title="トークンの状態"
        codes={['.data-list / .badge']}
        note="再表示時は平文を復元しません。1ユーザー1トークンの運用です。"
        className="grid gap-4"
      >
        <div className="border-t">
          <TokenRow>
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <h3>有効なトークン</h3>
                <Badge variant="secondary">有効</Badge>
              </div>
              <Muted>発行 2026-09-24 09:45 UTC</Muted>
              <p className="leading-[22px] text-muted-foreground">
                トークンの平文は再表示できません。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline">再発行</Button>
              <Button variant="destructive">失効する</Button>
            </div>
          </TokenRow>
          <TokenRow>
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <h3>失効済みトークン</h3>
                <Badge variant="destructive">失効済み</Badge>
              </div>
              <Muted>発行 2026-09-18 08:30 UTC · 失効 2026-09-24 09:45 UTC</Muted>
              <p className="leading-[22px] text-muted-foreground">
                このトークンではデータを送信できません。
              </p>
            </div>
            <Button variant="outline" disabled>
              コピー不可
            </Button>
          </TokenRow>
        </div>
        <Muted>状態の比較見本です。再発行すると旧トークンは自動的に失効します。</Muted>
        <EmptyState>
          <h3>トークンはまだ発行されていません</h3>
          <EmptyStateDescription>
            SDKからデータを送信するためのアクセストークンを発行してください。
          </EmptyStateDescription>
          <Button>トークンを発行</Button>
        </EmptyState>
      </Specimen>
      <Specimen
        title="完了・お知らせ"
        codes={['.alert / [role="status"]']}
        note="確認が必要な内容は消えないインライン表示。通知も影なし。"
        className="grid gap-4"
      >
        <Alert role="status">
          <CircleCheckIcon aria-hidden="true" />
          <AlertBody>
            <AlertTitle>セットアップが完了しました</AlertTitle>
            <AlertDescription>
              田中
              美咲さんを最初の管理者として登録しました。メンバーの追加とアクセストークンの発行を行えます。
            </AlertDescription>
          </AlertBody>
          <Button variant="outline">メンバーを管理</Button>
        </Alert>
        <Alert role="status">
          <CheckIcon aria-hidden="true" />
          <AlertBody>
            <AlertTitle>プロフィールを保存しました</AlertTitle>
            <AlertDescription>
              表示名を「田中 美咲」、ハンドルを「misaki_t」に更新しました。
            </AlertDescription>
          </AlertBody>
        </Alert>
        <Alert role="status">
          <CheckIcon aria-hidden="true" />
          <AlertBody>
            <AlertTitle>アクセストークンを失効しました</AlertTitle>
            <AlertDescription>
              SDKから再び送信するには、新しいトークンを発行して設定してください。
            </AlertDescription>
          </AlertBody>
        </Alert>
        <Alert role="status">
          <InfoIcon aria-hidden="true" />
          <AlertBody>
            <AlertTitle>ライブ接続が切断されました</AlertTitle>
            <AlertDescription>
              受信済みのデータを表示しています。接続を確認して再接続してください。
            </AlertDescription>
          </AlertBody>
          <Button variant="outline">再接続</Button>
        </Alert>
      </Specimen>
    </CatalogPage>
  )
}
