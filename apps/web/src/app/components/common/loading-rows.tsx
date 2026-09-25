import { Skeleton } from '../ui/skeleton'

/** Placeholder rows while the first page of a list loads. */
export function LoadingRows() {
  return (
    <div role="status" className="space-y-3 px-4 py-4 sm:px-6">
      <span className="sr-only">読み込み中</span>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-5 w-3/5" />
    </div>
  )
}
