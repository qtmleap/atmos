// Tests for src/server/static.ts: StaticAssets serving a built dist/client
// with SPA fallback, immutable caching for hashed /assets/*, and traversal
// safety (src/api/platform/types.ts StaticAssets).
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { filesystemAssets } from '../../src/server/static'

const staticDir: { current: string } = { current: '' }

beforeEach(async () => {
  staticDir.current = await mkdtemp(join(tmpdir(), 'atmos-static-'))
  await writeFile(join(staticDir.current, 'index.html'), '<html>spa shell</html>')
  await mkdir(join(staticDir.current, 'assets'), { recursive: true })
  await writeFile(join(staticDir.current, 'assets', 'app-abc123.js'), 'console.log(1)')
})

afterEach(async () => {
  await rm(staticDir.current, { recursive: true, force: true })
})

describe('filesystemAssets', () => {
  test('/ serves index.html with no-cache', async () => {
    const assets = filesystemAssets(staticDir.current)
    const res = await assets.fetch(new Request('http://localhost/'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('<html>spa shell</html>')
    expect(res.headers.get('Cache-Control')).toBe('no-cache')
  })

  test('a matching file under /assets/ serves with an immutable cache header', async () => {
    const assets = filesystemAssets(staticDir.current)
    const res = await assets.fetch(new Request('http://localhost/assets/app-abc123.js'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('console.log(1)')
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect(res.headers.get('Content-Type')).toContain('javascript')
  })

  test('a non-matching path falls back to index.html (client-side routes)', async () => {
    const assets = filesystemAssets(staticDir.current)
    const res = await assets.fetch(new Request('http://localhost/projects/abc'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('<html>spa shell</html>')
    expect(res.headers.get('Cache-Control')).toBe('no-cache')
  })

  test('a missing file under /assets/ falls back to index.html', async () => {
    const assets = filesystemAssets(staticDir.current)
    const res = await assets.fetch(new Request('http://localhost/assets/missing.js'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('<html>spa shell</html>')
  })

  test('a .. segment cannot escape the root', async () => {
    const assets = filesystemAssets(staticDir.current)
    const res = await assets.fetch(new Request('http://localhost/assets/../../etc/passwd'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('<html>spa shell</html>')
  })

  test('a percent-encoded .. segment falls back instead of resolving as a real .. (post-normalization decode)', async () => {
    const assets = filesystemAssets(staticDir.current)
    const res = await assets.fetch(new Request('http://localhost/assets/%2e%2e/%2e%2e/index.html'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('<html>spa shell</html>')
  })

  test('a percent-encoded slash cannot smuggle a new path separator', async () => {
    const assets = filesystemAssets(staticDir.current)
    const res = await assets.fetch(new Request('http://localhost/assets%2f..%2f..%2findex.html'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('<html>spa shell</html>')
  })

  test('a malformed percent-encoding falls back to index.html', async () => {
    const assets = filesystemAssets(staticDir.current)
    const res = await assets.fetch(new Request('http://localhost/assets/%'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('<html>spa shell</html>')
  })

  test('a NUL byte in a segment falls back to index.html', async () => {
    const assets = filesystemAssets(staticDir.current)
    const res = await assets.fetch(new Request('http://localhost/assets/%00'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('<html>spa shell</html>')
  })
})
