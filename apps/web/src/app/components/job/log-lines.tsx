import type * as React from 'react'
import type { LogLine } from '@/shared/types'
import { cn } from '../../lib/utils'
import { formatUtcClockMs } from './format-utc'

export type LogDensity = 'default' | 'compact'

/** `.log-line` of the mocks: the run page uses the compact 11px rows. */
const ROW_CLASSES: Record<LogDensity, string> = {
  default: 'grid-cols-[95px_65px_minmax(460px,1fr)] gap-3 py-[5px] text-xs leading-5',
  compact: 'grid-cols-[88px_48px_minmax(0,1fr)] gap-2.5 py-[3px] text-[11px] leading-[17px]',
}

export interface LogLinesProps extends React.ComponentProps<'div'> {
  lines: LogLine[]
  density?: LogDensity
  /** Shown instead of the lines when there are none. */
  empty?: React.ReactNode
}

/**
 * Ruled, horizontally scrollable list of log lines: UTC time, stream and
 * message in mono; stderr in the destructive colour as well as by label.
 */
export function LogLines({
  lines,
  density = 'default',
  empty,
  className,
  children,
  ...props
}: LogLinesProps) {
  return (
    <div
      role="log"
      aria-label="実行ログ・時刻はUTC"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the scroll box must be keyboard scrollable
      tabIndex={0}
      className={cn('overflow-x-auto border-b py-2 font-mono', className)}
      {...props}
    >
      {children}
      {lines.length === 0 ? (
        empty
      ) : (
        <ol>
          {lines.map((line) => (
            <li
              key={line.id}
              data-stream={line.stream}
              className={cn(
                'grid',
                ROW_CLASSES[density],
                line.stream === 'stderr' && 'text-destructive',
              )}
            >
              <time
                dateTime={line.logged_at}
                className="text-muted-foreground tabular-nums select-none"
              >
                {formatUtcClockMs(line.logged_at)}
              </time>
              <span
                className={
                  line.stream === 'stderr' ? 'select-none' : 'text-muted-foreground select-none'
                }
              >
                {line.stream}
              </span>
              <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{line.message}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
