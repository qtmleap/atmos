import { useCallback, useMemo, useState } from 'react'
import type { MediaAsset, MediaKind, Page } from '@/shared/types'
import { apiFetch, withQuery } from '../lib/api-client'
import { jobApiPath } from '../lib/job-paths'
import { mergeMedia } from '../lib/media'
import { type PagedList, usePagedList } from './use-paged-list'

export const MEDIA_PAGE_SIZE = 50

export interface JobMedia extends Omit<PagedList<MediaAsset>, 'items'> {
  /** Paged items plus live ones, without duplicates. */
  items: MediaAsset[]
  pushLive: (asset: MediaAsset) => void
  /** Re-reads the first page, to pick up anything logged while disconnected. */
  refreshHead: () => void
}

/** `GET .../media?kind=...`, page by page, plus live assets of that kind. */
export function useJobMedia(projectId: string, jobId: string, kind: MediaKind): JobMedia {
  const listPath = withQuery(jobApiPath(projectId, jobId, '/media'), { kind })
  const list = usePagedList<MediaAsset>(listPath, MEDIA_PAGE_SIZE)
  const [extra, setExtra] = useState<{ path: string; assets: MediaAsset[] }>({
    path: listPath,
    assets: [],
  })
  // Live assets belong to the list they arrived for; a new job starts clean.
  const extraAssets = extra.path === listPath ? extra.assets : []

  const add = useCallback(
    (assets: MediaAsset[]) =>
      setExtra((current) => ({
        path: listPath,
        assets: mergeMedia(current.path === listPath ? current.assets : [], assets),
      })),
    [listPath],
  )

  const pushLive = useCallback((asset: MediaAsset) => add([asset]), [add])

  const refreshHead = useCallback(() => {
    apiFetch<Page<MediaAsset>>(withQuery(listPath, { limit: MEDIA_PAGE_SIZE }))
      .then((page) => add(page.items))
      .catch((error: unknown) => console.warn('media refresh failed', error))
  }, [listPath, add])

  const items = useMemo(() => mergeMedia(list.items, extraAssets), [list.items, extraAssets])
  return { ...list, items, pushLive, refreshHead }
}
