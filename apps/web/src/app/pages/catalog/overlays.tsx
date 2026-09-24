import {
  ArrowRightIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  CopyIcon,
  InfoIcon,
  LockIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import type * as React from 'react'
import { Alert, AlertBody, AlertDescription, AlertTitle } from '../../components/ui/alert'
import { Avatar, AvatarFallback } from '../../components/ui/avatar'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { dialogStyles } from '../../components/ui/dialog'
import { popoverStyles } from '../../components/ui/popover'
import { Separator } from '../../components/ui/separator'
import { StatusDot } from '../../components/ui/status'
import { tooltipStyles } from '../../components/ui/tooltip'
import { cn } from '../../lib/utils'
import { CatalogPage, SampleCaption, Specimen } from './catalog-section'
import { StaticDialog } from './static-dialog'
import { StaticMenu } from './static-menu'

const accountItems = [
  { label: 'プロフィール' },
  { label: 'プロフィール設定' },
  { label: 'アクセストークン' },
]

/** A tooltip shown open above its trigger, with the 8px arrow underneath. */
function StaticTooltip({
  id,
  text,
  children,
}: {
  id: string
  text: string
  children: React.ReactNode
}) {
  return (
    <div className="grid justify-items-center gap-3">
      <div role="tooltip" id={id} className={cn(tooltipStyles.content, 'relative')}>
        {text}
        <span
          aria-hidden="true"
          className={cn(tooltipStyles.arrow, 'absolute -bottom-1 left-[calc(50%-4px)]')}
        />
      </div>
      {children}
    </div>
  )
}

function PopoverSample({
  id,
  trigger,
  children,
}: {
  id: string
  trigger: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Button variant="outline" aria-haspopup="dialog" aria-expanded="true" aria-controls={id}>
        {trigger}
      </Button>
      <div
        id={id}
        role="dialog"
        aria-labelledby={`${id}-title`}
        className={cn(popoverStyles.content, 'grid gap-4')}
      >
        {children}
      </div>
    </div>
  )
}

export default function OverlaysCatalog() {
  return (
    <CatalogPage
      slug="overlays"
      eyebrow="COMPONENTS / 05"
      title="オーバーレイ"
      description="確認・メニュー・補足情報。すべて開いた静止見本です。操作、フォーカストラップ、背景の操作抑止は実装しません。"
      footer={['atmos · コンポーネント層 / 静止見本', '05 / 07 · オーバーレイ']}
    >
      <Specimen
        title="トークン再発行"
        codes={['.dialog / .dialog-overlay']}
        note="再発行で旧トークンは自動失効。影を使わず、背景と罫線で区別します。"
        className={cn(dialogStyles.overlay, 'grid place-items-center p-6')}
      >
        <StaticDialog
          id="token"
          title="アクセストークンを再発行しますか？"
          description="現在のトークンは直ちに失効します。SDKで使用中のトークンも、新しいものへの置き換えが必要です。"
          closeLabel="確認を閉じる"
          footer={
            <>
              <Button variant="outline" data-preview="focus">
                キャンセル
              </Button>
              <Button variant="destructive">再発行する</Button>
            </>
          }
        >
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="text-muted-foreground">現在のトークンの発行日時</span>
            <time dateTime="2026-09-18T08:30:00Z">2026-09-18 08:30 UTC</time>
          </div>
          <Alert variant="destructive">
            <TriangleAlertIcon aria-hidden="true" />
            <AlertBody>
              <AlertTitle>実行中のジョブの送信に影響します</AlertTitle>
              <AlertDescription>
                旧トークンを使った以降のデータ送信は認証エラーになります。
              </AlertDescription>
            </AlertBody>
          </Alert>
        </StaticDialog>
      </Specimen>
      <Specimen
        title="ロール変更"
        codes={['.dialog-title / .dialog-footer']}
        note="対象と変更内容を明示。最後の管理者を一般ユーザーには変更できません。"
        className="grid grid-cols-2 items-start gap-6"
      >
        <StaticDialog
          id="role"
          title="管理者に変更しますか？"
          description="佐藤 悠斗さんにメンバーの追加・ロール変更の権限を付与します。"
          closeLabel="ロール変更の確認を閉じる"
          footer={
            <>
              <Button variant="outline">キャンセル</Button>
              <Button>変更する</Button>
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <Avatar aria-hidden="true">
              <AvatarFallback>佐</AvatarFallback>
            </Avatar>
            <div>
              <p>佐藤 悠斗</p>
              <p className="font-mono text-xs text-muted-foreground">@yuto_s</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">一般ユーザー</Badge>
            <ArrowRightIcon aria-label="変更後" className="size-4" />
            <Badge>管理者</Badge>
          </div>
        </StaticDialog>
        <div className="grid gap-4">
          <SampleCaption>保存中 / 更新が競合したとき</SampleCaption>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled aria-busy="true">
              変更中…
            </Button>
            <Button variant="outline" disabled>
              キャンセル
            </Button>
          </div>
          <Alert variant="destructive" role="alert">
            <CircleAlertIcon aria-hidden="true" />
            <AlertBody>
              <AlertTitle>ロールを変更できません</AlertTitle>
              <AlertDescription>
                チームには最低1人の管理者が必要です。別のメンバーを管理者に変更してから、もう一度お試しください。
              </AlertDescription>
            </AlertBody>
          </Alert>
        </div>
      </Specimen>
      <Specimen
        title="アカウントメニュー"
        codes={['.dropdown / .dropdown-item']}
        note="通常・ホバー・フォーカス・無効。プロフィールの公開情報のみ表示。"
        className="grid grid-cols-3 gap-6"
      >
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <Avatar aria-hidden="true">
              <AvatarFallback>田</AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              aria-haspopup="menu"
              aria-expanded="true"
              aria-controls="account-menu"
            >
              田中 美咲
              <ChevronDownIcon />
            </Button>
          </div>
          <StaticMenu
            id="account-menu"
            label="アカウント"
            name="田中 美咲"
            handle="misaki_t"
            items={[
              { label: 'プロフィール', preview: 'hover' },
              { label: 'プロフィール設定', preview: 'focus' },
              { label: 'アクセストークン' },
              { label: '管理' },
            ]}
            footer={{ label: 'ログアウト' }}
          />
        </div>
        <div className="grid content-start gap-4">
          <SampleCaption>一般ユーザー / 管理項目なし</SampleCaption>
          <StaticMenu
            label="一般ユーザーのアカウント"
            name="鈴木 葵"
            handle="aoi_ml"
            items={accountItems}
            footer={{ label: 'ログアウト中…', disabled: true }}
          />
        </div>
      </Specimen>
      <Specimen
        title="ツールチップ"
        codes={['.tooltip']}
        note="短い補足。必須の説明はツールチップだけに隠しません。"
        className="grid grid-cols-3 gap-6"
      >
        <StaticTooltip id="copy-tip" text="ジョブのリンクをコピー">
          <Button
            variant="outline"
            size="icon"
            data-preview="hover"
            aria-label="リンクをコピー"
            aria-describedby="copy-tip"
          >
            <CopyIcon />
          </Button>
        </StaticTooltip>
        <StaticTooltip id="live-tip" text="受信したデータを自動反映">
          <Button variant="ghost" data-preview="focus" aria-describedby="live-tip">
            <StatusDot />
            ライブ更新中
          </Button>
        </StaticTooltip>
        <StaticTooltip id="private-tip" text="閲覧にはログインが必要です">
          <Button variant="ghost" aria-describedby="private-tip">
            <LockIcon />
            非公開
          </Button>
        </StaticTooltip>
      </Specimen>
      <Specimen
        title="ポップオーバー"
        codes={['.popover']}
        note="補足情報を見出しと本文で説明。幅288px。"
        className="flex flex-wrap items-start gap-3"
      >
        <PopoverSample id="visibility-popover" trigger="公開範囲について">
          <h3 id="visibility-popover-title">プロジェクトの公開範囲</h3>
          <div className="grid gap-2">
            <p className="leading-none font-medium">公開</p>
            <p className="leading-[22px] text-muted-foreground">
              ログインしていない人も、ジョブやメトリクスを閲覧できます。
            </p>
          </div>
          <Separator />
          <div className="grid gap-2">
            <p className="leading-none font-medium">非公開</p>
            <p className="leading-[22px] text-muted-foreground">
              ログインしたチームメンバーのみ閲覧できます。
            </p>
          </div>
          <p className="text-xs text-muted-foreground">SDKでの作成時は、既定で非公開です。</p>
        </PopoverSample>
        <PopoverSample id="time-popover" trigger="日時の表示">
          <h3 id="time-popover-title">受信日時</h3>
          <p className="leading-[22px] text-muted-foreground">2026年9月24日 09:42:18 UTC</p>
          <p className="text-xs text-muted-foreground">
            このカタログでは、すべての日時をUTCで表示しています。
          </p>
        </PopoverSample>
      </Specimen>
      <Specimen
        title="お知らせ"
        codes={['.alert / .alert-destructive']}
        note="通常・エラーともに罫線型。角丸の箱に閉じ込めません。"
        className="grid gap-4"
      >
        <Alert role="status">
          <InfoIcon aria-hidden="true" />
          <AlertBody>
            <AlertTitle>このプロジェクトは公開されています</AlertTitle>
            <AlertDescription>
              ジョブの設定・メディア・ログも、リンクを知っている人が閲覧できます。
            </AlertDescription>
          </AlertBody>
        </Alert>
        <Alert variant="destructive" role="alert">
          <CircleAlertIcon aria-hidden="true" />
          <AlertBody>
            <AlertTitle>データを取得できませんでした</AlertTitle>
            <AlertDescription>通信状況を確認して、もう一度お試しください。</AlertDescription>
          </AlertBody>
          <Button variant="outline">再試行</Button>
        </Alert>
      </Specimen>
    </CatalogPage>
  )
}
