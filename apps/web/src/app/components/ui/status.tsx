import { CheckIcon, CircleCheckIcon, CircleXIcon, GlobeIcon, LockIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/app/lib/utils'

/** A 6px dot in the current colour; pulses unless reduced motion is set. */
function StatusDot({
  className,
  pulse = false,
  ...props
}: React.ComponentProps<'span'> & { pulse?: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-slot="status-dot"
      className={cn(
        'size-1.5 shrink-0 rounded-full bg-current',
        pulse && 'motion-safe:animate-[status-pulse_1.8s_ease-in-out_infinite]',
        className,
      )}
      {...props}
    />
  )
}

type StatusKind = 'running' | 'finished' | 'failed'

/**
 * Job state as a mark plus text (12px): a pulsing dot while running, a check
 * (circled, or bare with `plainCheck`) when finished, a circled cross in
 * --destructive when failed. The label is the children, so callers keep the
 * wording.
 */
function Status({
  status,
  plainCheck = false,
  className,
  children,
  ...props
}: React.ComponentProps<'span'> & { status: StatusKind; plainCheck?: boolean }) {
  return (
    <span
      data-slot="status"
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs whitespace-nowrap data-[status=failed]:text-destructive data-[status=finished]:text-muted-foreground [&>svg]:size-4 [&>svg]:shrink-0',
        className,
      )}
      {...props}
    >
      {status === 'running' ? <StatusDot pulse /> : null}
      {status === 'finished' ? (
        plainCheck ? (
          <CheckIcon aria-hidden="true" />
        ) : (
          <CircleCheckIcon aria-hidden="true" />
        )
      ) : null}
      {status === 'failed' ? <CircleXIcon aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

/** Public or private, as a muted globe or lock plus text (12px). */
function Visibility({
  isPublic,
  className,
  children,
  ...props
}: React.ComponentProps<'span'> & { isPublic: boolean }) {
  return (
    <span
      data-slot="visibility"
      className={cn(
        'inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground [&>svg]:size-4 [&>svg]:shrink-0',
        className,
      )}
      {...props}
    >
      {isPublic ? <GlobeIcon aria-hidden="true" /> : <LockIcon aria-hidden="true" />}
      {children}
    </span>
  )
}

export { Status, StatusDot, Visibility }
