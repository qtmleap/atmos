// The profile section of /settings/profile (designs/pages/settings-profile.html):
// avatar with an upload button, then display name and handle, then the
// ruled action row. Presentational; state lives in useProfileForm.
import { InfoIcon, UploadIcon } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { Button, buttonVariants } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Separator } from '../ui/separator'
import { FormDescription, FormField, FormMessage } from './form-field'

export interface ProfileFormProps {
  displayName: string
  onDisplayNameChange: (value: string) => void
  handle: string
  onHandleChange: (value: string) => void
  saving: boolean
  saveError: string | null
  saveSuccess: boolean
  onSave: () => void
  onReset: () => void
  avatarUrl: string | null
  uploadingAvatar: boolean
  avatarError: string | null
  onAvatarFile: (file: File) => void
}

/** 64px avatar: the image when set, otherwise the first character at 24px. */
function ProfileAvatar({ url, name }: { url: string | null; name: string }) {
  const initial = name.slice(0, 1)
  return (
    <span
      role="img"
      aria-label={`現在のアバター：${initial}`}
      className="inline-flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-medium"
    >
      {url === null ? initial : <img src={url} alt="" className="size-full object-cover" />}
    </span>
  )
}

export function ProfileForm({
  displayName,
  onDisplayNameChange,
  handle,
  onHandleChange,
  saving,
  saveError,
  saveSuccess,
  onSave,
  onReset,
  avatarUrl,
  uploadingAvatar,
  avatarError,
  onAvatarFile,
}: ProfileFormProps) {
  return (
    <section aria-labelledby="profile-settings" className="grid gap-6">
      <div className="grid gap-2">
        <h2 id="profile-settings" className="text-xl leading-7 font-semibold tracking-tight">
          プロフィール
        </h2>
        <p className="leading-[22px] text-muted-foreground">
          他のユーザーに表示される情報を編集します。
        </p>
      </div>
      <form
        className="grid gap-6"
        onSubmit={(event) => {
          event.preventDefault()
          onSave()
        }}
        onReset={(event) => {
          event.preventDefault()
          onReset()
        }}
      >
        <FormField>
          <span id="avatar-label" className="text-sm leading-none font-medium">
            アバター
          </span>
          <div className="flex items-center gap-3">
            <ProfileAvatar url={avatarUrl} name={displayName} />
            <div className="grid gap-2">
              <label className="relative inline-flex w-fit rounded-md focus-within:ring-[3px] focus-within:ring-ring/50">
                <span className={cn(buttonVariants({ variant: 'outline' }))}>
                  <UploadIcon aria-hidden="true" />
                  画像を変更
                </span>
                <input
                  type="file"
                  name="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-labelledby="avatar-label"
                  aria-describedby="avatar-help"
                  disabled={uploadingAvatar}
                  className="absolute inset-0 w-full cursor-pointer opacity-0"
                  onChange={(event) => {
                    const file = event.target.files === null ? null : event.target.files.item(0)
                    if (file !== null) {
                      onAvatarFile(file)
                    }
                    event.target.value = ''
                  }}
                />
              </label>
              <FormDescription id="avatar-help">
                PNG・JPEG・WebP、最大2MB。未設定時は頭文字を表示します。
              </FormDescription>
              {uploadingAvatar ? <FormDescription>アップロード中...</FormDescription> : null}
              {avatarError !== null ? <FormMessage>{avatarError}</FormMessage> : null}
            </div>
          </div>
        </FormField>
        <Separator />
        <FormField>
          <Label htmlFor="display-name">表示名</Label>
          <Input
            id="display-name"
            name="display_name"
            value={displayName}
            required
            autoComplete="name"
            aria-describedby="display-name-help"
            onChange={(event) => onDisplayNameChange(event.target.value)}
          />
          <FormDescription id="display-name-help">
            メンバー一覧やプロフィールに表示されます。日本語も使用できます。
          </FormDescription>
        </FormField>
        <FormField>
          <Label htmlFor="handle">URL用ハンドル</Label>
          <Input
            id="handle"
            name="handle"
            className="font-mono"
            value={handle}
            required
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9_-]{3,32}"
            autoComplete="username"
            spellCheck={false}
            aria-describedby="handle-help profile-url handle-warning"
            onChange={(event) => onHandleChange(event.target.value)}
          />
          <FormDescription id="handle-help">
            半角英数・ハイフン・アンダースコア、3〜32文字。
          </FormDescription>
          <FormDescription id="profile-url">
            プロフィールURL：<span className="font-mono">/users/{handle}</span>
          </FormDescription>
        </FormField>
        <div id="handle-warning" className="flex items-start gap-2 text-muted-foreground">
          <InfoIcon aria-hidden="true" className="mt-px size-4 shrink-0" />
          <div className="grid gap-2 text-xs">
            <p>ハンドルを変更すると、プロフィールのURLも変わります。</p>
            <p>共有済みのリンクやブックマークを確認してください。</p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t pt-6">
          <Button type="submit" disabled={saving}>
            変更を保存
          </Button>
          <Button type="reset" variant="ghost">
            キャンセル
          </Button>
          {saveError !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          ) : null}
          {saveSuccess ? (
            <p role="status" className="text-sm text-muted-foreground">
              保存しました。
            </p>
          ) : null}
        </div>
      </form>
    </section>
  )
}
