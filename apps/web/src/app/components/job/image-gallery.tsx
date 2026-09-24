import { useId, useMemo, useState } from 'react'
import type { MediaAsset } from '@/shared/types'
import { assetsAtStep, mediaSteps, nearestStep } from '../../lib/media'
import { formatStep } from '../../lib/metrics'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'
import { ImageViewer } from './image-viewer'
import { StepSlider } from './step-slider'
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
  images: MediaAsset[]
}

/**
 * The images of one step, three abreast, with a slider over the steps that
 * have images. Opens the latest step and stays there while new steps arrive.
 */
export function ImageGallery({ images }: ImageGalleryProps) {
  const steps = useMemo(() => mediaSteps(images), [images])
  const [chosen, setChosen] = useState<number | null>(null)
  const [open, setOpen] = useState<MediaAsset | null>(null)
  const sliderId = useId()
  const latest = steps.at(-1)
  const step = chosen !== null && steps.includes(chosen) ? chosen : latest
  const shown = useMemo(
    () => (step === undefined ? [] : assetsAtStep(images, step)),
    [images, step],
  )
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
      <StepSlider
        id={sliderId}
        label="ステップ"
        steps={steps}
        value={step === undefined ? null : step}
        onChange={(value) => {
          const snapped = nearestStep(steps, value)
          if (snapped !== null) {
            setChosen(snapped)
          }
        }}
        readout={step === undefined ? '—' : formatStep(step)}
      />
      <Gallery>
        {shown.map((asset) => (
          <GalleryThumb key={asset.id} asset={asset} onOpen={() => setOpen(asset)} />
        ))}
      </Gallery>
      {step !== undefined && step !== latest && latest !== undefined ? (
        <div className="flex justify-end pb-4">
          <Button variant="secondary" onClick={() => setChosen(null)}>
            最新のステップへ
          </Button>
        </div>
      ) : null}
      <ImageViewer asset={open} onClose={() => setOpen(null)} />
    </div>
  )
}
