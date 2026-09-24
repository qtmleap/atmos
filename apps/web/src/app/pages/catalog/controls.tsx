import { CheckIcon, CopyIcon, EllipsisIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react'
import { Fragment } from 'react'
import { Button } from '../../components/ui/button'
import { dropdownMenuStyles } from '../../components/ui/dropdown-menu'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { NativeSelect, NativeSelectOption } from '../../components/ui/native-select'
import { Switch } from '../../components/ui/switch'
import { Textarea } from '../../components/ui/textarea'
import { cn } from '../../lib/utils'
import { CatalogPage, FormField, Specimen } from './catalog-section'

const buttonRows = [
  { variant: 'default', label: '保存する', busy: '保存中…' },
  { variant: 'outline', label: '再読み込み', busy: '読込中…' },
  { variant: 'ghost', label: 'キャンセル', busy: '処理中…' },
  { variant: 'secondary', label: 'コピー', busy: 'コピー中…' },
  { variant: 'destructive', label: '失効する', busy: '失効中…' },
  { variant: 'link', label: '詳細を見る', busy: '読込中…' },
] as const

const stateHeadings = ['通常', 'ホバー', 'フォーカス', '無効', '読み込み中']

function Hint({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-xs text-muted-foreground">
      {children}
    </p>
  )
}

function ErrorText({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-xs text-destructive">
      {children}
    </p>
  )
}

function ButtonMatrix() {
  return (
    <div className="grid grid-cols-[100px_repeat(5,minmax(0,1fr))] items-center gap-4">
      <span />
      {stateHeadings.map((heading) => (
        <span key={heading} className="text-xs text-muted-foreground">
          {heading}
        </span>
      ))}
      {buttonRows.map((row) => (
        <Fragment key={row.variant}>
          <code className="font-mono text-xs text-muted-foreground">{row.variant}</code>
          <Button variant={row.variant} className="justify-self-start">
            {row.label}
          </Button>
          <Button variant={row.variant} data-preview="hover" className="justify-self-start">
            {row.label}
          </Button>
          <Button variant={row.variant} data-preview="focus" className="justify-self-start">
            {row.label}
          </Button>
          <Button variant={row.variant} disabled className="justify-self-start">
            {row.label}
          </Button>
          <Button variant={row.variant} disabled aria-busy="true" className="justify-self-start">
            {row.busy}
          </Button>
        </Fragment>
      ))}
    </div>
  )
}

function SelectOptions({ options }: { options: string[] }) {
  return options.map((option) => <NativeSelectOption key={option}>{option}</NativeSelectOption>)
}

export default function ControlsCatalog() {
  return (
    <CatalogPage
      slug="controls"
      eyebrow="COMPONENTS / 02"
      title="コントロール"
      description="Button・Input・Select は高さ32px。ホバーとフォーカスは撮影用の固定状態も併記しています。"
      footer={['atmos · コンポーネント層 / 静止見本', '02 / 04 · コントロール']}
    >
      <Specimen
        title="ボタン"
        codes={['.btn / .btn-*']}
        note="6バリアント × 5状態。読み込み中は操作不可。"
      >
        <ButtonMatrix />
      </Specimen>
      <Specimen
        title="サイズ・アイコン"
        codes={['.btn-sm / .btn-icon']}
        note="アイコン16px、stroke=currentColor。アイコン単独にも名前を付けます。"
        className="flex flex-wrap items-center gap-3"
      >
        <Button size="sm">
          <PlusIcon />
          トークンを発行
        </Button>
        <Button variant="outline" size="sm">
          <CopyIcon />
          コピー
        </Button>
        <Button variant="outline" size="icon" aria-label="ジョブを検索">
          <SearchIcon />
        </Button>
        <Button variant="ghost" size="icon" data-preview="hover" aria-label="その他の操作">
          <EllipsisIcon />
        </Button>
        <Button variant="ghost" size="icon" data-preview="focus" aria-label="閉じる">
          <XIcon />
        </Button>
        <Button variant="outline" size="icon" disabled aria-label="コピーできません">
          <CopyIcon />
        </Button>
        <span className="text-xs text-muted-foreground">すべて h-8 / アイコンボタン 32 × 32px</span>
      </Specimen>
      <Specimen
        title="テキスト入力"
        codes={['.input / .label']}
        note="空・入力済み・ホバー・フォーカス・無効・読み取り専用。"
        className="grid grid-cols-3 gap-6"
      >
        <FormField>
          <Label htmlFor="input-empty">空</Label>
          <Input id="input-empty" placeholder="表示名を入力" />
        </FormField>
        <FormField>
          <Label htmlFor="input-filled">入力済み</Label>
          <Input id="input-filled" defaultValue="田中 美咲" />
        </FormField>
        <FormField>
          <Label htmlFor="input-hover">ホバー</Label>
          <Input id="input-hover" data-preview="hover" defaultValue="田中 美咲" />
        </FormField>
        <FormField>
          <Label htmlFor="input-focus">フォーカス</Label>
          <Input id="input-focus" data-preview="focus" defaultValue="misaki_t" />
        </FormField>
        <FormField>
          <Label htmlFor="input-disabled" className="text-muted-foreground">
            無効
          </Label>
          <Input id="input-disabled" defaultValue="田中 美咲" disabled />
        </FormField>
        <FormField>
          <Label htmlFor="input-readonly">読み取り専用</Label>
          <Input id="input-readonly" className="font-mono" defaultValue="misaki_t" readOnly />
        </FormField>
      </Specimen>
      <Specimen
        title="選択"
        codes={['.select / .select-wrap']}
        note="ネイティブSelectに共通トークンを適用。開いた選択肢も静止表示。"
        className="grid grid-cols-3 gap-6"
      >
        <FormField>
          <Label htmlFor="select-empty">未選択</Label>
          <NativeSelect id="select-empty" required defaultValue="">
            <NativeSelectOption value="" disabled>
              ステータスを選択
            </NativeSelectOption>
            <SelectOptions options={['実行中', '完了', '失敗']} />
          </NativeSelect>
        </FormField>
        <FormField>
          <Label htmlFor="select-filled">選択済み</Label>
          <NativeSelect id="select-filled" defaultValue="実行中">
            <SelectOptions options={['すべてのステータス', '実行中', '完了', '失敗']} />
          </NativeSelect>
        </FormField>
        <FormField>
          <Label htmlFor="select-hover">ホバー</Label>
          <NativeSelect id="select-hover" data-preview="hover">
            <SelectOptions options={['すべてのステータス', '実行中']} />
          </NativeSelect>
        </FormField>
        <FormField>
          <Label htmlFor="select-focus">フォーカス・開いた状態</Label>
          <NativeSelect id="select-focus" data-preview="focus">
            <SelectOptions options={['実行中', '完了']} />
          </NativeSelect>
          <div
            role="listbox"
            aria-label="ステータスの選択肢（静止見本）"
            className={dropdownMenuStyles.content}
          >
            <div
              role="option"
              tabIndex={-1}
              aria-selected="true"
              data-highlighted=""
              className={dropdownMenuStyles.item}
            >
              <CheckIcon />
              実行中
            </div>
            <div
              role="option"
              tabIndex={-1}
              aria-selected="false"
              className={dropdownMenuStyles.item}
            >
              完了
            </div>
            <div
              role="option"
              tabIndex={-1}
              aria-selected="false"
              className={dropdownMenuStyles.item}
            >
              失敗
            </div>
          </div>
        </FormField>
        <FormField>
          <Label htmlFor="select-disabled" className="text-muted-foreground">
            無効・読み込み中
          </Label>
          <NativeSelect id="select-disabled" disabled aria-busy="true">
            <NativeSelectOption>読み込み中…</NativeSelectOption>
          </NativeSelect>
        </FormField>
        <FormField>
          <Label htmlFor="select-error" className="text-destructive">
            エラー
          </Label>
          <NativeSelect
            id="select-error"
            aria-invalid="true"
            aria-describedby="select-error-message"
            defaultValue=""
          >
            <NativeSelectOption value="">ロールを選択</NativeSelectOption>
            <SelectOptions options={['一般ユーザー', '管理者']} />
          </NativeSelect>
          <ErrorText id="select-error-message">ロールを選択してください。</ErrorText>
        </FormField>
      </Specimen>
      <Specimen
        title="複数行入力"
        codes={['.textarea']}
        note="部品の見本です。ジョブ説明などのスキーマ外フィールドは追加しません。"
        className="grid grid-cols-3 gap-6"
      >
        <FormField>
          <Label htmlFor="textarea-empty">空</Label>
          <Textarea id="textarea-empty" placeholder="テキストを入力" />
        </FormField>
        <FormField>
          <Label htmlFor="textarea-filled">入力済み</Label>
          <Textarea
            id="textarea-filled"
            defaultValue={'複数行テキストの見本です。\n改行を含む入力を表示します。'}
          />
        </FormField>
        <FormField>
          <Label htmlFor="textarea-focus">フォーカス</Label>
          <Textarea id="textarea-focus" data-preview="focus" defaultValue="編集中のテキスト" />
        </FormField>
        <FormField>
          <Label htmlFor="textarea-disabled" className="text-muted-foreground">
            無効
          </Label>
          <Textarea id="textarea-disabled" disabled defaultValue="入力できません" />
        </FormField>
        <FormField>
          <Label htmlFor="textarea-readonly">読み取り専用</Label>
          <Textarea id="textarea-readonly" readOnly defaultValue="読み取り専用のテキスト" />
        </FormField>
        <FormField>
          <Label htmlFor="textarea-error" className="text-destructive">
            エラー
          </Label>
          <Textarea id="textarea-error" aria-invalid="true" aria-describedby="textarea-message" />
          <ErrorText id="textarea-message">テキストを入力してください。</ErrorText>
        </FormField>
      </Specimen>
      <Specimen
        title="スイッチ"
        codes={['.switch / .label']}
        note="32 × 18px。ラベルと組み合わせて状態を明示。"
        className="grid grid-cols-3 gap-6"
      >
        {[
          { id: 'switch-off', label: 'ログを追従しない', checked: false, disabled: false },
          { id: 'switch-on', label: 'ログを追従する', checked: true, disabled: false },
          { id: 'switch-focus', label: 'フォーカス', checked: true, disabled: false, focus: true },
          { id: 'switch-disabled-off', label: '無効・オフ', checked: false, disabled: true },
          { id: 'switch-disabled-on', label: '無効・オン', checked: true, disabled: true },
        ].map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-3">
            <Switch
              id={item.id}
              defaultChecked={item.checked}
              disabled={item.disabled}
              data-preview={item.focus === true ? 'focus' : undefined}
            />
            <Label htmlFor={item.id} className={cn(item.disabled && 'text-muted-foreground')}>
              {item.label}
            </Label>
          </div>
        ))}
      </Specimen>
      <Specimen
        title="フォームフィールド"
        codes={['.form-field', '.form-description', '.form-message']}
        note="handleの仕様：半角英数・ハイフン・アンダースコア、3〜32文字。"
        className="grid grid-cols-2 gap-6"
      >
        <div className="grid gap-4">
          <FormField>
            <Label htmlFor="profile-name">
              <span>
                表示名 <span className="text-muted-foreground">（必須）</span>
              </span>
            </Label>
            <Input
              id="profile-name"
              defaultValue="田中 美咲"
              required
              aria-describedby="name-help"
            />
            <Hint id="name-help">プロジェクトやメンバー一覧に表示されます。</Hint>
          </FormField>
          <FormField>
            <Label htmlFor="profile-handle">ハンドル</Label>
            <Input
              id="profile-handle"
              className="font-mono"
              defaultValue="misaki_t"
              aria-describedby="handle-help"
            />
            <Hint id="handle-help">プロフィールURL：/users/misaki_t</Hint>
          </FormField>
          <div className="flex flex-wrap items-center gap-3">
            <Button>変更を保存</Button>
            <Button variant="ghost">キャンセル</Button>
          </div>
        </div>
        <div className="grid content-start gap-4">
          <FormField>
            <Label htmlFor="invalid-handle" className="text-destructive">
              形式エラー
            </Label>
            <Input
              id="invalid-handle"
              data-preview="focus"
              defaultValue="みさき"
              aria-invalid="true"
              aria-describedby="invalid-help invalid-message"
            />
            <Hint id="invalid-help">半角英数・ハイフン・アンダースコア、3〜32文字。</Hint>
            <ErrorText id="invalid-message">使用できない文字が含まれています。</ErrorText>
          </FormField>
          <FormField>
            <Label htmlFor="duplicate-handle" className="text-destructive">
              重複エラー
            </Label>
            <Input
              id="duplicate-handle"
              defaultValue="yuto"
              aria-invalid="true"
              aria-describedby="duplicate-message"
            />
            <ErrorText id="duplicate-message">このハンドルは既に使われています。</ErrorText>
          </FormField>
          <p className="text-xs text-muted-foreground">
            エラーは色だけでなく、理由をテキストで伝えます。
          </p>
        </div>
      </Specimen>
    </CatalogPage>
  )
}
