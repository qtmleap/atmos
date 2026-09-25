// Pointer, wheel and pinch handling of the fullscreen chart
// (components/project/chart-dialog.tsx), on top of use-chart-zoom.ts. One
// pointer drags: in 'pan' mode it moves the domain, in 'brush' mode it draws
// the zoom rectangle as the grid chart does. Two pointers pinch about their
// midpoint and move with it, in either mode. The wheel (and a trackpad
// pinch, which arrives as a wheel event with ctrlKey) zooms about the
// cursor; it needs a non-passive listener to stop the page zooming, hence
// `wheelRef` rather than a React prop. The domain math is
// lib/chart-pan-zoom.ts.
import {
  type PointerEvent as ReactPointerEvent,
  type RefCallback,
  useCallback,
  useRef,
} from 'react'
import type { PlotBox } from '../lib/chart-geometry'
import { panDomain, scaleDomain, wheelFactor } from '../lib/chart-pan-zoom'
import type { AxisDomain } from '../lib/chart-scale'
import type { ChartZoom } from './use-chart-zoom'

export type DragMode = 'pan' | 'brush'

interface Point {
  x: number
  y: number
}

/** Each handler returns true when it took the event, so the caller skips its own brush and hover. */
export interface ChartPanZoom {
  wheelRef: RefCallback<Element>
  onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => boolean
  onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => boolean
  onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => boolean
}

const localPoint = (event: { clientX: number; clientY: number }, element: Element): Point => {
  const rect = element.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)

/** Position within the plot, 0 at left/bottom and 1 at right/top, not clamped. */
const unitOf = (point: Point, box: PlotBox): Point => ({
  x: (point.x - box.left) / (box.right - box.left),
  y: (box.bottom - point.y) / (box.bottom - box.top),
})

export function useChartPanZoom(
  zoom: ChartZoom,
  /** Undefined behaves as 'brush'. */
  mode: DragMode | undefined,
  box: PlotBox,
  base: { x: AxisDomain; y: AxisDomain },
  tickCount: number,
): ChartPanZoom {
  const pointers = useRef(new Map<number, Point>())
  // The wheel listener lives outside React's render, so it reads the latest
  // box and base through a ref instead of a stale closure.
  const latest = useRef({ zoom, box, base, tickCount })
  latest.current = { zoom, box, base, tickCount }

  /** Moves the domain so plot point `from` lands on `to`, scaled by `factor` about `to`. */
  const apply = useCallback((from: Point, to: Point, factor: number) => {
    const { zoom, box, base, tickCount } = latest.current
    const a = unitOf(from, box)
    const b = unitOf(to, box)
    zoom.update(
      (current) => ({
        x: scaleDomain(panDomain(current.x, a.x - b.x, tickCount), b.x, factor, tickCount),
        y: scaleDomain(panDomain(current.y, a.y - b.y, tickCount), b.y, factor, tickCount),
      }),
      base,
    )
  }, [])

  const wheelRef = useCallback<RefCallback<Element>>(
    (node) => {
      if (node === null) {
        return
      }
      const onWheel = (event: Event) => {
        if (!(event instanceof WheelEvent)) {
          return
        }
        event.preventDefault()
        const point = localPoint(event, node)
        apply(point, point, wheelFactor(event.deltaY))
      }
      node.addEventListener('wheel', onWheel, { passive: false })
      return () => node.removeEventListener('wheel', onWheel)
    },
    [apply],
  )

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>): boolean => {
    pointers.current.set(event.pointerId, localPoint(event, event.currentTarget))
    event.currentTarget.setPointerCapture(event.pointerId)
    if (pointers.current.size >= 2) {
      zoom.cancelDrag()
      return true
    }
    return mode === 'pan'
  }

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>): boolean => {
    const previous = pointers.current.get(event.pointerId)
    if (previous === undefined) {
      return false
    }
    const next = localPoint(event, event.currentTarget)
    const others = [...pointers.current].filter(([id]) => id !== event.pointerId)
    pointers.current.set(event.pointerId, next)
    const partner = others[0]?.[1]
    if (partner !== undefined) {
      const before = distance(previous, partner)
      const after = distance(next, partner)
      apply(midpoint(previous, partner), midpoint(next, partner), after > 0 ? before / after : 1)
      return true
    }
    if (mode === 'pan') {
      apply(previous, next, 1)
      return true
    }
    return false
  }

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>): boolean => {
    const wasPinch = pointers.current.size >= 2
    pointers.current.delete(event.pointerId)
    return wasPinch || pointers.current.size > 0 || mode === 'pan'
  }

  return {
    wheelRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
}
