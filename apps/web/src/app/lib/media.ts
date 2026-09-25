// Media assets of a job (docs/SPEC.md §9) arranged for the gallery and the
// audio list.
import type { MediaAsset } from '@/shared/types'

/** Union by id; `incoming` wins on duplicates. Order is not meaningful. */
export const mergeMedia = (existing: MediaAsset[], incoming: MediaAsset[]): MediaAsset[] => {
  if (incoming.length === 0) {
    return existing
  }
  const byId = new Map(existing.map((asset) => [asset.id, asset]))
  for (const asset of incoming) {
    byId.set(asset.id, asset)
  }
  return [...byId.values()]
}

const byStepThenTime = (a: MediaAsset, b: MediaAsset): number =>
  a.step - b.step || (a.logged_at < b.logged_at ? -1 : a.logged_at > b.logged_at ? 1 : 0)

/** Newest step first, for the audio list. */
export const sortMediaNewestFirst = (assets: MediaAsset[]): MediaAsset[] =>
  [...assets].sort((a, b) => byStepThenTime(b, a))

/** Distinct steps with at least one asset, ascending. */
export const mediaSteps = (assets: MediaAsset[]): number[] =>
  [...new Set(assets.map((asset) => asset.step))].sort((a, b) => a - b)

/** The assets logged at `step`, in logging order (the SDK's order on ties). */
export const assetsAtStep = (assets: MediaAsset[], step: number): MediaAsset[] =>
  assets
    .filter((asset) => asset.step === step)
    .sort((a, b) => (a.logged_at < b.logged_at ? -1 : a.logged_at > b.logged_at ? 1 : 0))

/** The step among `steps` closest to `value` (the slider snaps to logged steps). */
export const nearestStep = (steps: number[], value: number): number | null =>
  steps.reduce<number | null>(
    (best, step) =>
      best === null || Math.abs(step - value) < Math.abs(best - value) ? step : best,
    null,
  )

/** `8` -> `0:08`, `75.4` -> `1:15`; NaN (duration unknown) -> `—`. */
export const formatAudioTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '—'
  }
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export interface MediaGroup {
  label: string
  /** Ordered by step (then logging time), oldest first. */
  assets: MediaAsset[]
}

/** One group per label, labels in alphabetical order (a film strip per label). */
export const groupMediaByLabel = (assets: MediaAsset[]): MediaGroup[] => {
  const byLabel = new Map<string, MediaAsset[]>()
  for (const asset of assets) {
    const group = byLabel.get(asset.label)
    if (group === undefined) {
      byLabel.set(asset.label, [asset])
    } else {
      group.push(asset)
    }
  }
  return [...byLabel.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([label, group]) => ({ label, assets: [...group].sort(byStepThenTime) }))
}
