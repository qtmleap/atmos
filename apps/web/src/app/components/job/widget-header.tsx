import type * as React from 'react'

export interface WidgetHeaderProps {
  /** `figcaption` inside a figure, `div` elsewhere. */
  as?: 'div' | 'figcaption'
  /** h2 (20px) for a panel, h3 (14px) for a chart or a sidebar block. */
  level?: 2 | 3
  title: string
  /** Set the title in mono (it is a metric key). */
  mono?: boolean
  subtitle?: string
  /** Right-hand side: a value, a note or an indicator. */
  aside?: React.ReactNode
}

/**
 * `.widget-header` of the mocks: title (and subtitle) on the left, `aside`
 * on the right, 12px of padding and a rule below.
 */
export function WidgetHeader({
  as: Tag = 'div',
  level = 3,
  title,
  mono = false,
  subtitle,
  aside,
}: WidgetHeaderProps) {
  const Heading = level === 2 ? 'h2' : 'h3'
  return (
    <Tag className="flex items-center justify-between gap-4 border-b py-3">
      <div className="min-w-0">
        <Heading className={mono ? 'truncate font-mono' : 'truncate'} title={title}>
          {title}
        </Heading>
        {subtitle === undefined ? null : (
          <span className="block text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>
      {aside}
    </Tag>
  )
}
