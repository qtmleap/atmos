import type * as React from 'react'
import { cn } from '@/app/lib/utils'

/**
 * Centered empty or error notice, set apart by space rather than a box. The
 * first child is usually a muted 16px icon or an ErrorCode, then an h3, a
 * description and an optional action, 12px apart.
 */
function EmptyState({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'grid justify-items-center gap-3 px-6 py-9 text-center [&>svg]:size-4 [&>svg]:text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

function EmptyStateDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="empty-state-description"
      className={cn('max-w-[400px] leading-[22px] text-muted-foreground', className)}
      {...props}
    />
  )
}

/** Large muted HTTP status, e.g. 404. */
function ErrorCode({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="error-code"
      className={cn(
        'font-mono text-4xl leading-10 tracking-[-0.04em] text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { EmptyState, EmptyStateDescription, ErrorCode }
