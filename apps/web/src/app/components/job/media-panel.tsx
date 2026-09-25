import { useId, useMemo } from 'react'
import type { JobMedia } from '../../hooks/use-job-media'
import { useMediaStep } from '../../hooks/use-media-step'
import { describeAudio } from '../../lib/config'
import { assetsAtStep } from '../../lib/media'
import { formatStep } from '../../lib/metrics'
import { ListFooter } from '../common/list-footer'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/empty-state'
import { AudioList } from './audio-list'
import { ImageGallery } from './image-gallery'
import { StepSlider } from './step-slider'
import { WidgetHeader } from './widget-header'

export interface MediaPanelProps {
  images: JobMedia
  audio: JobMedia
  config: Record<string, unknown>
}

/** Paging footer of one media list, only when there is something to page or an error. */
function MediaFooter({ media, noun }: { media: JobMedia; noun: string }) {
  if (!media.hasMore && media.error === null) {
    return null
  }
  return (
    <ListFooter
      noun={noun}
      count={media.items.length}
      hasMore={media.hasMore}
      loading={media.loading}
      error={media.error}
      onLoadMore={media.loadMore}
      onRetry={media.retry}
    />
  )
}

/**
 * The "画像・音声" tab: one step slider over the image gallery and the audio
 * samples, both showing what was logged at that step.
 */
export function MediaPanel({ images, audio, config }: MediaPanelProps) {
  const { steps, step, latest, choose, followLatest } = useMediaStep(images.items, audio.items)
  const sliderId = useId()
  const shownImages = useMemo(
    () => (step === undefined ? [] : assetsAtStep(images.items, step)),
    [images.items, step],
  )
  const shownAudio = useMemo(
    () => (step === undefined ? [] : assetsAtStep(audio.items, step)),
    [audio.items, step],
  )
  const audioNote = describeAudio(config)
  return (
    <div className="@container">
      <StepSlider
        id={sliderId}
        label="ステップ"
        steps={steps}
        value={step === undefined ? null : step}
        onChange={choose}
        readout={step === undefined ? '—' : formatStep(step)}
      />
      {step !== undefined && step !== latest ? (
        <div className="flex justify-end pb-3">
          <Button variant="secondary" onClick={followLatest}>
            最新のステップへ
          </Button>
        </div>
      ) : null}
      {images.initial ? (
        <p className="py-8 text-xs text-muted-foreground">画像を読み込んでいます。</p>
      ) : images.items.length === 0 && images.error === null ? (
        <>
          <WidgetHeader
            level={2}
            title="画像ギャラリー"
            aside={<span className="text-xs text-muted-foreground">未受信</span>}
          />
          <EmptyState>
            <h3>画像はまだありません</h3>
          </EmptyState>
        </>
      ) : (
        <>
          <ImageGallery images={shownImages} step={step} />
          <MediaFooter media={images} noun="画像" />
        </>
      )}
      <WidgetHeader
        level={2}
        title="音声サンプル"
        aside={
          <span className="text-xs text-muted-foreground">
            {audio.items.length === 0 || step === undefined
              ? '未受信'
              : audioNote === null
                ? `ステップ ${formatStep(step)}`
                : audioNote}
          </span>
        }
      />
      {audio.initial ? (
        <p className="py-8 text-xs text-muted-foreground">音声を読み込んでいます。</p>
      ) : audio.items.length === 0 && audio.error === null ? (
        <EmptyState>
          <h3>音声はまだありません</h3>
        </EmptyState>
      ) : (
        <>
          {shownAudio.length === 0 ? (
            <p className="py-8 text-xs text-muted-foreground">このステップの音声はありません。</p>
          ) : (
            <AudioList clips={shownAudio} />
          )}
          <MediaFooter media={audio} noun="音声" />
        </>
      )}
    </div>
  )
}
