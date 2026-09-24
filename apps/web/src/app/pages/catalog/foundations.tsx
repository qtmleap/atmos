import type * as React from 'react'
import { Separator } from '../../components/ui/separator'
import { CatalogPage, Specimen } from './catalog-section'

const colorTokens = [
  ['--background', 'ページ背景'],
  ['--foreground', '本文'],
  ['--primary', '主要アクション'],
  ['--primary-foreground', '主要アクション上の文字'],
  ['--secondary', '補助アクション'],
  ['--secondary-foreground', '補助アクション上の文字'],
  ['--muted', '控えめな背景'],
  ['--muted-foreground', '補足・時刻'],
  ['--accent', 'ホバー背景'],
  ['--accent-foreground', 'ホバー時の文字'],
  ['--border', '区切り線'],
  ['--input', '入力欄の枠'],
  ['--ring', 'フォーカス'],
  ['--destructive', '失敗・破壊的操作'],
  ['--destructive-foreground', '破壊的操作上の文字'],
  ['--popover', 'メニュー背景'],
  ['--popover-foreground', 'メニュー内の文字'],
  ['--card', '互換用・通常は使用しない'],
  ['--card-foreground', '互換用'],
] as const

const chartTokens = [
  ['--chart-1', 'train/loss'],
  ['--chart-2', 'val/loss'],
  ['--chart-3', 'lr'],
  ['--chart-4', 'grad_norm'],
  ['--chart-5', 'val/accuracy'],
] as const

const spaces = [
  [
    ['4px', 4, '小さな要素間'],
    ['8px', 8, 'ラベルと入力'],
    ['12px', 12, '行内の間隔'],
    ['16px', 16, '部品間'],
  ],
  [
    ['24px', 24, 'グループ間'],
    ['32px', 32, 'ページ余白'],
    ['40px', 40, '説明列との間隔'],
    ['64px', 64, 'ヘッダー高さ'],
  ],
] as const

const radii = [
  ['sm · 6px', 'rounded-sm'],
  ['md · 8px', 'rounded-md'],
  ['lg · 10px', 'rounded-lg'],
  ['xl · 14px', 'rounded-xl'],
  ['full', 'rounded-full'],
] as const

function Swatch({ token, children }: { token: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 text-xs">
      <div className="h-8 border-b" style={{ background: `var(${token})` }} />
      <code className="font-mono text-[11px]">{token}</code>
      {children}
    </div>
  )
}

function TypeRow({ sample, spec }: { sample: React.ReactNode; spec: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      {sample}
      <code className="font-mono text-xs text-muted-foreground">{spec}</code>
    </div>
  )
}

export default function FoundationsCatalog() {
  return (
    <CatalogPage
      slug="foundations"
      eyebrow="COMPONENTS / 01"
      title="基礎トークン"
      description="new-york / neutral。色・文字・余白の共通ルール。ライト表示、ダーク用トークンも共通CSSに定義。"
      footer={['atmos · コンポーネント層', '01 / 04 · 基礎']}
    >
      <Specimen
        title="色"
        codes={[':root / .dark']}
        note="意味に基づくCSS変数。面を増やさず、文字と罫線で情報の階層をつくります。"
        className="grid grid-cols-4 gap-5"
      >
        {colorTokens.map(([token, use]) => (
          <Swatch key={token} token={token}>
            <span className="text-muted-foreground">{use}</span>
          </Swatch>
        ))}
      </Specimen>
      <Specimen
        title="チャート色"
        codes={['--chart-1 … --chart-5']}
        note="系列名も併記し、色だけに意味を持たせません。"
        className="grid grid-cols-4 gap-5"
      >
        {chartTokens.map(([token, series]) => (
          <Swatch key={token} token={token}>
            <span>{series}</span>
          </Swatch>
        ))}
      </Specimen>
      <Specimen
        title="タイポグラフィ"
        codes={['--font-sans / --font-mono']}
        note="system-ui / ui-monospace。外部フォントなし。"
        className="grid gap-4"
      >
        <TypeRow
          sample={
            <span className="text-[30px] leading-9 font-semibold tracking-tight">音声合成 v4</span>
          }
          spec="30 / 36 · 600"
        />
        <TypeRow
          sample={<span className="text-2xl leading-8 font-semibold">ジョブの詳細</span>}
          spec="24 / 32 · 600"
        />
        <TypeRow sample={<h2>メトリクス</h2>} spec="20 / 28 · 600" />
        <TypeRow sample={<h3>学習の進捗</h3>} spec="14 / 20 · 600" />
        <TypeRow sample={<p>田中 美咲が開始したジョブを表示しています。</p>} spec="14 / 21 · 400" />
        <TypeRow
          sample={
            <p className="leading-[22px] text-muted-foreground">
              メトリクスは受信後に自動更新されます。
            </p>
          }
          spec="14 / 22 · muted"
        />
        <TypeRow
          sample={<p className="text-xs text-muted-foreground">2026年9月24日 09:42 UTC</p>}
          spec="12 / 18 · muted"
        />
        <TypeRow
          sample={<code className="font-mono">train/loss　0.1824　step 48,000</code>}
          spec="14 / 21 · mono"
        />
      </Specimen>
      <Specimen
        title="余白"
        codes={['4px 基準']}
        note="コントロールは32px。セクション間は罫線と余白で区切ります。"
        className="grid grid-cols-2 gap-6"
      >
        {spaces.map((column) => (
          <div key={column[0][0]} className="grid gap-4">
            {column.map(([label, width, use]) => (
              <div key={label} className="flex items-center gap-4 text-xs">
                <code className="font-mono">{label}</code>
                <span className="h-2 bg-foreground" style={{ width }} />
                <span className="text-muted-foreground">{use}</span>
              </div>
            ))}
          </div>
        ))}
      </Specimen>
      <Specimen
        title="角丸・罫線"
        codes={['--radius: 0.625rem']}
        note="装飾用の見本。影・グラデーションは使用しません。"
        className="grid gap-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          {radii.map(([label, radius]) => (
            <div
              key={label}
              className={`grid h-10 min-w-24 place-items-center border px-4 py-2 text-xs ${radius}`}
            >
              {label}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Button / Input: md　Dialog: lg　Avatar / Switch: full
        </p>
        <Separator />
        <p className="text-xs text-muted-foreground">区切り線 · 1px solid var(--border)</p>
      </Specimen>
    </CatalogPage>
  )
}
