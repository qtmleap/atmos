// Frame shared by the component catalog pages (/catalog/*, dev only). Each
// page mirrors one mock in docs/mock-diff/designs/components/ so mock-diff
// can compare them: same headings, same order, same vertical positions.

import { Link } from '@tanstack/react-router'
import type * as React from 'react'
import { cn } from '../../lib/utils'

export const catalogSections = [
  { slug: 'foundations', label: '基礎' },
  { slug: 'controls', label: 'コントロール' },
  { slug: 'data-display', label: 'データ表示' },
  { slug: 'navigation', label: 'ナビゲーション' },
  { slug: 'overlays', label: 'オーバーレイ' },
  { slug: 'run-widgets', label: 'ジョブ部品' },
  { slug: 'feedback', label: 'フィードバック' },
] as const

export type CatalogSlug = (typeof catalogSections)[number]['slug']

export interface CatalogPageProps {
  slug: CatalogSlug
  eyebrow: string
  title: string
  description: string
  footer: [string, string]
  children: React.ReactNode
}

export function CatalogPage({
  slug,
  eyebrow,
  title,
  description,
  footer,
  children,
}: CatalogPageProps) {
  return (
    <main className="mx-auto max-w-[1312px] px-8 pt-8 pb-16">
      <header className="flex items-center justify-between border-b pb-5">
        <span className="text-xl leading-7 font-[650] tracking-[-0.04em]">atmos</span>
        <nav aria-label="コンポーネントカタログ" className="flex flex-wrap gap-5 text-xs">
          {catalogSections.map((section) => (
            <Link
              key={section.slug}
              to="/catalog/$section"
              params={{ section: section.slug }}
              aria-current={section.slug === slug ? 'page' : undefined}
              className="text-muted-foreground hover:underline hover:underline-offset-4 aria-[current=page]:text-foreground"
            >
              {section.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="grid gap-3 py-8">
        <p className="font-mono text-[11px] leading-4 tracking-[0.08em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1>{title}</h1>
        <p className="leading-[22px] text-muted-foreground">{description}</p>
      </div>
      {children}
      <footer className="mt-6 flex justify-between border-t pt-5 text-xs text-muted-foreground">
        <span>{footer[0]}</span>
        <span>{footer[1]}</span>
      </footer>
    </main>
  )
}

export interface SpecimenProps {
  title: string
  /** Class names the mock lists under the title, one line each. */
  codes: string[]
  note?: string
  className?: string
  children: React.ReactNode
}

/** One ruled row: a 184px label column, 40px gap, then the specimen body. */
export function Specimen({ title, codes, note, className, children }: SpecimenProps) {
  return (
    <section className="grid grid-cols-[184px_minmax(0,1fr)] gap-10 border-t py-7">
      <div className="grid content-start gap-2">
        <h2>{title}</h2>
        {codes.map((code) => (
          <code
            key={code}
            className="font-mono text-[11px] [overflow-wrap:anywhere] text-muted-foreground"
          >
            {code}
          </code>
        ))}
        {note === undefined ? null : (
          <p className="text-xs leading-5 text-muted-foreground">{note}</p>
        )}
      </div>
      <div className={cn('min-w-0', className)}>{children}</div>
    </section>
  )
}

/** Small muted caption above a sample. */
export function SampleCaption({ children }: { children: React.ReactNode }) {
  return <span className="mb-3 block text-xs text-muted-foreground">{children}</span>
}

/** Label, control, then helper or error text, 8px apart. */
export function FormField({ children }: { children: React.ReactNode }) {
  return <div className="grid content-start gap-2">{children}</div>
}
