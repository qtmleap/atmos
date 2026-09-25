import { useEffect, useRef } from 'react'
import type { MediaAsset } from '@/shared/types'
import { Button } from '../ui/button'
import { formatUtcDateTime } from './format-utc'

/** Full-size view in a native <dialog> (focus trap and Escape come for free). */
export function ImageViewer({ asset, onClose }: { asset: MediaAsset | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (element === null) {
      return
    }
    if (asset !== null && !element.open) {
      element.showModal()
    } else if (asset === null && element.open) {
      element.close()
    }
  }, [asset])
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-label={asset === null ? '画像' : `${asset.label} step ${asset.step}`}
      className="m-auto max-h-[92dvh] max-w-[92vw] bg-background p-0 text-foreground backdrop:bg-black/70"
    >
      {asset === null ? null : (
        <div className="flex flex-col">
          <div className="flex items-center gap-4 border-b px-4 py-2">
            <span className="font-mono text-sm">
              {asset.label} ・ step {asset.step}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {formatUtcDateTime(asset.logged_at)}
            </span>
            <Button variant="ghost" className="ml-auto" onClick={onClose}>
              閉じる
            </Button>
          </div>
          <img
            src={asset.url}
            alt={`${asset.label} step ${asset.step}`}
            className="max-h-[80dvh] max-w-[90vw] object-contain"
          />
        </div>
      )}
    </dialog>
  )
}
