import { PauseIcon, PlayIcon, Volume2Icon, VolumeXIcon } from 'lucide-react'
import { useMemo } from 'react'
import type { MediaAsset } from '@/shared/types'
import { type AudioPlayer, useJobAudio } from '../../hooks/use-job-audio'
import { formatAudioTime, sortMediaNewestFirst } from '../../lib/media'
import { formatStep } from '../../lib/metrics'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'
import { RangeInput } from './step-slider'

/** A row of the audio list: button, 200px of info, the middle, time, volume. */
export function AudioRow({
  busy = false,
  children,
}: {
  busy?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-4 border-b py-3.5" aria-busy={busy ? 'true' : undefined}>
      {children}
    </div>
  )
}

export function AudioInfo({ label, note }: { label: string; note: string }) {
  return (
    <div className="w-[200px] shrink-0">
      <p className="font-mono text-xs">{label}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
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

/**
 * Stand-in for the clip's waveform before it is played: a mid line with
 * evenly spaced bars, drawn by the browser rather than fetched.
 */
export function AudioWave() {
  return (
    <svg
      viewBox="0 0 300 32"
      aria-hidden="true"
      className="h-8 w-full stroke-muted-foreground stroke-2"
    >
      <path
        fill="none"
        d="M0 16h300M8 12v8m8-14v20m8-24v28m8-20v12m8-15v18m8-24v30m8-19v8m8-15v22m8-17v12m8-20v28m8-21v14m8-10v6m8-15v24m8-20v16m8-12v8m8-19v30m8-23v16m8-12v8m8-17v26m8-20v14m8-17v20m8-14v8m8-10v12m8-17v22m8-15v8m8-6v4m8-10v16m8-13v10m8-15v20m8-13v6m8-5v4m8-3v2"
      />
    </svg>
  )
}

const phaseNote = (player: AudioPlayer): string | null =>
  player.phase === 'playing'
    ? '再生中'
    : player.phase === 'loading'
      ? '読み込み中'
      : player.phase === 'error'
        ? '再生できませんでした'
        : null

function AudioClip({ clip }: { clip: MediaAsset }) {
  const player = useJobAudio(clip.url)
  const note = phaseNote(player)
  const started = player.phase !== 'idle'
  const playing = player.phase === 'playing' || player.phase === 'loading'
  return (
    <AudioRow busy={player.phase === 'loading'}>
      <Button
        variant="outline"
        size="icon"
        onClick={player.toggle}
        disabled={player.phase === 'error'}
        aria-label={`${clip.label}を${playing ? '一時停止' : '再生'}`}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </Button>
      <AudioInfo
        label={clip.label}
        note={`step ${formatStep(clip.step)} · ${note === null ? clip.content_type : note}`}
      />
      <div className="min-w-0 flex-1">
        {started ? (
          Number.isFinite(player.duration) ? (
            <RangeInput
              min={0}
              max={player.duration}
              step={0.1}
              value={player.position}
              aria-label={`${clip.label}の再生位置`}
              aria-valuetext={`${Math.ceil(player.duration)}秒中${Math.floor(player.position)}秒`}
              onChange={(event) => player.seek(Number(event.target.value))}
            />
          ) : (
            <Skeleton className="h-4" />
          )
        ) : (
          <AudioWave />
        )}
      </div>
      <AudioTime>
        {started && !Number.isFinite(player.duration)
          ? '— / —'
          : `${formatAudioTime(player.position)} / ${formatAudioTime(player.duration)}`}
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
    </AudioRow>
  )
}

/** Newest step first; one player per clip. */
export function AudioList({ clips }: { clips: MediaAsset[] }) {
  const sorted = useMemo(() => sortMediaNewestFirst(clips), [clips])
  if (sorted.length === 0) {
    return null
  }
  return (
    <div>
      {sorted.map((clip) => (
        <AudioClip key={clip.id} clip={clip} />
      ))}
    </div>
  )
}
