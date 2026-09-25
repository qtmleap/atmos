// The waveform of one audio sample, worked out in the browser: the file is
// fetched, decoded with Web Audio and reduced to bar heights (lib/waveform.ts).
// The server stores only the file, so nothing about the waveform is kept.
// The fetched bytes are also handed back as a blob: URL to play from; the
// media route answers without Range support, and Chrome cannot seek a
// clip streamed that way, but it can seek one held in memory.
import { useEffect, useState } from 'react'
import { computePeaks } from '../lib/waveform'

export type AudioPeaks =
  | { phase: 'loading' }
  | { phase: 'ready'; peaks: number[]; duration: number; src: string }
  | { phase: 'error' }

// decodeAudioData needs a context but not a running one; an offline context
// is never started, so it is allowed before any user gesture. One is enough
// for every clip on the page.
let decoder: OfflineAudioContext | null = null
const getDecoder = (): OfflineAudioContext => {
  if (decoder === null) {
    decoder = new OfflineAudioContext(1, 1, 44100)
  }
  return decoder
}

const decodePeaks = async (url: string, signal: AbortSignal): Promise<AudioPeaks> => {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    return { phase: 'error' }
  }
  const blob = await response.blob()
  const buffer = await getDecoder().decodeAudioData(await blob.arrayBuffer())
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index),
  )
  return {
    phase: 'ready',
    peaks: computePeaks(channels),
    duration: buffer.duration,
    src: URL.createObjectURL(blob),
  }
}

export function useAudioPeaks(url: string): AudioPeaks {
  const [state, setState] = useState<AudioPeaks>({ phase: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    let src: string | null = null
    setState({ phase: 'loading' })
    decodePeaks(url, controller.signal)
      .then((next) => {
        if (next.phase === 'ready') {
          src = next.src
        }
        if (controller.signal.aborted) {
          if (src !== null) {
            URL.revokeObjectURL(src)
          }
        } else {
          setState(next)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ phase: 'error' })
        }
      })
    return () => {
      controller.abort()
      if (src !== null) {
        URL.revokeObjectURL(src)
      }
    }
  }, [url])
  return state
}
