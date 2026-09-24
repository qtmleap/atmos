import type { JobMedia } from '../../hooks/use-job-media'
import { describeAudio } from '../../lib/config'
import { formatStep } from '../../lib/metrics'
import { ListFooter } from '../common/list-footer'
import { AudioList } from './audio-list'
import { ImageGallery } from './image-gallery'
import { WidgetHeader } from './widget-header'

export interface MediaPanelProps {
  images: JobMedia
  audio: JobMedia
  config: Record<string, unknown>
}

const latestStepOf = (media: JobMedia): number | null =>
  media.items.reduce<number | null>(
    (max, asset) => (max === null || asset.step > max ? asset.step : max),
    null,
  )

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

/** The "画像・音声" tab: the image gallery, then the audio samples. */
export function MediaPanel({ images, audio, config }: MediaPanelProps) {
  const audioStep = latestStepOf(audio)
  const audioNote = describeAudio(config)
  return (
    <div>
      {images.initial ? (
        <p className="py-8 text-xs text-muted-foreground">画像を読み込んでいます。</p>
      ) : images.items.length === 0 && images.error === null ? (
        <>
          <WidgetHeader
            level={2}
            title="画像ギャラリー"
            aside={<span className="text-xs text-muted-foreground">未受信</span>}
          />
          <p className="py-8 text-xs text-muted-foreground">画像はまだ記録されていません。</p>
        </>
      ) : (
        <>
          <ImageGallery images={images.items} />
          <MediaFooter media={images} noun="画像" />
        </>
      )}
      <WidgetHeader
        level={2}
        title="音声サンプル"
        aside={
          <span className="text-xs text-muted-foreground">
            {audioNote === null
              ? audioStep === null
                ? '未受信'
                : `ステップ ${formatStep(audioStep)}`
              : audioNote}
          </span>
        }
      />
      {audio.initial ? (
        <p className="py-8 text-xs text-muted-foreground">音声を読み込んでいます。</p>
      ) : audio.items.length === 0 && audio.error === null ? (
        <p className="py-8 text-xs text-muted-foreground">音声はまだ記録されていません。</p>
      ) : (
        <>
          <AudioList clips={audio.items} />
          <MediaFooter media={audio} noun="音声" />
        </>
      )}
    </div>
  )
}
