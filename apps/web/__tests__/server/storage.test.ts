// Tests for src/server/storage.ts: the filesystem ObjectStorage backing
// media/avatar bytes for the self-hosted server (src/api/platform/types.ts).
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { filesystemStorage, InvalidObjectKeyError } from '../../src/server/storage'

const readAll = async (body: ReadableStream): Promise<string> => new Response(body).text()

const dataDir: { current: string } = { current: '' }

beforeEach(async () => {
  dataDir.current = await mkdtemp(join(tmpdir(), 'atmos-storage-'))
})

afterEach(async () => {
  await rm(dataDir.current, { recursive: true, force: true })
})

describe('filesystemStorage', () => {
  test('put/get round-trips the body and content type', async () => {
    const storage = filesystemStorage(dataDir.current)
    await storage.put('avatars/a.png', new TextEncoder().encode('bytes'), {
      contentType: 'image/png',
    })
    const stored = await storage.get('avatars/a.png')
    expect(stored).not.toBeNull()
    if (stored === null) {
      return
    }
    expect(await readAll(stored.body)).toBe('bytes')
    expect(stored.contentType).toBe('image/png')
  })

  test('get returns null for a missing key', async () => {
    const storage = filesystemStorage(dataDir.current)
    expect(await storage.get('nope')).toBeNull()
  })

  test('delete removes the object and its sidecar, ignoring missing keys', async () => {
    const storage = filesystemStorage(dataDir.current)
    await storage.put('a', new TextEncoder().encode('x'), { contentType: 'text/plain' })
    await storage.delete(['a', 'never-existed'])
    expect(await storage.get('a')).toBeNull()
  })

  test('put overwrites an existing key', async () => {
    const storage = filesystemStorage(dataDir.current)
    await storage.put('k', new TextEncoder().encode('first'), { contentType: 'text/plain' })
    await storage.put('k', new TextEncoder().encode('second'), { contentType: 'text/plain' })
    const stored = await storage.get('k')
    expect(stored).not.toBeNull()
    if (stored !== null) {
      expect(await readAll(stored.body)).toBe('second')
    }
  })

  test('rejects a key that escapes the root with ..', async () => {
    const storage = filesystemStorage(dataDir.current)
    await expect(
      storage.put('../escape', new TextEncoder().encode('x'), { contentType: 'text/plain' }),
    ).rejects.toBeInstanceOf(InvalidObjectKeyError)
  })

  test('rejects an absolute key', async () => {
    const storage = filesystemStorage(dataDir.current)
    await expect(storage.get('/etc/passwd')).rejects.toBeInstanceOf(InvalidObjectKeyError)
  })

  test('rejects a key containing a NUL byte', async () => {
    const storage = filesystemStorage(dataDir.current)
    await expect(storage.get('a\0b')).rejects.toBeInstanceOf(InvalidObjectKeyError)
  })

  test('rejects a key with a .. segment in the middle', async () => {
    const storage = filesystemStorage(dataDir.current)
    await expect(storage.get('objects/../../escape')).rejects.toBeInstanceOf(InvalidObjectKeyError)
  })
})
