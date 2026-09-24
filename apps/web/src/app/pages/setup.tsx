// /setup — first-run admin registration (docs/SPEC.md §2, docs/PLAN.md §4,
// designs/pages/setup.html). Gated server-side on the `users` table being
// empty; once a user exists (someone is signed in, or the server answered
// `already_initialized`) the page shows the closed state of
// designs/pages/setup-closed.html instead.

import { Link } from '@tanstack/react-router'
import { ArrowRightIcon, ShieldCheckIcon, UserIcon } from 'lucide-react'
import { LoadingRows } from '../components/common/loading-rows'
import { FormDescription, FormField, FormMessage } from '../components/settings/form-field'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { ErrorCode } from '../components/ui/empty-state'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useSetupForm } from '../hooks/use-setup-form'

export default function SetupPage() {
  const form = useSetupForm()

  if (form.loading) {
    return <LoadingRows />
  }

  if (form.result !== null) {
    return <SetupDone displayName={form.result.user.display_name} />
  }

  if (form.closed) {
    return <SetupClosed />
  }

  return (
    <div className="mx-auto my-12 w-[min(100%-48px,520px)]">
      <header className="grid gap-4 border-b py-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <ShieldCheckIcon aria-hidden="true" className="size-4 shrink-0" />
          <span>最初の管理者を登録</span>
        </div>
        <h1 className="text-2xl leading-8 font-semibold tracking-tight">atmos へようこそ</h1>
        <p className="leading-[22px] text-muted-foreground">
          実験を記録する準備をはじめましょう。
          <br />
          初回セットアップは、一度だけ実行できます。
        </p>
      </header>

      <section aria-labelledby="identity-title" className="grid gap-6 border-b py-6">
        <div className="flex items-center justify-between gap-4">
          <h3 id="identity-title" className="leading-5 font-semibold">
            Cloudflare Access の認証情報
          </h3>
          <Badge variant="secondary">認証済み</Badge>
        </div>
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted [&>svg]:size-4"
          >
            <UserIcon />
          </span>
          <div className="grid gap-2">
            <p>Cloudflare Access でサインインしているアカウント</p>
            <p className="text-xs text-muted-foreground">
              このメールアドレスを最初の管理者として登録します。
            </p>
          </div>
        </div>
      </section>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void form.submit()
        }}
      >
        <div className="grid gap-6 border-b py-6">
          <div className="grid grid-cols-2 gap-6">
            <FormField>
              <Label htmlFor="display-name">表示名</Label>
              <Input
                id="display-name"
                name="display_name"
                value={form.displayName}
                required
                autoComplete="name"
                onChange={(event) => form.setDisplayName(event.target.value)}
              />
            </FormField>
            <FormField>
              <Label htmlFor="handle">URL用ハンドル</Label>
              <Input
                id="handle"
                name="handle"
                className="font-mono"
                value={form.handle}
                required
                minLength={3}
                maxLength={32}
                pattern="[A-Za-z0-9_-]{3,32}"
                autoComplete="username"
                aria-describedby="handle-help"
                onChange={(event) => form.setHandle(event.target.value)}
              />
              <FormDescription id="handle-help">
                半角英数・ハイフン・アンダースコア、3〜32文字。
              </FormDescription>
            </FormField>
          </div>
          <FormField>
            <Label htmlFor="init-key">
              初期管理者キー
              <span className="font-mono text-xs font-normal text-muted-foreground">
                INIT_ADMIN_KEY
              </span>
            </Label>
            <Input
              id="init-key"
              name="init_admin_key"
              type="password"
              value={form.initAdminKey}
              placeholder="初期管理者キーを入力"
              required
              autoComplete="off"
              aria-describedby="key-help"
              onChange={(event) => form.setInitAdminKey(event.target.value)}
            />
            <FormDescription id="key-help">
              デプロイ時に Wrangler Secret に設定した INIT_ADMIN_KEY を入力してください。Cloudflare
              Access のパスワードではありません。
            </FormDescription>
            {form.error !== null ? <FormMessage>{form.error}</FormMessage> : null}
          </FormField>
        </div>
        <div className="grid gap-3 pt-6">
          <Button type="submit" disabled={form.submitting}>
            <ShieldCheckIcon aria-hidden="true" />
            最初の管理者として登録
          </Button>
          <p className="text-xs text-muted-foreground">
            登録後はこのページを利用できなくなります。
            <br />
            以降のユーザー追加・ロール変更は、管理画面から行えます。
          </p>
        </div>
      </form>
    </div>
  )
}

function SetupDone({ displayName }: { displayName: string }) {
  return (
    <div className="mx-auto my-12 w-[min(100%-48px,520px)]">
      <header className="grid gap-4 border-b py-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <ShieldCheckIcon aria-hidden="true" className="size-4 shrink-0" />
          <span>初回セットアップ</span>
        </div>
        <h1 className="text-2xl leading-8 font-semibold tracking-tight">初期設定が完了しました</h1>
        <p className="leading-[22px] text-muted-foreground">
          {displayName}さんを最初の管理者として登録しました。
        </p>
      </header>
      <div className="flex items-center gap-3 pt-6">
        <Button asChild>
          <Link to="/">プロジェクトへ</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/admin">
            ユーザー管理へ
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function SetupClosed() {
  return (
    <div className="mx-auto mt-28 max-w-[640px] px-6">
      <section
        aria-labelledby="closed-title"
        className="grid justify-items-center gap-5 py-8 text-center"
      >
        <p className="text-xs text-muted-foreground">初回セットアップ</p>
        <ErrorCode>403</ErrorCode>
        <h1 id="closed-title" className="text-3xl leading-9 font-semibold tracking-tight">
          セットアップは完了しています
        </h1>
        <p className="max-w-[520px] leading-[22px] text-muted-foreground">
          すでにユーザーが登録されているため、
          <br />
          初回セットアップを再実行することはできません。
        </p>
        <p className="font-mono text-xs text-muted-foreground">already_initialized</p>
        <div className="flex items-center gap-3">
          <Button asChild>
            <Link to="/">プロジェクトへ</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin">
              ユーザー管理へ
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
      <section aria-labelledby="next-title" className="grid gap-3 border-t py-6">
        <h3 id="next-title" className="leading-5 font-semibold">
          ユーザーを追加したい場合
        </h3>
        <p className="leading-[22px] text-muted-foreground">
          管理者は管理画面からユーザーを追加できます。
          <br />
          管理者権限がない場合は、チームの管理者に連絡してください。
        </p>
        <p className="text-xs text-muted-foreground">
          INIT_ADMIN_KEY を入力し直しても、この状態は解除されません。
        </p>
      </section>
    </div>
  )
}
