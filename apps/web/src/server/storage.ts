// Filesystem-backed ObjectStorage (src/api/platform/types.ts) for the
// self-hosted server: media/avatar bytes under `DATA_DIR/objects/<key>`,
// with the content type `put` was given kept alongside as a
// `DATA_DIR/meta/<key>.json` sidecar. R2 (the Cloudflare equivalent, see
// src/api/platform/cloudflare.ts) carries content type as object metadata; a
// plain file has none, hence the sidecar.
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'

import type { ObjectStorage, StoredObject } from '../api/platform/types'

/** Thrown when a key would resolve outside its store's root (traversal, an absolute path, `..`, NUL). */
export class InvalidObjectKeyError extends Error {
  constructor(key: string) {
    super(`invalid object key: ${JSON.stringify(key)}`)
    this.name = 'InvalidObjectKeyError'
  }
}

const isSafeKey = (key: string): boolean => {
  if (key.length === 0 || key.includes('\0') || key.startsWith('/') || key.startsWith('\\')) {
    return false
  }
  return key
    .split(/[/\\]/)
    .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
}

/** `key` resolved under `root`; throws InvalidObjectKeyError instead of ever resolving outside it. */
const resolveKey = (root: string, key: string): string => {
  if (!isSafeKey(key)) {
    throw new InvalidObjectKeyError(key)
  }
  const resolved = resolve(root, key)
  if (!resolved.startsWith(`${root}${sep}`)) {
    throw new InvalidObjectKeyError(key)
  }
  return resolved
}

interface Sidecar {
  contentType: string
}

const readContentType = async (sidecarPath: string): Promise<string | null> => {
  const file = Bun.file(sidecarPath)
  if (!(await file.exists())) {
    return null
  }
  const parsed: unknown = await file.json()
  if (
    parsed !== null &&
    typeof parsed === 'object' &&
    'contentType' in parsed &&
    typeof parsed.contentType === 'string'
  ) {
    return parsed.contentType
  }
  return null
}

/** ObjectStorage over a local directory. */
export const filesystemStorage = (dataDir: string): ObjectStorage => {
  const objectsRoot = resolve(dataDir, 'objects')
  const metaRoot = resolve(dataDir, 'meta')
  const metaPath = (key: string): string => `${resolveKey(metaRoot, key)}.json`

  return {
    put: async (key, body, { contentType }) => {
      const objectPath = resolveKey(objectsRoot, key)
      const sidecarPath = metaPath(key)
      // Bun.write creates objectPath's parent directories itself; the
      // sidecar tree needs its own mkdir since writeFile does not.
      await mkdir(dirname(sidecarPath), { recursive: true })
      await Bun.write(objectPath, body)
      await writeFile(sidecarPath, JSON.stringify({ contentType } satisfies Sidecar))
    },
    get: async (key) => {
      const objectPath = resolveKey(objectsRoot, key)
      const file = Bun.file(objectPath)
      if (!(await file.exists())) {
        return null
      }
      const contentType = await readContentType(metaPath(key))
      const stored: StoredObject = { body: file.stream(), contentType }
      return stored
    },
    delete: async (keys) => {
      for (const key of keys) {
        await rm(resolveKey(objectsRoot, key), { force: true })
        await rm(metaPath(key), { force: true })
      }
    },
  }
}
