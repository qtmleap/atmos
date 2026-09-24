// Throwaway harness: open a page at 1440x900 and print, for every recharts
// Y axis, the axis width and each tick label with its rendered text width,
// plus the requests the page made. Used to check that axis labels fit.
//   cd apps/web && bun ../../scripts/measure-chart-ticks.mjs <url>
import { chromium } from 'playwright'

const [url] = process.argv.slice(2)
const executablePath = process.env.CHROME_PATH
const browser = await chromium.launch(executablePath === undefined ? {} : { executablePath })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
  reducedMotion: 'reduce',
})
const page = await context.newPage()
const requests = []
page.on('request', (request) => {
  const { pathname } = new URL(request.url())
  if (pathname.startsWith('/api/')) {
    requests.push(pathname)
  }
})
await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(1500)
const result = await page.evaluate(() => {
  const axes = [...document.querySelectorAll('.recharts-yAxis')]
  return axes.map((axis) => {
    const ticks = [...axis.querySelectorAll('text')]
    const svg = axis.closest('svg')
    return {
      svgLeft: svg.getBoundingClientRect().left,
      ticks: ticks.map((tick) => {
        const box = tick.getBoundingClientRect()
        return {
          text: tick.textContent,
          left: box.left - svg.getBoundingClientRect().left,
          width: box.width,
          fontSize: getComputedStyle(tick).fontSize,
          fontFamily: getComputedStyle(tick).fontFamily,
        }
      }),
    }
  })
})
console.log(JSON.stringify(result, null, 1))
console.log('api requests:', requests)
await browser.close()
