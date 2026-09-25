// Drag-to-zoom of one comparison chart (project-jobs-compare.html
// `.chart-brush`): a pixel rectangle tracked while the pointer is down
// inside the plot, turned into an exact domain per axis on release
// (lib/chart-geometry.ts `dragToDomain`). Local to one chart instance, so
// the grid figure and the enlarged dialog each keep their own zoom.
// `resetKey` (the log toggles) clears it on change — compared during render
// rather than in an effect, so the reset is visible on the same paint — and
// so does a double-click or the explicit reset wired to "ズームを戻す".
// `update` is the fullscreen dialog's pan, wheel and pinch
// (hooks/use-chart-pan-zoom.ts), applied to the latest domain so events
// arriving between renders still add up.
import { useCallback, useState } from 'react'
import { dragToDomain, type PixelRect, type PlotBox } from '../lib/chart-geometry'
import type { AxisDomain } from '../lib/chart-scale'

export interface ChartZoom {
  /** Overrides the base domain while zoomed in. */
  domain: { x: AxisDomain; y: AxisDomain } | null
  zoomed: boolean
  /** The drag rectangle in plot pixels while the pointer is down, else null. */
  drag: PixelRect | null
  onDragStart: (x: number, y: number) => void
  onDragMove: (x: number, y: number) => void
  /** `tickCount` carries the chart's tick density into the zoomed-in domain (lib/chart-geometry.ts `dragToDomain`). */
  onDragEnd: (box: PlotBox, xDomain: AxisDomain, yDomain: AxisDomain, tickCount?: number) => void
  reset: () => void
  /** Replaces the domain with `next` of the current one (`base` while not yet zoomed). */
  update: (
    next: (current: { x: AxisDomain; y: AxisDomain }) => { x: AxisDomain; y: AxisDomain },
    base: { x: AxisDomain; y: AxisDomain },
  ) => void
  /** Drops an in-progress drag rectangle without zooming, e.g. when a second finger lands. */
  cancelDrag: () => void
}

interface ZoomState {
  resetKey: unknown
  domain: { x: AxisDomain; y: AxisDomain } | null
  drag: PixelRect | null
}

const initialState = (resetKey: unknown): ZoomState => ({ resetKey, domain: null, drag: null })

export function useChartZoom(resetKey: unknown): ChartZoom {
  const [state, setState] = useState<ZoomState>(() => initialState(resetKey))
  const current = state.resetKey === resetKey ? state : initialState(resetKey)
  if (state.resetKey !== resetKey) {
    setState(current)
  }
  const { domain, drag } = current

  const onDragStart = useCallback((x: number, y: number) => {
    setState((current) => ({ ...current, drag: { x0: x, y0: y, x1: x, y1: y } }))
  }, [])

  const onDragMove = useCallback((x: number, y: number) => {
    setState((current) =>
      current.drag === null ? current : { ...current, drag: { ...current.drag, x1: x, y1: y } },
    )
  }, [])

  const onDragEnd = useCallback(
    (box: PlotBox, xDomain: AxisDomain, yDomain: AxisDomain, tickCount?: number) => {
      setState((current) => {
        if (current.drag === null) {
          return current
        }
        const next = dragToDomain(current.drag, xDomain, yDomain, box, tickCount)
        return { ...current, domain: next === null ? current.domain : next, drag: null }
      })
    },
    [],
  )

  const reset = useCallback(() => setState((current) => ({ ...current, domain: null })), [])

  const update = useCallback<ChartZoom['update']>((next, base) => {
    setState((current) => ({
      ...current,
      domain: next(current.domain === null ? base : current.domain),
    }))
  }, [])

  const cancelDrag = useCallback(() => setState((current) => ({ ...current, drag: null })), [])

  return {
    domain,
    zoomed: domain !== null,
    drag,
    onDragStart,
    onDragMove,
    onDragEnd,
    reset,
    update,
    cancelDrag,
  }
}
