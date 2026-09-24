// Crop the same region out of a mock/actual pair and stack them for a look.
import { chromium } from 'playwright'
import { readFile, writeFile } from 'node:fs/promises'
const [name, x, y, w, h] = process.argv.slice(2)
const dir = new URL('../screenshots/mock-diff/', import.meta.url).pathname
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH })
const p = await b.newPage()
const urls = await Promise.all(['mock', 'actual'].map(async (k) => `data:image/png;base64,${(await readFile(`${dir}${name}-${k}.png`)).toString('base64')}`))
const png = await p.evaluate(async ([urls, x, y, w, h]) => {
  const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src })
  const imgs = await Promise.all(urls.map(load))
  const c = new OffscreenCanvas(w, h * 2 + 4)
  const ctx = c.getContext('2d')
  ctx.fillStyle = 'red'; ctx.fillRect(0, 0, w, h * 2 + 4)
  imgs.forEach((img, i) => ctx.drawImage(img, x, y, w, h, 0, i * (h + 4), w, h))
  const blob = await c.convertToBlob({ type: 'image/png' })
  const buf = new Uint8Array(await blob.arrayBuffer())
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000))
  return btoa(s)
}, [urls, +x, +y, +w, +h])
await b.close()
await writeFile(`${dir}${name}-crop.png`, Buffer.from(png, 'base64'))
