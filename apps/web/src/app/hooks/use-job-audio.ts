// Playback of one audio sample of a job, behind a play/pause button and its
// waveform (components/job/audio-list.tsx). The <audio> element is created
// once `url` is known, with preload="metadata" so the length shows before
// playing. A null `url` (the clip is still being fetched) makes it a no-op.
import { useCallback, useEffect, useRef, useState } from 'react'

export type AudioPhase = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

export interface AudioPlayer {
  phase: AudioPhase
  /** Seconds played; 0 before the first play. */
  position: number
  /** Seconds in total; NaN until the metadata has loaded. */
  duration: number
  muted: boolean
  toggle: () => void
  seek: (seconds: number) => void
  toggleMuted: () => void
}

export function useJobAudio(url: string | null): AudioPlayer {
  const element = useRef<HTMLAudioElement | null>(null)
  const [phase, setPhase] = useState<AudioPhase>('idle')
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(Number.NaN)
  const [muted, setMuted] = useState(false)

  const ensure = useCallback((): HTMLAudioElement | null => {
    const existing = element.current
    if (existing !== null || url === null) {
      return existing
    }
    const audio = new Audio(url)
    audio.preload = 'metadata'
    // Once disposed (src cleared) the element still fires events; ignore them.
    const on = (event: string, handler: () => void) =>
      audio.addEventListener(event, () => {
        if (element.current === audio) {
          handler()
        }
      })
    on('loadedmetadata', () => setDuration(audio.duration))
    on('durationchange', () => setDuration(audio.duration))
    on('timeupdate', () => setPosition(audio.currentTime))
    on('playing', () => setPhase('playing'))
    on('waiting', () => setPhase('loading'))
    on('pause', () => setPhase('paused'))
    on('ended', () => {
      setPhase('paused')
      setPosition(0)
    })
    on('error', () => setPhase('error'))
    element.current = audio
    return audio
  }, [url])

  // One hook instance plays one clip (the list keys its rows by asset id):
  // the element is made once and stopped when the row goes away.
  useEffect(() => {
    ensure()
    return () => {
      const audio = element.current
      element.current = null
      if (audio !== null) {
        audio.pause()
        audio.src = ''
      }
    }
  }, [ensure])

  const toggle = useCallback(() => {
    const audio = ensure()
    if (audio === null) {
      return
    }
    if (audio.paused) {
      setPhase('loading')
      audio.play().catch(() => setPhase('error'))
    } else {
      audio.pause()
    }
  }, [ensure])

  const seek = useCallback(
    (seconds: number) => {
      const audio = ensure()
      if (audio === null) {
        return
      }
      audio.currentTime = seconds
      setPosition(seconds)
    },
    [ensure],
  )

  const toggleMuted = useCallback(() => {
    const audio = ensure()
    if (audio === null) {
      return
    }
    audio.muted = !audio.muted
    setMuted(audio.muted)
  }, [ensure])

  return { phase, position, duration, muted, toggle, seek, toggleMuted }
}
