// Reads a job's free-form `config` object for display: the key/value rows of
// the settings table, and the few well-known keys the run page summarises
// (docs/mock-diff/designs/pages/job-detail.html).

export type ConfigKind = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object'

export interface ConfigEntry {
  key: string
  kind: ConfigKind
  /** JSON form, one line, a space after `:` and `,`: `{"name": "AdamW", "betas": [0.8, 0.99]}`. */
  json: string
  /** Scalars as they are (`vits`, `0.0003`, `true`); arrays and objects as `json`. */
  plain: string
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const kindOf = (value: unknown): ConfigKind => {
  if (typeof value === 'string') {
    return 'string'
  }
  if (typeof value === 'number') {
    return 'number'
  }
  if (typeof value === 'boolean') {
    return 'boolean'
  }
  if (Array.isArray(value)) {
    return 'array'
  }
  return isPlainObject(value) ? 'object' : 'null'
}

/** JSON on one line with spaces after `:` and `,`, as a person would type it. */
export const formatConfigJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(formatConfigJson).join(', ')}]`
  }
  if (isPlainObject(value)) {
    return `{${Object.entries(value)
      .map(([key, item]) => `${JSON.stringify(key)}: ${formatConfigJson(item)}`)
      .join(', ')}}`
  }
  if (value === undefined) {
    return 'null'
  }
  return JSON.stringify(value)
}

/** Top-level keys in the object's own order. */
export const configEntries = (config: Record<string, unknown>): ConfigEntry[] =>
  Object.entries(config).map(([key, value]) => {
    const kind = kindOf(value)
    const json = formatConfigJson(value)
    return {
      key,
      kind,
      json,
      plain: kind === 'string' && typeof value === 'string' ? value : json,
    }
  })

/** `config[key]` when it is a finite number. */
export const configNumber = (config: Record<string, unknown>, key: string): number | null => {
  const value = config[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const configString = (config: Record<string, unknown>, key: string): string | null => {
  const value = config[key]
  return typeof value === 'string' && value !== '' ? value : null
}

/** Number of speakers: a `speakers` list, or an `n_speakers` / `num_speakers` count. */
const speakerCount = (config: Record<string, unknown>): number | null => {
  const speakers = config.speakers
  if (Array.isArray(speakers)) {
    return speakers.length
  }
  const counted = configNumber(config, 'n_speakers')
  return counted === null ? configNumber(config, 'num_speakers') : counted
}

/**
 * One-line description of the run from its config, `VITS / JSUT · 単一話者`:
 * the model and the dataset family (the part before the first `-`) in
 * capitals, then the speaker count. Null when neither model nor dataset is set.
 */
export const describeJob = (config: Record<string, unknown>): string | null => {
  const model = configString(config, 'model')
  const dataset = configString(config, 'dataset')
  const parts = [model, dataset === null ? null : dataset.split('-')[0]]
    .filter((part): part is string => part !== null && part !== undefined)
    .map((part) => part.toUpperCase())
  if (parts.length === 0) {
    return null
  }
  const speakers = speakerCount(config)
  const voices = speakers !== null && speakers > 1 ? `${speakers}話者` : '単一話者'
  return `${parts.join(' / ')} · ${voices}`
}

/** `22,050 Hz` (plus `· モノラル` / `· ステレオ` when `channels` is set), or null. */
export const describeAudio = (config: Record<string, unknown>): string | null => {
  const rate = configNumber(config, 'sample_rate')
  if (rate === null) {
    return null
  }
  const channels = configNumber(config, 'channels')
  const layout = channels === 1 ? ' · モノラル' : channels === 2 ? ' · ステレオ' : ''
  return `${rate.toLocaleString('en-US')} Hz${layout}`
}

// ---------------------------------------------------------------------------
// Flattened rows (kept for callers that want one row per leaf)
// ---------------------------------------------------------------------------

export interface ConfigRow {
  /** Dotted path, e.g. `optimizer.lr` or `layers.0`. */
  path: string
  /** Display text; strings are shown as they are, everything else as JSON. */
  value: string
  kind: 'string' | 'number' | 'boolean' | 'null' | 'empty'
}

const leaf = (path: string, value: unknown): ConfigRow => {
  if (typeof value === 'string') {
    return { path, value, kind: 'string' }
  }
  if (typeof value === 'number') {
    return { path, value: String(value), kind: 'number' }
  }
  if (typeof value === 'boolean') {
    return { path, value: String(value), kind: 'boolean' }
  }
  if (value === null || value === undefined) {
    return { path, value: 'null', kind: 'null' }
  }
  return { path, value: JSON.stringify(value), kind: 'string' }
}

/**
 * Nested objects and arrays become dotted paths. Empty objects and arrays are
 * kept as one row so they do not silently disappear. Rows keep the object's
 * key order.
 */
export const flattenConfig = (config: Record<string, unknown>, prefix = ''): ConfigRow[] =>
  Object.entries(config).flatMap(([key, value]): ConfigRow[] => {
    const path = prefix === '' ? key : `${prefix}.${key}`
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return [{ path, value: '[]', kind: 'empty' }]
      }
      const indexed = Object.fromEntries(value.map((item, index) => [String(index), item]))
      return flattenConfig(indexed, path)
    }
    if (isPlainObject(value)) {
      if (Object.keys(value).length === 0) {
        return [{ path, value: '{}', kind: 'empty' }]
      }
      return flattenConfig(value, path)
    }
    return [leaf(path, value)]
  })
