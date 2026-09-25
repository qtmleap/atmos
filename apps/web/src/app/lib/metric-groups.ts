// Groups metric keys by their "namespace" prefix (the text before the first
// `/`, as train/loss and train/acc share `train`), for the compare chart's
// grouped layout.

export interface MetricGroup {
  /** Text before the first `/`; null for keys with no prefix. */
  prefix: string | null
  /** Keys in this group, in the order they first appeared. */
  keys: string[]
}

/** Label for the group of keys with no prefix. */
export const OTHER_GROUP_LABEL = 'その他'

const prefixOf = (key: string): string | null => {
  const slash = key.indexOf('/')
  if (slash <= 0) {
    return null
  }
  return key.slice(0, slash)
}

/**
 * Groups keys by prefix, in the order each prefix first appears; keys keep
 * their order within a group. Keys with no prefix (none, or starting with
 * `/`) share one group, placed last and omitted when there are none.
 */
export const groupMetricKeys = (keys: readonly string[]): MetricGroup[] => {
  const groups = new Map<string | null, string[]>()
  for (const key of keys) {
    const prefix = prefixOf(key)
    const bucket = groups.get(prefix)
    if (bucket === undefined) {
      groups.set(prefix, [key])
    } else {
      bucket.push(key)
    }
  }
  const other = groups.get(null)
  groups.delete(null)
  const ordered = [...groups.entries()].map(([prefix, groupKeys]) => ({ prefix, keys: groupKeys }))
  return other === undefined ? ordered : [...ordered, { prefix: null, keys: other }]
}

/** Display label of a group: its prefix, or the "no prefix" label. */
export const metricGroupLabel = (group: MetricGroup): string =>
  group.prefix === null ? OTHER_GROUP_LABEL : group.prefix
