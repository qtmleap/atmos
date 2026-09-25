import { Link } from '@tanstack/react-router'
import { ChevronDownIcon, ChevronRightIcon, LinkIcon, UserIcon } from 'lucide-react'
import { Fragment } from 'react'
import { AppHeaderBar } from '../../components/layout/app-header'
import { ConnectedThemeToggle } from '../../components/layout/theme-toggle'
import { Avatar, AvatarFallback } from '../../components/ui/avatar'
import { Button } from '../../components/ui/button'
import { Skeleton } from '../../components/ui/skeleton'
import { Status, Visibility } from '../../components/ui/status'
import { CatalogPage, SampleCaption, Specimen } from './catalog-section'
import { StaticMenu } from './static-menu'
import { StaticTabs } from './static-tabs'

function Breadcrumb({ label, trail }: { label: string; trail: string[] }) {
  const current = trail[trail.length - 1]
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {trail.map((item) => (
          <Fragment key={item}>
            {item === trail[0] ? null : <ChevronRightIcon aria-hidden="true" className="size-4" />}
            <li className="inline-flex items-center gap-2">
              {item === current ? (
                <span aria-current="page" className="text-foreground">
                  {item}
                </span>
              ) : (
                <Link to="." className="hover:underline hover:underline-offset-4">
                  {item}
                </Link>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}

function PageHeader({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 border-b py-6">{children}</div>
}

function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl leading-8">{children}</h2>
}

function Description({ children }: { children: React.ReactNode }) {
  return <p className="leading-[22px] text-muted-foreground">{children}</p>
}

export default function NavigationCatalog() {
  return (
    <CatalogPage
      slug="navigation"
      eyebrow="COMPONENTS / 04"
      title="ナビゲーション"
      description="アプリシェル・パンくず・タブ・見出しの独立した部品見本です。ページ全体は構成しません。"
      footer={['atmos · コンポーネント層 / 静止見本', '04 / 04 · ナビゲーション']}
    >
      <Specimen
        title="ログイン時"
        codes={['.app-shell / .app-header', '.app-nav / .app-account']}
        note="高さ64px。アバターとメニューボタンは右端に配置。"
        className="grid gap-4"
      >
        <AppHeaderBar
          current="projects"
          navLabel="ログイン時のナビゲーション"
          account={
            <>
              <ConnectedThemeToggle />
              <span className="text-xs">田中 美咲</span>
              <Avatar role="img" aria-label="田中 美咲のアバター">
                <AvatarFallback>田</AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon"
                data-preview="hover"
                aria-label="ユーザーメニュー"
                aria-haspopup="menu"
                aria-expanded="true"
                aria-controls="user-menu"
              >
                <ChevronDownIcon />
              </Button>
            </>
          }
        />
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            ユーザーメニューを開いた静止見本。
            <br />
            「管理」は管理者だけに表示。
          </p>
          <StaticMenu
            id="user-menu"
            label="ユーザーメニュー"
            name="田中 美咲"
            handle="misaki_t"
            className="w-56"
            items={[
              { label: 'プロフィール', preview: 'hover', icon: <UserIcon aria-hidden="true" /> },
              { label: 'プロフィール設定' },
              { label: 'アクセストークン' },
              { label: '管理' },
            ]}
            footer={{ label: 'ログアウト' }}
          />
        </div>
      </Specimen>
      <Specimen
        title="未ログイン時"
        codes={['.app-account / .btn']}
        note="公開プロジェクトを閲覧可能。メンバーはログイン後に利用。"
        className="grid gap-4"
      >
        <AppHeaderBar
          current="projects"
          navLabel="未ログイン時のナビゲーション"
          account={
            <>
              <ConnectedThemeToggle />
              <Button>ログイン</Button>
            </>
          }
        />
        <p className="text-xs text-muted-foreground">
          「メンバー」を開く際は認証が必要です。ここでは遷移しない静止見本として表示しています。
        </p>
      </Specimen>
      <Specimen
        title="ナビゲーション状態"
        codes={['[aria-current="page"]']}
        note="メンバー選択時。リンクのフォーカスも確認できます。"
      >
        <AppHeaderBar
          current="users"
          navLabel="メンバー選択時のナビゲーション"
          account={
            <>
              <ConnectedThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                data-preview="focus"
                aria-label="ユーザーメニューを開く"
                aria-haspopup="menu"
                aria-expanded="false"
              >
                <Avatar aria-hidden="true">
                  <AvatarFallback>田</AvatarFallback>
                </Avatar>
              </Button>
            </>
          }
        />
      </Specimen>
      <Specimen
        title="パンくず"
        codes={['.breadcrumb']}
        note="現在地はリンクにしません。長い名前も折り返して表示。"
        className="grid gap-4"
      >
        <Breadcrumb label="ルート階層の見本" trail={['プロジェクト']} />
        <Breadcrumb label="プロジェクト階層の見本" trail={['プロジェクト', '音声合成 v4']} />
        <Breadcrumb
          label="ジョブ階層の見本"
          trail={['プロジェクト', '音声合成 v4', 'vits-baseline-042']}
        />
      </Specimen>
      <Specimen title="タブ" codes={['.tabs / .tabs-list', '.tabs-trigger']} className="grid gap-4">
        <StaticTabs label="ジョブの詳細" value="metrics" />
      </Specimen>
      <Specimen
        title="ページ見出し"
        codes={['.page-header']}
        note="パンくず＋見出し＋補足。囲み箱は使わず、下端の罫線で区切ります。"
        className="grid gap-4"
      >
        <PageHeader>
          <Breadcrumb
            label="プロジェクト見出しのパンくず"
            trail={['プロジェクト', '音声合成 v4']}
          />
          <div className="flex items-center justify-between gap-4">
            <div className="grid gap-2">
              <Title>音声合成 v4</Title>
              <Description>
                所有者：田中 美咲 <span className="font-mono text-xs">@misaki_t</span> · 作成
                2026-09-18
              </Description>
            </div>
            <Visibility visibility="private">非公開</Visibility>
          </div>
        </PageHeader>
        <PageHeader>
          <Breadcrumb
            label="ジョブ見出しのパンくず"
            trail={['プロジェクト', '音声合成 v4', 'vits-baseline-042']}
          />
          <div className="flex items-center justify-between gap-4">
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <Title>vits-baseline-042</Title>
                <Status status="running">実行中</Status>
              </div>
              <Description>田中 美咲が開始 · 2026-09-24 08:15 UTC</Description>
            </div>
            <Button variant="outline">
              <LinkIcon />
              リンクをコピー
            </Button>
          </div>
        </PageHeader>
        <PageHeader>
          <div className="grid gap-2">
            <Title>メンバー</Title>
            <Description>チームのメンバー 5人</Description>
          </div>
        </PageHeader>
        <div className="grid gap-4 border-b py-6" aria-busy="true">
          <SampleCaption>見出しを読み込み中</SampleCaption>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-[280px]" />
          <Skeleton className="h-4 w-[360px] max-w-full" />
        </div>
      </Specimen>
    </CatalogPage>
  )
}
