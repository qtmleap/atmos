import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { formatListCount } from '../../lib/format'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'

export interface ListFooterProps {
  /** Items shown so far. */
  count: number
  hasMore: boolean
  loading: boolean
  error: string | null
  onLoadMore: () => void
  /** Called by the button after an error (the first page may need a full reload). */
  onRetry: () => void
  /** Noun for the pager's label, e.g. "プロジェクト" → "プロジェクトのページ送り". */
  noun: string
  /** Spacing above the footer; the mocks use pt-3 under tables and pt-4 under row lists. */
  className?: string
}

/**
 * Bottom of a paged list (the mock's `.pagination.list-footer`): the count
 * line on the left, "前へ" / "次へ" on the right. Pages are appended, so the
 * list always starts at the head and "前へ" stays disabled; "次へ" fetches the
 * next page, or retries after an error.
 */
export function ListFooter({
  count,
  hasMore,
  loading,
  error,
  onLoadMore,
  onRetry,
  noun,
  className,
}: ListFooterProps) {
  const failed = error !== null
  const pageable = hasMore || failed
  return (
    <nav
      aria-label={`${noun}のページ送り`}
      className={cn(
        'flex items-center justify-between gap-4 pt-3 text-xs text-muted-foreground',
        className,
      )}
    >
      <span aria-live="polite">{formatListCount(count, hasMore)}</span>
      {failed ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
      <ul className="flex items-center gap-1 text-foreground">
        <li>
          <Button variant="ghost" type="button" disabled>
            {pageable ? <ChevronLeftIcon aria-hidden="true" /> : null}
            前へ
          </Button>
        </li>
        <li>
          <Button
            variant="outline"
            type="button"
            disabled={!pageable || loading}
            onClick={failed ? onRetry : onLoadMore}
          >
            {failed ? 'もう一度試す' : '次へ'}
            {pageable ? <ChevronRightIcon aria-hidden="true" /> : null}
          </Button>
        </li>
      </ul>
    </nav>
  )
}
