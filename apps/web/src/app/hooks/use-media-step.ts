// The step shown on the "画像・音声" tab. One slider drives the images and
// the audio together, over every step that has either. It opens on the
// latest step and follows new steps until the user picks an older one.
import { useCallback, useMemo, useState } from 'react'
import type { MediaAsset } from '@/shared/types'
import { mediaSteps, nearestStep } from '../lib/media'

export interface MediaStep {
  /** Steps with at least one image or audio sample, ascending. */
  steps: number[]
  /** The step shown; undefined while nothing has arrived. */
  step: number | undefined
  latest: number | undefined
  /** Snaps a slider value to the nearest logged step. */
  choose: (value: number) => void
  /** Back to following the latest step. */
  followLatest: () => void
}

export function useMediaStep(images: MediaAsset[], audio: MediaAsset[]): MediaStep {
  const steps = useMemo(() => mediaSteps([...images, ...audio]), [images, audio])
  const [chosen, setChosen] = useState<number | null>(null)
  const latest = steps.at(-1)
  const step = chosen !== null && steps.includes(chosen) ? chosen : latest
  const choose = useCallback(
    (value: number) => {
      const snapped = nearestStep(steps, value)
      if (snapped !== null) {
        setChosen(snapped)
      }
    },
    [steps],
  )
  const followLatest = useCallback(() => setChosen(null), [])
  return { steps, step, latest, choose, followLatest }
}
