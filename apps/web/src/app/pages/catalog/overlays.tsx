import { ChevronDownIcon, CircleAlertIcon, CopyIcon, InfoIcon, LockIcon } from 'lucide-react'
import type * as React from 'react'
import { Alert, AlertBody, AlertDescription, AlertTitle } from '../../components/ui/alert'
import { Avatar, AvatarFallback } from '../../components/ui/avatar'
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
        title="トークン再発行の確認"
        codes={['.dialog / .dialog-overlay']}
        className={cn(dialogStyles.overlay, 'grid place-items-center p-6')}
      >
        <StaticDialog
          id="reissue"
          role="alertdialog"
          title="トークンを発行し直しますか？"
          description="2026年9月24日 09:42 UTC に発行した今のトークン（atmos_...w52G）はすぐに失効し、それを使っている SDK からの送信はできなくなります。"
          closeLabel="閉じる"
          footer={
            <>
              <Button variant="outline">キャンセル</Button>
              <Button>発行し直す</Button>
            </>
          }
        />
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
            <p className="leading-none font-medium">メンバー限定</p>
            <p className="leading-[22px] text-muted-foreground">
              ログインしているメンバーなら誰でも閲覧できます。
            </p>
          </div>
          <Separator />
          <div className="grid gap-2">
            <p className="leading-none font-medium">非公開</p>
            <p className="leading-[22px] text-muted-foreground">
              所有者と管理者だけが閲覧できます。
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
