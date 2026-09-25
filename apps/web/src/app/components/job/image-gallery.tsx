import { useState } from 'react'
import type { MediaAsset } from '@/shared/types'
import { formatStep } from '../../lib/metrics'
import { Skeleton } from '../ui/skeleton'
import { ImageViewer } from './image-viewer'
import { WidgetHeader } from './widget-header'

/** Three-up grid of thumbnails; each child is a `<figure>`. */
export function Gallery({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-4 py-4">{children}</div>
}

/** Caption under a thumbnail: mono label, then muted step and type. */
export function GalleryCaption({ label, note }: { label: string; note: string }) {
  return (
    <figcaption className="grid gap-0.5 pt-2 text-xs">
      <span className="font-mono">{label}</span>
      <span className="text-muted-foreground">{note}</span>
    </figcaption>
  )
}

/** A thumbnail that has not arrived (loading) or failed. */
export function GalleryPlaceholder({
  children,
  busy = false,
}: {
  children: React.ReactNode
  busy?: boolean
}) {
  return (
    <div
      aria-busy={busy ? 'true' : undefined}
      className="grid h-[120px] place-content-center gap-2 bg-muted text-center text-xs text-muted-foreground"
    >
      {busy ? <Skeleton className="w-[180px]" /> : null}
      {children}
    </div>
  )
}

export function GalleryThumb({ asset, onOpen }: { asset: MediaAsset; onOpen: () => void }) {
  return (
    <figure>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${asset.label} step ${formatStep(asset.step)} を拡大`}
        className="block w-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <img
          src={asset.url}
          alt={`${asset.label} step ${formatStep(asset.step)}`}
          loading="lazy"
          className="block h-[120px] w-full bg-muted object-contain"
        />
      </button>
      <GalleryCaption
        label={asset.label}
        note={`step ${formatStep(asset.step)} · ${asset.content_type}`}
      />
    </figure>
  )
}

export interface ImageGalleryProps {
  /** The images at `step`, in logging order. */
  images: MediaAsset[]
  step: number | undefined
}

/** The images of the step chosen on the media tab, three abreast. */
export function ImageGallery({ images, step }: ImageGalleryProps) {
  const [open, setOpen] = useState<MediaAsset | null>(null)
  return (
    <div>
      <WidgetHeader
        level={2}
        title="画像ギャラリー"
        aside={
          <span className="text-xs text-muted-foreground">
            {step === undefined ? '未受信' : `ステップ ${formatStep(step)}`}
          </span>
        }
      />
      {images.length === 0 ? (
        <p className="py-8 text-xs text-muted-foreground">このステップの画像はありません。</p>
      ) : (
        <Gallery>
          {images.map((asset) => (
            <GalleryThumb key={asset.id} asset={asset} onOpen={() => setOpen(asset)} />
          ))}
        </Gallery>
      )}
      <ImageViewer asset={open} onClose={() => setOpen(null)} />
    </div>
  )
}
