import { FolderIcon, UserIcon } from 'lucide-react'
import { Avatar, AvatarFallback } from '../../components/ui/avatar'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { EmptyState, EmptyStateDescription } from '../../components/ui/empty-state'
import { Separator } from '../../components/ui/separator'
import { Skeleton } from '../../components/ui/skeleton'
import { Status, Visibility } from '../../components/ui/status'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import { CatalogPage, Specimen } from './catalog-section'
import { JobRows, MemberRows, ProjectRows } from './data-rows'

const metricRows = [
  { key: 'train/loss', value: '0.1824', state: '通常', preview: undefined, selected: false },
  { key: 'val/loss', value: '0.2108', state: 'ホバー', preview: 'hover', selected: false },
  { key: 'lr', value: '0.00012', state: '選択中', preview: undefined, selected: true },
  { key: 'grad_norm', value: '1.842', state: '通常', preview: undefined, selected: false },
] as const

const pages = [
  { label: '先頭の一覧', text: '20件表示 · 先頭', prev: false, next: true, focus: false },
  { label: '途中の一覧', text: '20件表示 · 続きあり', prev: true, next: true, focus: true },
  { label: '最後の一覧', text: '8件表示 · 最後', prev: true, next: false, focus: false },
]

function LoadingMember() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Skeleton className="size-8 rounded-full" />
      <div className="grid min-w-0 flex-1 gap-2">
        <Skeleton className="h-4 w-[180px]" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  )
}

export default function DataDisplayCatalog() {
  return (
    <CatalogPage
      slug="data-display"
      eyebrow="COMPONENTS / 03"
      title="データ表示"
      description="プロジェクト・ジョブ・メンバーを罫線区切りの行で表示。装飾より情報の読みやすさを優先します。"
      footer={['atmos · コンポーネント層 / 日時はUTC', '03 / 04 · データ表示']}
    >
      <Specimen
        title="バッジ・アバター"
        codes={['.badge / .avatar']}
        note="ロールと補足情報。画像未設定時は表示名の文字を使用。"
        className="grid gap-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge>管理者</Badge>
          <Badge variant="secondary">一般ユーザー</Badge>
          <Badge variant="outline">読み取り専用</Badge>
          <Badge variant="destructive">失効済み</Badge>
          <span className="text-xs text-muted-foreground">
            default / secondary / outline / destructive
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Avatar size="sm" role="img" aria-label="田中 美咲">
            <AvatarFallback>田</AvatarFallback>
          </Avatar>
          <Avatar role="img" aria-label="田中 美咲">
            <AvatarFallback>田</AvatarFallback>
          </Avatar>
          <Avatar size="lg" role="img" aria-label="佐藤 悠斗">
            <AvatarFallback>佐</AvatarFallback>
          </Avatar>
          <Avatar role="img" aria-label="表示名未設定">
            <AvatarFallback>
              <UserIcon aria-hidden="true" />
            </AvatarFallback>
          </Avatar>
          <Skeleton
            className="size-8 rounded-full"
            role="status"
            aria-label="アバターを読み込み中"
          />
          <span className="text-xs text-muted-foreground">
            24 / 32 / 40px · フォールバック · 読み込み中
          </span>
        </div>
      </Specimen>
      <Specimen
        title="状態・公開範囲"
        codes={['.status / .visibility']}
        note="running / finished / failed。実行中のみ点が脈打ちます。"
        className="grid gap-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Status status="running">実行中</Status>
          <Status status="finished">完了</Status>
          <Status status="failed">失敗</Status>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Visibility visibility="public">公開</Visibility>
          <Visibility visibility="internal">メンバー限定</Visibility>
          <Visibility visibility="private">非公開</Visibility>
          <span className="text-xs text-muted-foreground">
            公開：誰でも閲覧可能 / メンバー限定：ログインが必要 / 非公開：所有者と管理者のみ
          </span>
        </div>
      </Specimen>
      <Specimen
        title="テーブル"
        codes={['.table / .table-wrap']}
        note="通常・ホバー・選択状態。数値は右揃え、キーは等幅。"
      >
        <Table>
          <TableCaption>
            ジョブ「vits-baseline-042」の最新値。日時はUTC。背景色はホバー・選択状態の見本です。
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">メトリクス</TableHead>
              <TableHead scope="col" data-numeric="true">
                値
              </TableHead>
              <TableHead scope="col" data-numeric="true">
                step
              </TableHead>
              <TableHead scope="col">受信日時</TableHead>
              <TableHead scope="col">表示状態</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metricRows.map((row) => (
              <TableRow
                key={row.key}
                data-preview={row.preview}
                data-state={row.selected ? 'selected' : undefined}
              >
                <TableHead scope="row" className="font-mono">
                  {row.key}
                </TableHead>
                <TableCell data-numeric="true" className="font-mono">
                  {row.value}
                </TableCell>
                <TableCell data-numeric="true" className="font-mono">
                  48,000
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">2026-09-24 09:42:18</TableCell>
                <TableCell className={row.selected ? undefined : 'text-xs text-muted-foreground'}>
                  {row.selected ? <Badge variant="outline">{row.state}</Badge> : row.state}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Specimen>
      <Specimen
        title="プロジェクト行"
        codes={['.data-list / .data-row']}
        note="名前・公開範囲・所有者・作成日。2行目はホバー。"
      >
        <ProjectRows />
      </Specimen>
      <Specimen
        title="ジョブ行"
        codes={['.data-row / .status-*']}
        note="開始日時と所要時間。名前がnullの場合はIDを表示。"
      >
        <JobRows />
      </Specimen>
      <Specimen
        title="メンバー行"
        codes={['.data-row.member-row']}
        note="公開プロフィールにメールアドレスは表示しません。"
      >
        <MemberRows />
      </Specimen>
      <Specimen
        title="ページ送り"
        codes={['.pagination']}
        note="APIのカーソル方式に合わせ、総件数・総ページ数は表示しません。"
        className="grid gap-4"
      >
        {pages.map((page) => (
          <nav
            key={page.label}
            aria-label={page.label}
            className="flex items-center justify-between gap-4 text-xs text-muted-foreground"
          >
            <span>{page.text}</span>
            <ul className="flex items-center gap-1 text-foreground">
              <li>
                <Button variant="ghost" disabled={!page.prev}>
                  前へ
                </Button>
              </li>
              <li>
                <Button
                  variant="outline"
                  disabled={!page.next}
                  data-preview={page.focus ? 'focus' : undefined}
                >
                  次へ
                </Button>
              </li>
            </ul>
          </nav>
        ))}
      </Specimen>
      <Specimen
        title="空・読み込み中"
        codes={['.empty-state / .skeleton']}
        note="未取得をゼロ件と混同しません。動きを減らす設定に対応。"
        className="grid grid-cols-2 gap-6"
      >
        <div>
          <h3>空の一覧</h3>
          <EmptyState>
            <FolderIcon aria-hidden="true" />
            <h3>ジョブはまだありません</h3>
            <EmptyStateDescription>
              SDKからジョブを開始すると、ここに表示されます。
            </EmptyStateDescription>
          </EmptyState>
        </div>
        <div className="grid gap-4" role="status" aria-label="メンバー一覧を読み込み中">
          <h3>読み込み中</h3>
          <LoadingMember />
          <Separator />
          <LoadingMember />
          <Separator />
          <p className="text-xs text-muted-foreground">メンバーを読み込んでいます…</p>
        </div>
      </Specimen>
    </CatalogPage>
  )
}
