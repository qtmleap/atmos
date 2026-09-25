// Throwaway harness: shoot a mock HTML file and an app URL at 1440x900@2x
// (light, reduced motion) and report the share of differing pixels, writing
// <name>-mock.png, <name>-actual.png and <name>-diff.png to screenshots/mock-diff/.
// Run from apps/web so imports resolve:
//   cd apps/web && bun ../../scripts/mock-compare.mjs <mock.html> <url> <name>
// Env: CHROME_PATH (headless shell binary), STATIC_DIR (serve a built client
// bundle instead of a server), FULL_PAGE=1 (whole page, not just the viewport).
import { chromium } from "playwright";


const [mockPath, url, name] = process.argv.slice(2);
const outDir = new URL("../screenshots/mock-diff/", import.meta.url).pathname;
// The Playwright version resolved from here may not match the downloaded
// browser build, so point at whichever headless shell is installed.
const executablePath = process.env.CHROME_PATH
const browser = await chromium.launch(executablePath === undefined ? {} : { executablePath });
const context = await browser.newContext({
	viewport: { width: 1440, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: "light",
	reducedMotion: "reduce",
});
const page = await context.newPage();
await page.goto(`file://${mockPath}`)
await page.screenshot({ path: `${outDir}${name}-mock.png`, fullPage: process.env.FULL_PAGE === '1' });
// With STATIC_DIR set, answer the app's requests from a built client bundle
// instead of a running server (index.html for every route, 401 for /api).
const staticDir = process.env.STATIC_DIR
if (staticDir !== undefined) {
  const { readFile } = await import('node:fs/promises')
  await page.route('**/*', async (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/api/me') {
      // Signed-in header for the page shots. Mirrors the mock's 田中 美咲.
      const me = { id: 'usr_1', handle: 'misaki_t', display_name: '田中 美咲', avatar_url: null, role: 'admin', created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z', cf_access_email: 'misaki@example.com' }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(me) })
      return
    }
    if (pathname.startsWith('/api/')) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"code":"unauthenticated","message":"x"}}' })
      return
    }
    const file = pathname.startsWith('/assets/') ? pathname : '/index.html'
    const body = await readFile(`${staticDir}${file}`).catch(() => null)
    if (body === null) {
      await route.fulfill({ status: 404, body: '' })
      return
    }
    const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'
    await route.fulfill({ status: 200, contentType: type, body })
  })
}
await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(1500)
await page.screenshot({ path: `${outDir}${name}-actual.png`, timeout: 20000, fullPage: process.env.FULL_PAGE === '1' });
// Diff in the browser: sharp's native module stalls under bun here.
const { readFile, writeFile } = await import('node:fs/promises')
const toDataUrl = async (path) => `data:image/png;base64,${(await readFile(path)).toString('base64')}`
await page.unroute('**/*')
await page.goto('about:blank')
const result = await page.evaluate(
  async ([mockUrl, actualUrl]) => {
    const load = (src) =>
      new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
      })
    const [m, a] = await Promise.all([load(mockUrl), load(actualUrl)])
    const w = m.naturalWidth
    const h = m.naturalHeight
    const draw = (img) => {
      const c = new OffscreenCanvas(w, h)
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      return ctx.getImageData(0, 0, w, h).data
    }
    const M = draw(m)
    const A = draw(a)
    const out = new OffscreenCanvas(w, h)
    const octx = out.getContext('2d')
    const od = octx.createImageData(w, h)
    let count = 0
    for (let i = 0; i < w * h; i++) {
      const o = i * 4
      const d = Math.max(Math.abs(M[o] - A[o]), Math.abs(M[o + 1] - A[o + 1]), Math.abs(M[o + 2] - A[o + 2]))
      const hit = d > 25
      const g = (M[o] * 0.3 + 178) | 0
      od.data[o] = hit ? 255 : g
      od.data[o + 1] = hit ? 0 : g
      od.data[o + 2] = hit ? 0 : g
      od.data[o + 3] = 255
      if (hit) count++
    }
    octx.putImageData(od, 0, 0)
    const blob = await out.convertToBlob({ type: 'image/png' })
    const buf = new Uint8Array(await blob.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000))
    }
    return { count, total: w * h, png: btoa(bin) }
  },
  [await toDataUrl(`${outDir}${name}-mock.png`), await toDataUrl(`${outDir}${name}-actual.png`)],
)
await browser.close()
await writeFile(`${outDir}${name}-diff.png`, Buffer.from(result.png, 'base64'))
console.log(`${name}: ${((result.count / result.total) * 100).toFixed(2)}%`)
