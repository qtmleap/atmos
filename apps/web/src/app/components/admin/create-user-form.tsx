// The "create user" column of /admin (designs/pages/admin.html).
// Presentational; the parent owns the field values and submission.
import { UserPlusIcon } from 'lucide-react'
import type { Role } from '@/shared/types'
import { ROLES } from '@/shared/types'
import { type CreateUserFormInput, isRole } from '../../hooks/use-admin-users'
import { FormDescription, FormField, FormMessage } from '../settings/form-field'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { NativeSelect, NativeSelectOption } from '../ui/native-select'
import { Separator } from '../ui/separator'

const ROLE_OPTION_LABELS: Record<Role, string> = {
  user: 'member（メンバー）',
  admin: 'admin（管理者）',
}

/** The select lists member first, as the mock does. */
const ROLE_OPTIONS: readonly Role[] = [...ROLES].reverse()

export interface CreateUserFormProps {
  form: CreateUserFormInput
  onChange: (form: CreateUserFormInput) => void
  creating: boolean
  error: string | null
  onSubmit: () => void
}

export function CreateUserForm({ form, onChange, creating, error, onSubmit }: CreateUserFormProps) {
  return (
    <aside aria-labelledby="create-title" className="grid gap-4 border-l pl-8">
      <div className="grid gap-2">
        <h2 id="create-title" className="text-xl leading-7 font-semibold tracking-tight">
          ユーザーを作成
        </h2>
        <p className="leading-[22px] text-muted-foreground">
          Cloudflare Access で使用するメールアドレスを登録してください。
        </p>
      </div>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <FormField>
          <Label htmlFor="new-email">メールアドレス</Label>
          <Input
            id="new-email"
            name="cf_access_email"
            type="email"
            placeholder="name@example.com"
            required
            value={form.cf_access_email}
            onChange={(event) => onChange({ ...form, cf_access_email: event.target.value })}
          />
        </FormField>
        <FormField>
          <Label htmlFor="new-name">表示名</Label>
          <Input
            id="new-name"
            name="display_name"
            placeholder="例：山田 太郎"
            required
            value={form.display_name}
            onChange={(event) => onChange({ ...form, display_name: event.target.value })}
          />
        </FormField>
        <FormField>
          <Label htmlFor="new-handle">URL用ハンドル</Label>
          <Input
            id="new-handle"
            name="handle"
            placeholder="例：taro_y"
            required
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9_-]{3,32}"
            aria-describedby="new-handle-help"
            value={form.handle}
            onChange={(event) => onChange({ ...form, handle: event.target.value })}
          />
          <FormDescription id="new-handle-help">
            半角英数・ハイフン・アンダースコア、3〜32文字。
          </FormDescription>
        </FormField>
        <FormField>
          <Label htmlFor="new-role">ロール</Label>
          <NativeSelect
            id="new-role"
            name="role"
            value={form.role}
            onChange={(event) => {
              if (isRole(event.target.value)) {
                onChange({ ...form, role: event.target.value })
              }
            }}
          >
            {ROLE_OPTIONS.map((role) => (
              <NativeSelectOption key={role} value={role}>
                {ROLE_OPTION_LABELS[role]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
        {error !== null ? <FormMessage>{error}</FormMessage> : null}
        <Button type="submit" disabled={creating}>
          <UserPlusIcon aria-hidden="true" />
          ユーザーを作成
        </Button>
      </form>
      <Separator />
      <div className="grid gap-2">
        <h3 className="leading-5 font-semibold">ロールについて</h3>
        <p className="text-xs text-muted-foreground">
          <span className="font-mono">admin</span>：ユーザー作成・ロール変更が可能です。
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="font-mono">member</span>：実験の閲覧・記録が可能です。
        </p>
      </div>
    </aside>
  )
}
