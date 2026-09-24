// Metric and LogLine ids are integer keys sent as decimal strings
// (shared/types.ts). They order by numeric value, which for canonical decimal
// strings is length first, then text.

export const compareSerialId = (a: string, b: string): number => {
  if (a.length !== b.length) {
    return a.length - b.length
  }
  if (a === b) {
    return 0
  }
  return a < b ? -1 : 1
}

/**
 * Merges `incoming` into `existing` (both may be unordered), dropping
 * duplicate ids (the incoming copy wins) and returning the result ordered by id.
 */
export const mergeBySerialId = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
  if (incoming.length === 0) {
    return existing
  }
  const byId = new Map<string, T>()
  for (const item of existing) {
    byId.set(item.id, item)
  }
  for (const item of incoming) {
    byId.set(item.id, item)
  }
  return [...byId.values()].sort((x, y) => compareSerialId(x.id, y.id))
}
