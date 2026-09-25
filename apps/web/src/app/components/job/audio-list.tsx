import { PauseIcon, PlayIcon, Volume2Icon, VolumeXIcon } from 'lucide-react'
import type * as React from 'react'
import type { MediaAsset } from '@/shared/types'
import { useAudioPeaks } from '../../hooks/use-audio-peaks'
import { type AudioPlayer, useJobAudio } from '../../hooks/use-job-audio'
import { formatAudioTime } from '../../lib/media'
import { formatStep } from '../../lib/metrics'
import {
  computePeaks,
  playedRatio,
  seekTargetForKey,
  WAVE_VIEWBOX,
  wavePath,
} from '../../lib/waveform'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'

/** Two clips abreast (one on a narrow screen), as `.audio-grid` in the mocks. */
export function AudioGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">{children}</div>
}

/** One clip: the head row above its waveform, a rule below. */
export function AudioCell({
  busy = false,
  children,
}: {
  busy?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2 border-b py-3.5" aria-busy={busy ? 'true' : undefined}>
      {children}
    </div>
  )
}

/** Play button, label and note, time, volume button. */
export function AudioHead({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3">{children}</div>
}

export function AudioInfo({ label, note }: { label: string; note: string }) {
  return (
    <div className="min-w-0 flex-1 text-xs">
      <p className="truncate font-mono">{label}</p>
      <p className="truncate text-muted-foreground">{note}</p>
    </div>
  )
}

export function AudioTime({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 font-mono text-xs whitespace-nowrap text-muted-foreground">
      {children}
    </span>
  )
}

export interface AudioWaveProps {
  label: string
  /** Bar heights 0 to 1; null while the clip is being decoded. */
  peaks: number[] | null
  position: number
  /** Seconds; NaN while unknown, which disables seeking. */
  duration: number
  onSeek?: (seconds: number) => void
}

/**
 * The clip's waveform, doubling as its position slider: the played part is
 * drawn again in the foreground colour and clipped to the playhead.
 */
export function AudioWave({ label, peaks, position, duration, onSeek }: AudioWaveProps) {
  const known = Number.isFinite(duration) && duration > 0
  const played = playedRatio(position, duration)
  const path = peaks === null ? '' : wavePath(peaks)
  const seekTo = (seconds: number | null) => {
    if (seconds !== null && onSeek !== undefined) {
      onSeek(seconds)
    }
  }
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={`${label}の再生位置`}
      aria-valuemin={0}
      aria-valuemax={known ? Math.ceil(duration) : 0}
      aria-valuenow={Math.floor(position)}
      aria-valuetext={known ? `${Math.ceil(duration)}秒中${Math.floor(position)}秒` : undefined}
      aria-disabled={known ? undefined : 'true'}
      className="relative h-10 cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-disabled:cursor-default"
      onClick={(event) => {
        if (!known) {
          return
        }
        const box = event.currentTarget.getBoundingClientRect()
        seekTo(box.width > 0 ? ((event.clientX - box.left) / box.width) * duration : null)
      }}
      onKeyDown={(event) => {
        const target = seekTargetForKey(event.key, position, duration)
        if (target !== null) {
          event.preventDefault()
          seekTo(target)
        }
      }}
    >
      {peaks === null ? (
        <Skeleton className="h-full" />
      ) : (
        <>
          <svg
            viewBox={WAVE_VIEWBOX}
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute inset-0 size-full fill-none stroke-muted-foreground stroke-2 opacity-50"
          >
            <path vectorEffect="non-scaling-stroke" d={path} />
          </svg>
          <svg
            viewBox={WAVE_VIEWBOX}
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute inset-0 size-full fill-none stroke-foreground stroke-2"
            style={{ clipPath: `inset(0 ${(1 - played) * 100}% 0 0)` }}
          >
            <path vectorEffect="non-scaling-stroke" d={path} />
          </svg>
        </>
      )}
    </div>
  )
}

const phaseNote = (player: AudioPlayer, decoding: boolean): string | null =>
  player.phase === 'playing'
    ? '再生中'
    : player.phase === 'loading'
      ? '読み込み中'
      : player.phase === 'error'
        ? '再生できませんでした'
        : decoding
          ? '波形を読み込み中'
          : null

const FLAT = computePeaks([])

function AudioClip({ clip }: { clip: MediaAsset }) {
  const wave = useAudioPeaks(clip.url)
  // Plays the bytes fetched for the waveform (seekable), or the file itself
  // when they could not be decoded.
  const player = useJobAudio(
    wave.phase === 'ready' ? wave.src : wave.phase === 'error' ? clip.url : null,
  )
  const decoding = wave.phase === 'loading'
  const note = phaseNote(player, decoding)
  const playing = player.phase === 'playing' || player.phase === 'loading'
  // The decoded length is known before the <audio> element's metadata.
  const duration = Number.isFinite(player.duration)
    ? player.duration
    : wave.phase === 'ready'
      ? wave.duration
      : Number.NaN
  return (
    <AudioCell busy={decoding || player.phase === 'loading'}>
      <AudioHead>
        <Button
          variant="outline"
          size="icon"
          onClick={player.toggle}
          disabled={decoding || player.phase === 'error'}
          aria-label={`${clip.label}を${playing ? '一時停止' : '再生'}`}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <AudioInfo
          label={clip.label}
          note={`step ${formatStep(clip.step)} · ${note === null ? clip.content_type : note}`}
        />
        <AudioTime>
          {Number.isFinite(duration)
            ? `${formatAudioTime(player.position)} / ${formatAudioTime(duration)}`
            : '— / —'}
        </AudioTime>
        <Button
          variant="ghost"
          size="icon"
          onClick={player.toggleMuted}
          aria-label={`${clip.label}の音量`}
          aria-pressed={player.muted}
        >
          {player.muted ? <VolumeXIcon /> : <Volume2Icon />}
        </Button>
      </AudioHead>
      <AudioWave
        label={clip.label}
        // A clip that cannot be decoded still gets a flat line to seek on.
        peaks={wave.phase === 'ready' ? wave.peaks : wave.phase === 'error' ? FLAT : null}
        position={player.position}
        duration={duration}
        onSeek={player.seek}
      />
    </AudioCell>
  )
}

/** The clips of one step, in logging order; one player per clip. */
export function AudioList({ clips }: { clips: MediaAsset[] }) {
  if (clips.length === 0) {
    return null
  }
  return (
    <AudioGrid>
      {clips.map((clip) => (
        <AudioClip key={clip.id} clip={clip} />
      ))}
    </AudioGrid>
  )
}
