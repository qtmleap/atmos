// The waveform of an audio sample, as `.audio-wave` in the mocks draws it:
// 75 vertical bars on a 300x40 viewBox, centred on y=20. The peaks come from
// the decoded samples (hooks/use-audio-peaks.ts); these functions are pure.

export const WAVE_BARS = 75
const WAVE_WIDTH = 300
const WAVE_HEIGHT = 40
const WAVE_PITCH = WAVE_WIDTH / WAVE_BARS
/** Tallest bar, leaving 2px above and below for the stroke's caps. */
const WAVE_MAX = WAVE_HEIGHT - 4
/** Silence still shows as a short tick, as in the mocks. */
const WAVE_MIN = 2

export const WAVE_VIEWBOX = `0 0 ${WAVE_WIDTH} ${WAVE_HEIGHT}`

/**
 * The loudest absolute sample of each of `bars` equal slices, over all
 * channels, scaled so the loudest slice is 1. Silence gives all zeros.
 */
export const computePeaks = (channels: Float32Array[], bars: number = WAVE_BARS): number[] => {
  const length = channels.reduce((max, channel) => Math.max(max, channel.length), 0)
  const peaks = new Array<number>(bars).fill(0)
  if (length === 0 || bars <= 0) {
    return peaks
  }
  for (let bar = 0; bar < bars; bar++) {
    const start = Math.floor((bar * length) / bars)
    const end = Math.max(start + 1, Math.floor(((bar + 1) * length) / bars))
    let peak = 0
    for (const channel of channels) {
      for (const sample of channel.subarray(start, end)) {
        peak = Math.max(peak, Math.abs(sample))
      }
    }
    peaks[bar] = peak
  }
  const loudest = Math.max(...peaks)
  return loudest === 0 ? peaks : peaks.map((peak) => peak / loudest)
}

const round = (value: number): number => Math.round(value * 10) / 10

/** One `M x y v h` per peak (0 to 1), bars `WAVE_PITCH` apart. */
export const wavePath = (peaks: number[]): string =>
  peaks
    .map((peak, index) => {
      const clamped = Math.min(1, Math.max(0, Number.isFinite(peak) ? peak : 0))
      const height = round(WAVE_MIN + clamped * (WAVE_MAX - WAVE_MIN))
      const x = round(index * WAVE_PITCH + WAVE_PITCH / 2)
      return `M${x} ${round((WAVE_HEIGHT - height) / 2)}v${height}`
    })
    .join('')

/**
 * Where a key on the waveform slider moves the playhead: arrows by 1 second,
 * Page keys by 5, Home and End to either end. Null for any other key.
 */
export const seekTargetForKey = (
  key: string,
  position: number,
  duration: number,
): number | null => {
  if (!Number.isFinite(duration) || duration <= 0) {
    return null
  }
  const clamp = (seconds: number) => Math.min(duration, Math.max(0, seconds))
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return clamp(position - 1)
    case 'ArrowRight':
    case 'ArrowUp':
      return clamp(position + 1)
    case 'PageDown':
      return clamp(position - 5)
    case 'PageUp':
      return clamp(position + 5)
    case 'Home':
      return 0
    case 'End':
      return duration
    default:
      return null
  }
}

/** Share of the clip played, 0 to 1; 0 while the length is unknown. */
export const playedRatio = (position: number, duration: number): number =>
  Number.isFinite(duration) && duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0
