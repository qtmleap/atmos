// "前へ" / "次へ" under the user list (designs/pages/admin.html,
// `.pagination.admin-pagination`). The API returns no total, so there is no
// count or page number; a failed page shows its error beside the buttons.
import { Button } from '../ui/button'

export interface UserPagerProps {
  canGoPrevious: boolean
  canGoNext: boolean
  loading: boolean
  error: string | null
  onPrevious: () => void
  onNext: () => void
}

export function UserPager({
  canGoPrevious,
  canGoNext,
  loading,
  error,
  onPrevious,
  onNext,
}: UserPagerProps) {
  return (
    <nav
      aria-label="ユーザー一覧のページ送り"
      className="mt-5 flex items-center justify-end gap-4 text-xs"
    >
      {error !== null ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
      <ul className="flex items-center gap-1">
        <li>
          <Button variant="ghost" type="button" disabled={!canGoPrevious} onClick={onPrevious}>
            前へ
          </Button>
        </li>
        <li>
          <Button variant="outline" type="button" disabled={!canGoNext || loading} onClick={onNext}>
            {error !== null ? '再試行' : '次へ'}
          </Button>
        </li>
      </ul>
    </nav>
  )
}
